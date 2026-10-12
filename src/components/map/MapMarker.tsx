import type { GeoProjection } from "d3-geo";
import type { LonLat } from "@/lib/geo/distance";

interface MapMarkerProps {
  kind: "guess" | "answer" | "past";
  /** Tooltip, e.g. the name of a previously revealed answer. */
  title?: string;
  point: LonLat;
  projection: GeoProjection;
}

/** Teardrop whose tip sits on (0, 0). */
const PIN_PATH = "M0 0C-1.6-5.2-9-9.4-9-16.2a9 9 0 1 1 18 0C9-9.4 1.6-5.2 0 0Z";

export function MapMarker({ kind, point, projection, title }: MapMarkerProps) {
  const position = projection(point as [number, number]);
  if (!position) return null;

  return (
    <g
      className="map-marker"
      data-kind={kind}
      data-testid={`marker-${kind}`}
      pointerEvents={kind === "past" ? "visiblePainted" : "none"}
      style={{ translate: `${position[0]}px ${position[1]}px` }}
    >
      {title && <title>{title}</title>}
      <g className="map-marker-body">
        {kind === "past" ? (
          <circle r={4} fill="var(--answer)" fillOpacity={0.55} stroke="var(--panel-solid)" strokeWidth={1.5} />
        ) : kind === "guess" ? (
          <>
            <path d={PIN_PATH} fill="var(--accent)" stroke="var(--panel-solid)" strokeWidth={1.5} />
            <circle cy={-16.2} r={3.4} fill="var(--panel-solid)" />
          </>
        ) : (
          <>
            <circle r={10} fill="var(--answer)" fillOpacity={0.18} />
            <circle r={5.5} fill="var(--answer)" stroke="var(--panel-solid)" strokeWidth={2} />
          </>
        )}
      </g>
    </g>
  );
}
