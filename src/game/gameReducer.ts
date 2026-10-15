import type { LonLat } from "@/lib/geo/distance";
import type { Target } from "@/modes/types";
import { evaluateGuess, type RoundResult } from "./evaluate";

export type GameStatus = "loading" | "error" | "guessing" | "revealed" | "finished";

export interface GameState {
  status: GameStatus;
  scaleKm: number;
  targets: readonly Target[];
  roundIndex: number;
  guess: LonLat | null;
  results: readonly RoundResult[];
  error: string | null;
  /** Guessing time of the rounds already answered; the stopwatch pauses while an answer is shown. */
  stoppedMs: number;
  /** When the current round's guessing started, or null while the stopwatch is paused. */
  runningSince: number | null;
}

/**
 * Actions that start or stop the stopwatch carry `at`, a timestamp in ms, so the reducer stays pure.
 * The first round's clock waits for "start" (sent once the map can take a pin); later rounds start with "next".
 */
export type GameAction =
  | { type: "loaded"; targets: readonly Target[] }
  | { type: "start"; at: number }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "place"; guess: LonLat }
  | { type: "confirm"; at: number }
  | { type: "next"; at: number };

export function createInitialState(scaleKm: number): GameState {
  return {
    status: "loading",
    scaleKm,
    targets: [],
    roundIndex: 0,
    guess: null,
    results: [],
    error: null,
    stoppedMs: 0,
    runningSince: null,
  };
}

export type Clock = Pick<GameState, "stoppedMs" | "runningSince">;

/** Time spent guessing so far, as of `now` (ms, same clock as the actions' `at`). */
export function elapsedMs(state: Clock, now: number): number {
  return state.stoppedMs + (state.runningSince === null ? 0 : Math.max(0, now - state.runningSince));
}

export function currentTarget(state: GameState): Target | undefined {
  return state.targets[state.roundIndex];
}

export function currentResult(state: GameState): RoundResult | undefined {
  return state.status === "revealed" ? state.results[state.roundIndex] : undefined;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "loaded":
      if (action.targets.length === 0) {
        return { ...state, status: "error", error: "Aucun site disponible pour ce mode." };
      }
      return { ...createInitialState(state.scaleKm), status: "guessing", targets: action.targets };

    case "start":
      return state.status === "guessing" && state.runningSince === null ? { ...state, runningSince: action.at } : state;

    case "failed":
      return { ...state, status: "error", error: action.message };

    case "retry":
      return createInitialState(state.scaleKm);

    case "place":
      return state.status === "guessing" ? { ...state, guess: action.guess } : state;

    case "confirm": {
      const target = currentTarget(state);
      if (state.status !== "guessing" || !state.guess || !target) return state;
      const result = evaluateGuess(target, state.guess, state.scaleKm);
      return {
        ...state,
        status: "revealed",
        results: [...state.results, result],
        stoppedMs: elapsedMs(state, action.at),
        runningSince: null,
      };
    }

    case "next": {
      if (state.status !== "revealed") return state;
      const roundIndex = state.roundIndex + 1;
      return roundIndex >= state.targets.length
        ? { ...state, status: "finished", guess: null }
        : { ...state, status: "guessing", roundIndex, guess: null, runningSince: action.at };
    }
  }
}
