"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { createMarkerElement } from "@/components/map/markerElement";
import { useMaplibre } from "@/components/map/useMaplibre";
import type { LonLat } from "@/lib/geo/distance";
import { toLngLat, type MapArea } from "@/lib/map/bounds";
import { CROWD_SOURCE } from "@/lib/map/style";

const NO_PADDING = () => ({ top: 0, bottom: 0 });

interface StatsHeatmapProps {
  area: MapArea;
  siteName: string;
  answer: LonLat;
  guesses: readonly LonLat[];
}

/** Where players put one site, as a heatmap around its real position. */
export function StatsHeatmap({ area, siteName, answer, guesses }: StatsHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map = useMaplibre(containerRef, NO_PADDING, area);

  useEffect(() => {
    if (!map) return;
    const apply = () =>
      map.getSource<GeoJSONSource>(CROWD_SOURCE)?.setData({
        type: "FeatureCollection",
        features: guesses.map((point) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [...point] } })),
      });
    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [map, guesses]);

  useEffect(() => {
    if (!map) return;
    let marker: Marker | null = null;
    let cancelled = false;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      marker = new maplibregl.Marker({ element: createMarkerElement("answer", siteName), anchor: "center" }).setLngLat(toLngLat(answer)).addTo(map);
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, answer, siteName]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-(--map-ocean)">
      <div ref={containerRef} className="aspect-[4/3] w-full sm:aspect-[16/10]" role="img" aria-label={`Carte des placements de ${siteName}`} />
      <figcaption className="flex items-center gap-4 border-t border-line bg-panel-solid px-4 py-2.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-answer" aria-hidden /> Position réelle
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-crowd" aria-hidden /> Placements des joueurs
        </span>
      </figcaption>
    </figure>
  );
}
