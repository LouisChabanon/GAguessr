"use client";

import { useEffect, useState } from "react";
import { remainingMs } from "@/game/duel/phase";

/** The display only shows whole seconds; a few ticks per second keep it from lagging behind. */
const TICK_MS = 250;

/**
 * Time left until `until` (server clock), re-rendering a few times per second.
 * Use it in a leaf component: everything rendering it re-renders on each tick.
 */
export function useCountdown(until: number | null, offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);

  useEffect(() => {
    if (until === null) return;
    const tick = () => setNow(Date.now() + offsetMs);
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [until, offsetMs]);

  return remainingMs(until, now);
}
