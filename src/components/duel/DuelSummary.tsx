"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { duelStandings, duelVerdict, type DuelVerdict } from "@/game/duel/outcome";
import { useModeTargets } from "@/hooks/useModeTargets";
import { playerColors, playerName } from "@/lib/duel/colors";
import type { DuelView } from "@/lib/duel/types";
import { formatDistance, formatRank, formatScore } from "@/lib/format";
import type { GameMode } from "@/modes/types";
import { Eyebrow } from "./DuelScreen";

interface DuelSummaryProps {
  view: DuelView;
  mode: GameMode;
  isBusy: boolean;
  onRematch: () => void;
}

function headline(verdict: DuelVerdict, isOneOnOne: boolean): string {
  if (verdict.kind === "win") return "Victoire";
  if (verdict.kind === "tie") return "Égalité";
  return isOneOnOne ? "Défaite" : `${formatRank(verdict.place)} place`;
}

/** The duel's result: the final standings, every round player by player, and a rematch. */
export function DuelSummary({ view, mode, isBusy, onRematch }: DuelSummaryProps) {
  const targets = useModeTargets(mode);
  const standings = duelStandings(view.players);
  const verdict = duelVerdict(standings);
  const colors = playerColors(view.players);
  // Columns follow the standings, so the round-by-round table reads like the podium.
  const columns = standings.map((s) => s.player);

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <section
        aria-labelledby="duel-summary-heading"
        data-testid="duel-summary"
        className="enter-up w-full max-w-xl rounded-3xl border border-line bg-panel-solid p-6 shadow-pop sm:p-8"
      >
        <Eyebrow>
          Duel · {mode.title} · {view.players.length} joueurs
        </Eyebrow>
        <h1
          id="duel-summary-heading"
          data-verdict={verdict.kind}
          className="mt-3 text-5xl font-semibold tracking-[-0.04em] data-[verdict=place]:text-muted data-[verdict=win]:text-accent-text sm:text-6xl"
        >
          {headline(verdict, view.players.length === 2)}
        </h1>

        <ol className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line" data-testid="duel-standings">
          {standings.map(({ player, place }) => (
            <li key={player.seat} data-first={place === 1} className="flex items-center gap-3 px-4 py-2.5 data-[first=true]:bg-accent/15">
              <span className="w-7 font-mono text-sm text-muted tabular-nums">{formatRank(place)}</span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors.get(player.seat) }} aria-hidden />
              <span className={`min-w-0 flex-1 truncate ${player.isMe ? "font-semibold" : ""}`}>{playerName(player)}</span>
              <span className={`font-mono text-xl tabular-nums ${place === 1 ? "font-semibold" : ""}`}>{formatScore(player.total)}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-max border-y border-line text-sm">
            <caption className="sr-only">Score de chaque manche</caption>
            <thead className="border-b border-line text-[11px] tracking-[0.12em] text-muted uppercase">
              <tr>
                <th scope="col" className="py-2 text-left font-medium">
                  <span className="sr-only">Site</span>
                </th>
                {columns.map((player) => (
                  <th key={player.seat} scope="col" className="max-w-24 truncate py-2 pl-3 text-right font-medium">
                    {playerName(player)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {view.rounds.map((round, i) => {
                const best = Math.max(...round.answers.map((a) => a.score));
                return (
                  <tr key={round.targetId}>
                    <th scope="row" className="max-w-48 py-2.5 pr-3 text-left font-medium">
                      <span className="mr-3 font-mono text-xs font-normal text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {targets?.get(round.targetId)?.name ?? round.targetId}
                    </th>
                    {columns.map((player) => {
                      const answer = round.answers.find((a) => a.seat === player.seat);
                      const score = answer?.score ?? 0;
                      return (
                        <td key={player.seat} className="py-2.5 pl-3 text-right font-mono tabular-nums">
                          <p data-best={score === best && best > 0} className="data-[best=true]:font-semibold">
                            {formatScore(score)}
                          </p>
                          <p className="text-xs text-muted">{answer?.distanceKm == null ? "—" : formatDistance(answer.distanceKm)}</p>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
