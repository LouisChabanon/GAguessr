"use client";

import type { Ref } from "react";
import { buttonClass } from "@/components/ui/button";
import { ScoreBar, TIER_COLOR } from "@/components/ui/ScoreBar";
import { revealEndsAt } from "@/game/duel/phase";
import type { UseDuel } from "@/hooks/useDuel";
import type { DuelGuess, DuelRound, DuelView } from "@/lib/duel/types";
import { formatDistance, formatScore } from "@/lib/format";
import { scoreTier } from "@/lib/geo/scoring";
import { DuelTimer } from "./DuelTimer";

interface DuelActionBarProps {
  duel: UseDuel;
  view: DuelView;
  /** The round being revealed, during a reveal. */
  revealed: DuelRound | undefined;
  targetName: string;
  myTotal: number;
  opponentTotal: number;
  opponentName: string;
  ref?: Ref<HTMLElement>;
}

export function DuelActionBar({ duel, view, revealed, targetName, myTotal, opponentTotal, opponentName, ref }: DuelActionBarProps) {
  const { phase } = duel;
  return (
    <footer ref={ref} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-3 sm:p-6">
      <Scoreboard myTotal={myTotal} opponentTotal={opponentTotal} opponentName={opponentName} opponentLocked={phase !== "reveal" && view.opponentLocked} />
      {phase === "guessing" && <GuessPanel duel={duel} view={view} opponentName={opponentName} />}
      {phase === "locked" && (
        <div className="panel enter-up pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3" role="status" data-testid="duel-locked">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
          <p className="text-sm">
            Épingle validée. {view.opponentLocked ? "Résultat…" : `En attente de ${opponentName}…`}
          </p>
        </div>
      )}
      {phase === "reveal" && revealed && (
        <RevealPanel duel={duel} view={view} round={revealed} targetName={targetName} opponentName={opponentName} />
      )}
    </footer>
  );
}

interface ScoreboardProps {
  myTotal: number;
  opponentTotal: number;
  opponentName: string;
  opponentLocked: boolean;
}

/** Both totals side by side, with a light on the opponent once they lock the current round. */
function Scoreboard({ myTotal, opponentTotal, opponentName, opponentLocked }: ScoreboardProps) {
  const lead = Math.sign(myTotal - opponentTotal);
  return (
    <dl className="panel pointer-events-auto grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-full px-4 py-1.5 text-sm" data-testid="duel-scoreboard">
      <div className="flex items-baseline justify-end gap-2">
        <dt className="text-muted">Vous</dt>
        <dd className={`font-mono tabular-nums ${lead > 0 ? "font-semibold" : ""}`}>{formatScore(myTotal)}</dd>
      </div>
      <span className="h-4 w-px bg-line" aria-hidden />
      <div className="flex flex-row-reverse items-baseline justify-end gap-2">
        <dt className="flex max-w-32 items-center gap-1.5 text-muted">
          <span className="truncate">{opponentName}</span>
          <span
            data-locked={opponentLocked}
            className="size-2 shrink-0 rounded-full bg-line transition-colors duration-150 data-[locked=true]:bg-opponent"
            aria-hidden
          />
          {opponentLocked && <span className="sr-only">a validé</span>}
        </dt>
        <dd className={`font-mono tabular-nums ${lead < 0 ? "font-semibold" : ""}`}>{formatScore(opponentTotal)}</dd>
      </div>
    </dl>
  );
}

function GuessPanel({ duel, view, opponentName }: { duel: UseDuel; view: DuelView; opponentName: string }) {
  const hasGuess = duel.guess !== null;
  return (
    <div className="panel enter-up pointer-events-auto flex flex-col items-stretch rounded-2xl sm:flex-row sm:items-center">
      {view.opponentLocked && (
        <p
          className="border-b border-line px-5 py-2 text-sm font-medium text-poor sm:border-r sm:border-b-0"
          role="status"
          data-testid="duel-hurry"
        >
          {opponentName} a validé : plus que{" "}
          <DuelTimer until={view.roundDeadline} offsetMs={duel.offsetMs} format="seconds" />
          &nbsp;s
        </p>
      )}
      <div className="flex items-center gap-4 py-2 pr-2 pl-5">
        <p className="text-sm text-muted">{hasGuess ? "Content de votre épingle ?" : "Cliquez sur la carte pour placer votre épingle"}</p>
        <button type="button" className={buttonClass("primary")} disabled={!hasGuess || duel.isBusy} onClick={duel.lock}>
          Valider
        </button>
      </div>
    </div>
  );
}

interface RevealPanelProps {
  duel: UseDuel;
  view: DuelView;
  round: DuelRound;
  targetName: string;
  opponentName: string;
}

function RevealPanel({ duel, view, round, targetName, opponentName }: RevealPanelProps) {
  const isLast = view.status === "finished";
  return (
    <section aria-live="polite" data-testid="duel-reveal" className="panel enter-up pointer-events-auto w-full max-w-md rounded-2xl p-4 sm:p-5">
      <p className="truncate text-sm font-medium">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-answer align-middle" aria-hidden />
        {targetName}
      </p>
      <ul className="mt-3 space-y-3">
        <AnswerRow label="Vous" answer={round.me} isWinner={round.me.score > round.opponent.score} dotClass="bg-accent" />
        <AnswerRow label={opponentName} answer={round.opponent} isWinner={round.opponent.score > round.me.score} dotClass="bg-opponent" />
      </ul>
      {isLast ? (
        <button type="button" autoFocus className={buttonClass("primary", "mt-4 w-full")} onClick={duel.showResult}>
          Voir le résultat
        </button>
      ) : (
        <p className="mt-4 text-center text-sm text-muted" role="status">
          Manche suivante dans <DuelTimer until={revealEndsAt(view)} offsetMs={duel.offsetMs} format="seconds" />
          &nbsp;s
        </p>
      )}
    </section>
  );
}

function AnswerRow({ label, answer, isWinner, dotClass }: { label: string; answer: DuelGuess; isWinner: boolean; dotClass: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
          <span className={`truncate ${isWinner ? "font-semibold" : ""}`}>{label}</span>
          <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
            {answer.distanceKm === null ? "temps écoulé" : formatDistance(answer.distanceKm)}
          </span>
        </span>
        <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: TIER_COLOR[scoreTier(answer.score)] }}>
          +{formatScore(answer.score)}
        </span>
      </div>
      <ScoreBar score={answer.score} className="mt-1.5" />
    </li>
  );
}
