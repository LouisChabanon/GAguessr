"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionBar } from "@/components/hud/ActionBar";
import { TargetBanner } from "@/components/hud/TargetBanner";
import { GameMap, type SafeArea } from "@/components/map/GameMap";
import { MapLoading } from "./MapLoading";
import { preloadPhoto } from "@/components/photo/SitePhoto";
import { GameSummary } from "@/components/summary/GameSummary";
import { buttonClass } from "@/components/ui/button";
import { totalScore } from "@/game/evaluate";
import { currentResult, currentTarget } from "@/game/gameReducer";
import { useCrowdData } from "@/hooks/useCrowdData";
import { useGame } from "@/hooks/useGame";
import { MIN_PLAYS_FOR_STATS } from "@/lib/scores/crowd";
import { getMode } from "@/modes/registry";

interface GameProps {
  modeId: string;
}

export function Game({ modeId }: GameProps) {
  // Modes hold functions, so the client looks them up by id rather than receiving them as props.
  const mode = getMode(modeId);
  if (!mode) throw new Error(`Unknown game mode "${modeId}"`);
  const { state, record, submission, choosePseudo, place, startClock, confirm, next, restart } = useGame(mode);
  // The clock starts once both the sites and the map are ready, so a slow map costs no time.
  const [isMapReady, setIsMapReady] = useState(false);
  const handleMapReady = useCallback(() => setIsMapReady(true), []);
  useEffect(() => {
    if (isMapReady && state.status === "guessing") startClock();
  }, [isMapReady, state.status, startClock]);
  const topBarRef = useRef<HTMLElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const getSafeArea = useCallback(
    (): SafeArea => ({
      top: topBarRef.current?.getBoundingClientRect().bottom ?? 0,
      bottom: bottomBarRef.current ? window.innerHeight - bottomBarRef.current.getBoundingClientRect().top : 0,
    }),
    [],
  );
  const target = currentTarget(state);
  const nextPhoto = state.targets[state.roundIndex + 1]?.photo;
  useEffect(() => preloadPhoto(nextPhoto), [nextPhoto]);
  const result = currentResult(state);
  const crowdData = useCrowdData(mode.id);
  const crowdStat = result ? crowdData?.stats[result.target.id] : undefined;
  const crowd = crowdData && crowdStat && crowdStat.plays >= MIN_PLAYS_FOR_STATS ? { stat: crowdStat, withinKm: crowdData.withinKm } : undefined;
  const total = totalScore(state.results);
  // While revealed, the last result is the current round's: it gets the full treatment.
  const pastResults = state.status === "revealed" ? state.results.slice(0, -1) : state.results;
  const isPlaying = state.status === "guessing" || state.status === "revealed";

  return (
    <div className="absolute inset-0">
      <GameMap
        area={mode.map}
        roundKey={target?.id ?? "none"}
        guess={state.guess}
        result={result}
        pastResults={pastResults}
        crowdGuesses={result ? crowdData?.guesses[result.target.id] : undefined}
        interactive={state.status === "guessing"}
        onPick={place}
        onConfirm={confirm}
        onReady={handleMapReady}
        getSafeArea={getSafeArea}
      />

      {isPlaying && (
        <>
          <TargetBanner
            ref={topBarRef}
            modeTitle={mode.title}
            showPhoto={mode.hasPhotos}
            target={target}
            round={state.roundIndex + 1}
            rounds={state.targets.length}
            score={total}
            clock={state}
          />
          <ActionBar
            ref={bottomBarRef}
            hasGuess={state.guess !== null}
            result={result}
            crowd={crowd}
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
            <p className="font-medium">Impossible de lancer la partie</p>
            <p className="mt-1 text-sm text-muted">{state.error}</p>
            <button type="button" className={buttonClass("primary", "mt-4")} onClick={restart}>
              Réessayer
            </button>
          </div>
        </div>
      )}

      {state.status === "finished" && (
        <GameSummary
          modeId={mode.id}
          modeTitle={mode.title}
          results={state.results}
          total={total}
          timeMs={state.stoppedMs}
          record={record}
          submission={submission}
          onChoosePseudo={choosePseudo}
          onPlayAgain={restart}
        />
      )}
    </div>
  );
}
