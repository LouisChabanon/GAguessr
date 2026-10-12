import { MAX_ROUND_SCORE, scoreTier } from "@/lib/geo/scoring";

export const TIER_COLOR = {
  great: "var(--great)",
  good: "var(--good)",
  poor: "var(--poor)",
} as const;

interface ScoreBarProps {
  score: number;
  className?: string;
}

/** Horizontal meter of a round score out of the max, colored by tier. */
export function ScoreBar({ score, className = "" }: ScoreBarProps) {
  const ratio = Math.min(1, Math.max(0, score / MAX_ROUND_SCORE));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-line ${className}`} aria-hidden>
      <div
        className="h-full origin-left rounded-full transition-transform duration-700 ease-out"
        style={{ transform: `scaleX(${ratio})`, background: TIER_COLOR[scoreTier(score)] }}
      />
    </div>
  );
}
