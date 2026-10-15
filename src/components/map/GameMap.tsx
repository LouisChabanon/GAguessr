"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MaplibreMap, Marker } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import type { RoundResult } from "@/game/evaluate";
import type { LonLat } from "@/lib/geo/distance";
import { MAP_VIEWS, REVEAL_MAX_ZOOM, revealBounds, toLngLat, type MapArea } from "@/lib/map/bounds";
import { CROWD_SOURCE, REVEAL_SOURCE } from "@/lib/map/style";
import { createMarkerElement, type MarkerKind } from "./markerElement";
import { useMaplibre } from "./useMaplibre";

export interface SafeArea {
  top: number;
  bottom: number;
}

const CAMERA_DURATION_MS = 750;
const EDGE_PADDING_PX = 40;
const KEY_STEP_PX = 14;
const NO_SAFE_AREA: SafeArea = { top: 0, bottom: 0 };

const ARROW_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

interface GameMapProps {
  area: MapArea;
  /** Changes every round; replays the pin-drop animation. */
  roundKey: string;
  guess: LonLat | null;
  result: RoundResult | undefined;
  /** Answers revealed in earlier rounds; they stay on the map for the rest of the game. */
  pastResults: readonly RoundResult[];
  /** Where other players put the revealed site, drawn as a heatmap. */
  crowdGuesses?: readonly LonLat[];
  interactive: boolean;
  onPick: (lonLat: LonLat) => void;
  onConfirm: () => void;
  /** Called once the map has loaded and takes clicks. */
  onReady?: () => void;
  /** Live measurement of the HUD, used to frame the map around it. */
  getSafeArea?: () => SafeArea;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Keeps one MapLibre marker per key in sync with `points`. */
function useMarkers(map: MaplibreMap | null, kind: MarkerKind, points: readonly { key: string; point: LonLat; title?: string }[]) {
  const markers = useRef(new Map<string, Marker>());
  useEffect(() => {
    if (!map) return;
    const current = markers.current;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      const wanted = new Set(points.map((p) => p.key));
      for (const [key, marker] of current) {
        if (!wanted.has(key)) {
          marker.remove();
          current.delete(key);
        }
      }
      for (const { key, point, title } of points) {
        const existing = current.get(key);
        if (existing) {
          existing.setLngLat(toLngLat(point));
          continue;
        }
        const marker = new maplibregl.Marker({ element: createMarkerElement(kind, title), anchor: kind === "guess" ? "bottom" : "center" })
          .setLngLat(toLngLat(point))
          .addTo(map);
        current.set(key, marker);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [map, kind, points]);

  useEffect(() => {
    const current = markers.current;
    return () => {
      for (const marker of current.values()) marker.remove();
      current.clear();
    };
  }, [map]);
}

export function GameMap({ area, roundKey, guess, result, pastResults, crowdGuesses, interactive, onPick, onConfirm, onReady, getSafeArea }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const padding = useCallback(() => {
    const safe = getSafeArea?.() ?? NO_SAFE_AREA;
    return { top: safe.top + EDGE_PADDING_PX / 2, bottom: safe.bottom + EDGE_PADDING_PX / 2 };
  }, [getSafeArea]);
  const map = useMaplibre(containerRef, padding, area);
  const view = MAP_VIEWS[area];

  useEffect(() => {
    if (map) onReady?.();
  }, [map, onReady]);

  // Latest callbacks for MapLibre's listeners, which are attached once.
  const live = useRef({ interactive, onPick });
  useEffect(() => {
    live.current = { interactive, onPick };
  }, [interactive, onPick]);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => {
      if (live.current.interactive) live.current.onPick([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  const guessPoints = useMemo(() => (guess ? [{ key: roundKey, point: guess }] : []), [guess, roundKey]);
  const answerPoints = useMemo(() => (result ? [{ key: result.target.id, point: result.answer }] : []), [result]);
  const pastPoints = useMemo(
    () => pastResults.map((past) => ({ key: past.target.id, point: past.answer, title: past.target.name })),
    [pastResults],
  );
  useMarkers(map, "guess", guessPoints);
  useMarkers(map, "answer", answerPoints);
  useMarkers(map, "past", pastPoints);

  // Dashed line between the guess and the answer; re-applied when the color scheme swaps the style.
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const source = map.getSource<GeoJSONSource>(REVEAL_SOURCE);
      source?.setData(
        result && result.distanceKm > 0
          ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[...result.guess], [...result.answer]] } }
          : { type: "FeatureCollection", features: [] },
      );
    };
    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [map, result]);

  // Other players' guesses, only once the answer is out; re-applied when the color scheme swaps the style.
  useEffect(() => {
    if (!map) return;
    const points = result ? (crowdGuesses ?? []) : [];
    const apply = () => {
      map.getSource<GeoJSONSource>(CROWD_SOURCE)?.setData({
        type: "FeatureCollection",
        features: points.map((point) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [...point] } })),
      });
    };
    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [map, result, crowdGuesses]);

  // Frame the guess and the answer on reveal; back to the whole map for the next round.
  useEffect(() => {
    if (!map) return;
    const pad = padding();
    const options = {
      padding: { top: pad.top + EDGE_PADDING_PX, bottom: pad.bottom + EDGE_PADDING_PX, left: EDGE_PADDING_PX, right: EDGE_PADDING_PX },
      duration: prefersReducedMotion() ? 0 : CAMERA_DURATION_MS,
    };
    if (result) {
      map.fitBounds(revealBounds(result.guess, result.answer), { ...options, maxZoom: REVEAL_MAX_ZOOM });
    } else {
      map.fitBounds(view.bounds, options);
    }
  }, [map, result, padding, view]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!map) return;
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      if (event.key === "-") map.zoomOut();
      else map.zoomIn();
      return;
    }
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (guess) onConfirm();
      return;
    }
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const origin = map.project(guess ? toLngLat(guess) : map.getCenter());
    const moved = map.unproject([origin.x + step[0] * KEY_STEP_PX, origin.y + step[1] * KEY_STEP_PX]);
    onPick([moved.lng, moved.lat]);
  };

  return (
    // MapLibre sets `position: relative` on its container, so it gets its own inner element.
    <div
      className="game-map absolute inset-0 bg-(--map-ocean)"
      role="application"
      aria-label={view.label}
      aria-describedby="map-instructions"
      tabIndex={0}
      data-interactive={interactive}
      data-map-ready={map !== null}
      onKeyDown={handleKeyDown}
    >
      <div ref={containerRef} className="h-full w-full" />
      <p id="map-instructions" className="sr-only">
        Cliquez pour placer une épingle, ou déplacez-la avec les flèches. Entrée pour valider, plus et
        moins pour zoomer. Faites glisser ou défilez pour vous déplacer et zoomer.
      </p>
    </div>
  );
}
