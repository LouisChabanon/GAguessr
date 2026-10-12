import type { GeoGeometryObjects, GeoPath, GeoPermissibleObjects, GeoProjection } from "d3-geo";
import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import { isValidLonLat, type LonLat } from "@/lib/geo/distance";

export interface Size {
  width: number;
  height: number;
}

/** Vertical space (px) covered by floating UI. */
export interface SafeArea {
  top: number;
  bottom: number;
}

export type Extent = [[number, number], [number, number]];

/** Axis-aligned rectangle as [[x0, y0], [x1, y1]]. */
export type Rect = [[number, number], [number, number]];

export type ConstrainFn = (transform: ZoomTransform, extent: Extent, translateExtent: Extent) => ZoomTransform;

/** Matches Tailwind's `sm` breakpoint, where the HUD switches to its stacked layout. */
export const COMPACT_MAX_WIDTH = 640;
const HUD_INSETS_COMPACT: SafeArea = { top: 176, bottom: 88 };
const HUD_INSETS_REGULAR: SafeArea = { top: 120, bottom: 104 };
const SIDE_PADDING_PX = 24;
/** Roughly Equal Earth's width:height, so a whole-world map fills a phone's height and pans sideways. */
const MIN_WORLD_ASPECT = 2.05;
/** Share of the visible area the guess→answer segment may fill after a reveal. */
const REVEAL_FILL = 0.5;
const REVEAL_MAX_ZOOM = 6;
/** Max reprojection error (px) for a click to count as "on the map". */
const INVERT_TOLERANCE_PX = 1;

export function hudInsets({ width }: Size): SafeArea {
  return width < COMPACT_MAX_WIDTH ? HUD_INSETS_COMPACT : HUD_INSETS_REGULAR;
}

/**
 * Fits `fitObject` into the space left by the HUD. Whole-world maps keep a
 * minimum aspect so they fill the height of a phone and pan sideways.
 */
export function fitProjection(
  projection: GeoProjection,
  fitObject: GeoPermissibleObjects,
  size: Size,
  { isWholeWorld }: { isWholeWorld: boolean },
): GeoProjection {
  const insets = hudInsets(size);
  const availableWidth = size.width - 2 * SIDE_PADDING_PX;
  const availableHeight = Math.max(size.height - insets.top - insets.bottom, size.height / 3);
  const fitWidth = isWholeWorld ? Math.max(availableWidth, availableHeight * MIN_WORLD_ASPECT) : availableWidth;
  const left = (size.width - fitWidth) / 2;
  const top = Math.min(insets.top, size.height - availableHeight);
  return projection.fitExtent(
    [
      [left, top],
      [left + fitWidth, top + availableHeight],
    ],
    fitObject as GeoGeometryObjects,
  );
}

/** Pannable area: the projected content, never smaller than the viewport. */
export function contentExtent(path: GeoPath, fitObject: GeoPermissibleObjects, size: Size): Extent {
  const [[x0, y0], [x1, y1]] = path.bounds(fitObject);
  return [
    [Math.min(0, x0), Math.min(0, y0)],
    [Math.max(size.width, x1), Math.max(size.height, y1)],
  ];
}

export function invertPoint(projection: GeoProjection, [x, y]: [number, number]): LonLat | null {
  const lonLat = projection.invert?.([x, y]);
  if (!lonLat || !isValidLonLat(lonLat)) return null;
  // Points outside the projected globe still invert to something; reject them.
  const back = projection(lonLat);
  if (!back || Math.hypot(back[0] - x, back[1] - y) > INVERT_TOLERANCE_PX) return null;
  return [lonLat[0], lonLat[1]];
}

/** Zoom transform framing `points` in the part of the screen not covered by the HUD. */
export function revealTransform(
  projection: GeoProjection,
  points: readonly LonLat[],
  size: Size,
  safeArea: SafeArea,
  translateExtent: Extent,
  constrain: ConstrainFn,
): ZoomTransform {
  const projected = points
    .map((p) => projection(p as [number, number]))
    .filter((p): p is [number, number] => p !== null);
  if (projected.length === 0) return zoomIdentity;

  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const top = Math.min(safeArea.top, size.height / 2);
  const visibleHeight = Math.max(size.height - top - safeArea.bottom, size.height / 4);
  const fit = REVEAL_FILL * Math.min(size.width / Math.max(x1 - x0, 1), visibleHeight / Math.max(y1 - y0, 1));
  const k = Math.min(REVEAL_MAX_ZOOM, Math.max(1, fit));

  const target = zoomIdentity
    .translate(size.width / 2, top + visibleHeight / 2)
    .scale(k)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  return constrain(target, [[0, 0], [size.width, size.height]], translateExtent);
}

export function rectsIntersect([[ax0, ay0], [ax1, ay1]]: Rect, [[bx0, by0], [bx1, by1]]: Rect): boolean {
  return ax0 <= bx1 && ax1 >= bx0 && ay0 <= by1 && ay1 >= by0;
}

/** The part of the (unzoomed) map currently on screen. */
export function visibleRect(transform: ZoomTransform, { width, height }: Size): Rect {
  return [transform.invert([0, 0]), transform.invert([width, height])];
}
