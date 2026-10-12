import {
  geoConicConformal,
  geoEqualEarth,
  type GeoPermissibleObjects,
  type GeoProjection,
} from "d3-geo";
import type { Feature } from "geojson";
import { loadCountries, loadCountriesLowRes, type CountryFeature } from "./atlas";
import { loadFrance, type FranceGeography } from "./france";
import { FRENCH_CITIES, type CityFeature } from "./frenchCities";

export type RegionId = "world" | "france-metro";

export type FillStyle = "land" | "muted" | "region";
export type LineStyle = "river" | "river-major";

export type MapLayer =
  | { kind: "fill"; style: FillStyle; features: readonly Feature[] }
  | { kind: "line"; style: LineStyle; features: readonly Feature[] }
  | { kind: "label"; style: "city"; features: readonly CityFeature[] };

/** Layers to draw from `minZoom` upwards (until a more detailed level takes over). */
export interface BasemapLevel {
  minZoom: number;
  layers: readonly MapLayer[];
}

export interface Basemap {
  /** What the projection is fitted to. */
  fitObject: GeoPermissibleObjects;
  levels: readonly BasemapLevel[];
  /** Extra detail fetched on demand when the player zooms in. */
  detail?: { minZoom: number; load: () => Promise<BasemapLevel> };
}

export interface Region {
  id: RegionId;
  label: string;
  /** Draw the globe outline (only meaningful for whole-world projections). */
  drawSphere: boolean;
  maxZoom: number;
  createProjection(): GeoProjection;
  loadBasemap(): Promise<Basemap>;
}

/** Zoom factor from which the world map switches from 1:110m to 1:50m. */
export const WORLD_DETAIL_ZOOM = 2.5;

/** Most detailed level whose `minZoom` is reached at zoom `k`. */
export function pickLevel<L extends { minZoom: number }>(levels: readonly L[], k: number): L | undefined {
  return levels.reduce<L | undefined>(
    (best, level) => (level.minZoom <= k && (!best || level.minZoom >= best.minZoom) ? level : best),
    undefined,
  );
}

export function worldLevel(countries: readonly CountryFeature[], minZoom: number): BasemapLevel {
  return {
    minZoom,
    layers: [{ kind: "fill", style: "land", features: countries.filter((c) => c.properties.name !== "Antarctica") }],
  };
}

export function franceBasemap(france: FranceGeography, cities: readonly CityFeature[] = FRENCH_CITIES): Basemap {
  return {
    fitObject: france.land,
    levels: [
      {
        minZoom: 1,
        layers: [
          { kind: "fill", style: "muted", features: france.neighbours },
          { kind: "fill", style: "region", features: france.regions },
          { kind: "line", style: "river", features: france.rivers.filter((r) => !r.properties.major) },
          { kind: "line", style: "river-major", features: france.rivers.filter((r) => r.properties.major) },
          { kind: "label", style: "city", features: cities },
        ],
      },
    ],
  };
}

const world: Region = {
  id: "world",
  label: "World",
  drawSphere: true,
  maxZoom: 40,
  createProjection: () => geoEqualEarth(),
  loadBasemap: async () => ({
    fitObject: { type: "Sphere" },
    levels: [worldLevel(await loadCountriesLowRes(), 1)],
    detail: {
      minZoom: WORLD_DETAIL_ZOOM,
      load: async () => worldLevel(await loadCountries(), WORLD_DETAIL_ZOOM),
    },
  }),
};

const franceMetro: Region = {
  id: "france-metro",
  label: "France",
  drawSphere: false,
  maxZoom: 12,
  // Lambert-93-like: standard parallels 44°/49°, central meridian 3°E.
  createProjection: () => geoConicConformal().parallels([44, 49]).rotate([-3, 0]),
  loadBasemap: async () => franceBasemap(await loadFrance()),
};

export const REGIONS: Readonly<Record<RegionId, Region>> = {
  world,
  "france-metro": franceMetro,
};
