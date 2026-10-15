"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import type { SubmissionState } from "@/hooks/useScoreSubmission";
import { formatPercent, formatRank } from "@/lib/format";
import { PSEUDO_MAX } from "@/lib/scores/pseudo";
import type { GameStanding, PseudoResult } from "@/lib/scores/types";

interface SummaryStandingProps {
  modeId: string;
  submission: SubmissionState;
  onChoosePseudo: (pseudo: string) => Promise<PseudoResult>;
}

const ERROR_NOTES: Readonly<Record<Exclude<SubmissionState, { status: "idle" | "pending" | "done" }>["error"], string>> = {
  invalid: "Partie non enregistrée au classement.",
  unauthenticated: "Score non enregistré : session introuvable.",
  too_soon: "Partie non enregistrée : une autre vient de l’être.",
  unavailable: "Score non enregistré (hors ligne).",
};

/** How the game ranks against everyone else's; never blocks the summary. */
export function SummaryStanding({ modeId, submission, onChoosePseudo }: SummaryStandingProps) {
  if (submission.status === "idle") return null;
  if (submission.status === "pending") {
    return (
      <p className="mt-4 h-5 w-48 animate-pulse rounded bg-line" aria-busy="true">
        <span className="sr-only">Enregistrement du score…</span>
      </p>
    );
  }
  if (submission.status === "error") {
    return (
      <p className="mt-4 text-sm text-muted" data-testid="standing-error">
        {ERROR_NOTES[submission.error]}
      </p>
    );
  }
  return <Standing modeId={modeId} standing={submission.standing} onChoosePseudo={onChoosePseudo} />;
}

function Standing({ modeId, standing, onChoosePseudo }: { modeId: string; standing: GameStanding; onChoosePseudo: SummaryStandingProps["onChoosePseudo"] }) {
  const isFirstGame = standing.games <= 1;
  return (
    <div className="enter-up mt-5 rounded-2xl border border-line p-4" data-testid="standing">
      <p className="text-sm">
        {isFirstGame ? (
          "Première partie enregistrée sur ce mode."
        ) : (
          <>
            Mieux que <strong className="font-mono font-semibold tabular-nums">{formatPercent(standing.percentile)}</strong> des
            parties
          </>
        )}
        {standing.pseudo && (
          <>
            {" · "}
            <Link href={`/classement/${modeId}`} className="font-medium underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-text">
              {formatRank(standing.rank)} au classement
            </Link>
          </>
        )}
      </p>
      {!standing.pseudo && <PseudoForm rank={standing.rank} onChoosePseudo={onChoosePseudo} />}
    </div>
  );
}

function PseudoForm({ rank, onChoosePseudo }: { rank: number; onChoosePseudo: SummaryStandingProps["onChoosePseudo"] }) {
  const inputId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pseudo = String(new FormData(event.currentTarget).get("pseudo") ?? "");
    setIsPending(true);
    const result = await onChoosePseudo(pseudo);
    setIsPending(false);
    setError(result.ok ? null : (result.message ?? "Impossible d’enregistrer ce pseudo, réessayez."));
  };

  return (
    <form className="mt-3" onSubmit={handleSubmit} data-testid="pseudo-form">
      <label htmlFor={inputId} className="text-xs text-muted">
        Choisissez un pseudo pour entrer au classement, en <span className="font-medium text-ink">{formatRank(rank)}</span> position
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          name="pseudo"
          required
          maxLength={PSEUDO_MAX}
          autoComplete="nickname"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm transition-[border-color,box-shadow] duration-150 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
        />
        <button type="submit" className={buttonClass("secondary")} disabled={isPending}>
          Valider
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-poor">
          {error}
        </p>
      )}
    </form>
  );
}
