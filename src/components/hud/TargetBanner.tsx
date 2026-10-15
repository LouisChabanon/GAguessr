import Link from "next/link";
import type { Ref } from "react";
import type { Target } from "@/modes/types";
import { buttonClass } from "@/components/ui/button";
import { formatScore } from "@/lib/format";
import { SitePhoto } from "@/components/photo/SitePhoto";

interface TargetBannerProps {
  modeTitle: string;
  target: Target | undefined;
  round: number;
  rounds: number;
  score: number;
  ref?: Ref<HTMLElement>;
}

export function TargetBanner({ modeTitle, target, round, rounds, score, ref }: TargetBannerProps) {
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
          className="panel enter-up pointer-events-auto col-span-3 row-start-2 flex items-center gap-4 justify-self-center rounded-2xl py-2.5 pr-6 pl-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1"
        >
          <SitePhoto name={target.name} photo={target.photo} />
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

      <dl className="panel pointer-events-auto col-start-3 flex items-center gap-4 rounded-2xl px-4 py-2 font-mono text-sm tabular-nums">
        <div>
          <dt className="font-sans text-[10px] tracking-[0.14em] text-muted uppercase">Manche</dt>
          <dd>
            {round}
            <span className="text-muted">/{rounds}</span>
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
