import type { DuelPlayer } from "./types";

/** The viewer is always yellow, like their pin in solo games. */
export const MY_COLOR = "var(--accent)";
const OTHER_COLORS = [
  "var(--opponent)",
  "var(--player-2)",
  "var(--player-3)",
  "var(--player-4)",
  "var(--player-5)",
  "var(--player-6)",
  "var(--player-7)",
] as const;

/** Each player's color for this viewer: theirs, then the others in seat order. Stable for the whole duel. */
export function playerColors(players: readonly DuelPlayer[]): ReadonlyMap<number, string> {
  const others = players.filter((p) => !p.isMe);
  return new Map([
    ...players.filter((p) => p.isMe).map((p) => [p.seat, MY_COLOR] as const),
    ...others.map((p, i) => [p.seat, OTHER_COLORS[i % OTHER_COLORS.length]] as const),
  ]);
}

/** "Vous" for the viewer, else their pseudo. */
export function playerName(player: Pick<DuelPlayer, "isMe" | "pseudo" | "seat">): string {
  return player.isMe ? "Vous" : (player.pseudo ?? `Joueur ${player.seat + 1}`);
}
