"use client";

import { useEffect, useState } from "react";
import { parseCrowdData } from "@/lib/scores/crowd";
import type { CrowdData } from "@/lib/scores/types";

/** Other players' guesses for a mode, fetched once in the background; null until (or unless) they arrive. */
export function useCrowdData(modeId: string): CrowdData | null {
  const [loaded, setLoaded] = useState<{ modeId: string; data: CrowdData | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/crowd/${encodeURIComponent(modeId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => setLoaded({ modeId, data: parseCrowdData(json) }))
      .catch((error: unknown) => {
        // The game is complete without crowd data; just leave the layer off.
        if (!controller.signal.aborted) console.warn("[crowd] unavailable", error);
      });
    return () => controller.abort();
  }, [modeId]);

  return loaded?.modeId === modeId ? loaded.data : null;
}
