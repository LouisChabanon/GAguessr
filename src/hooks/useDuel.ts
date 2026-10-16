"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDuel, joinDuel, lockDuelGuess, requestRematch } from "@/app/actions/duel";
import { deriveDuelPhase, revealEndsAt, type DuelPhase } from "@/game/duel/phase";
import { DUEL_TOLERANCE_MS } from "@/game/duel/rules";
import type { DuelError, DuelResult, DuelView } from "@/lib/duel/types";
import type { LonLat } from "@/lib/geo/distance";
import { browserSupabase } from "@/lib/supabase/browser";
import { ensureSession } from "@/lib/supabase/session";

/** Realtime is the main signal; this catches any update it drops. */
const FALLBACK_POLL_MS = 5_000;
/** Asks the server to settle a round a little after its deadline, so the server agrees it is over. */
const SETTLE_DELAY_MS = DUEL_TOLERANCE_MS + 300;
/** Floor between two settle attempts, in case the clocks disagree. */
const MIN_SETTLE_WAIT_MS = 500;

interface Synced {
  view: DuelView;
  /** Server clock minus client clock, in ms. */
  offsetMs: number;
}

export interface UseDuel {
  view: DuelView | null;
  error: DuelError | null;
  phase: DuelPhase | null;
  offsetMs: number;
  guess: LonLat | null;
  isBusy: boolean;
  /** Jumps from the last round's reveal straight to the result. */
  showResult: () => void;
  place: (guess: LonLat) => void;
  lock: () => void;
  join: () => Promise<boolean>;
  /** Resolves to the rematch lobby's code, or null if it could not be opened. */
  rematch: () => Promise<string | null>;
}

export function useDuel(code: string): UseDuel {
  const [synced, setSynced] = useState<Synced | null>(null);
  const [error, setError] = useState<DuelError | null>(null);
  // The server-clock time phases are derived from; moved on at each round boundary.
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<{ round: number; guess: LonLat } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isResultShown, setIsResultShown] = useState(false);
  // Answers can come back out of order; only the latest request's counts.
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    const sentAt = Date.now();
    const result = await getDuel(code).catch((): DuelResult<{ view: DuelView }> => ({ ok: false, error: "unavailable" }));
    if (current !== request.current) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // The server read its clock about halfway through the round trip.
    const offsetMs = result.view.serverNow - (sentAt + Date.now()) / 2;
    setSynced({ view: result.view, offsetMs });
    setNow(result.view.serverNow);
    setError(null);
  }, [code]);

  useEffect(() => {
    ensureSession()
      .then(refresh)
      .catch((err: unknown) => {
        console.error("[duel] session unavailable", err);
        setError("unavailable");
      });
  }, [refresh]);

  const view = synced?.view ?? null;
  const offsetMs = synced?.offsetMs ?? 0;
  const duelId = view?.isParticipant ? view.id : null;
  const isLive = view?.status === "lobby" || view?.status === "playing";

  // Any change to the duel's row means the view is stale.
  useEffect(() => {
    if (!duelId) return;
    const supabase = browserSupabase();
    const channel = supabase
      .channel(`duel:${duelId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${duelId}` }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [duelId, refresh]);

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => void refresh(), FALLBACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLive, refresh]);

  // Wake up when a round starts or the last reveal ends, and ask the server to settle a round once its time is up.
  useEffect(() => {
    if (!view) return;
    const serverNow = Date.now() + offsetMs;
    const timers: number[] = [];
    const wakeAt = view.status === "finished" ? revealEndsAt(view) : view.roundStartedAt;
    if (wakeAt !== null && wakeAt > serverNow) {
      timers.push(window.setTimeout(() => setNow(Date.now() + offsetMs), wakeAt - serverNow));
    }
    if (view.status === "playing" && view.roundDeadline !== null) {
      const wait = Math.max(MIN_SETTLE_WAIT_MS, view.roundDeadline + SETTLE_DELAY_MS - serverNow);
      timers.push(window.setTimeout(() => void refresh(), wait));
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [view, offsetMs, refresh]);

  const roundIndex = view?.roundIndex ?? -1;
  const guess = draft?.round === roundIndex ? draft.guess : null;
  const derived = view ? deriveDuelPhase(view, now) : null;
  const phase = derived === "reveal" && view?.status === "finished" && isResultShown ? "finished" : derived;
  const showResult = useCallback(() => setIsResultShown(true), []);

  const place = useCallback((point: LonLat) => setDraft({ round: roundIndex, guess: point }), [roundIndex]);

  const lock = useCallback(() => {
    if (!guess || isBusy) return;
    setIsBusy(true);
    lockDuelGuess({ code, roundIndex, guess })
      .then((result) => {
        if (!result.ok && result.error !== "too_late") setError(result.error);
      })
      .catch((err: unknown) => console.error("[duel] lock failed", err))
      .then(refresh)
      .finally(() => setIsBusy(false));
  }, [code, roundIndex, guess, isBusy, refresh]);

  const join = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await joinDuel(code);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      await refresh();
      return true;
    } finally {
      setIsBusy(false);
    }
  }, [code, refresh]);

  const rematch = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await requestRematch(code);
      if (result.ok) return result.code;
      setError(result.error);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [code]);

  return { view, error, phase, offsetMs, guess, isBusy, showResult, place, lock, join, rematch };
}
