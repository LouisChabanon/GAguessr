import type { Target } from "@/modes/types";
import { MIN_PLAYS_FOR_STATS } from "./crowd";
import type { TargetStat } from "./types";

export interface RankedSite {
  target: Target;
  /** Null until the site has enough plays to say anything. */
  stat: TargetStat | null;
}

/** Best-known sites first (highest average score); sites without enough plays go last, by name. */
export function rankSites(targets: readonly Target[], stats: Readonly<Record<string, TargetStat>>): RankedSite[] {
  const sites = targets.map((target) => {
    const stat = stats[target.id];
    return { target, stat: stat && stat.plays >= MIN_PLAYS_FOR_STATS ? stat : null };
  });
  return sites.toSorted((a, b) => {
    if (a.stat && b.stat) return b.stat.avgScore - a.stat.avgScore;
    if (a.stat || b.stat) return a.stat ? -1 : 1;
    return a.target.name.localeCompare(b.target.name, "fr");
  });
}
