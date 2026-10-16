import { playerColors, playerName } from "@/lib/duel/colors";
import type { DuelPlayer } from "@/lib/duel/types";

/** Who sits in a lobby, and the seats still free. */
export function PlayerList({ players, maxPlayers }: { players: readonly DuelPlayer[]; maxPlayers: number }) {
  const colors = playerColors(players);
  const free = Math.max(0, maxPlayers - players.length);
  return (
    <div>
      <p className="flex items-baseline justify-between text-xs font-medium tracking-[0.16em] text-muted uppercase">
        <span>Joueurs</span>
        <span className="font-mono tracking-normal tabular-nums" data-testid="duel-seats">
          {players.length}/{maxPlayers}
        </span>
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" data-testid="duel-players">
        {players.map((player) => (
          <li key={player.seat} className="enter-up flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors.get(player.seat) }} aria-hidden />
            <span className={`min-w-0 flex-1 truncate ${player.isMe ? "font-semibold" : ""}`}>{playerName(player)}</span>
            {player.isHost && <span className="shrink-0 text-[11px] font-medium text-muted">Hôte</span>}
          </li>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <li key={`free-${i}`} className="photo-placeholder flex items-center rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
            Place libre
          </li>
        ))}
      </ul>
    </div>
  );
}
