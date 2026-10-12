import type { Feature, FeatureCollection } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { z } from "zod";
import { cachedAsync, onceAsync } from "@/lib/cache";

export const COUNTRIES_50M_URL = "/geo/countries-50m.json";
export const COUNTRIES_110M_URL = "/geo/countries-110m.json";

export interface CountryProperties {
  name: string;
}

export type CountryFeature = Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, CountryProperties>;

/** Fetches a static TopoJSON file once per URL (retried after a failure). */
export const loadTopology = cachedAsync(async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load map data (HTTP ${res.status})`);
  return res.json();
});

const namedGeometries = z.object({
  type: z.literal("GeometryCollection"),
  geometries: z.array(z.object({ properties: z.object({ name: z.string().min(1) }).loose() }).loose()),
});

/** Schema for a topology whose listed objects are named geometry collections. */
export function topologySchema<const K extends string>(objectNames: readonly K[]) {
  return z.object({
    type: z.literal("Topology"),
    arcs: z.array(z.unknown()),
    objects: z.object(
      Object.fromEntries(objectNames.map((name) => [name, namedGeometries])) as Record<K, typeof namedGeometries>,
    ),
  });
}

const countriesSchema = topologySchema(["countries"]);

/** Validates a world-atlas TopoJSON payload and converts it to GeoJSON countries. */
export function parseCountries(input: unknown): CountryFeature[] {
  const parsed = countriesSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid countries topology: ${parsed.error.message}`);
  }
  const topology = input as Topology<{ countries: GeometryCollection<CountryProperties> }>;
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<
    CountryFeature["geometry"],
    CountryProperties
  >;
  return collection.features;
}

/** 1:50m countries: accurate enough for scoring and close-up rendering. */
export const loadCountries = onceAsync(async () => parseCountries(await loadTopology(COUNTRIES_50M_URL)));

/** 1:110m countries: plenty for drawing the whole world. */
export const loadCountriesLowRes = onceAsync(async () =>
  parseCountries(await loadTopology(COUNTRIES_110M_URL)),
);
