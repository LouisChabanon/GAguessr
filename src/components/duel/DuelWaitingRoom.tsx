"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { DuelView } from "@/lib/duel/types";
import type { GameMode } from "@/modes/types";
import { DuelScreen, Eyebrow } from "./DuelScreen";

const COPIED_FEEDBACK_MS = 2_000;

/** The host's lobby: the code and link to send, until the opponent joins. */
export function DuelWaitingRoom({ view, mode }: { view: DuelView; mode: GameMode }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch (error: unknown) {
      console.warn("[duel] clipboard unavailable", error);
    }
  };

  return (
    <DuelScreen labelledBy="waiting-heading" testId="duel-waiting">
      <Eyebrow>Duel · {mode.title}</Eyebrow>
      <h1 id="waiting-heading" className="mt-3 text-2xl font-semibold tracking-tight">
        Invitez votre adversaire
      </h1>
      <p className="mt-1 text-sm text-muted">Envoyez-lui ce code ou le lien de cette page.</p>

      <p
        className="mt-6 rounded-2xl border border-dashed border-line py-5 text-center font-mono text-4xl font-semibold tracking-[0.35em] select-all sm:text-5xl"
        data-testid="duel-code"
        aria-label={`Code du duel : ${view.code.split("").join(" ")}`}
      >
        {view.code}
      </p>

      <button type="button" className={buttonClass("primary", "mt-4 w-full")} onClick={copyLink}>
        {copied ? "Lien copié" : "Copier le lien"}
      </button>

      <p className="mt-6 flex items-center gap-2.5 text-sm text-muted" role="status">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative size-2.5 rounded-full bg-accent" />
        </span>
        En attente d’un adversaire… la partie démarre dès qu’il rejoint.
      </p>

      <Link href="/duel" className={buttonClass("ghost", "mt-4 -ml-3")}>
        Annuler
      </Link>
    </DuelScreen>
  );
}
