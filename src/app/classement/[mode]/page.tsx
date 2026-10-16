import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/scores/LeaderboardTable";
import { ModePageHeader } from "@/components/scores/ModePageHeader";
import { formatDuration, formatPercent } from "@/lib/format";
import { getLeaderboard } from "@/lib/scores/queries";
import { SPEED_BONUS_MAX, SPEED_BONUS_ZERO_MS_PER_ROUND } from "@/lib/scores/speedBonus";
import { GAME_MODES, getMode } from "@/modes/registry";

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode: mode.id }));
}

export async function generateMetadata(props: PageProps<"/classement/[mode]">): Promise<Metadata> {
  const mode = getMode((await props.params).mode);
  return mode ? { title: `Classement · ${mode.title} · GAguessr`, description: `Les meilleurs joueurs du mode ${mode.title}.` } : {};
}

/** The all-time board: each named player's best game. */
async function Board({ modeId }: { modeId: string }) {
  const rows = await getLeaderboard(modeId);
  return (
    <div className="mt-6">
      {rows.length > 0 ? (
        <LeaderboardTable rows={rows} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">
          Personne n’est encore classé. Terminez une partie et choisissez un pseudo pour ouvrir le bal.
        </p>
      )}
    </div>
  );
}

async function ModeLeaderboard(props: PageProps<"/classement/[mode]">) {
  const mode = getMode((await props.params).mode);
  if (!mode) notFound();
  return (
    <>
      <ModePageHeader mode={mode} current="classement" />
      <p className="mt-6 max-w-xl text-sm text-muted">
        Meilleure partie de chaque joueur, depuis toujours. Aux points de précision s’ajoute un bonus vitesse : jusqu’à +{formatPercent(SPEED_BONUS_MAX)}, qui
        diminue avec le temps moyen par manche et disparaît à {formatDuration(SPEED_BONUS_ZERO_MS_PER_ROUND)}.
      </p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-line/50" />}>
        <Board modeId={mode.id} />
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
