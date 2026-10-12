import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import { feature, merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { onceAsync } from "@/lib/cache";
import { loadTopology, topologySchema } from "./atlas";

/** Built by scripts/build-france-geo.mjs. */
export const FRANCE_URL = "/geo/france.json";

type Area = Polygon | MultiPolygon;

export type FranceRegion = Feature<Area, { code: string; name: string }>;
export type River = Feature<MultiLineString, { name: string; major: boolean }>;
export type Neighbour = Feature<Area, { name: string }>;

export interface FranceGeography {
  regions: FranceRegion[];
  /** Union of the regions: metropolitan France with a detailed coastline. */
  land: Feature<MultiPolygon, { name: string }>;
  rivers: River[];
  neighbours: Neighbour[];
}

const franceSchema = topologySchema(["regions", "rivers", "neighbours"]);

type FranceTopology = Topology<{
  regions: GeometryCollection<FranceRegion["properties"]>;
  rivers: GeometryCollection<River["properties"]>;
  neighbours: GeometryCollection<Neighbour["properties"]>;
}>;

export function parseFrance(input: unknown): FranceGeography {
  const parsed = franceSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid France topology: ${parsed.error.message}`);
  }
  const topology = input as FranceTopology;
  const { regions, rivers, neighbours } = topology.objects;
  return {
    regions: (feature(topology, regions) as FeatureCollection<Area, FranceRegion["properties"]>).features,
    land: {
      type: "Feature",
      properties: { name: "France" },
      geometry: merge(topology, regions.geometries as Parameters<typeof merge>[1]),
    },
    rivers: (feature(topology, rivers) as FeatureCollection<MultiLineString, River["properties"]>).features,
    neighbours: (feature(topology, neighbours) as FeatureCollection<Area, Neighbour["properties"]>).features,
  };
}

export const loadFrance = onceAsync(async () => parseFrance(await loadTopology(FRANCE_URL)));
