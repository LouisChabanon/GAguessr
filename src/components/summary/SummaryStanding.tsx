"use client";

import Link from "next/link";
import { useId, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { PseudoEditor } from "@/components/ui/PseudoEditor";
import type { PseudoDraft } from "@/hooks/usePseudoDraft";
import type { SubmissionState } from "@/hooks/useScoreSubmission";
import { formatPercent, formatRank, formatScore } from "@/lib/format";
import { PSEUDO_MAX } from "@/lib/scores/pseudo";
import type { GameStanding, PseudoResult } from "@/lib/scores/types";

interface SummaryStandingProps {
  modeId: string;
  submission: SubmissionState;
  /** The game's precision points, before the speed bonus. */
  totalScore: number;
  pseudoDraft: PseudoDraft;
  /** Changes the pseudo of a player who already has one. */
  onRename: (pseudo: string) => Promise<PseudoResult>;
}

const ERROR_NOTES: Readonly<Record<Exclude<SubmissionState, { status: "idle" | "pending" | "done" }>["error"], string>> = {
  invalid: "Partie non enregistrée au classement.",
  unauthenticated: "Score non enregistré : session introuvable.",
  too_soon: "Partie non enregistrée : une autre vient de l’être.",
  unavailable: "Score non enregistré (hors ligne).",
};

/** How the game ranks against everyone else's; never blocks the summary. */
export function SummaryStanding({ modeId, submission, totalScore, pseudoDraft, onRename }: SummaryStandingProps) {
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
  return <Standing modeId={modeId} standing={submission.standing} totalScore={totalScore} pseudoDraft={pseudoDraft} onRename={onRename} />;
}

interface StandingProps extends Pick<SummaryStandingProps, "modeId" | "totalScore" | "pseudoDraft" | "onRename"> {
  standing: GameStanding;
}

function Standing({ modeId, standing, totalScore, pseudoDraft, onRename }: StandingProps) {
  const isFirstGame = standing.games <= 1;
  const speedBonus = standing.rankingScore - totalScore;
  return (
    <div className={`enter-up mt-5 rounded-2xl border p-4 ${standing.pseudo ? "border-line" : "border-accent bg-accent/10"}`} data-testid="standing">
      <p className="text-sm" data-testid="ranking-score">
        <strong className="font-mono font-semibold tabular-nums">{formatScore(standing.rankingScore)}</strong> points de classement
        {speedBonus > 0 && (
          <span className="text-muted">
            , dont <span className="font-mono tabular-nums">+{formatScore(speedBonus)}</span> de vitesse
          </span>
        )}
      </p>
      <p className="mt-1 text-sm">
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
      {standing.pseudo ? (
        <PseudoEditor pseudo={standing.pseudo} onRename={onRename} label="Au classement sous le nom" className="mt-3 border-t border-line pt-3" />
      ) : (
        <PseudoForm rank={standing.rank} draft={pseudoDraft} />
      )}
    </div>
  );
}

function PseudoForm({ rank, draft }: { rank: number; draft: PseudoDraft }) {
  const inputId = useId();
  const errorId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void draft.save();
  };

  return (
    <form className="mt-3 border-t border-line pt-3" onSubmit={handleSubmit} data-testid="pseudo-form">
      <label htmlFor={inputId} className="text-sm font-medium">
        Choisissez un pseudo pour entrer au classement en <span className="text-accent-text">{formatRank(rank)}</span> position
      </label>
      <p className="mt-0.5 text-xs text-muted">Vos parties précédentes y apparaîtront aussi.</p>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          name="pseudo"
          required
          autoFocus
          maxLength={PSEUDO_MAX}
          autoComplete="nickname"
          placeholder="Votre pseudo"
          value={draft.value}
          onChange={(event) => draft.setValue(event.target.value)}
          aria-invalid={draft.error !== null}
          aria-describedby={draft.error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm transition-[border-color,box-shadow] duration-150 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
        />
        <button type="submit" className={buttonClass("primary")} disabled={draft.isPending}>
          Valider
        </button>
      </div>
      {draft.error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-poor">
          {draft.error}
        </p>
      )}
    </form>
  );
}
