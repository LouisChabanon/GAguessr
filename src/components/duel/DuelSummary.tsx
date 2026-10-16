"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { duelOutcome } from "@/game/duel/outcome";
import { useModeTargets } from "@/hooks/useModeTargets";
import type { DuelGuess, DuelView } from "@/lib/duel/types";
import { formatDistance, formatScore } from "@/lib/format";
import type { GameMode } from "@/modes/types";
import { Eyebrow } from "./DuelScreen";

interface DuelSummaryProps {
  view: DuelView;
  mode: GameMode;
  isBusy: boolean;
  onRematch: () => void;
}

const HEADLINES = { me: "Victoire", opponent: "Défaite", tie: "Égalité" } as const;

/** The duel's result: who won, both totals, every round side by side, and a rematch. */
export function DuelSummary({ view, mode, isBusy, onRematch }: DuelSummaryProps) {
  const targets = useModeTargets(mode);
  const { myTotal, opponentTotal, winner } = duelOutcome(view.rounds);
  const opponentName = view.opponentPseudo ?? "Adversaire";

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <section
        aria-labelledby="duel-summary-heading"
        data-testid="duel-summary"
        className="enter-up w-full max-w-lg rounded-3xl border border-line bg-panel-solid p-6 shadow-pop sm:p-8"
      >
        <Eyebrow>Duel · {mode.title}</Eyebrow>
        <h1
          id="duel-summary-heading"
          data-winner={winner}
          className="mt-3 text-5xl font-semibold tracking-[-0.04em] data-[winner=me]:text-accent-text data-[winner=opponent]:text-muted sm:text-6xl"
        >
          {HEADLINES[winner]}
        </h1>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <Total label="Vous" score={myTotal} isWinner={winner === "me"} dotClass="bg-accent" />
          <Total label={opponentName} score={opponentTotal} isWinner={winner === "opponent"} dotClass="bg-opponent" />
        </dl>

        <table className="mt-6 w-full border-y border-line text-sm">
          <caption className="sr-only">Score de chaque manche</caption>
          <thead className="border-b border-line text-[11px] tracking-[0.12em] text-muted uppercase">
            <tr>
              <th scope="col" className="py-2 text-left font-medium">
                <span className="sr-only">Site</span>
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Vous
              </th>
              <th scope="col" className="max-w-24 truncate py-2 pl-3 text-right font-medium">
                {opponentName}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {view.rounds.map((round, i) => (
              <tr key={round.targetId}>
                <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                  <span className="mr-3 font-mono text-xs font-normal text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {targets?.get(round.targetId)?.name ?? round.targetId}
                </th>
                <RoundCell answer={round.me} isWinner={round.me.score > round.opponent.score} />
                <RoundCell answer={round.opponent} isWinner={round.opponent.score > round.me.score} />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/" className={buttonClass("ghost", "h-11")}>
            Accueil
          </Link>
          {view.rematchCode && <p className="text-sm text-muted sm:mr-auto">Revanche proposée !</p>}
          <button type="button" autoFocus className={buttonClass("primary")} disabled={isBusy} onClick={onRematch}>
            {view.rematchCode ? "Rejoindre la revanche" : "Revanche"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Total({ label, score, isWinner, dotClass }: { label: string; score: number; isWinner: boolean; dotClass: string }) {
  return (
    <div className="bg-panel-solid p-4">
      <dt className="flex items-center gap-2 truncate text-sm text-muted">
        <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        {label}
      </dt>
      <dd data-winner={isWinner} className="mt-1 font-mono text-3xl tabular-nums data-[winner=true]:font-semibold">
        {formatScore(score)}
      </dd>
    </div>
  );
}

function RoundCell({ answer, isWinner }: { answer: DuelGuess; isWinner: boolean }) {
  return (
    <td className="py-2.5 pl-3 text-right font-mono tabular-nums">
      <p data-winner={isWinner} className="data-[winner=true]:font-semibold">
        {formatScore(answer.score)}
      </p>
      <p className="text-xs text-muted">{answer.distanceKm === null ? "—" : formatDistance(answer.distanceKm)}</p>
    </td>
  );
}
