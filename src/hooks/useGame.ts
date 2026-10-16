"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { startGame } from "@/app/actions/startGame";
import { totalScore } from "@/game/evaluate";
import { createInitialState, gameReducer, type GameState } from "@/game/gameReducer";
import { pickTargets, roundCount } from "@/game/pickTargets";
import type { LonLat } from "@/lib/geo/distance";
import type { GameMode } from "@/modes/types";
import type { UseScoreSubmission } from "./useScoreSubmission";
import { recordScore, type ScoreRecord } from "./useBestScore";
import { useScoreSubmission, type SubmissionState } from "./useScoreSubmission";

export interface UseGame {
  state: GameState;
  record: ScoreRecord | null;
  /** Saving the finished game to the shared leaderboard. */
  submission: SubmissionState;
  choosePseudo: UseScoreSubmission["choosePseudo"];
  place: (guess: LonLat) => void;
  /** Starts the first round's stopwatch; call it once the map can take a pin. */
  startClock: () => void;
  confirm: () => void;
  next: () => void;
  restart: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue au chargement de la partie.";
}

export function useGame(mode: GameMode): UseGame {
  const [state, dispatch] = useReducer(gameReducer, mode.scaleKm, createInitialState);
  const [record, setRecord] = useState<ScoreRecord | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { submission, submit, choosePseudo, reset: resetSubmission } = useScoreSubmission();
  // Asked for as the first round's clock starts, so the server can bound the reported time.
  const startToken = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    mode
      .loadTargets()
      .then((targets) => {
        if (cancelled) return;
        dispatch({
          type: "loaded",
          targets: pickTargets(targets, roundCount(mode.roundsPerGame, targets.length)),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) dispatch({ type: "failed", message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, attempt]);

  const place = useCallback((guess: LonLat) => dispatch({ type: "place", guess }), []);
  const startClock = useCallback(() => {
    startToken.current ??= startGame(mode.id).catch((error: unknown) => {
      console.warn("[scores] game start not recorded", error);
      return null;
    });
    dispatch({ type: "start", at: Date.now() });
  }, [mode.id]);
  const confirm = useCallback(() => dispatch({ type: "confirm", at: Date.now() }), []);

  const next = useCallback(() => {
    const isLastRound = state.status === "revealed" && state.roundIndex === state.targets.length - 1;
    if (isLastRound) {
      setRecord(recordScore(mode.id, totalScore(state.results)));
      submit(mode.id, state.results, state.stoppedMs, startToken.current ?? Promise.resolve(null));
    }
    dispatch({ type: "next", at: Date.now() });
  }, [mode.id, state, submit]);

  const restart = useCallback(() => {
    setRecord(null);
    resetSubmission();
    startToken.current = null;
    dispatch({ type: "retry" });
    setAttempt((n) => n + 1);
  }, [resetSubmission]);

  return { state, record, submission, choosePseudo, place, startClock, confirm, next, restart };
}
