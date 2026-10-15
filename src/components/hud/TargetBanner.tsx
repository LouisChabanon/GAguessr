import Link from "next/link";
import type { Ref } from "react";
import type { Target } from "@/modes/types";
import { buttonClass } from "@/components/ui/button";
import type { Clock } from "@/game/gameReducer";
import { formatScore } from "@/lib/format";
import { Stopwatch } from "./Stopwatch";
import { SitePhoto } from "@/components/photo/SitePhoto";

interface TargetBannerProps {
  modeTitle: string;
  /** False for modes without site photos: the photo slot is left out rather than shown empty. */
  showPhoto: boolean;
  target: Target | undefined;
  round: number;
  rounds: number;
  score: number;
  /** Guessing time; paused while an answer is shown. */
  clock: Clock;
  ref?: Ref<HTMLElement>;
}

export function TargetBanner({ modeTitle, showPhoto, target, round, rounds, score, clock, ref }: TargetBannerProps) {
  return (
    <header
      ref={ref}
      className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 sm:p-5">
      <Link
        href="/"
        aria-label={`Retour à l’accueil (partie : ${modeTitle})`}
        className={buttonClass("ghost", "panel pointer-events-auto h-10 rounded-full pl-2.5")}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline" aria-hidden>
          {modeTitle}
        </span>
      </Link>

      {target ? (
        <section
          key={target.id}
          aria-live="polite"
          className={`panel enter-up pointer-events-auto col-span-3 row-start-2 flex items-center gap-4 justify-self-center rounded-2xl py-2.5 pr-6 sm:col-span-1 sm:col-start-2 sm:row-start-1 ${showPhoto ? "pl-2.5" : "pl-6"}`}
        >
          {showPhoto && <SitePhoto name={target.name} photo={target.photo} />}
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Trouvez</p>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              {target.name}
            </h1>
            {target.hint && <p className="mt-0.5 text-sm text-muted">{target.hint}</p>}
          </div>
        </section>
      ) : (
        <span />
      )}

      <dl className="panel pointer-events-auto col-start-3 flex items-center gap-3 rounded-2xl px-3 py-2 font-mono text-sm whitespace-nowrap tabular-nums sm:gap-4 sm:px-4">
        <div>
          <dt className="font-sans text-[10px] tracking-[0.14em] text-muted uppercase">Manche</dt>
          <dd>
            {round}
            <span className="text-muted">/{rounds}</span>
          </dd>
        </div>
        <div className="h-7 w-px bg-line" aria-hidden />
        <div>
          <dt className="font-sans text-[10px] tracking-[0.14em] text-muted uppercase">Temps</dt>
          <dd data-testid="stopwatch">
            <Stopwatch stoppedMs={clock.stoppedMs} runningSince={clock.runningSince} />
          </dd>
        </div>
        <div className="h-7 w-px bg-line" aria-hidden />
        <div>
          <dt className="font-sans text-[10px] tracking-[0.14em] text-muted uppercase">Score</dt>
          <dd data-testid="total-score">{formatScore(score)}</dd>
        </div>
      </dl>
    </header>
  );
}
