"use client";

import { useCallback, useRef } from "react";
import { ActionBar } from "@/components/hud/ActionBar";
import { TargetBanner } from "@/components/hud/TargetBanner";
import { GameMap, type SafeArea } from "@/components/map/GameMap";
import { MapLoading } from "./MapLoading";
import { GameSummary } from "@/components/summary/GameSummary";
import { buttonClass } from "@/components/ui/button";
import { totalScore } from "@/game/evaluate";
import { currentResult, currentTarget } from "@/game/gameReducer";
import { useGame } from "@/hooks/useGame";
import { REGIONS } from "@/lib/geo/regions";
import { getMode } from "@/modes/registry";

interface GameProps {
  modeId: string;
}

export function Game({ modeId }: GameProps) {
  const mode = getMode(modeId);
  if (!mode) throw new Error(`Unknown game mode "${modeId}"`);

  const { state, basemap, record, place, confirm, next, restart } = useGame(mode);
  const topBarRef = useRef<HTMLElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const getSafeArea = useCallback(
    (): SafeArea => ({
      top: topBarRef.current?.getBoundingClientRect().bottom ?? 0,
      bottom: bottomBarRef.current ? window.innerHeight - bottomBarRef.current.getBoundingClientRect().top : 0,
    }),
    [],
  );
  const region = REGIONS[mode.region];
  const target = currentTarget(state);
  const result = currentResult(state);
  const total = totalScore(state.results);
  // While revealed, the last result is the current round's: it gets the full treatment.
  const pastResults = state.status === "revealed" ? state.results.slice(0, -1) : state.results;
  const isPlaying = state.status === "guessing" || state.status === "revealed";

  return (
    <div className="absolute inset-0">
      {basemap && (
        <GameMap
          region={region}
          basemap={basemap}
          roundKey={target?.id ?? "none"}
          guess={state.guess}
          result={result}
          pastResults={pastResults}
          interactive={state.status === "guessing"}
          onPick={place}
          onConfirm={confirm}
          getSafeArea={getSafeArea}
        />
      )}

      {isPlaying && (
        <>
          <TargetBanner
            ref={topBarRef}
            modeTitle={mode.title}
            target={target}
            round={state.roundIndex + 1}
            rounds={state.targets.length}
            score={total}
          />
          <ActionBar
            ref={bottomBarRef}
            hasGuess={state.guess !== null}
            result={result}
            isLastRound={state.roundIndex === state.targets.length - 1}
            onConfirm={confirm}
            onNext={next}
          />
        </>
      )}

      {state.status === "loading" && <MapLoading />}

      {state.status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-4" role="alert">
          <div className="panel max-w-sm rounded-2xl p-6 text-center">
            <p className="font-medium">Couldn&apos;t start the game</p>
            <p className="mt-1 text-sm text-muted">{state.error}</p>
            <button type="button" className={buttonClass("primary", "mt-4")} onClick={restart}>
              Try again
            </button>
          </div>
        </div>
      )}

      {state.status === "finished" && (
        <GameSummary
          modeTitle={mode.title}
          results={state.results}
          total={total}
          record={record}
          onPlayAgain={restart}
        />
      )}
    </div>
  );
}
