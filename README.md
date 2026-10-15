# GAguessr

A map game about nuclear France. A site's name appears, and you drop a pin on a map of France's regions, rivers and major cities. The closer you land, the more you score: up to 5,000 points per site. A game covers every site of its mode once.

| Mode | Sites | What you place |
| --- | --- | --- |
| Nuclear power plants (`/play/fr-nuclear-plants`) | 18 | Every operating plant (57 reactors) |
| Research centres & reactors (`/play/fr-nuclear-research`) | 10 | CEA centres, research reactors (ILL, Orphée/Osiris, Jules Horowitz), prototypes (Superphénix, Brennilis), ITER, GANIL, the Andra lab at Bure |
| Military nuclear sites (`/play/fr-military-nuclear`) | 18 | Submarine bases and yards, CEA military applications centres, strike air bases, command and transmission sites, Cold War relics |

`/play` opens the power plants mode. Your best score per mode is kept in `localStorage`; there are no accounts and no server-side storage.

Built with Next.js 16 (App Router, Cache Components), React 19, `d3-geo` and `d3-zoom`. The map needs no API key.

Answers revealed in earlier rounds stay on the map until the game ends.

## Getting started

```bash
npm install
npm run dev   # http://localhost:3000
```

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MAP_TILES_URL` | TileJSON of an OpenMapTiles-schema tileset (default OpenFreeMap's `https://tiles.openfreemap.org/planet`). Point it at a self-hosted copy to stop depending on OpenFreeMap |
| `NEXT_PUBLIC_MAP_GLYPHS_URL` | Font glyphs for the labels (default OpenFreeMap's, Noto Sans Regular/Bold/Italic) |

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Unit tests + coverage gate (80%) on `lib/`, `game/` and `modes/` |
| `npm run test:e2e` | Playwright tests on desktop and mobile (run `npx playwright install chromium` once first) |
| `npm run lint` / `npm run typecheck` / `npm run build` | Static checks and production build |
| `npm run build:geo` | Regenerate `public/geo/france.json` (needs network) |

## Site photos

Each site shows a photo while you look for it (click it to enlarge it and see its credits); `/credits` lists them all. The photos come from Wikimedia Commons, under their own free licenses (CC BY-SA, CC BY, CC0, public domain).

`node scripts/fetch-site-photos.mjs` takes the lead photo of each site's French Wikipedia article (`wikipedia` field in the datasets) and saves a 960 px copy to `public/photos/<mode>/<site>.jpg`, plus size, author and license to `src/data/site-photos.json`. Already-downloaded sites are skipped. `OVERRIDES` in the script pins a Commons file by hand, or `null` when no free photo of the site exists. Seven sensitive sites (CEA Fontenay-aux-Roses, Valduc, DAM Île-de-France, CESTA, Gramat, Le Ripault, Pierrelatte) have none and show a placeholder. Check new photos by eye: a lead image can be a map that gives the answer away (ITER's was).

## Map rendering

- **MapLibre GL + OpenFreeMap.** The map is [MapLibre](https://maplibre.org) (WebGL) reading [OpenFreeMap](https://openfreemap.org)'s OpenStreetMap vector tiles (OpenMapTiles schema, zoom 0–14, over-zoomed to 18). No API key and no local tile download. MapLibre (~280 KB gzipped) is loaded only on the game pages.
- **The style is built in code** (`src/lib/map/style.ts`, colors in `palette.ts`). It shows régions, départements (borders and names), towns and villages, roads with motorway numbers, street names from zoom 12, rivers, lakes and seas. Left out because they would give answers away: points of interest, industrial and military land, airfields, buildings.
- **Spoiler filter:** many sites share their town's name (Flamanville, Chinon, Marcoule…). Town and village labels matching any run of words from any site name, in any mode, are hidden (`src/lib/map/spoilers.ts`), so a missing label never points at this round's answer. Large cities (OSM class `city`) stay as landmarks. Tests enforce this.
- **Overview from `france.json`:** below zoom 9, région and département names, département borders, major rivers and our 26 major cities come from `france.json` and `fr-cities.json`, then hand over to OpenStreetMap's data. Neighbouring countries are dimmed up to zoom 10.
- **Pins** are MapLibre markers (DOM elements), the guess–answer line is a GeoJSON layer. The camera frames each guess and its answer, then goes back to the whole of France.
- MapLibre's web worker is copied to `public/vendor/` on install, dev and build (`scripts/copy-maplibre-worker.mjs`), because bundlers do not resolve the worker URL MapLibre computes.
- Floating panels are near-opaque instead of using `backdrop-filter`, because blurring a moving map on every frame is expensive.

## Map data

| File | Content | Source |
| --- | --- | --- |
| `src/data/fr-nuclear-plants.json` | The 18 operating plants: coordinates, region, river or sea, reactor count | Hand-curated |
| `src/data/fr-nuclear-research.json`, `fr-military-nuclear.json` | Research and military sites: coordinates, region, department, role | Hand-curated from public sources (Wikipedia, CEA access maps). Positions are accurate to a few km, plenty for a 100 km scoring scale |
| `src/data/fr-cities.json` | 26 major French cities, drawn as labelled landmarks | Hand-curated coordinates |
| Vector tiles and fonts (remote) | OpenStreetMap, zoom 0–14; Noto Sans glyphs | [OpenFreeMap](https://openfreemap.org), [OpenMapTiles](https://openmaptiles.org) schema, © OpenStreetMap contributors (ODbL). Credited on the map |
| `public/geo/france.json` | Overview rivers, neighbouring countries, 13 régions and 96 départements with a label point each (régions are also used by the dataset tests) | Régions, départements: [france-geojson](https://github.com/gregoiredavid/france-geojson) (IGN/INSEE, Licence Ouverte). Rivers and neighbours: Natural Earth (public domain) |

`france.json` is generated by `npm run build:geo` (`scripts/build-france-geo.mjs`). The script downloads the sources, fixes ring winding for d3, keeps an allow-list of rivers, picks a label point well inside each région and département, and simplifies the result to about 260 KB. The output is committed.

## How scoring works

`score = round(5000 · e^(−distance / 100 km))`: the great-circle distance between your pin and the site. A guess 100 km away keeps about 37% of the points.

## Project layout

```
src/
├── app/                 # routes: home, /play/[mode], /credits
├── components/          # map (MapLibre + markers), hud, photo, summary, ui
├── data/                # static datasets (JSON)
├── game/                # pure game logic: reducer, scoring
├── hooks/               # useGame, useBestScore (localStorage)
├── lib/geo/             # distances, topology loading, France geography, city list
├── lib/map/             # MapLibre style (layer allow-list, palettes) and camera bounds
└── modes/               # game modes (datasets → targets) and their registry
```

## Adding a game mode

1. Add a dataset to `src/data/`. For a list of sites, use the `{ name, region, department, role, lat, lon }` shape and `buildSiteTargets` from `src/modes/sites.ts`. `fr-nuclear-sites.ts` shows two complete modes.
2. Append the mode to `GAME_MODES` in `src/modes/registry.ts`. The home page, and `/play/[mode]` pick it up automatically.
3. Add the dataset to `SITE_DATASETS` in `src/modes/modes.test.ts`. The tests check that every site lies in France and in its stated region.
