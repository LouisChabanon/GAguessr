"use client";

import { useCallback, useRef, useState } from "react";
import { setPseudo } from "@/app/actions/setPseudo";
import { submitGame } from "@/app/actions/submitGame";
import type { RoundResult } from "@/game/evaluate";
import type { Submission } from "@/game/submission";
import type { GameStanding, PseudoResult, SubmitError, SubmitResult } from "@/lib/scores/types";
import { browserSupabase } from "@/lib/supabase/browser";

export type SubmissionState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; standing: GameStanding }
  | { status: "error"; error: SubmitError };

export interface UseScoreSubmission {
  submission: SubmissionState;
  submit: (modeId: string, results: readonly RoundResult[], timeMs: number) => void;
  choosePseudo: (pseudo: string) => Promise<PseudoResult>;
  reset: () => void;
}

/** Signs the visitor in anonymously the first time they finish a game; later games reuse the session. */
async function ensureSession(): Promise<void> {
  const auth = browserSupabase().auth;
  const { data } = await auth.getSession();
  if (data.session) return;
  const { error } = await auth.signInAnonymously();
  if (error) throw error;
}

async function sendGame(payload: Submission): Promise<SubmitResult> {
  await ensureSession();
  const first = await submitGame(payload);
  if (first.ok || first.error !== "unauthenticated") return first;
  // Keep the same player (and their pseudo) whenever the session can still be refreshed.
  const auth = browserSupabase().auth;
  const { error: refreshError } = await auth.refreshSession();
  if (!refreshError) return submitGame(payload);
  // The stored session was revoked for good: start a fresh anonymous one.
  console.warn("[scores] session lost, starting a new anonymous player", refreshError);
  await auth.signOut({ scope: "local" });
  await ensureSession();
  return submitGame(payload);
}

export function useScoreSubmission(): UseScoreSubmission {
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });
  // Ignores answers to a game the player has already restarted.
  const attempt = useRef(0);

  const submit = useCallback((modeId: string, results: readonly RoundResult[], timeMs: number) => {
    const current = ++attempt.current;
    setSubmission({ status: "pending" });
    const payload: Submission = {
      modeId,
      timeMs: Math.round(timeMs),
      rounds: results.map((r) => ({ targetId: r.target.id, guess: r.guess })),
    };
    sendGame(payload)
      .then((result): SubmissionState => (result.ok ? { status: "done", standing: result.standing } : { status: "error", error: result.error }))
      .catch((error: unknown): SubmissionState => {
        console.error("[scores] submission failed", error);
        return { status: "error", error: "unavailable" };
      })
      .then((next) => {
        if (attempt.current === current) setSubmission(next);
      });
  }, []);

  const choosePseudo = useCallback(async (pseudo: string): Promise<PseudoResult> => {
    const result = await setPseudo(pseudo).catch((): PseudoResult => ({ ok: false, error: "unavailable" }));
    if (result.ok) {
      setSubmission((s) => (s.status === "done" ? { status: "done", standing: { ...s.standing, pseudo: result.pseudo } } : s));
    }
    return result;
  }, []);

  const reset = useCallback(() => {
    attempt.current++;
    setSubmission({ status: "idle" });
  }, []);

  return { submission, submit, choosePseudo, reset };
}
