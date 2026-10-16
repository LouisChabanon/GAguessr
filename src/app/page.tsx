import Link from "next/link";
import type { ReactNode } from "react";
import { BestScore } from "@/components/game/BestScore";
import { HeroMap } from "@/components/home/HeroMap";
import { ModeCard } from "@/components/home/ModeCard";
import { PhotoStrip } from "@/components/home/PhotoStrip";
import { PlayerBadge } from "@/components/player/PlayerBadge";
import { buttonClass } from "@/components/ui/button";
import { DEFAULT_MODE, GAME_MODES } from "@/modes/registry";
import type { GameMode } from "@/modes/types";

/** Plants whose photos tease the main game, in this order. */
const TEASER_SITES = ["chinon", "gravelines", "bugey"] as const;

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

/** Small line icons for the secondary modes, drawn on a 20×20 grid. */
const ICONS: Readonly<Record<string, ReactNode>> = {
  "fr-nuclear-research": <path d="M8 3h4M9 3v5l-5 8a1.5 1.5 0 0 0 1.3 2h9.4a1.5 1.5 0 0 0 1.3-2l-5-8V3M6.5 13h7" />,
  "fr-military-nuclear": <path d="M10 2.5 4 5v5c0 3.6 2.6 6.3 6 7.5 3.4-1.2 6-3.9 6-7.5V5l-6-2.5Z" />,
  "world-nuclear-plants": (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5Z" />
    </>
  ),
  duel: (
    <>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="13.5" cy="7" r="2.5" />
      <path d="M2.5 16.5c.6-2.5 2.1-4 4-4s3.4 1.5 4 4M9.5 16.5c.6-2.5 2.1-4 4-4s3.4 1.5 4 4" />
    </>
  ),
};

function Icon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

/** "18 sites", or "10 manches sur 173 sites" for modes that draw a few rounds from a big pool. */
function modeSize(mode: GameMode, sites: number): string {
  return mode.roundsPerGame === "all" ? `${sites} sites` : `${mode.roundsPerGame} manches sur ${sites} sites`;
}

const linkClass = "underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline";

async function Hero({ mode }: { mode: GameMode }) {
  const targets = await mode.loadTargets();
  const teasers = TEASER_SITES.flatMap((id) => targets.filter((t) => t.id === id));
  return (
    <section aria-labelledby="hero-heading" className="mt-12 grid items-center gap-x-12 gap-y-14 sm:mt-16 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Le jeu</p>
        <h1 id="hero-heading" className="mt-4 text-5xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
          Placez les centrales{" "}
          <mark className="rounded-xl bg-accent px-2 leading-none text-accent-ink [box-decoration-break:clone]">nucléaires</mark>.
        </h1>
        <p className="mt-6 max-w-md text-lg text-pretty text-muted">
          {targets.length} centrales, une carte de France. Un nom et une photo par manche : posez votre épingle au plus près.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href={`/play/${mode.id}`} className={buttonClass("primary", "group h-14 rounded-2xl px-8 text-lg")}>
            Jouer
            <span className="sr-only">
              {" "}
              — {mode.title}, {targets.length} sites
            </span>
            <svg
              className="transition-transform duration-200 ease-(--ease-out-expo) group-hover:translate-x-1"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              aria-hidden
            >
              <path d="M4 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <dl className="text-sm">
            <dt className="text-xs text-muted">Votre record</dt>
            <dd className="mt-0.5">
              <BestScore modeId={mode.id} className="text-lg font-semibold" />
            </dd>
          </dl>
        </div>
        <p className="mt-5 flex gap-4 text-sm text-muted">
          <Link href={`/classement/${mode.id}`} className={linkClass}>
            Classement
          </Link>
          <Link href={`/stats/${mode.id}`} className={linkClass}>
            Statistiques
          </Link>
        </p>
      </div>

      {/* overflow-x-clip: the tilted photos may poke out on the narrowest phones. */}
      <div className="relative mx-auto w-full max-w-md overflow-x-clip pb-24 lg:max-w-none lg:overflow-x-visible">
        <div className="rounded-[2rem] border border-line bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:18px_18px] p-6 sm:p-10">
          <HeroMap />
        </div>
        <div className="absolute inset-x-0 -bottom-2 px-4 sm:left-6 sm:px-0">
          <PhotoStrip targets={teasers} />
        </div>
      </div>
    </section>
  );
}

async function OtherModes({ modes }: { modes: readonly GameMode[] }) {
  const sizes = await Promise.all(modes.map(async (mode) => (await mode.loadTargets()).length));
  return (
    <section aria-labelledby="modes-heading" className="mt-20 sm:mt-28">
      <h2 id="modes-heading" className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
        Autres modes
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {modes.map((mode, i) => (
          <ModeCard
            key={mode.id}
            href={`/play/${mode.id}`}
            title={mode.title}
            meta={modeSize(mode, sizes[i])}
            icon={<Icon name={mode.id} />}
            aside={
              <span>
                Record <BestScore modeId={mode.id} className="text-xs text-ink" />
              </span>
            }
            links={[{ href: `/classement/${mode.id}`, label: "Classement" }]}
          />
        ))}
        <ModeCard href="/duel" title="Duel" meta="De 2 à 8 joueurs, mêmes sites" icon={<Icon name="duel" />} isHighlighted aside="Le chrono s’emballe à la première validation" />
      </ul>
    </section>
  );
}

export default function Home() {
  const others = GAME_MODES.filter((mode) => mode.id !== DEFAULT_MODE.id);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Logo />
        <PlayerBadge />
      </header>

      <Hero mode={DEFAULT_MODE} />
      <OtherModes modes={others} />

      <footer className="mt-auto pt-16 text-xs text-muted">
        <Link href="/credits" className="underline underline-offset-2 hover:text-ink">
          Crédits photos
        </Link>
      </footer>
    </main>
  );
}
