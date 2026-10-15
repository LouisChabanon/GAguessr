import Link from "next/link";
import type { RoundResult } from "@/game/evaluate";
import type { ScoreRecord } from "@/hooks/useBestScore";
import { buttonClass } from "@/components/ui/button";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatDistance, formatScore } from "@/lib/format";
import { MAX_ROUND_SCORE } from "@/lib/geo/scoring";

interface GameSummaryProps {
  modeTitle: string;
  results: readonly RoundResult[];
  total: number;
  record: ScoreRecord | null;
  onPlayAgain: () => void;
}

export function GameSummary({ modeTitle, results, total, record, onPlayAgain }: GameSummaryProps) {
  const max = results.length * MAX_ROUND_SCORE;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-surface/40 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="summary-heading"
        data-testid="game-summary"
        className="enter-up w-full max-w-lg rounded-3xl border border-line bg-panel-solid p-6 shadow-pop sm:p-8"
      >
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">{modeTitle}</p>
        <h2 id="summary-heading" className="mt-3 flex items-baseline gap-2 font-mono tabular-nums">
          <span className="text-5xl font-semibold tracking-tight sm:text-6xl">{formatScore(total)}</span>
          <span className="text-lg text-muted">/ {formatScore(max)}</span>
        </h2>
        {record && <BestScoreNote record={record} />}

        <ol className="mt-6 divide-y divide-line border-y border-line">
          {results.map((r, i) => (
            <li key={r.target.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{r.target.name}</p>
                <ScoreBar score={r.score} className="mt-1.5 max-w-40" />
              </div>
              <div className="text-right font-mono tabular-nums">
                <p>{formatScore(r.score)}</p>
                <p className="text-xs text-muted">{formatDistance(r.distanceKm)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/" className={buttonClass("ghost", "h-11")}>
            Accueil
          </Link>
          <button type="button" autoFocus className={buttonClass("primary")} onClick={onPlayAgain}>
            Rejouer
          </button>
        </div>
      </section>
    </div>
  );
}

function BestScoreNote({ record }: { record: ScoreRecord }) {
  if (record.isNewBest) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/30 px-2.5 py-1 text-xs font-medium text-accent-text">
        {record.previousBest === null ? "Premier score enregistré" : "Nouveau record personnel"}
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-muted">
      Record personnel <span className="font-mono tabular-nums">{formatScore(record.previousBest ?? 0)}</span>
    </p>
  );
}
