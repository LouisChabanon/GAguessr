"use client";

import { useBestScore } from "@/hooks/useBestScore";
import { formatScore } from "@/lib/format";

interface BestScoreProps {
  modeId: string;
  className?: string;
}

export function BestScore({ modeId, className = "text-sm" }: BestScoreProps) {
  const best = useBestScore(modeId);
  return (
    <span className={`font-mono tabular-nums ${className}`} data-testid={`best-${modeId}`}>
      {best === null ? <span className="text-muted">—</span> : formatScore(best)}
    </span>
  );
}
