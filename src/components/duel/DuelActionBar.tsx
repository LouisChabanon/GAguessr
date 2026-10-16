"use client";

import type { Ref } from "react";
import { buttonClass } from "@/components/ui/button";
import { ScoreBar, TIER_COLOR } from "@/components/ui/ScoreBar";
import { duelStandings } from "@/game/duel/outcome";
import { revealEndsAt } from "@/game/duel/phase";
import type { UseDuel } from "@/hooks/useDuel";
import { playerColors, playerName } from "@/lib/duel/colors";
import type { DuelPlayer, DuelRound, DuelView } from "@/lib/duel/types";
import { formatDistance, formatScore } from "@/lib/format";
import { scoreTier } from "@/lib/geo/scoring";
import { DuelTimer } from "./DuelTimer";

interface DuelActionBarProps {
  duel: UseDuel;
  view: DuelView;
  /** The round being revealed, during a reveal. */
  revealed: DuelRound | undefined;
  targetName: string;
  ref?: Ref<HTMLElement>;
}

/** "Bob a validé", "3 joueurs ont validé". */
function lockedLabel(locked: readonly DuelPlayer[]): string {
  return locked.length === 1 ? `${playerName(locked[0])} a validé` : `${locked.length} joueurs ont validé`;
}

export function DuelActionBar({ duel, view, revealed, targetName, ref }: DuelActionBarProps) {
  const { phase } = duel;
  const colors = playerColors(view.players);
  const others = view.players.filter((p) => !p.isMe);
  const waitingFor = others.filter((p) => !p.hasLocked);

  return (
    <footer ref={ref} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-3 sm:p-6">
      {duel.isConnectionUnstable && (
        <p className="panel enter-up pointer-events-auto flex items-center gap-2 rounded-full px-4 py-1.5 text-sm" role="status" data-testid="duel-connection">
          <span className="size-2 animate-pulse rounded-full bg-poor" aria-hidden />
          Connexion instable, reconnexion…
        </p>
      )}
      <Scoreboard players={view.players} colors={colors} showLocks={phase !== "reveal"} />
      {phase === "guessing" && <GuessPanel duel={duel} view={view} />}
      {phase === "locked" && (
        <div className="panel enter-up pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3" role="status" data-testid="duel-locked">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden />
          <p className="text-sm">
            {duel.isSendingLock ? "Envoi de votre épingle…" : "Épingle validée."}{" "}
            {duel.isSendingLock
              ? null
              : waitingFor.length === 0
              ? "Résultat…"
              : waitingFor.length === 1
                ? `En attente de ${playerName(waitingFor[0])}…`
                : `En attente de ${waitingFor.length} joueurs…`}
          </p>
        </div>
      )}
      {phase === "reveal" && revealed && <RevealPanel duel={duel} view={view} round={revealed} targetName={targetName} colors={colors} />}
    </footer>
  );
}

interface ScoreboardProps {
  players: readonly DuelPlayer[];
  colors: ReadonlyMap<number, string>;
  /** Light up whoever locked the current round; off during the reveal. */
  showLocks: boolean;
}

/** Everyone's total, best first, with a ring on those who locked the current round. */
function Scoreboard({ players, colors, showLocks }: ScoreboardProps) {
  const standings = duelStandings(players);
  return (
    <ol className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-1.5" data-testid="duel-scoreboard" aria-label="Classement">
      {standings.map(({ player, place }) => {
        const hasLocked = showLocks && player.hasLocked;
        return (
          <li
            key={player.seat}
            data-locked={hasLocked}
            className="panel flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm transition-shadow duration-150 data-[locked=true]:ring-2 data-[locked=true]:ring-(--ring)"
            style={{ ["--ring" as string]: colors.get(player.seat) }}
          >
            <span className="grid size-5 place-items-center rounded-full font-mono text-[10px] font-semibold text-accent-ink tabular-nums" style={{ background: colors.get(player.seat) }}>
              {place}
            </span>
            <span className={`max-w-28 truncate ${player.isMe ? "font-semibold" : "text-muted"}`}>{playerName(player)}</span>
            <span className="font-mono tabular-nums">{formatScore(player.total)}</span>
            {hasLocked && <span className="sr-only">a validé</span>}
          </li>
        );
      })}
    </ol>
  );
}

function GuessPanel({ duel, view }: { duel: UseDuel; view: DuelView }) {
  const hasGuess = duel.guess !== null;
  const locked = view.players.filter((p) => !p.isMe && p.hasLocked);
  return (
    <div className="panel enter-up pointer-events-auto flex flex-col items-stretch rounded-2xl sm:flex-row sm:items-center">
      {locked.length > 0 && (
        <p className="border-b border-line px-5 py-2 text-sm font-medium text-poor sm:border-r sm:border-b-0" role="status" data-testid="duel-hurry">
          {lockedLabel(locked)} : plus que <DuelTimer until={view.roundDeadline} offsetMs={duel.offsetMs} format="seconds" />
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
  colors: ReadonlyMap<number, string>;
}

/** Every answer to the round just played, best first. */
function RevealPanel({ duel, view, round, targetName, colors }: RevealPanelProps) {
  const isLast = view.status === "finished";
  const best = Math.max(...round.answers.map((a) => a.score));
  const rows = view.players
    .map((player) => ({ player, answer: round.answers.find((a) => a.seat === player.seat) }))
    .sort((a, b) => (b.answer?.score ?? 0) - (a.answer?.score ?? 0) || a.player.seat - b.player.seat);

  return (
    <section aria-live="polite" data-testid="duel-reveal" className="panel enter-up pointer-events-auto w-full max-w-md rounded-2xl p-4 sm:p-5">
      <p className="truncate text-sm font-medium">
        <span className="mr-1.5 inline-block size-2 rounded-full bg-answer align-middle" aria-hidden />
        {targetName}
      </p>
      {duel.notice && (
        <p className="mt-2 rounded-lg bg-poor/10 px-3 py-2 text-xs text-pretty text-poor" role="alert" data-testid="duel-late-lock">
          {duel.notice === "lock_too_late"
            ? "Votre validation n’est pas arrivée à temps : c’est votre dernière épingle reçue qui compte."
            : "Votre validation n’est pas arrivée à temps, ni aucune épingle : la connexion était trop lente."}
        </p>
      )}
      <ul className="mt-3 max-h-56 space-y-2.5 overflow-y-auto">
        {rows.map(({ player, answer }) => (
          <li key={player.seat}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: colors.get(player.seat) }} aria-hidden />
                <span className={`truncate ${answer && answer.score === best && best > 0 ? "font-semibold" : ""}`}>{playerName(player)}</span>
                <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
                  {answer?.distanceKm == null ? "temps écoulé" : formatDistance(answer.distanceKm)}
                  {answer?.guess && !answer.isLocked && " · non validée"}
                </span>
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: TIER_COLOR[scoreTier(answer?.score ?? 0)] }}>
                +{formatScore(answer?.score ?? 0)}
              </span>
            </div>
            <ScoreBar score={answer?.score ?? 0} className="mt-1" />
          </li>
        ))}
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
