"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { configureDuel, joinDuel, leaveDuel, requestRematch, startDuel } from "@/app/actions/duel";
import { deriveDuelPhase, revealEndsAt, type DuelPhase } from "@/game/duel/phase";
import { DUEL_TOLERANCE_MS } from "@/game/duel/rules";
import type { DuelSettings } from "@/game/duel/settings";
import { fetchDuel, isUnreachable, postAnswer } from "@/lib/duel/client";
import { retryUntil, singleFlight } from "@/lib/duel/net";
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
/** A pin is saved once the player stops moving it for this long: one small request, not one per click. */
const PIN_DEBOUNCE_MS = 400;
/** A lock keeps being retried a little past the server's own slack: the server has the last word anyway. */
const LOCK_RETRY_SLACK_MS = 2_000;
/** Failed syncs in a row before the player is told the connection is struggling. */
const UNSTABLE_AFTER_FAILURES = 2;

interface Synced {
  view: DuelView;
  /** Server clock minus client clock, in ms. */
  offsetMs: number;
}

/**
 * Something to tell the player about their own answer: their lock did not arrive in time, and
 * either their last pin counted instead, or nothing of theirs reached the server.
 */
export type DuelNotice = "lock_too_late" | "lock_lost";

export interface UseDuel {
  view: DuelView | null;
  error: DuelError | null;
  phase: DuelPhase | null;
  offsetMs: number;
  guess: LonLat | null;
  isBusy: boolean;
  /** A lock is on its way: the round already shows as locked. */
  isSendingLock: boolean;
  /** True while syncing keeps failing (offline, very slow network). */
  isConnectionUnstable: boolean;
  notice: DuelNotice | null;
  /** Jumps from the last round's reveal straight to the result. */
  showResult: () => void;
  place: (guess: LonLat) => void;
  lock: () => void;
  join: () => Promise<boolean>;
  /** Changes the lobby's settings (host only, before the game starts); resolves to whether they were saved. */
  configure: (settings: DuelSettings) => Promise<boolean>;
  /** The host starts the lobby before it is full. */
  start: () => Promise<boolean>;
  /** Leaves the lobby; for the host, cancels it. */
  leave: () => Promise<boolean>;
  /** Resolves to the rematch lobby's code, or null if it could not be opened. */
  rematch: () => Promise<string | null>;
}

/** During a reveal, whether the player clicked "Valider" in that round but the server never got the lock in time. */
function lateLockNotice(view: DuelView | null, phase: DuelPhase | null, lockedRound: number | null): DuelNotice | null {
  if (!view || phase !== "reveal" || lockedRound !== view.rounds.length - 1) return null;
  const mine = view.rounds.at(-1)?.answers.find((a) => a.seat === view.mySeat);
  if (!mine || mine.isLocked) return null;
  return mine.guess ? "lock_too_late" : "lock_lost";
}

function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
}

