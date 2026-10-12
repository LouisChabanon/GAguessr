"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "pinit:best-score";
const storageKey = (modeId: string) => `pinit:best:${modeId}`;

export function readBestScore(modeId: string): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(modeId));
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null; // storage unavailable (private mode, blocked cookies)
  }
}

export interface ScoreRecord {
  previousBest: number | null;
  isNewBest: boolean;
}

export function recordScore(modeId: string, score: number): ScoreRecord {
  const previousBest = readBestScore(modeId);
  const isNewBest = previousBest === null || score > previousBest;
  if (isNewBest) {
    try {
      window.localStorage.setItem(storageKey(modeId), String(score));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Not persisting a best score is harmless; the game still works.
    }
  }
  return { previousBest, isNewBest };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useBestScore(modeId: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => readBestScore(modeId),
    () => null,
  );
}
