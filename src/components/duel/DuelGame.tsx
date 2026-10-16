"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapLoading } from "@/components/game/MapLoading";
import { TargetBanner } from "@/components/hud/TargetBanner";
import { GameMap, type SafeArea } from "@/components/map/GameMap";
import { preloadPhoto } from "@/components/photo/SitePhoto";
import { duelOutcome } from "@/game/duel/outcome";
import { revealEndsAt } from "@/game/duel/phase";
import { DUEL_GRACE_MS } from "@/game/duel/rules";
import type { UseDuel } from "@/hooks/useDuel";
import { useModeTargets } from "@/hooks/useModeTargets";
import { toRoundResult } from "@/lib/duel/results";
import type { DuelView } from "@/lib/duel/types";
import type { GameMode } from "@/modes/types";
import { DuelActionBar } from "./DuelActionBar";
import { DuelTimer } from "./DuelTimer";

interface DuelGameProps {
  duel: UseDuel;
  view: DuelView;
  mode: GameMode;
}

/** The rounds of a duel on the map: countdown, guessing, waiting for the opponent, reveal. */
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
  const result = revealed && target ? toRoundResult(target, revealed.me) : undefined;
  const pastResults = useMemo(() => {
    if (!targets) return [];
    const settled = isReveal ? view.rounds.slice(0, -1) : view.rounds;
    return settled.flatMap((r) => {
      const t = targets.get(r.targetId);
      return t ? [toRoundResult(t, r.me)] : [];
    });
  }, [targets, isReveal, view.rounds]);

  // The next site's photo loads during the reveal, so it shows as soon as the round starts.
  const nextPhoto = isReveal ? targets?.get(view.currentTargetId ?? "")?.photo : undefined;
  useEffect(() => preloadPhoto(nextPhoto), [nextPhoto]);

  if (!targets) return <MapLoading />;

  const { myTotal, opponentTotal } = duelOutcome(view.rounds);
  const opponentName = view.opponentPseudo ?? "Adversaire";
  const shownGuess = isReveal ? (revealed?.me.guess ?? null) : (duel.guess ?? view.myLock?.guess ?? null);
  const isRoundOn = phase === "guessing" || phase === "locked";

  return (
    <div className="absolute inset-0">
      <GameMap
        area={mode.map}
        roundKey={target?.id ?? "none"}
        guess={shownGuess}
        result={result}
        opponentGuess={revealed?.opponent.guess}
        pastResults={pastResults}
        interactive={phase === "guessing" && !duel.isBusy}
        onPick={duel.place}
        onConfirm={duel.lock}
        getSafeArea={getSafeArea}
      />

      {phase === "countdown" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-surface/50 backdrop-blur-sm" role="status">
          <div className="text-center">
            <p className="text-sm font-medium tracking-[0.18em] text-muted uppercase">Contre {opponentName}</p>
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
            score={myTotal}
            timerLabel={isReveal ? "Suite" : "Reste"}
            timer={
              <DuelTimer
                until={isReveal ? revealEndsAt(view) : view.roundDeadline}
                offsetMs={offsetMs}
                urgentBelowMs={isReveal ? 0 : DUEL_GRACE_MS}
              />
            }
          />
          <DuelActionBar
            ref={bottomBarRef}
            duel={duel}
            view={view}
            revealed={revealed}
            targetName={target?.name ?? ""}
            myTotal={myTotal}
            opponentTotal={opponentTotal}
            opponentName={opponentName}
          />
        </>
      )}
    </div>
  );
}
