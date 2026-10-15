/**
 * Downloads one freely licensed photo per site from Wikimedia Commons.
 *
 * For each site, the photo is the lead image of its French Wikipedia article
 * (`wikipedia` field in the datasets), or the first suitable photo in the article
 * when the lead image is a logo, a map or a diagram. `OVERRIDES` pins a Commons
 * file by hand when the automatic pick is wrong.
 *
 * Output:
 * - public/photos/<modeId>/<siteId>.<ext>  (≈ 960 px wide thumbnails)
 * - src/data/site-photos.json              (size and attribution for each photo)
 *
 * Already-downloaded sites are skipped, so an interrupted run can be resumed.
 *
 * Usage: node scripts/fetch-site-photos.mjs [--only <modeId>/<siteId>] [--force]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DATASETS = {
  "fr-nuclear-plants": "src/data/fr-nuclear-plants.json",
  "fr-nuclear-research": "src/data/fr-nuclear-research.json",
  "fr-military-nuclear": "src/data/fr-military-nuclear.json",
};
const OUTPUT_JSON = "src/data/site-photos.json";
const THUMB_WIDTH = 960;
const USER_AGENT = "pinit-geo-game/0.1 (photo import script; local development)";

/**
 * `<modeId>/<siteId>` → Commons file name, for sites where the automatic pick is wrong,
 * or `null` when no freely licensed photo of the site itself exists (most military
 * sites cannot be photographed): the game then shows a placeholder.
 */
const OVERRIDES = {
  "fr-nuclear-research/institut-laue-langevin": "ILL Grenoble soleil.jpg",
  // The article's lead image is a satellite view with an arrow on the site: it would give the answer away.
  "fr-nuclear-research/iter": "ITER central building construction (41767823552).jpg",
  "fr-nuclear-research/cea-fontenay-aux-roses": null,
  "fr-military-nuclear/base-aerienne-de-saint-dizier": "Dassault Rafale C ‘142 - 4-GU’ (35408987672).jpg",
  "fr-military-nuclear/taverny": "Télécommunications de la base aérienne de Taverny dans la forêt de Montmorency.jpg",
  "fr-military-nuclear/ile-longue": "36 Ile Longue.jpg",
  "fr-military-nuclear/cea-valduc": null,
  "fr-military-nuclear/cea-dam-ile-de-france": null,
  "fr-military-nuclear/cea-cesta": null,
  "fr-military-nuclear/cea-gramat": null, // the article's photos show the town, not the centre
  "fr-military-nuclear/cea-le-ripault": null, // the article's photos are unrelated (a museum locomotive)
  "fr-military-nuclear/pierrelatte": null, // Commons only has maps of the site
};

/** File names that are almost never a photo of the site itself. */
const NOT_A_PHOTO =
  /logo|blason|insigne|badge|emblem|embl[eè]me|coa\b|coat.of.arms|flag|drapeau|icon|pictogram|map|carte|locator|localisation|plan[ _]|sch[eé]ma|diagram|\.svg$|\.gif$|\.tiff?$/i;

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REQUEST_GAP_MS = 1_200;
const MAX_ATTEMPTS = 5;

/** GET with a pause between requests, and exponential backoff on HTTP 429 / 5xx. */
async function politeFetch(url) {
  for (let attempt = 1; ; attempt++) {
    await sleep(REQUEST_GAP_MS);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    const retryable = res.status === 429 || res.status >= 500;
    if (res.ok || !retryable || attempt === MAX_ATTEMPTS) {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 2_000;
    console.warn(`  … HTTP ${res.status}, retrying in ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
}

async function getJson(url) {
  return (await politeFetch(url)).json();
}

function apiUrl(host, params) {
  return `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
}

/** Lead image and the list of images used in a French Wikipedia article. */
async function articleImages(title) {
  const data = await getJson(
    apiUrl("fr.wikipedia.org", {
      action: "query",
      titles: title,
      redirects: "1",
      prop: "pageimages|images",
      piprop: "name",
      imlimit: "100",
    }),
  );
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`No French Wikipedia article "${title}"`);
  return {
    lead: page.pageimage ?? null,
    others: (page.images ?? []).map((img) => img.title.replace(/^(Fichier|File):/, "")),
  };
}

function pickFile({ lead, others }) {
  if (lead && !NOT_A_PHOTO.test(lead)) return lead;
  return others.find((name) => /\.(jpe?g|png)$/i.test(name) && !NOT_A_PHOTO.test(name)) ?? null;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function commonsInfo(fileName) {
  const data = await getJson(
    apiUrl("commons.wikimedia.org", {
      action: "query",
      titles: `File:${fileName}`,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: String(THUMB_WIDTH),
    }),
  );
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error(`No Commons file "${fileName}"`);
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    author: stripHtml(meta.Artist?.value ?? "Auteur inconnu"),
    license: stripHtml(meta.LicenseShortName?.value ?? "Licence inconnue"),
    licenseUrl: meta.LicenseUrl?.value ?? null,
    sourceUrl: info.descriptionurl,
  };
}

async function download(url, path) {
  const res = await politeFetch(url);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : null;
  const force = process.argv.includes("--force") || only !== null;

  let existing = {};
  try {
    existing = JSON.parse(readFileSync(OUTPUT_JSON, "utf8"));
  } catch {
    // First run.
  }
  const photos = { ...existing };
  const failures = [];

  for (const [modeId, file] of Object.entries(DATASETS)) {
    for (const site of JSON.parse(readFileSync(file, "utf8"))) {
      const key = `${modeId}/${slugify(site.name)}`;
      if (only && key !== only) continue;
      if (OVERRIDES[key] === null) {
        if (photos[key]) rmSync(join("public", photos[key].src), { force: true });
        delete photos[key];
        console.log(`– ${key}: no free photo (placeholder)`);
        continue;
      }
      const isOverridden = key in OVERRIDES && photos[key]?.commonsFile !== OVERRIDES[key];
      if (!force && photos[key] && !isOverridden) continue;
      try {
        const fileName = OVERRIDES[key] ?? pickFile(await articleImages(site.wikipedia));
        if (!fileName) throw new Error(`no suitable photo in "${site.wikipedia}"`);
        const info = await commonsInfo(fileName);
        const ext = info.url.match(/\.(jpe?g|png)(?:$|\?)/i)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "jpg";
        const src = `/photos/${key}.${ext}`;
        await download(info.url, join("public", src));
        photos[key] = {
          src,
          width: info.width,
          height: info.height,
          commonsFile: fileName,
          author: info.author,
          license: info.license,
          licenseUrl: info.licenseUrl,
          sourceUrl: info.sourceUrl,
        };
        console.log(`✓ ${key} ← ${fileName}`);
      } catch (error) {
        failures.push(key);
        console.error(`✗ ${key}: ${error.message}`);
      }
    }
  }

  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUTPUT_JSON, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`\n${Object.keys(sorted).length} photos in ${OUTPUT_JSON}, ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}

await main();
