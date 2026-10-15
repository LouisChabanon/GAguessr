/**
 * Downloads one freely licensed photo per site from Wikimedia Commons.
 *
 * For each site, the photo is the lead image of its Wikipedia article (`wikipedia`
 * field in the datasets: French Wikipedia for French sites, English Wikipedia for the
 * world's power stations), or the first suitable photo in the article
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

/** Each mode's dataset, the Wikipedia its `wikipedia` titles belong to, and how the mode ids its sites. */
const DATASETS = {
  "fr-nuclear-plants": { file: "src/data/fr-nuclear-plants.json", wiki: "fr", siteId: (site) => slugify(site.name) },
  "fr-nuclear-research": { file: "src/data/fr-nuclear-research.json", wiki: "fr", siteId: (site) => slugify(site.name) },
  "fr-military-nuclear": { file: "src/data/fr-military-nuclear.json", wiki: "fr", siteId: (site) => slugify(site.name) },
  // Same id as buildWorldPlantTargets in src/modes/world-nuclear-plants.ts.
  "world-nuclear-plants": {
    file: "src/data/world-nuclear-plants.json",
    wiki: "en",
    siteId: (site) => slugify(`${site.countryCode} ${site.name}`),
    // French stations reuse the French mode's photos, already checked by eye, rather than downloading copies.
    reuseFrom: "fr-nuclear-plants",
  },
};
/** A site reuses a photo from `reuseFrom` when the two lie this close. */
const REUSE_DISTANCE_KM = 5;
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
  "world-nuclear-plants/jp-sendai": "Sendai 04780025 (8388173285) (cropped).jpg", // the lead image is mostly sky
  "world-nuclear-plants/ru-leningrad-ii": "LAES2-Jan2016.jpg", // the article shares the old plant's photo
  "world-nuclear-plants/pk-karachi": null, // the article only shows a fuel bundle
  // No free photo of these stations on Commons (most Chinese stations have none).
  "world-nuclear-plants/pk-chashma": null,
  "world-nuclear-plants/cn-changjiang": null, // only a satellite image
  "world-nuclear-plants/cn-fangchenggang": null,
  "world-nuclear-plants/cn-fangjiashan": null,
  "world-nuclear-plants/cn-fuqing": null,
  "world-nuclear-plants/cn-hongyanhe": null,
  "world-nuclear-plants/cn-ling-ao": null,
  "world-nuclear-plants/cn-ningde": null,
  "world-nuclear-plants/cn-shidao-bay": null,
  "world-nuclear-plants/us-waterford": null,
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

/** Lead image and the list of images used in a Wikipedia article (a `#section` anchor is dropped). */
async function articleImages(wiki, title) {
  const data = await getJson(
    apiUrl(`${wiki}.wikipedia.org`, {
      action: "query",
      titles: title.split("#")[0],
      redirects: "1",
      prop: "pageimages|images",
      piprop: "name",
      imlimit: "100",
    }),
  );
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error(`No ${wiki} Wikipedia article "${title}"`);
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

function haversineKm([lon1, lat1], [lon2, lat2]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Key of the `reuseFrom` site at the same place as `site`, if any. */
function sameSiteKey(site, reuseFrom) {
  const { file, siteId } = DATASETS[reuseFrom];
  const match = JSON.parse(readFileSync(file, "utf8")).find(
    (other) => haversineKm([site.lon, site.lat], [other.lon, other.lat]) <= REUSE_DISTANCE_KM,
  );
  return match ? `${reuseFrom}/${siteId(match)}` : null;
}

/** Deletes a photo file unless another entry still points at it. */
function removePhotoFile(photos, key) {
  const { src } = photos[key];
  if (!Object.entries(photos).some(([other, photo]) => other !== key && photo.src === src)) {
    rmSync(join("public", src), { force: true });
  }
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

  for (const [modeId, { file, wiki, siteId, reuseFrom }] of Object.entries(DATASETS)) {
    for (const site of JSON.parse(readFileSync(file, "utf8"))) {
      const key = `${modeId}/${siteId(site)}`;
      if (only && key !== only) continue;
      const reusedKey = reuseFrom ? sameSiteKey(site, reuseFrom) : null;
      if (reusedKey && photos[reusedKey]) {
        if (photos[key] && photos[key].src !== photos[reusedKey].src) removePhotoFile(photos, key);
        photos[key] = photos[reusedKey];
        console.log(`= ${key} ← ${reusedKey}`);
        continue;
      }
      if (OVERRIDES[key] === null) {
        if (photos[key]) removePhotoFile(photos, key);
        delete photos[key];
        console.log(`– ${key}: no free photo (placeholder)`);
        continue;
      }
      const isOverridden = key in OVERRIDES && photos[key]?.commonsFile !== OVERRIDES[key];
      if (!force && photos[key] && !isOverridden) continue;
      try {
        const fileName = OVERRIDES[key] ?? pickFile(await articleImages(wiki, site.wikipedia));
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
