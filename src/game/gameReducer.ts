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
}

export type GameAction =
  | { type: "loaded"; targets: readonly Target[] }
  | { type: "failed"; message: string }
  | { type: "retry" }
  | { type: "place"; guess: LonLat }
  | { type: "confirm" }
  | { type: "next" };

export function createInitialState(scaleKm: number): GameState {
  return { status: "loading", scaleKm, targets: [], roundIndex: 0, guess: null, results: [], error: null };
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
        return { ...state, status: "error", error: "No targets available for this mode." };
      }
      return { ...createInitialState(state.scaleKm), status: "guessing", targets: action.targets };

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
      return { ...state, status: "revealed", results: [...state.results, result] };
    }

    case "next": {
      if (state.status !== "revealed") return state;
      const roundIndex = state.roundIndex + 1;
      return roundIndex >= state.targets.length
        ? { ...state, status: "finished", guess: null }
        : { ...state, status: "guessing", roundIndex, guess: null };
    }
  }
}
