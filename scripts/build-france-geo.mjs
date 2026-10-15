#!/usr/bin/env node
/**
 * Builds public/geo/france.json: a TopoJSON with metropolitan France's regions and
 * départements, with a label point for each, for the France map.
 *
 * Sources:
 * - Regions, départements: github.com/gregoiredavid/france-geojson (IGN/INSEE, Licence Ouverte)
 *
 * Run with `npm run build:geo`; the output is committed.
 */
import { writeFileSync } from "node:fs";
import { geoArea, geoBounds } from "d3-geo";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";

const OUT = "public/geo/france.json";
const FRANCE_GEOJSON = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master";
const REGIONS_URL = `${FRANCE_GEOJSON}/regions-version-simplifiee.geojson`;
const DEPARTEMENTS_URL = `${FRANCE_GEOJSON}/departements-version-simplifiee.geojson`;

/** Share of the least significant arc points dropped when simplifying. */
const SIMPLIFY_QUANTILE = 0.35;
/** Candidate points per side when searching for a label point inside a polygon. */
const LABEL_GRID = 48;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
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

async function buildRegions() {
  const geojson = await fetchJson(REGIONS_URL);
  return geojson.features.map((f) =>
    rewind({ type: "Feature", properties: { code: f.properties.code, name: f.properties.nom }, geometry: f.geometry }),
  );
}

async function buildDepartements() {
  const geojson = await fetchJson(DEPARTEMENTS_URL);
  return geojson.features.map((f) =>
    rewind({ type: "Feature", properties: { code: f.properties.code, name: f.properties.nom }, geometry: f.geometry }),
  );
}

/** Squared distance from p to segment ab, in a plane where x is scaled by cos(latitude). */
function segmentDistance2([px, py], [ax, ay], [bx, by], kx) {
  const dx = (bx - ax) * kx;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (((px - ax) * kx) * dx + (py - ay) * dy) / len2));
  const ex = (px - ax) * kx - t * dx;
  const ey = py - ay - t * dy;
  return ex * ex + ey * ey;
}

function insideRings([x, y], rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * A point well inside the largest polygon of a feature (an approximate pole of
 * inaccessibility), so labels never sit on a border or in the sea like centroids can.
 */
function labelPoint(feature) {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const largest = polygons.reduce((a, b) =>
    geoArea({ type: "Polygon", coordinates: a }) >= geoArea({ type: "Polygon", coordinates: b }) ? a : b,
  );
  const [[w, s], [e, n]] = geoBounds({ type: "Polygon", coordinates: largest });
  const kx = Math.cos((((s + n) / 2) * Math.PI) / 180);
  let best = null;
  let bestDistance = -1;
  for (let i = 0; i <= LABEL_GRID; i++) {
    for (let j = 0; j <= LABEL_GRID; j++) {
      const point = [w + ((e - w) * i) / LABEL_GRID, s + ((n - s) * j) / LABEL_GRID];
      if (!insideRings(point, largest)) continue;
      let distance = Infinity;
      for (const ring of largest) {
        for (let k = 1; k < ring.length; k++) distance = Math.min(distance, segmentDistance2(point, ring[k - 1], ring[k], kx));
      }
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
  }
  return best.map((v) => Math.round(v * 1e4) / 1e4);
}

function labels(features) {
  return features.map((f) => ({ type: "Feature", properties: f.properties, geometry: { type: "Point", coordinates: labelPoint(f) } }));
}

const [regions, departements] = await Promise.all([buildRegions(), buildDepartements()]);

const topo = topology({
  regions: { type: "FeatureCollection", features: regions },
  departements: { type: "FeatureCollection", features: departements },
  regionLabels: { type: "FeatureCollection", features: labels(regions) },
  departementLabels: { type: "FeatureCollection", features: labels(departements) },
}, 1e5);
const presimplified = presimplify(topo);
const simplified = simplify(presimplified, quantile(presimplified, SIMPLIFY_QUANTILE));
// Simplifying turns the arcs back into degrees and drops the transform, but leaves points quantized.
const { scale, translate } = topo.transform;
for (const name of ["regionLabels", "departementLabels"]) {
  for (const point of simplified.objects[name].geometries) {
    const [x, y] = point.coordinates;
    point.coordinates = [x * scale[0] + translate[0], y * scale[1] + translate[1]].map((v) => Math.round(v * 1e4) / 1e4);
  }
}
writeFileSync(OUT, JSON.stringify(simplified));

const kb = (JSON.stringify(simplified).length / 1024).toFixed(0);
console.log(`${OUT}: ${kb} KB`);
console.log(`  regions (${regions.length}): ${regions.map((r) => r.properties.name).join(", ")}`);
console.log(`  départements (${departements.length})`);
