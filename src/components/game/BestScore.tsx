"use client";

import { useBestScore } from "@/hooks/useBestScore";
import { formatScore } from "@/lib/format";

export function BestScore({ modeId }: { modeId: string }) {
  const best = useBestScore(modeId);
  return (
    <span className="font-mono text-sm tabular-nums" data-testid={`best-${modeId}`}>
      {best === null ? <span className="text-muted">—</span> : formatScore(best)}
    </span>
  );
}
