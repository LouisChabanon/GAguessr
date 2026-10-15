"use client";

import { useEffect, useState } from "react";
import { elapsedMs, type Clock } from "@/game/gameReducer";

/** The display only shows whole seconds; a few ticks per second keep it from lagging behind. */
const TICK_MS = 250;

/**
 * Guessing time so far, re-rendering a few times per second while the clock runs.
 * Use it in a leaf component: everything rendering it re-renders on each tick.
 */
export function useStopwatch(clock: Clock): number {
  const [now, setNow] = useState<number | null>(null);
  const { runningSince } = clock;

  useEffect(() => {
    if (runningSince === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [runningSince]);

  // Before the first tick, the round has only just started.
  return elapsedMs(clock, now ?? runningSince ?? 0);
}
