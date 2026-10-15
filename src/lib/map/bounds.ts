import type { LonLat } from "@/lib/geo/distance";

/** Mutable tuples, as MapLibre expects them. */
export type LngLatTuple = [number, number];
type Bounds = [LngLatTuple, LngLatTuple];

/** Metropolitan France and Corsica: what the map frames at the start of each round. */
export const FRANCE_BOUNDS: Bounds = [
  [-5.2, 41.3],
  [9.6, 51.1],
];

/**
 * How far the player may pan around France. It must be much wider than France: MapLibre
 * will not zoom out past what fits inside it.
 */
const FRANCE_MAX_BOUNDS: Bounds = [
  [-25, 33],
  [32, 60],
];

/** Every inhabited continent, from Alaska to New Zealand: what the world map frames each round. */
export const WORLD_BOUNDS: Bounds = [
  [-130, -45],
  [175, 72],
];

/** Which map a game mode plays on. */
export type MapArea = "france" | "world";

export interface MapView {
  /** Framed at the start of each round. */
  bounds: Bounds;
  /**
   * How far the player may pan; `null` for the whole world, which MapLibre already keeps in
   * view without world copies (a 360° `maxBounds` makes it fail to start).
   */
  maxBounds: Bounds | null;
  /** Accessible name of the map. */
  label: string;
}

export const MAP_VIEWS: Readonly<Record<MapArea, MapView>> = {
  france: { bounds: FRANCE_BOUNDS, maxBounds: FRANCE_MAX_BOUNDS, label: "Carte : France" },
  world: { bounds: WORLD_BOUNDS, maxBounds: null, label: "Carte : monde" },
};

/** Street level: the tiles go to zoom 14 and MapLibre over-zooms them cleanly up to here. */
export const MAP_MAX_ZOOM = 18;

/** Closest zoom used to frame a guess and its answer. */
export const REVEAL_MAX_ZOOM = 9;

/** Bounding box of a guess and its answer, ready for `fitBounds`. */
export function revealBounds(guess: LonLat, answer: LonLat): Bounds {
  return [
    [Math.min(guess[0], answer[0]), Math.min(guess[1], answer[1])],
    [Math.max(guess[0], answer[0]), Math.max(guess[1], answer[1])],
  ];
}

export function toLngLat(point: LonLat): LngLatTuple {
  return [point[0], point[1]];
}
