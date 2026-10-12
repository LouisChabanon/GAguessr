import { geoPath, type GeoContext, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import type { CityFeature, CityRank } from "@/lib/geo/frenchCities";
import type { BasemapLevel, FillStyle, LineStyle, MapLayer } from "@/lib/geo/regions";
import type { Rect } from "@/lib/map/viewport";

/** A feature projected once into a Path2D, with its projected bounds for culling. */
export interface CompiledFeature {
  path: Path2D;
  bounds: Rect;
}

/** A city projected to (unzoomed) map coordinates. */
export interface CompiledLabel {
  name: string;
  rank: CityRank;
  x: number;
  y: number;
}

export type CompiledLayer =
  | { kind: "fill"; style: FillStyle; features: CompiledFeature[] }
  | { kind: "line"; style: LineStyle; features: CompiledFeature[] }
  | { kind: "label"; style: "city"; labels: CompiledLabel[]; span: number };

export interface CompiledLevel {
  minZoom: number;
  layers: CompiledLayer[];
}

/**
 * Lets d3 draw into a Path2D (d3-geo never calls `beginPath`, which Path2D
 * lacks) while recording the bounds of every point it emits.
 */
function recordingContext(path: Path2D, bounds: Rect): GeoContext {
  const track = (x: number, y: number) => {
    bounds[0][0] = Math.min(bounds[0][0], x);
    bounds[0][1] = Math.min(bounds[0][1], y);
    bounds[1][0] = Math.max(bounds[1][0], x);
    bounds[1][1] = Math.max(bounds[1][1], y);
  };
  return {
    beginPath: () => {},
    moveTo: (x, y) => {
      track(x, y);
      path.moveTo(x, y);
    },
    lineTo: (x, y) => {
      track(x, y);
      path.lineTo(x, y);
    },
    arc: (x, y, radius, startAngle, endAngle) => {
      track(x - radius, y - radius);
      track(x + radius, y + radius);
      path.arc(x, y, radius, startAngle, endAngle);
    },
    closePath: () => path.closePath(),
  };
}

export function compileFeature(feature: Feature | { type: "Sphere" }, projection: GeoProjection): CompiledFeature {
  const path = new Path2D();
  // Mutable accumulator, local to this function until returned.
  const bounds: Rect = [
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ];
  geoPath(projection, recordingContext(path, bounds))(feature);
  return { path, bounds };
}

function compileLabels(cities: readonly CityFeature[], projection: GeoProjection): CompiledLayer {
  const labels = cities.flatMap((city) => {
    const point = projection(city.geometry.coordinates as [number, number]);
    return point ? [{ name: city.properties.name, rank: city.properties.rank, x: point[0], y: point[1] }] : [];
  });
  const xs = labels.map((l) => l.x);
  return { kind: "label", style: "city", labels, span: labels.length ? Math.max(...xs) - Math.min(...xs) : 0 };
}

function compileLayer(layer: MapLayer, projection: GeoProjection): CompiledLayer {
  switch (layer.kind) {
    case "label":
      return compileLabels(layer.features, projection);
    case "fill":
    case "line":
      return {
        ...layer,
        features: layer.features.map((feature) => compileFeature(feature, projection)),
      } as CompiledLayer;
  }
}

export function compileLevel(level: BasemapLevel, projection: GeoProjection): CompiledLevel {
  return { minZoom: level.minZoom, layers: level.layers.map((layer) => compileLayer(layer, projection)) };
}
