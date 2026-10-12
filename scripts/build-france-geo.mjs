#!/usr/bin/env node
/**
 * Builds public/geo/france.json: a TopoJSON with metropolitan France's regions,
 * its major rivers and the neighbouring countries, for the France map.
 *
 * Sources:
 * - Regions: github.com/gregoiredavid/france-geojson (IGN/INSEE, Licence Ouverte)
 * - Rivers: Natural Earth 10m rivers (public domain)
 * - Neighbours: world-atlas 1:50m (Natural Earth, public domain)
 *
 * Run with `npm run build:geo`; the output is committed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { geoArea, geoBounds } from "d3-geo";
import { feature as topoFeature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";

const OUT = "public/geo/france.json";
const REGIONS_URL =
  "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-version-simplifiee.geojson";
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const RIVER_URLS = [`${NE}/ne_10m_rivers_lake_centerlines.geojson`, `${NE}/ne_10m_rivers_europe.geojson`];

/** West, south, east, north: generous box around metropolitan France. */
const BBOX = [-6, 41, 10.5, 51.5];
/** Share of the least significant arc points dropped when simplifying. */
const SIMPLIFY_QUANTILE = 0.35;

/** Natural Earth name (some badly encoded) → French display name. */
const RIVER_NAMES = new Map([
  ["Loire", "Loire"],
  ["Seine", "Seine"],
  ["Rhône", "Rhône"],
  ["Rhne", "Rhône"],
  ["Garonne", "Garonne"],
  ["Maas", "Meuse"],
  ["Meuse", "Meuse"],
  ["Mosel", "Moselle"],
  ["Moselle", "Moselle"],
  ["Vienne", "Vienne"],
  ["Dordogne", "Dordogne"],
  ["Saône", "Saône"],
  ["Sane", "Saône"],
  ["Allier", "Allier"],
  ["Cher", "Cher"],
  ["Marne", "Marne"],
  ["Rhin", "Rhin"],
  ["Rhein", "Rhin"],
  ["Rhine", "Rhin"],
  ["Lot", "Lot"],
  ["Tarn", "Tarn"],
  ["Durance", "Durance"],
  ["Doubs", "Doubs"],
  ["Yonne", "Yonne"],
  ["Charente", "Charente"],
  ["Somme", "Somme"],
  ["Creuse", "Creuse"],
  ["Adour", "Adour"],
  ["Vilaine", "Vilaine"],
  ["Sarthe", "Sarthe"],
]);

/** Rivers drawn with a heavier stroke. */
const MAJOR_RIVERS = new Set(["Loire", "Seine", "Rhône", "Garonne", "Rhin"]);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

function pointInBBox([lon, lat], [w, s, e, n]) {
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

function boundsIntersect(feature, [w, s, e, n]) {
  const [[x0, y0], [x1, y1]] = geoBounds(feature);
  return x0 <= e && x1 >= w && y0 <= n && y1 >= s;
}

/** d3-geo needs clockwise exterior rings; GeoJSON (RFC 7946) uses the opposite. */
function rewind(feature) {
  const fix = (polygon) =>
    geoArea({ type: "Polygon", coordinates: polygon }) > 2 * Math.PI
      ? polygon.map((ring) => [...ring].reverse())
      : polygon;
  const { geometry } = feature;
  const coordinates =
    geometry.type === "Polygon" ? fix(geometry.coordinates) : geometry.coordinates.map(fix);
  return { ...feature, geometry: { ...geometry, coordinates } };
}

/** Splits lines into runs of points inside the box (drops the parts far outside France). */
function clipLines(lines, bbox) {
  return lines.flatMap((line) => {
    const runs = [];
    let run = [];
    for (const point of line) {
      if (pointInBBox(point, bbox)) {
        run.push(point);
      } else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);
    return runs;
  });
}

async function buildRegions() {
  const geojson = await fetchJson(REGIONS_URL);
  return geojson.features.map((f) =>
    rewind({ type: "Feature", properties: { code: f.properties.code, name: f.properties.nom }, geometry: f.geometry }),
  );
}

async function buildRivers() {
  const collections = await Promise.all(RIVER_URLS.map(fetchJson));
  const linesByName = new Map();
  for (const f of collections.flatMap((c) => c.features)) {
    const name = RIVER_NAMES.get(f.properties?.name);
    if (!name || !f.geometry) continue;
    const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
    linesByName.set(name, [...(linesByName.get(name) ?? []), ...clipLines(lines, BBOX)]);
  }
  return [...linesByName]
    .filter(([, lines]) => lines.length > 0)
    .map(([name, lines]) => ({
      type: "Feature",
      properties: { name, major: MAJOR_RIVERS.has(name) },
      geometry: { type: "MultiLineString", coordinates: lines },
    }));
}

function buildNeighbours() {
  const atlas = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
  return topoFeature(atlas, atlas.objects.countries)
    .features.filter((f) => f.properties.name !== "France" && boundsIntersect(f, BBOX))
    .map((f) => ({ type: "Feature", properties: { name: f.properties.name }, geometry: f.geometry }));
}

const [regions, rivers] = await Promise.all([buildRegions(), buildRivers()]);
const neighbours = buildNeighbours();

const topo = topology(
  {
    regions: { type: "FeatureCollection", features: regions },
    rivers: { type: "FeatureCollection", features: rivers },
    neighbours: { type: "FeatureCollection", features: neighbours },
  },
  1e5,
);
const presimplified = presimplify(topo);
const simplified = simplify(presimplified, quantile(presimplified, SIMPLIFY_QUANTILE));
writeFileSync(OUT, JSON.stringify(simplified));

const kb = (JSON.stringify(simplified).length / 1024).toFixed(0);
console.log(`${OUT}: ${kb} KB`);
console.log(`  regions (${regions.length}): ${regions.map((r) => r.properties.name).join(", ")}`);
console.log(`  rivers (${rivers.length}): ${rivers.map((r) => r.properties.name).join(", ")}`);
console.log(`  neighbours (${neighbours.length}): ${neighbours.map((n) => n.properties.name).join(", ")}`);
