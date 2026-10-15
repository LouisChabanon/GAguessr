#!/usr/bin/env node
/**
 * Builds src/data/world-nuclear-plants.json: every nuclear power station in service
 * in the world, one entry per site.
 *
 * Source: the "In service" table of English Wikipedia's "List of nuclear power
 * stations" (itself based on the IAEA's PRIS, long-term shut-down Japanese reactors
 * included), pinned to one revision so the output is reproducible.
 *
 * The table's coordinates are hand-copied and some are wrong (Novovoronezh II once
 * carried Leningrad II's), so each station takes the coordinates of its own Wikipedia
 * article when it has some. Stations where the two disagree by more than
 * `MISMATCH_KM` are reported, to be checked by hand and pinned in `OVERRIDES`.
 *
 * Usage: node scripts/build-world-plants.mjs   (needs network; the output is committed)
 */
import { writeFileSync } from "node:fs";

const OUT = "src/data/world-nuclear-plants.json";
const API = "https://en.wikipedia.org/w/api.php";
const LIST_REVISION = 1372389410;
const USER_AGENT = "gaguessr/0.1 (world nuclear plants import script; local development)";
const MISMATCH_KM = 15;
const TITLES_PER_QUERY = 50;

/** Country as the table's {{Flag}} names it → ISO 3166 code (French names come from Intl). */
const COUNTRY_CODES = {
  Argentina: "AR", Armenia: "AM", Belarus: "BY", Belgium: "BE", Brazil: "BR", Bulgaria: "BG",
  Canada: "CA", China: "CN", "Czech Republic": "CZ", Finland: "FI", France: "FR", Hungary: "HU",
  India: "IN", Iran: "IR", Japan: "JP", Mexico: "MX", Netherlands: "NL", Pakistan: "PK",
  Romania: "RO", Russia: "RU", Slovakia: "SK", Slovenia: "SI", "South Africa": "ZA",
  "South Korea": "KR", Spain: "ES", Sweden: "SE", Switzerland: "CH", Taiwan: "TW",
  UAE: "AE", Ukraine: "UA", "United Kingdom": "GB", "United States": "US",
};

/**
 * Hand fixes, by the station's name in the table, checked against the station's article
 * and satellite imagery. `lat`/`lon` pin the coordinates; `name` renames the station.
 */
const OVERRIDES = {
  // The table once carried Leningrad II's coordinates; these are the article's, checked on imagery.
  "Novovoronezh II": { lat: 51.265, lon: 39.2115 },
  ANO: { name: "Arkansas Nuclear One" },
  "Sizewell-B": { name: "Sizewell B" },
};

const frenchCountryNames = new Intl.DisplayNames(["fr"], { type: "region" });

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

/** Splits wikitext on `sep` outside of {{templates}} and [[links]]. */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      current += pair;
      i++;
    } else if (pair === "}}" || pair === "]]") {
      depth--;
      current += pair;
      i++;
    } else if (text[i] === sep && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += text[i];
    }
  }
  parts.push(current);
  return parts;
}

