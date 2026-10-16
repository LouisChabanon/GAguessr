"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { usePlayerName } from "@/hooks/usePlayerName";
import { DUEL_ERROR_MESSAGES } from "@/lib/duel/messages";
import type { DuelError, DuelView } from "@/lib/duel/types";
import type { GameMode } from "@/modes/types";
import { playerName } from "@/lib/duel/colors";
import { DuelRules } from "./DuelRules";
import { PlayerList } from "./PlayerList";
import { DuelScreen, Eyebrow } from "./DuelScreen";
import { PseudoField } from "./PseudoField";

interface DuelJoinProps {
  view: DuelView;
  mode: GameMode;
  error: DuelError | null;
  isBusy: boolean;
  onJoin: () => Promise<boolean>;
}

/** What a visitor sees on a lobby's link: who challenges them, on what, and a button to accept. */
export function DuelJoin({ view, mode, error, isBusy, onJoin }: DuelJoinProps) {
  const host = view.players.find((p) => p.isHost);
  const name = usePlayerName(view.myPseudo);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    try {
      if (await name.ready()) await onJoin();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <DuelScreen labelledBy="join-heading" testId="duel-join">
      <Eyebrow>Duel · {mode.title}</Eyebrow>
      <h1 id="join-heading" className="mt-3 text-3xl font-semibold tracking-tight text-balance">
        <span className="rounded-lg bg-accent px-1.5 text-accent-ink">{host ? playerName(host) : "Un joueur"}</span> vous défie
      </h1>
      <div className="mt-5 grid gap-4">
        <DuelRules view={view} />
        <PlayerList players={view.players} maxPlayers={view.maxPlayers} />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <PseudoField name={name} id="join-pseudo" />
        <button type="submit" className={buttonClass("primary", "w-full")} disabled={isBusy || isPending || name.draft.isPending}>
          Accepter le duel
        </button>
        {error && error !== "pseudo_required" && (
          <p className="text-sm text-poor" role="alert">
            {DUEL_ERROR_MESSAGES[error]}
          </p>
        )}
      </form>

      <Link href="/" className={buttonClass("ghost", "mt-4 -ml-3")}>
        Non merci
      </Link>
    </DuelScreen>
  );
}
