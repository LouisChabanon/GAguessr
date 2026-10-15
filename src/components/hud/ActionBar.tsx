import type { Ref } from "react";
import type { RoundResult } from "@/game/evaluate";
import { buttonClass } from "@/components/ui/button";
import { ScoreBar, TIER_COLOR } from "@/components/ui/ScoreBar";
import { formatDistance, formatPercent, formatScore } from "@/lib/format";
import type { TargetStat } from "@/lib/scores/types";
import { scoreTier } from "@/lib/geo/scoring";

interface ActionBarProps {
  hasGuess: boolean;
  result: RoundResult | undefined;
  /** How other players did on the revealed site, when enough have played it. */
  crowd?: { stat: TargetStat; withinKm: number };
  isLastRound: boolean;
  onConfirm: () => void;
  onNext: () => void;
  ref?: Ref<HTMLElement>;
}

export function ActionBar({ hasGuess, result, crowd, isLastRound, onConfirm, onNext, ref }: ActionBarProps) {
  return (
    <footer
      ref={ref}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3 sm:p-6">
      {result ? (
        <RoundResultPanel result={result} crowd={crowd} isLastRound={isLastRound} onNext={onNext} />
      ) : (
        <div className="panel enter-up pointer-events-auto flex items-center gap-4 rounded-2xl py-2 pr-2 pl-5">
          <p className="text-sm text-muted">
            {hasGuess ? "Content de votre épingle ?" : "Cliquez sur la carte pour placer votre épingle"}
          </p>
          <button type="button" className={buttonClass("primary")} disabled={!hasGuess} onClick={onConfirm}>
            Valider
          </button>
        </div>
      )}
    </footer>
  );
}

interface RoundResultPanelProps {
  result: RoundResult;
  crowd: ActionBarProps["crowd"];
  isLastRound: boolean;
  onNext: () => void;
}

function RoundResultPanel({ result, crowd, isLastRound, onNext }: RoundResultPanelProps) {
  const tier = scoreTier(result.score);

  return (
    <section
      aria-live="polite"
      data-testid="round-result"
      className="panel enter-up pointer-events-auto w-full max-w-md rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-answer align-middle" aria-hidden />
            {result.target.name}
          </p>
          {result.target.detail && <p className="mt-0.5 text-xs text-pretty text-muted">{result.target.detail}</p>}
          {result.target.description && (
            <p className="mt-1.5 text-sm text-pretty" data-testid="round-description">
              {result.target.description}
            </p>
          )}
          <p className="mt-1 font-mono text-2xl font-medium tracking-tight tabular-nums">
            {formatDistance(result.distanceKm)}
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
      {crowd && (
        <p className="mt-2.5 flex items-center gap-2 text-xs text-muted" data-testid="round-crowd">
          <span className="size-2 shrink-0 rounded-full bg-crowd" aria-hidden />
          <span>
            <span className="font-medium text-ink tabular-nums">{formatPercent(crowd.stat.withinShare)}</span> des joueurs l’ont
            placé à moins de {formatDistance(crowd.withinKm)}
          </span>
        </p>
      )}
      <button
        type="button"
        // Keyboard flow: Enter on the map confirms, Enter again moves on.
        autoFocus
        className={buttonClass("primary", "mt-4 w-full")}
        onClick={onNext}
      >
        {isLastRound ? "Voir les résultats" : "Manche suivante"}
      </button>
    </section>
  );
}