/** {{Coord|lat|lon}}, {{Coord|d|m|s|N|d|m|s|E}} or {{Coord|d|m|N|d|m|E}} → [lon, lat]; null for {{Coord|qid=…}}. */
export function parseCoord(cell) {
  const match = cell.match(/\{\{coord\|([^}]*)\}\}/i);
  if (!match) return null;
  const params = match[1].split("|").map((p) => p.trim()).filter((p) => p && !p.includes("="));
  const hemispheres = params.filter((p) => /^[NSEW]$/.test(p));
  if (hemispheres.length === 0) {
    const [lat, lon] = params.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
  }
  const toDecimal = (parts) => parts.reduce((sum, value, i) => sum + Number(value) / 60 ** i, 0);
  const latEnd = params.findIndex((p) => p === "N" || p === "S");
  const lonEnd = params.findIndex((p) => p === "E" || p === "W");
  const lat = toDecimal(params.slice(0, latEnd)) * (params[latEnd] === "S" ? -1 : 1);
  const lon = toDecimal(params.slice(latEnd + 1, lonEnd)) * (params[lonEnd] === "W" ? -1 : 1);
  return [lon, lat];
}

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function parseRow(row) {
  const clean = row.replace(/<ref[^>]*\/>|<ref[^>]*>.*?<\/ref>/gs, "").replace(/\n/g, " ");
  const cells = splitTopLevel(clean, "|").map((c) => c.trim()).filter(Boolean);
  const [nameCell, unitsCell, capacityCell, countryCell, coordCell, sinceCell] = cells;
  const link = nameCell?.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const country = countryCell?.match(/\{\{flag\|([^}|]+)/i)?.[1].trim();
  if (!link || !country) throw new Error(`Unparsed row: ${clean.slice(0, 160)}`);
  const code = COUNTRY_CODES[country];
  if (!code) throw new Error(`No country code for "${country}"; add it to COUNTRY_CODES`);
  return {
    name: (link[2] ?? link[1]).trim(),
    article: link[1].trim(),
    reactors: Number(unitsCell),
    capacityMw: Number(capacityCell.match(/\d[\d,]*/)?.[0].replace(/,/g, "")),
    country: frenchCountryNames.of(code),
    countryCode: code,
    tableCoords: parseCoord(coordCell),
    since: Number(sinceCell?.match(/\d{4}/)?.[0]),
  };
}

async function fetchStations() {
  const { parse } = await api({ action: "parse", oldid: String(LIST_REVISION), prop: "wikitext" });
  const section = parse.wikitext.split(/^== In service ==/m)[1]?.split(/^==[^=]/m)[0];
  if (!section) throw new Error('No "In service" section in the list');
  // Rows start with `|-`; the first chunk is the table opening, the second its header.
  return section.split(/^\|-/m).slice(2).filter((row) => row.includes("[[")).map(parseRow);
}

/** Article title → [lon, lat] of the article's primary coordinates, following redirects. */
async function fetchArticleCoords(titles) {
  const coords = new Map();
  for (let i = 0; i < titles.length; i += TITLES_PER_QUERY) {
    const batch = titles.slice(i, i + TITLES_PER_QUERY);
    const { query } = await api({ action: "query", prop: "coordinates", titles: batch.join("|"), redirects: "1", colimit: "max" });
    const resolve = new Map(batch.map((t) => [t, t]));
    for (const step of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
      for (const [original, current] of resolve) if (current === step.from) resolve.set(original, step.to);
    }
    const byTitle = new Map(query.pages.map((page) => [page.title, page.coordinates?.find((c) => c.primary) ?? page.coordinates?.[0]]));
    for (const [original, resolved] of resolve) {
      const c = byTitle.get(resolved);
      if (c) coords.set(original, [c.lon, c.lat]);
    }
  }
  return coords;
}

const round = (value) => Math.round(value * 1e4) / 1e4;

const stations = await fetchStations();
const articleCoords = await fetchArticleCoords([...new Set(stations.map((s) => s.article))]);

const plants = stations.map(({ tableCoords, article, ...station }) => {
  const override = OVERRIDES[station.name] ?? {};
  const fromArticle = articleCoords.get(article);
  if (fromArticle && tableCoords && haversineKm(fromArticle, tableCoords) > MISMATCH_KM && !override.lat) {
    console.warn(`⚠ ${station.name}: table and article disagree by ${Math.round(haversineKm(fromArticle, tableCoords))} km`);
  }
  const coords = override.lat !== undefined ? [override.lon, override.lat] : (fromArticle ?? tableCoords);
  if (!coords) throw new Error(`No coordinates for ${station.name}; pin them in OVERRIDES`);
  return {
    ...station,
    name: override.name ?? station.name,
    lat: round(coords[1]),
    lon: round(coords[0]),
    wikipedia: article,
  };
});

plants.sort((a, b) => a.name.localeCompare(b.name, "fr"));
writeFileSync(OUT, `[\n${plants.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n]\n`);
console.log(`${plants.length} stations, ${plants.reduce((n, p) => n + p.reactors, 0)} reactors → ${OUT}`);
