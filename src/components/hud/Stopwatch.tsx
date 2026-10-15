"use client";

import type { Clock } from "@/game/gameReducer";
import { useStopwatch } from "@/hooks/useStopwatch";
import { formatClock } from "@/lib/format";

/** The ticking clock on its own, so only this text re-renders every tick, not the map. */
export function Stopwatch({ stoppedMs, runningSince }: Clock) {
  const timeMs = useStopwatch({ stoppedMs, runningSince });
  // Not a live region: a screen reader would announce every second.
  return <time dateTime={`PT${Math.floor(timeMs / 1000)}S`}>{formatClock(timeMs)}</time>;
}
