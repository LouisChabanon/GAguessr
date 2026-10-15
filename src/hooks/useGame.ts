"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { totalScore } from "@/game/evaluate";
import { createInitialState, gameReducer, type GameState } from "@/game/gameReducer";
import { pickTargets, roundCount } from "@/game/pickTargets";
import type { LonLat } from "@/lib/geo/distance";
import type { GameMode } from "@/modes/types";
import { recordScore, type ScoreRecord } from "./useBestScore";

export interface UseGame {
  state: GameState;
  record: ScoreRecord | null;
  place: (guess: LonLat) => void;
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

  useEffect(() => {
    let cancelled = false;
    mode
      .loadTargets()
      .then((targets) => {
        if (cancelled) return;
        dispatch({ type: "loaded", targets: pickTargets(targets, roundCount(mode.roundsPerGame, targets.length)) });
      })
      .catch((error: unknown) => {
        if (!cancelled) dispatch({ type: "failed", message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, attempt]);

  const place = useCallback((guess: LonLat) => dispatch({ type: "place", guess }), []);
  const confirm = useCallback(() => dispatch({ type: "confirm" }), []);

  const next = useCallback(() => {
    const isLastRound = state.status === "revealed" && state.roundIndex === state.targets.length - 1;
    if (isLastRound) setRecord(recordScore(mode.id, totalScore(state.results)));
    dispatch({ type: "next" });
  }, [mode.id, state]);

  const restart = useCallback(() => {
    setRecord(null);
    dispatch({ type: "retry" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, record, place, confirm, next, restart };
}
