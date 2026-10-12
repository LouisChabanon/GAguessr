"use client";

import { geoPath } from "d3-geo";
import { pointer, select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { RoundResult } from "@/game/evaluate";
import type { LonLat } from "@/lib/geo/distance";
import type { Basemap, Region } from "@/lib/geo/regions";
import {
  contentExtent,
  fitProjection,
  invertPoint,
  revealTransform,
  type Extent,
  type SafeArea,
} from "@/lib/map/viewport";
import { MapMarker } from "./MapMarker";
import { useBasemapCanvas } from "./useBasemapCanvas";
import { useElementSize } from "./useElementSize";

export type { SafeArea } from "@/lib/map/viewport";

const ZOOM_DURATION_MS = 750;
const KEY_ZOOM_DURATION_MS = 200;
const KEY_STEP_PX = 14;
const KEY_ZOOM_FACTOR = 1.6;
const NO_SAFE_AREA: SafeArea = { top: 0, bottom: 0 };

const ARROW_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

interface GameMapProps {
  region: Region;
  basemap: Basemap;
  /** Changes every round; replays the pin-drop animation. */
  roundKey: string;
  guess: LonLat | null;
  result: RoundResult | undefined;
  /** Answers revealed in earlier rounds; they stay on the map for the rest of the game. */
  pastResults: readonly RoundResult[];
  interactive: boolean;
  onPick: (lonLat: LonLat) => void;
  onConfirm: () => void;
  /** Live measurement of the HUD, used to frame reveals. */
  getSafeArea?: () => SafeArea;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GameMap({
  region,
  basemap,
  roundKey,
  guess,
  result,
  pastResults,
  interactive,
  onPick,
  onConfirm,
  getSafeArea,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomGroupRef = useRef<SVGGElement>(null);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const size = useElementSize(containerRef);

  const geo = useMemo(() => {
    if (!size) return null;
    const projection = fitProjection(region.createProjection(), basemap.fitObject, size, {
      isWholeWorld: region.drawSphere,
    });
    const path = geoPath(projection);
    return { projection, path, extent: contentExtent(path, basemap.fitObject, size) };
  }, [region, basemap, size]);

  const projection = geo?.projection ?? null;
  const path = geo?.path ?? null;
  const translateExtent: Extent | null = geo?.extent ?? null;

  const requestDraw = useBasemapCanvas({
    canvasRef,
    basemap,
    projection,
    size,
    drawSphere: region.drawSphere,
  });

  // Pan & zoom: d3 redraws the canvas and moves the overlay without re-rendering React.
  useEffect(() => {
    const svg = svgRef.current;
    const group = zoomGroupRef.current;
    if (!svg || !group || !size || !translateExtent) return;

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, region.maxZoom])
      .extent([[0, 0], [size.width, size.height]])
      .translateExtent(translateExtent)
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        requestDraw(event.transform);
        group.setAttribute("transform", event.transform.toString());
        svg.style.setProperty("--k", String(event.transform.k));
      });

    const selection = select(svg);
    selection.call(behavior).on("dblclick.zoom", null);
    selection.call(behavior.transform, zoomIdentity);
    behaviorRef.current = behavior;

    return () => {
      selection.interrupt().on(".zoom", null);
      behaviorRef.current = null;
    };
  }, [size, translateExtent, region.maxZoom, requestDraw]);

  // Frame the guess and the answer on reveal; zoom back out for the next round.
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior || !projection || !size || !translateExtent) return;

    const target = result
      ? revealTransform(
          projection,
          [result.guess, result.answer],
          size,
          getSafeArea?.() ?? NO_SAFE_AREA,
          translateExtent,
          behavior.constrain(),
        )
      : zoomIdentity;
    select(svg)
      .transition()
      .duration(prefersReducedMotion() ? 0 : ZOOM_DURATION_MS)
      .call(behavior.transform, target);
  }, [result, projection, size, translateExtent, getSafeArea]);

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!interactive || !projection || !zoomGroupRef.current) return;
    const lonLat = invertPoint(projection, pointer(event.nativeEvent, zoomGroupRef.current));
    if (lonLat) onPick(lonLat);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (!svg || !behavior || !projection || !size) return;

    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      const factor = event.key === "-" ? 1 / KEY_ZOOM_FACTOR : KEY_ZOOM_FACTOR;
      select(svg).transition().duration(prefersReducedMotion() ? 0 : KEY_ZOOM_DURATION_MS).call(behavior.scaleBy, factor);
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

    const t = transformRef.current;
    const origin = guess ? projection(guess as [number, number]) : t.invert([size.width / 2, size.height / 2]);
    if (!origin) return;
    const delta = KEY_STEP_PX / t.k;
    const lonLat = invertPoint(projection, [origin[0] + step[0] * delta, origin[1] + step[1] * delta]);
    if (lonLat) onPick(lonLat);
  };

  const background = region.drawSphere ? "var(--surface)" : "var(--map-ocean)";

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background }}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        data-layers={basemap.levels[0]?.layers.length ?? 0}
        aria-hidden
      />
      {size && path && projection && (
        <svg
          ref={svgRef}
          className="map-svg absolute inset-0 block h-full w-full"
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          data-interactive={interactive}
          role="application"
          aria-label={`${region.label} map`}
          aria-describedby="map-instructions"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <g ref={zoomGroupRef}>
            {pastResults.map((past) =>
              past.target.kind === "area" ? (
                <path
                  key={past.target.id}
                  className="map-past-area"
                  d={path(past.target.feature) ?? undefined}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{past.target.name}</title>
                </path>
              ) : (
                <MapMarker
                  key={past.target.id}
                  kind="past"
                  point={past.answer}
                  projection={projection}
                  title={past.target.name}
                />
              ),
            )}
            {result?.target.kind === "area" && (
              <path
                className="map-answer-area"
                d={path(result.target.feature) ?? undefined}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {result && result.distanceKm > 0 && (
              <path
                className="map-line"
                d={path({ type: "LineString", coordinates: [[...result.guess], [...result.answer]] }) ?? undefined}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {result && result.target.kind === "point" && (
              <MapMarker kind="answer" point={result.answer} projection={projection} />
            )}
            {guess && <MapMarker key={roundKey} kind="guess" point={guess} projection={projection} />}
          </g>
        </svg>
      )}
      <p id="map-instructions" className="sr-only">
        Click to drop a pin, or use the arrow keys to move it. Press Enter to confirm, plus and minus
        to zoom. Drag or scroll to pan and zoom.
      </p>
    </div>
  );
}
