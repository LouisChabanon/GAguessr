"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapLoading } from "@/components/game/MapLoading";
import { TargetBanner } from "@/components/hud/TargetBanner";
import { GameMap, type OpponentPin, type SafeArea } from "@/components/map/GameMap";
import { preloadPhoto } from "@/components/photo/SitePhoto";
import { revealEndsAt } from "@/game/duel/phase";
import type { UseDuel } from "@/hooks/useDuel";
import { useModeTargets } from "@/hooks/useModeTargets";
import { playerColors, playerName } from "@/lib/duel/colors";
import { toRoundResult } from "@/lib/duel/results";
import type { DuelGuess, DuelRound, DuelView } from "@/lib/duel/types";
import type { GameMode } from "@/modes/types";
import { DuelActionBar } from "./DuelActionBar";
import { DuelTimer } from "./DuelTimer";

interface DuelGameProps {
  duel: UseDuel;
  view: DuelView;
  mode: GameMode;
}

const NO_ANSWER: DuelGuess = { guess: null, distanceKm: null, score: 0 };

function myAnswer(round: DuelRound, mySeat: number | null): DuelGuess {
  return round.answers.find((a) => a.seat === mySeat) ?? NO_ANSWER;
}

/** The rounds of a duel on the map: countdown, guessing, waiting for the others, reveal. */
export function DuelGame({ duel, view, mode }: DuelGameProps) {
  const { phase, offsetMs } = duel;
  const targets = useModeTargets(mode);
  const topBarRef = useRef<HTMLElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const getSafeArea = useCallback(
    (): SafeArea => ({
      top: topBarRef.current?.getBoundingClientRect().bottom ?? 0,
      bottom: bottomBarRef.current ? window.innerHeight - bottomBarRef.current.getBoundingClientRect().top : 0,
    }),
    [],
  );

  const isReveal = phase === "reveal";
  const revealed = isReveal ? view.rounds.at(-1) : undefined;
  const target = targets?.get((isReveal ? revealed?.targetId : view.currentTargetId) ?? "");
  const result = revealed && target ? toRoundResult(target, myAnswer(revealed, view.mySeat)) : undefined;
  const pastResults = useMemo(() => {
    if (!targets) return [];
    const settled = isReveal ? view.rounds.slice(0, -1) : view.rounds;
    return settled.flatMap((r) => {
      const t = targets.get(r.targetId);
      return t ? [toRoundResult(t, myAnswer(r, view.mySeat))] : [];
    });
  }, [targets, isReveal, view.rounds, view.mySeat]);

  // Memoized: the map reframes whenever this array changes.
  const opponentPins = useMemo((): OpponentPin[] => {
    if (!revealed) return [];
    const colors = playerColors(view.players);
    return view.players.flatMap((player) => {
      const point = revealed.answers.find((a) => a.seat === player.seat)?.guess;
      return !player.isMe && point
        ? [{ key: String(player.seat), point, title: playerName(player), color: colors.get(player.seat) ?? "var(--opponent)" }]
        : [];
    });
  }, [revealed, view.players]);

  // The next site's photo loads during the reveal, so it shows as soon as the round starts.
  const nextPhoto = isReveal ? targets?.get(view.currentTargetId ?? "")?.photo : undefined;
  useEffect(() => preloadPhoto(nextPhoto), [nextPhoto]);

  if (!targets) return <MapLoading />;

  const me = view.players.find((p) => p.isMe);
  const others = view.players.filter((p) => !p.isMe);
  const shownGuess = isReveal ? (revealed ? myAnswer(revealed, view.mySeat).guess : null) : (duel.guess ?? view.myLock?.guess ?? null);
  const isRoundOn = phase === "guessing" || phase === "locked";

  return (
    <div className="absolute inset-0">
      <GameMap
        area={mode.map}
        roundKey={target?.id ?? "none"}
        guess={shownGuess}
        result={result}
        opponentGuesses={opponentPins}
        pastResults={pastResults}
        interactive={phase === "guessing" && !duel.isBusy}
        onPick={duel.place}
        onConfirm={duel.lock}
        getSafeArea={getSafeArea}
      />

      {phase === "countdown" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-surface/50 backdrop-blur-sm" role="status">
          <div className="px-4 text-center">
            <p className="text-sm font-medium tracking-[0.18em] text-balance text-muted uppercase">
              {others.length === 1 ? `Contre ${playerName(others[0])}` : `${view.players.length} joueurs`}
            </p>
            <p className="mt-2 font-mono text-8xl font-semibold tracking-tight" data-testid="duel-countdown">
              <DuelTimer until={view.roundStartedAt} offsetMs={offsetMs} format="seconds" />
            </p>
          </div>
        </div>
      )}

      {(isRoundOn || isReveal) && (
        <>
          <TargetBanner
            ref={topBarRef}
            modeTitle={mode.title}
            showPhoto={mode.hasPhotos}
            target={target}
            round={isReveal ? view.rounds.length : view.roundIndex + 1}
            rounds={view.roundCount}
            score={me?.total ?? 0}
            timerLabel={isReveal ? "Suite" : "Reste"}
            timer={
              <DuelTimer
                until={isReveal ? revealEndsAt(view) : view.roundDeadline}
                offsetMs={offsetMs}
                urgentBelowMs={isReveal ? 0 : view.graceSeconds * 1000}
              />
            }
          />
          <DuelActionBar ref={bottomBarRef} duel={duel} view={view} revealed={revealed} targetName={target?.name ?? ""} />
        </>
      )}
    </div>
  );
}
