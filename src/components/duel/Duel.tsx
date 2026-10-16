"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { MapLoading } from "@/components/game/MapLoading";
import { buttonClass } from "@/components/ui/button";
import { useDuel } from "@/hooks/useDuel";
import { DUEL_ERROR_MESSAGES } from "@/lib/duel/messages";
import { getMode } from "@/modes/registry";
import { DuelGame } from "./DuelGame";
import { DuelJoin } from "./DuelJoin";
import { DuelScreen } from "./DuelScreen";
import { DuelSummary } from "./DuelSummary";
import { DuelWaitingRoom } from "./DuelWaitingRoom";

/** One duel, from its lobby to its result, as seen by whoever opened its link. */
export function Duel({ code }: { code: string }) {
  const router = useRouter();
  const duel = useDuel(code);
  const { view, error, phase, rematch } = duel;

  const handleRematch = useCallback(async () => {
    const next = await rematch();
    if (next) router.push(`/duel/${next}`);
  }, [rematch, router]);

  if (!view || phase === "cancelled") {
    if (!error && phase !== "cancelled") return <MapLoading />;
    return (
      <DuelScreen labelledBy="duel-error-heading">
        <h1 id="duel-error-heading" className="text-2xl font-semibold tracking-tight">
          Duel indisponible
        </h1>
        <p className="mt-2 text-muted" role="alert">
          {DUEL_ERROR_MESSAGES[error ?? "not_found"]}
        </p>
        <Link href="/duel" className={buttonClass("primary", "mt-6")}>
          Lancer un autre duel
        </Link>
      </DuelScreen>
    );
  }

  const mode = getMode(view.modeId);
  if (!mode) throw new Error(`Unknown game mode "${view.modeId}"`);

  if (!view.isParticipant) return <DuelJoin view={view} mode={mode} error={error} isBusy={duel.isBusy} onJoin={duel.join} />;
  if (phase === "lobby") return <DuelWaitingRoom duel={duel} view={view} mode={mode} />;
  if (phase === "finished") return <DuelSummary view={view} mode={mode} isBusy={duel.isBusy} onRematch={handleRematch} />;
  return <DuelGame duel={duel} view={view} mode={mode} />;
}
