import Link from "next/link";
import { BestScore } from "@/components/game/BestScore";
import { GAME_MODES } from "@/modes/registry";
import type { GameMode } from "@/modes/types";

function Logo() {
  return (
    <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
      <svg width="18" height="18" viewBox="-10 -26 20 28" aria-hidden>
        <path
          d="M0 0C-1.6-5.2-9-9.4-9-16.2a9 9 0 1 1 18 0C9-9.4 1.6-5.2 0 0Z"
          fill="var(--accent)"
          stroke="var(--accent-ink)"
          strokeWidth={1.4}
        />
        <circle cy={-16.2} r={3.4} fill="var(--accent-ink)" />
      </svg>
      <span>
        <span className="mr-px rounded-[5px] bg-accent px-0.5 text-accent-ink">GA</span>guessr
      </span>
    </span>
  );
}

async function ModeRow({ mode, index }: { mode: GameMode; index: number }) {
  const sites = (await mode.loadTargets()).length;
  return (
    <li className="border-b border-line">
      <Link
        href={`/play/${mode.id}`}
        className="group -mx-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 rounded-xl px-3 py-5 transition-colors duration-150 hover:bg-panel-solid sm:grid-cols-[3.5rem_1fr_auto_2rem] sm:py-6"
      >
        <span className="grid size-8 place-items-center rounded-full border border-line font-mono text-xs text-muted tabular-nums transition-colors duration-150 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink sm:size-10">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tracking-tight sm:text-4xl">{mode.title}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
              {sites} sites
            </span>
          </span>
        </span>
        <BestScore modeId={mode.id} />
        <svg
          className="hidden text-muted transition-[translate,color] duration-200 group-hover:translate-x-1 group-hover:text-accent-text sm:block"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M4 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <p className="-mt-3 flex gap-4 pb-4 pl-14 text-xs text-muted sm:-mt-4 sm:pl-[4.5rem]">
        <Link href={`/classement/${mode.id}`} className="underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">
          Classement
        </Link>
        <Link href={`/stats/${mode.id}`} className="underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">
          Statistiques
        </Link>
      </p>
    </li>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header>
        <Logo />
      </header>

      <section aria-labelledby="hero-heading" className="mt-16 sm:mt-24">
        <h1
          id="hero-heading"
          className="max-w-3xl text-5xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-7xl"
        >
          Placez les centrales{" "}
          <mark className="rounded-xl bg-accent px-2 leading-none text-accent-ink [box-decoration-break:clone]">nucléaires</mark>.
        </h1>
      </section>

      <section aria-labelledby="modes-heading" className="mt-14 sm:mt-20">
        <div className="flex items-baseline justify-between border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          <h2 id="modes-heading">Jouer</h2>
          <span>Record</span>
        </div>
        <ul>
          {GAME_MODES.map((mode, i) => (
            <ModeRow key={mode.id} mode={mode} index={i} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="duel-heading" className="mt-14 sm:mt-20">
        <h2 id="duel-heading" className="border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          À deux
        </h2>
        <Link
          href="/duel"
          className="group -mx-3 mt-2 grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl px-3 py-5 transition-colors duration-150 hover:bg-panel-solid sm:py-6"
        >
          <span className="min-w-0">
            <span className="text-2xl font-semibold tracking-tight sm:text-4xl">Duel</span>
            <span className="mt-1 block text-sm text-muted">Défiez un ami sur les mêmes sites : dès qu’il valide, vous n’avez plus que 5 s.</span>
          </span>
          <svg
            className="text-muted transition-[translate,color] duration-200 group-hover:translate-x-1 group-hover:text-accent-text"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path d="M4 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

      <footer className="mt-auto pt-16 text-xs text-muted">
        <Link href="/credits" className="underline underline-offset-2 hover:text-ink">
          Crédits photos
        </Link>
      </footer>
    </main>
  );
}
