"use client";

import { useEffect, useState } from "react";
import type { GameMode, Target } from "@/modes/types";

/** A mode's targets by id, once loaded; null until then. Throws to the error boundary if they cannot load. */
export function useModeTargets(mode: GameMode): ReadonlyMap<string, Target> | null {
  const [targets, setTargets] = useState<{ modeId: string; byId: ReadonlyMap<string, Target> } | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (error) throw error;

  useEffect(() => {
    let cancelled = false;
    mode
      .loadTargets()
      .then((list) => {
        if (!cancelled) setTargets({ modeId: mode.id, byId: new Map(list.map((t) => [t.id, t])) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return targets?.modeId === mode.id ? targets.byId : null;
}
