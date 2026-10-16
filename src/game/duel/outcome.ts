import type { DuelPlayer } from "@/lib/duel/types";

export interface Standing {
  player: DuelPlayer;
  /** 1 for the best total; equal totals share a place, and the next place is skipped (1, 1, 3). */
  place: number;
}

/** Players from best to worst total. */
export function duelStandings(players: readonly DuelPlayer[]): Standing[] {
  const sorted = [...players].sort((a, b) => b.total - a.total || a.seat - b.seat);
  return sorted.map((player) => ({ player, place: 1 + sorted.filter((p) => p.total > player.total).length }));
}

export type DuelVerdict = { kind: "win" } | { kind: "tie" } | { kind: "place"; place: number };

/** How the duel went for the viewer: won outright, shared first place, or a lower place. */
export function duelVerdict(standings: readonly Standing[]): DuelVerdict {
  const mine = standings.find((s) => s.player.isMe);
  if (!mine || mine.place > 1) return { kind: "place", place: mine?.place ?? standings.length };
  return standings.filter((s) => s.place === 1).length > 1 ? { kind: "tie" } : { kind: "win" };
}
