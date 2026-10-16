import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/scores/LeaderboardTable";
import { ModePageHeader } from "@/components/scores/ModePageHeader";
import { formatDuration, formatPercent } from "@/lib/format";
import { getLeaderboard } from "@/lib/scores/queries";
import { SPEED_BONUS_MAX, SPEED_BONUS_ZERO_MS_PER_ROUND } from "@/lib/scores/speedBonus";
import type { LeaderboardPeriod } from "@/lib/scores/types";
import { GAME_MODES, getMode } from "@/modes/registry";

const PERIODS: readonly { id: LeaderboardPeriod; label: string }[] = [
  { id: "all", label: "Depuis toujours" },
  { id: "week", label: "7 derniers jours" },
];

function parsePeriod(value: string | string[] | undefined): LeaderboardPeriod {
  return value === "week" ? "week" : "all";
}

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode: mode.id }));
}

export async function generateMetadata(props: PageProps<"/classement/[mode]">): Promise<Metadata> {
  const mode = getMode((await props.params).mode);
  return mode ? { title: `Classement · ${mode.title} · GAguessr`, description: `Les meilleurs joueurs du mode ${mode.title}.` } : {};
}

async function Board({ modeId, searchParams }: { modeId: string; searchParams: PageProps<"/classement/[mode]">["searchParams"] }) {
  const period = parsePeriod((await searchParams).periode);
  const rows = await getLeaderboard(modeId, period);
  return (
    <>
      <nav aria-label="Période" className="mt-6 inline-flex rounded-xl border border-line p-1 text-sm">
        {PERIODS.map(({ id, label }) => (
          <Link
            key={id}
            href={id === "all" ? `/classement/${modeId}` : `/classement/${modeId}?periode=${id}`}
            aria-current={id === period ? "page" : undefined}
            scroll={false}
            className="rounded-lg px-3 py-1.5 text-muted transition-colors duration-150 hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-surface"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {rows.length > 0 ? (
          <LeaderboardTable rows={rows} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">
            Personne n’est encore classé{period === "week" ? " cette semaine" : ""}. Terminez une partie et choisissez un pseudo pour ouvrir le bal.
          </p>
        )}
      </div>
    </>
  );
}

async function ModeLeaderboard(props: PageProps<"/classement/[mode]">) {
  const mode = getMode((await props.params).mode);
  if (!mode) notFound();
  return (
    <>
      <ModePageHeader mode={mode} current="classement" />
      <p className="mt-6 max-w-xl text-sm text-muted">
        Meilleure partie de chaque joueur. Aux points de précision s’ajoute un bonus vitesse : jusqu’à +{formatPercent(SPEED_BONUS_MAX)}, qui
        diminue avec le temps moyen par manche et disparaît à {formatDuration(SPEED_BONUS_ZERO_MS_PER_ROUND)}.
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-line/50" />}>
        <Board modeId={mode.id} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

export default function LeaderboardPage(props: PageProps<"/classement/[mode]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <Suspense>
        <ModeLeaderboard {...props} />
      </Suspense>
    </main>
  );
}