export function useDuel(code: string): UseDuel {
  const [synced, setSynced] = useState<Synced | null>(null);
  const [error, setError] = useState<DuelError | null>(null);
  // The server-clock time phases are derived from; moved on at each round boundary.
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<{ round: number; guess: LonLat } | null>(null);
  const [pendingLock, setPendingLock] = useState<{ round: number; guess: LonLat } | null>(null);
  // The last round the player clicked "Valider" in: if its answer comes back unlocked, the lock was too late.
  const [lockedRound, setLockedRound] = useState<number | null>(null);
  const [failures, setFailures] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isResultShown, setIsResultShown] = useState(false);
  const isOnline = useOnline();
  // Answers can come back out of order; the freshest one wins.
  const freshest = useRef(-Infinity);
  const pinTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    const sentAt = Date.now();
    const result = await fetchDuel(code);
    if (!result.ok) {
      if (isUnreachable(result)) setFailures((n) => n + 1);
      else setError(result.error);
      return;
    }
    setFailures(0);
    if (result.view.serverNow < freshest.current) return;
    freshest.current = result.view.serverNow;
    // The server read its clock about halfway through the round trip.
    const offsetMs = result.view.serverNow - (sentAt + Date.now()) / 2;
    setSynced({ view: result.view, offsetMs });
    setNow(result.view.serverNow);
    setError(null);
  }, [code]);
  // One read at a time: on a slow link, overlapping polls would only queue up behind each other.
  // Declared before the effects that call refresh, so it is ready when they run.
  const flight = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    flight.current = singleFlight(load);
  }, [load]);
  const refresh = useCallback(() => (flight.current ?? load)(), [load]);

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
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
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

  useEffect(() => () => window.clearTimeout(pinTimer.current), []);

  const roundIndex = view?.roundIndex ?? -1;
  const roundDeadline = view?.roundDeadline ?? null;
  const guess = draft?.round === roundIndex ? draft.guess : null;
  const isSendingLock = pendingLock?.round === roundIndex && !view?.myLock;
  const derived = view ? deriveDuelPhase(view, now) : null;
  const phase =
    derived === "reveal" && view?.status === "finished" && isResultShown
      ? "finished"
      : derived === "guessing" && isSendingLock
        ? "locked"
        : derived;
  const showResult = useCallback(() => setIsResultShown(true), []);

  const place = useCallback(
    (point: LonLat) => {
      setDraft({ round: roundIndex, guess: point });
      // Saved in the background: if the lock never arrives in time, this pin still counts.
      window.clearTimeout(pinTimer.current);
      pinTimer.current = window.setTimeout(() => {
        void postAnswer("pin", code, roundIndex, point);
      }, PIN_DEBOUNCE_MS);
    },
    [code, roundIndex],
  );

  const lock = useCallback(() => {
    if (!guess || isSendingLock || roundDeadline === null) return;
    // The lock carries the pin itself: no need for the pending one.
    window.clearTimeout(pinTimer.current);
    const round = roundIndex;
    const deadline = roundDeadline;
    setPendingLock({ round, guess });
    setLockedRound(round);
    void (async () => {
      const result = await retryUntil(() => postAnswer("lock", code, round, guess), {
        shouldRetry: isUnreachable,
        // Server time to client time.
        until: () => deadline + DUEL_TOLERANCE_MS + LOCK_RETRY_SLACK_MS - offsetMs,
      });
      // A retry of a lock that went through the first time answers already_locked: that is a success.
      // too_late is told by the reveal itself, which may come before this answer on a slow link.
      if (!result.ok && result.error !== "already_locked" && result.error !== "too_late") setError(result.error);
      await refresh();
      setPendingLock(null);
    })();
  }, [code, roundIndex, guess, isSendingLock, roundDeadline, offsetMs, refresh]);

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

  const configure = useCallback(
    async (settings: DuelSettings) => {
      const result = await configureDuel({ code, settings }).catch((): DuelResult<object> => ({ ok: false, error: "unavailable" }));
      if (!result.ok) setError(result.error);
      await refresh();
      return result.ok;
    },
    [code, refresh],
  );

  const lobbyAction = useCallback(
    async (action: (code: string) => Promise<DuelResult<object>>) => {
      setIsBusy(true);
      try {
        const result = await action(code).catch((): DuelResult<object> => ({ ok: false, error: "unavailable" }));
        if (!result.ok) setError(result.error);
        await refresh();
        return result.ok;
      } finally {
        setIsBusy(false);
      }
    },
    [code, refresh],
  );
  const start = useCallback(() => lobbyAction(startDuel), [lobbyAction]);
  const leave = useCallback(() => lobbyAction(leaveDuel), [lobbyAction]);

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

  return {
    view,
    error,
    phase,
    offsetMs,
    guess,
    isBusy,
    isSendingLock,
    isConnectionUnstable: isLive && (!isOnline || failures >= UNSTABLE_AFTER_FAILURES),
    notice: lateLockNotice(view, phase, lockedRound),
    showResult,
    place,
    lock,
    join,
    configure,
    start,
    leave,
    rematch,
  };
}
