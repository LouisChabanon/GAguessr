"use client";

import { useOwnPseudo } from "@/hooks/useOwnPseudo";
import { formatDate, formatDuration, formatRank, formatScore } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/scores/types";

const PODIUM = 3;

/** Leaderboard rows; the visitor's own row is picked out once their pseudo is known. */
export function LeaderboardTable({ rows }: { rows: readonly LeaderboardRow[] }) {
  const ownPseudo = useOwnPseudo();

  return (
    <ol className="divide-y divide-line" data-testid="leaderboard">
      {rows.map((row) => {
        const isOwn = row.pseudo === ownPseudo;
        return (
          <li
            key={row.pseudo}
            aria-current={isOwn ? "true" : undefined}
            className="-mx-3 grid grid-cols-[3rem_1fr_auto] items-center gap-x-4 rounded-xl px-3 py-3 aria-[current=true]:bg-accent/25"
          >
            <span className={`font-mono tabular-nums ${row.rank <= PODIUM ? "text-lg font-semibold" : "text-sm text-muted"}`}>
              {formatRank(row.rank)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {row.pseudo}
                {isOwn && <span className="ml-2 text-xs font-normal text-muted">(vous)</span>}
              </span>
              <span className="block text-xs text-muted">{formatDate(new Date(row.playedAt))}</span>
            </span>
            <span className="text-right font-mono tabular-nums">
              <span className="block">
                {formatScore(row.totalScore)}
                <span className="text-xs text-muted"> / {formatScore(row.maxScore)}</span>
              </span>
              <span className="block text-xs text-muted">{formatDuration(row.timeMs)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
