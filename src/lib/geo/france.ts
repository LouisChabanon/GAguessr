import type { Feature, FeatureCollection, GeoJsonProperties, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import { feature, merge, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { onceAsync } from "@/lib/cache";
import { loadTopology, topologySchema } from "./topology";

/** Built by scripts/build-france-geo.mjs. */
export const FRANCE_URL = "/geo/france.json";

type Area = Polygon | MultiPolygon;
type AdminProperties = { code: string; name: string };

export type FranceRegion = Feature<Area, AdminProperties>;
export type Departement = Feature<Area, AdminProperties>;
/** Where a region's or département's name is drawn: a point well inside it. */
export type AdminLabel = Feature<Point, AdminProperties>;

export interface FranceGeography {
  regions: FranceRegion[];
  /** Union of the regions: metropolitan France with a detailed coastline. */
  land: Feature<MultiPolygon, { name: string }>;
  departements: Departement[];
  /** Borders shared by two départements (no coastline, no national border). */
  departementBorders: Feature<MultiLineString, Record<string, never>>;
  regionLabels: AdminLabel[];
  departementLabels: AdminLabel[];
}

const franceSchema = topologySchema(["regions", "departements", "regionLabels", "departementLabels"]);

type FranceTopology = Topology<{
  regions: GeometryCollection<AdminProperties>;
  departements: GeometryCollection<AdminProperties>;
  regionLabels: GeometryCollection<AdminProperties>;
  departementLabels: GeometryCollection<AdminProperties>;
}>;

export function parseFrance(input: unknown): FranceGeography {
  const parsed = franceSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid France topology: ${parsed.error.message}`);
  }
  const topology = input as FranceTopology;
  const { regions, departements, regionLabels, departementLabels } = topology.objects;
  const features = <G extends Feature["geometry"], P extends GeoJsonProperties>(object: GeometryCollection<P>) =>
    (feature(topology, object) as FeatureCollection<G, P>).features;
  return {
    regions: features<Area, AdminProperties>(regions),
    land: {
      type: "Feature",
      properties: { name: "France" },
      geometry: merge(topology, regions.geometries as Parameters<typeof merge>[1]),
    },
    departements: features<Area, AdminProperties>(departements),
    departementBorders: {
      type: "Feature",
      properties: {},
      geometry: mesh(topology, departements, (a, b) => a !== b),
    },
    regionLabels: features<Point, AdminProperties>(regionLabels),
    departementLabels: features<Point, AdminProperties>(departementLabels),
  };
}

export const loadFrance = onceAsync(async () => parseFrance(await loadTopology(FRANCE_URL)));
