import { readFileSync } from "node:fs";
import path from "node:path";
import { geoConicConformal, geoPath } from "d3-geo";
import { mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import { distanceKm, type LonLat } from "@/lib/geo/distance";
import { parseFrance } from "@/lib/geo/france";
import { TIER_COLOR } from "@/components/ui/ScoreBar";
import { scoreFor, scoreTier } from "@/lib/geo/scoring";
import { formatDistance, formatScore } from "@/lib/format";

const SIZE = 480;
/** The demo round: an answer near Bourges (no real site there), and a guess far enough off for the line to read. */
const DEMO_ANSWER: LonLat = [2.4, 47.08];
const DEMO_GUESS: LonLat = [1.5, 46.66];
/** The power plants mode's score scale, so the chip shows what the game would award. */
const DEMO_SCALE_KM = 100;

/** Teardrop pin whose tip is at (0, 0), as on the game map. */
const PIN_PATH = "M0 0C-1.6-5.2-9-9.4-9-16.2a9 9 0 1 1 18 0C9-9.4 1.6-5.2 0 0Z";

function franceShapes() {
  const topology: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "public/geo/france.json"), "utf8"));
  const { land } = parseFrance(topology);
  const regions = (topology as Topology).objects.regions;
  const borders = mesh(topology as Topology, regions as Parameters<typeof mesh>[1], (a, b) => a !== b);
  const projection = geoConicConformal().parallels([44, 49]).rotate([-3, 0]).fitSize([SIZE, SIZE], land);
  // Whole pixels are plenty at this size and keep the inlined SVG small.
  const toPath = geoPath(projection).digits(0);
  const point = (lonLat: LonLat) => projection([lonLat[0], lonLat[1]]) ?? [0, 0];
  return { land: toPath(land) ?? "", borders: toPath(borders) ?? "", guess: point(DEMO_GUESS), answer: point(DEMO_ANSWER) };
}

/**
 * France with a demo round on a loop: a pin drops, a line runs to the answer and the score pops.
 * Static, server-rendered SVG: no map library, and no real site given away. With reduced motion
 * it shows the round's last frame.
 */
export function HeroMap() {
  const { land, borders, guess, answer } = franceShapes();
  const km = distanceKm(DEMO_GUESS, DEMO_ANSWER);
  const score = scoreFor(km, DEMO_SCALE_KM);
  const pct = (value: number) => `${(value / SIZE) * 100}%`;

  return (
    <figure className="hero-demo relative" aria-label="Exemple de manche : une épingle posée près de la bonne réponse">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full" role="img" aria-hidden>
        <defs>
          <mask id="hero-line-mask">
            <line
              x1={guess[0]}
              y1={guess[1]}
              x2={answer[0]}
              y2={answer[1]}
              pathLength={100}
              stroke="white"
              strokeWidth={6}
              className="hero-line-draw"
            />
          </mask>
        </defs>
        <path d={land} fill="var(--panel-solid)" stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={1.2} strokeLinejoin="round" />
        <path d={borders} fill="none" stroke="var(--line)" strokeWidth={1} strokeLinejoin="round" />
        <line
          x1={guess[0]}
          y1={guess[1]}
          x2={answer[0]}
          y2={answer[1]}
          stroke="var(--ink)"
          strokeOpacity={0.55}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          mask="url(#hero-line-mask)"
        />
        <g transform={`translate(${answer[0]} ${answer[1]})`}>
          <g className="hero-answer">
            <circle r={13} fill="var(--answer)" fillOpacity={0.18} />
            <circle r={6} fill="var(--answer)" stroke="var(--panel-solid)" strokeWidth={2} />
          </g>
        </g>
        <g transform={`translate(${guess[0]} ${guess[1]}) scale(1.4)`}>
          <g className="hero-pin">
            <path d={PIN_PATH} fill="var(--accent)" stroke="var(--accent-ink)" strokeWidth={1.5} />
            <circle cy={-16.2} r={3.4} fill="var(--accent-ink)" />
          </g>
        </g>
      </svg>
      <figcaption
        className="hero-chip panel absolute flex -translate-x-1/2 items-baseline gap-2 rounded-full px-3 py-1.5 font-mono text-sm whitespace-nowrap tabular-nums"
        style={{ left: pct((guess[0] + answer[0]) / 2), top: pct(Math.max(guess[1], answer[1]) + 22) }}
      >
        {/* Coloured like a round result in the game. */}
        <span className="font-semibold" style={{ color: TIER_COLOR[scoreTier(score)] }}>
          +{formatScore(score)}
        </span>
        <span className="text-muted">{formatDistance(km)}</span>
      </figcaption>
    </figure>
  );
}
