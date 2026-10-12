"use client";

import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { GeoProjection } from "d3-geo";
import { maxVisibleCityRank } from "@/lib/geo/frenchCities";
import { pickLevel, type Basemap, type BasemapLevel, type FillStyle, type LineStyle } from "@/lib/geo/regions";
import { labelOrigin, layoutLabels } from "@/lib/map/labelLayout";
import { rectsIntersect, visibleRect, type Size } from "@/lib/map/viewport";
import {
  compileFeature,
  compileLevel,
  type CompiledFeature,
  type CompiledLabel,
  type CompiledLevel,
} from "./compileBasemap";

/** Screen-space stroke widths (CSS px), kept constant at every zoom level. */
const BORDER_WIDTH_PX = 0.6;
const SPHERE_WIDTH_PX = 1;
const LINE_WIDTH_PX: Readonly<Record<LineStyle, number>> = { river: 1, "river-major": 1.7 };
const CITY_DOT_RADIUS_PX = 2.5;
const CITY_LABEL_OFFSET_PX = 5;
const CITY_FONT_SIZE_PX = 11;
const CITY_HALO_WIDTH_PX = 3;

/** Fallback delay when requestIdleCallback is unavailable (Safari). */
const IDLE_FALLBACK_MS = 1200;

interface Palette {
  ocean: string;
  sphereStroke: string;
  land: string;
  muted: string;
  border: string;
  river: string;
  city: string;
  cityLabel: string;
  halo: string;
  font: string;
}

const FILL_COLOR: Readonly<Record<FillStyle, keyof Palette>> = { land: "land", region: "land", muted: "muted" };

function whenIdle(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(callback, IDLE_FALLBACK_MS);
  return () => clearTimeout(id);
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToScheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

let paletteCache: { isDark: boolean; palette: Palette } | null = null;

/** Palette for the active color scheme; stable between calls so it can be a store snapshot. */
function getPaletteSnapshot(): Palette {
  const isDark = window.matchMedia(DARK_QUERY).matches;
  if (paletteCache?.isDark !== isDark) paletteCache = { isDark, palette: readPalette() };
  return paletteCache.palette;
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ocean: token("--map-ocean"),
    sphereStroke: token("--line"),
    land: token("--map-land"),
    muted: token("--map-land-muted"),
    border: token("--map-border"),
    river: token("--map-river"),
    city: token("--ink"),
    cityLabel: token("--muted"),
    halo: token("--map-land"),
    font: token("--font-geist-sans") || "system-ui, sans-serif",
  };
}

