"use client";

import type { Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { loadFrance } from "@/lib/geo/france";
import { FRENCH_CITIES } from "@/lib/geo/frenchCities";
import { MAP_MAX_ZOOM, MAP_VIEWS, type MapArea } from "@/lib/map/bounds";
import { SPOILER_PLACE_NAMES } from "@/lib/map/siteNames";
import { buildMapStyle, type FranceOverlay, type MapScheme } from "@/lib/map/style";

/** OpenStreetMap vector tiles (OpenMapTiles schema): free, no API key. */
const TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/planet";
const GLYPHS_URL = process.env.NEXT_PUBLIC_MAP_GLYPHS_URL ?? "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
/** Copied from node_modules by scripts/copy-maplibre-worker.mjs. */
const WORKER_URL = "/vendor/maplibre-gl-worker.mjs";
const DARK_QUERY = "(prefers-color-scheme: dark)";

let isWorkerConfigured = false;

function currentScheme(): MapScheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** France's overview layers, loaded only for the France map. */
async function loadOverlay(area: MapArea): Promise<FranceOverlay | null> {
  if (area !== "france") return null;
  const france = await loadFrance();
  return {
    land: france.land,
    cities: FRENCH_CITIES,
    departementBorders: france.departementBorders,
    departementLabels: { type: "FeatureCollection", features: france.departementLabels },
    regionLabels: { type: "FeatureCollection", features: france.regionLabels },
  };
}

/**
 * Creates a MapLibre map of `area` in `containerRef` once (MapLibre is loaded on demand), keeps its palette in sync with the color scheme, and removes it on unmount.
 * Returns the map once its style has loaded.
 */
export function useMaplibre(
  containerRef: RefObject<HTMLDivElement | null>,
  getPadding: () => { top: number; bottom: number },
  area: MapArea,
): MaplibreMap | null {
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const getPaddingRef = useRef(getPadding);
  useEffect(() => {
    getPaddingRef.current = getPadding;
  }, [getPadding]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let instance: MaplibreMap | null = null;
    let cancelled = false;
    const query = window.matchMedia(DARK_QUERY);
    let onSchemeChange: (() => void) | null = null;

    (async () => {
      const [maplibregl, france] = await Promise.all([import("maplibre-gl"), loadOverlay(area)]);
      if (cancelled) return;
      if (!isWorkerConfigured) {
        maplibregl.setWorkerUrl(WORKER_URL);
        isWorkerConfigured = true;
      }
      const styleFor = (scheme: MapScheme) =>
        buildMapStyle({ scheme, tilesUrl: TILES_URL, glyphsUrl: GLYPHS_URL, hiddenPlaceNames: SPOILER_PLACE_NAMES, france });
      const view = MAP_VIEWS[area];

      const padding = getPaddingRef.current();
      const created = new maplibregl.Map({
        container,
        style: styleFor(currentScheme()),
        bounds: view.bounds,
        fitBoundsOptions: { padding: { ...padding, left: 16, right: 16 } },
        maxBounds: view.maxBounds ?? undefined,
        maxZoom: MAP_MAX_ZOOM,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        keyboard: false, // the game handles the keyboard: arrows move the pin
        doubleClickZoom: false,
        attributionControl: { compact: true },
      });
      instance = created;
      created.touchZoomRotate.disableRotation();
      onSchemeChange = () => created.setStyle(styleFor(currentScheme()));
      query.addEventListener("change", onSchemeChange);
      created.once("load", () => {
        if (!cancelled) setMap(created);
      });
    })().catch((error: unknown) => {
      console.error("[map] failed to start", error);
    });

    return () => {
      cancelled = true;
      if (onSchemeChange) query.removeEventListener("change", onSchemeChange);
      instance?.remove();
      setMap(null);
    };
  }, [containerRef, area]);

  return map;
}
