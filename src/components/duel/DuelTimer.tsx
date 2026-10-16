"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { formatClock } from "@/lib/format";

interface DuelTimerProps {
  /** Server time the countdown runs to. */
  until: number | null;
  offsetMs: number;
  /** "clock" shows 0:42, "seconds" just 42. */
  format?: "clock" | "seconds";
  /** Below this many ms left the time turns urgent. */
  urgentBelowMs?: number;
}

const MS_PER_SECOND = 1000;

/** A ticking countdown on its own, so only this text re-renders every tick. Shows whole seconds left, rounded up. */
export function DuelTimer({ until, offsetMs, format = "clock", urgentBelowMs = 0 }: DuelTimerProps) {
  const left = useCountdown(until, offsetMs);
  const seconds = Math.ceil(left / MS_PER_SECOND);
  const isUrgent = left > 0 && left <= urgentBelowMs;
  return (
    // Not a live region: a screen reader would announce every second.
    <time
      dateTime={`PT${seconds}S`}
      data-urgent={isUrgent}
      className="tabular-nums transition-colors duration-150 data-[urgent=true]:font-semibold data-[urgent=true]:text-poor"
    >
      {format === "clock" ? formatClock(seconds * MS_PER_SECOND) : seconds}
    </time>
  );
}
