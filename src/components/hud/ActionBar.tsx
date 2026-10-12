import type { Ref } from "react";
import type { RoundResult } from "@/game/evaluate";
import { buttonClass } from "@/components/ui/button";
import { ScoreBar, TIER_COLOR } from "@/components/ui/ScoreBar";
import { formatDistance, formatScore } from "@/lib/format";
import { scoreTier } from "@/lib/geo/scoring";

interface ActionBarProps {
  hasGuess: boolean;
  result: RoundResult | undefined;
  isLastRound: boolean;
  onConfirm: () => void;
  onNext: () => void;
  ref?: Ref<HTMLElement>;
}

export function ActionBar({ hasGuess, result, isLastRound, onConfirm, onNext, ref }: ActionBarProps) {
  return (
    <footer
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3 sm:p-6">
      {result ? (
        <RoundResultPanel result={result} isLastRound={isLastRound} onNext={onNext} />
      ) : (
        <div className="panel enter-up pointer-events-auto flex items-center gap-4 rounded-2xl py-2 pr-2 pl-5">
          <p className="text-sm text-muted">
            {hasGuess ? "Happy with your pin?" : "Click the map to drop your pin"}
          </p>
          <button type="button" className={buttonClass("primary")} disabled={!hasGuess} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      )}
    </footer>
  );
}

interface RoundResultPanelProps {
  result: RoundResult;
  isLastRound: boolean;
  onNext: () => void;
}

function RoundResultPanel({ result, isLastRound, onNext }: RoundResultPanelProps) {
  const tier = scoreTier(result.score);
  const inside = result.distanceKm === 0 && result.target.kind === "area";

  return (
    <section
      aria-live="polite"
      data-testid="round-result"
      className="panel enter-up pointer-events-auto w-full max-w-md rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-answer align-middle" aria-hidden />
            {result.target.name}
            {result.target.detail && <span className="text-muted/80"> · {result.target.detail}</span>}
          </p>
          <p className="mt-1 font-mono text-2xl font-medium tracking-tight tabular-nums">
            {inside ? "Inside!" : formatDistance(result.distanceKm)}
          </p>
        </div>
        <p
          className="font-mono text-2xl font-semibold tabular-nums"
          style={{ color: TIER_COLOR[tier] }}
          data-testid="round-score"
        >
          +{formatScore(result.score)}
        </p>
      </div>
      <ScoreBar score={result.score} className="mt-3" />
      <button
        type="button"
        // Keyboard flow: Enter on the map confirms, Enter again moves on.
        autoFocus
        className={buttonClass("primary", "mt-4 w-full")}
        onClick={onNext}
      >
        {isLastRound ? "See results" : "Next round"}
      </button>
    </section>
  );
}
