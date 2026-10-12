import Link from "next/link";
import { BestScore } from "@/components/game/BestScore";
import { REGIONS } from "@/lib/geo/regions";
import { GAME_MODES } from "@/modes/registry";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <svg width="18" height="18" viewBox="-10 -26 20 28" aria-hidden>
          <path d="M0 0C-1.6-5.2-9-9.4-9-16.2a9 9 0 1 1 18 0C9-9.4 1.6-5.2 0 0Z" fill="var(--accent)" />
          <circle cy={-16.2} r={3.4} fill="var(--surface)" />
        </svg>
        Pin it
      </header>

      <section aria-labelledby="hero-heading" className="mt-16 sm:mt-28">
        <h1
          id="hero-heading"
          className="max-w-3xl text-5xl leading-[0.95] font-semibold tracking-[-0.04em] text-balance sm:text-7xl"
        >
          Put the world <span className="text-muted">in its place.</span>
        </h1>
        <p className="mt-6 max-w-md text-base text-muted sm:text-lg">
          A name appears. You drop a pin on a blank map. The closer you land, the more points you
          score.
        </p>
      </section>

      <section aria-labelledby="modes-heading" className="mt-16 sm:mt-24">
        <div className="flex items-baseline justify-between border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          <h2 id="modes-heading">Game modes</h2>
          <span>Best</span>
        </div>
        <ul>
          {GAME_MODES.map((mode, i) => (
            <li key={mode.id} className="border-b border-line">
              <Link
                href={`/play/${mode.id}`}
                className="group -mx-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 rounded-xl px-3 py-6 transition-colors duration-150 hover:bg-panel-solid sm:grid-cols-[3.5rem_1fr_auto_2rem] sm:py-8"
              >
                <span className="self-start pt-1.5 font-mono text-xs text-muted tabular-nums sm:pt-3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-2xl font-semibold tracking-tight sm:text-4xl">{mode.title}</span>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                      {REGIONS[mode.region].label}
                    </span>
                    <span className="text-[11px] font-medium text-muted">
                      {mode.roundsPerGame === "all" ? "Full set" : `${mode.roundsPerGame} rounds`}
                    </span>
                  </span>
                  <span className="mt-1.5 block max-w-xl text-sm text-muted">{mode.description}</span>
                </span>
                <BestScore modeId={mode.id} />
                <svg
                  className="hidden text-muted transition-[translate,color] duration-200 group-hover:translate-x-1 group-hover:text-accent sm:block"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path d="M4 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted">
        Map data: Natural Earth (public domain) · French regions: IGN/INSEE via france-geojson (Licence
        Ouverte). Up to 5,000 points per round.
      </footer>
    </main>
  );
}