/** City dots and names, drawn in screen space so they stay the same size at any zoom. */
function drawCityLabels(
  ctx: CanvasRenderingContext2D,
  labels: readonly CompiledLabel[],
  span: number,
  transform: ZoomTransform,
  size: Size,
  dpr: number,
  palette: Palette,
) {
  const maxRank = maxVisibleCityRank(span * transform.k);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = `500 ${CITY_FONT_SIZE_PX}px ${palette.font}`;
  ctx.textBaseline = "top";

  const onScreen = labels.flatMap((label) => {
    if (label.rank > maxRank) return [];
    const [x, y] = transform.apply([label.x, label.y]);
    if (x < 0 || y < 0 || x > size.width || y > size.height) return [];
    return [{ name: label.name, x, y, rank: label.rank, width: ctx.measureText(label.name).width, height: CITY_FONT_SIZE_PX }];
  });
  const sides = layoutLabels(onScreen, { offset: CITY_LABEL_OFFSET_PX, dotRadius: CITY_DOT_RADIUS_PX });

  ctx.fillStyle = palette.city;
  for (const { x, y } of onScreen) {
    ctx.beginPath();
    ctx.arc(x, y, CITY_DOT_RADIUS_PX, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.lineWidth = CITY_HALO_WIDTH_PX;
  onScreen.forEach((label, i) => {
    const side = sides[i];
    if (!side) return;
    const [textX, textY] = labelOrigin(label, side, CITY_LABEL_OFFSET_PX);
    ctx.strokeStyle = palette.halo;
    ctx.strokeText(label.name, textX, textY);
    ctx.fillStyle = palette.cityLabel;
    ctx.fillText(label.name, textX, textY);
  });
}

function drawFrame(
  canvas: HTMLCanvasElement,
  size: Size,
  transform: ZoomTransform,
  level: CompiledLevel | undefined,
  sphere: CompiledFeature | null,
  palette: Palette,
) {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(size.width * dpr);
  const height = Math.round(size.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { x, y, k } = transform;
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (sphere) {
    ctx.fillStyle = palette.ocean;
    ctx.fill(sphere.path);
    ctx.strokeStyle = palette.sphereStroke;
    ctx.lineWidth = SPHERE_WIDTH_PX / k;
    ctx.stroke(sphere.path);
  }

  // Only draw what's on screen: once zoomed in, most features are skipped.
  const view = visibleRect(transform, size);
  for (const layer of level?.layers ?? []) {
    if (layer.kind === "label") {
      drawCityLabels(ctx, layer.labels, layer.span, transform, size, dpr, palette);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
      continue;
    }
    const visible = layer.features.filter((f) => rectsIntersect(f.bounds, view));
    if (layer.kind === "fill") {
      ctx.fillStyle = palette[FILL_COLOR[layer.style]];
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = BORDER_WIDTH_PX / k;
      for (const f of visible) {
        ctx.fill(f.path);
        ctx.stroke(f.path);
      }
    } else {
      ctx.strokeStyle = palette.river;
      ctx.lineWidth = LINE_WIDTH_PX[layer.style] / k;
      for (const f of visible) ctx.stroke(f.path);
    }
  }
}

interface UseBasemapCanvasOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  basemap: Basemap;
  projection: GeoProjection | null;
  size: Size | null;
  drawSphere: boolean;
}

/**
 * Draws the basemap on a canvas. Paths are projected once into Path2D objects;
 * pan/zoom only changes the canvas transform, and redraws are coalesced to one
 * per animation frame. Returns a function to call with every zoom transform.
 */
export function useBasemapCanvas({
  canvasRef,
  basemap,
  projection,
  size,
  drawSphere,
}: UseBasemapCanvasOptions): (transform: ZoomTransform) => void {
  // CSS tokens differ per color scheme, so the palette is re-read when it flips.
  const palette = useSyncExternalStore<Palette | null>(subscribeToScheme, getPaletteSnapshot, () => null);

  const [detail, setDetail] = useState<{ source: Basemap; level: BasemapLevel } | null>(null);
  const detailRequested = useRef<Basemap | null>(null);

  const levels = useMemo(() => {
    if (!projection) return [];
    const sourceLevels = detail?.source === basemap ? [...basemap.levels, detail.level] : basemap.levels;
    return sourceLevels.map((level) => compileLevel(level, projection));
  }, [basemap, detail, projection]);

  const sphere = useMemo(
    () => (projection && drawSphere ? compileFeature({ type: "Sphere" }, projection) : null),
    [projection, drawSphere],
  );

  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const frameRef = useRef(0);
  const renderRef = useRef<() => void>(() => {});

  useEffect(() => {
    renderRef.current = () => {
      frameRef.current = 0;
      const canvas = canvasRef.current;
      if (!canvas || !size || !palette) return;
      const level = pickLevel(levels, transformRef.current.k);
      drawFrame(canvas, size, transformRef.current, level, sphere, palette);
    };
    renderRef.current();
  }, [canvasRef, size, palette, levels, sphere]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const loadDetail = useCallback(() => {
    if (!basemap.detail || detailRequested.current === basemap) return;
    detailRequested.current = basemap;
    basemap.detail
      .load()
      .then((level) => setDetail({ source: basemap, level }))
      .catch(() => {
        // Non-fatal: the coarser level stays on screen; the next zoom retries.
        detailRequested.current = null;
      });
  }, [basemap]);

  // Fetch and project the detailed level while idle, not in the middle of a zoom gesture.
  useEffect(() => (basemap.detail ? whenIdle(loadDetail) : undefined), [basemap, loadDetail]);

  return useCallback(
    (transform: ZoomTransform) => {
      transformRef.current = transform;
      if (basemap.detail && transform.k >= basemap.detail.minZoom) loadDetail();

      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => renderRef.current());
      }
    },
    [basemap, loadDetail],
  );
}
