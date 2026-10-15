import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModePageHeader } from "@/components/scores/ModePageHeader";
import { StatsHeatmap } from "@/components/scores/StatsHeatmap";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { formatDistance, formatPercent, formatScore } from "@/lib/format";
import { getCrowdData, getModeOverview } from "@/lib/scores/queries";
import { rankSites, type RankedSite } from "@/lib/scores/ranking";
import { GAME_MODES, getMode } from "@/modes/registry";
import type { GameMode } from "@/modes/types";

type StatsProps = PageProps<"/stats/[mode]">;

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode: mode.id }));
}

export async function generateMetadata(props: StatsProps): Promise<Metadata> {
  const mode = getMode((await props.params).mode);
  return mode ? { title: `Statistiques · ${mode.title} · GAguessr`, description: `Les sites les mieux et les moins bien placés du mode ${mode.title}.` } : {};
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</dd>
    </div>
  );
}

async function Overview({ modeId }: { modeId: string }) {
  const overview = await getModeOverview(modeId);
  return (
    <dl className="mt-10 grid grid-cols-3 gap-4 border-b border-line pb-10">
      <Figure label="Parties" value={formatScore(overview.games)} />
      <Figure label="Joueurs" value={formatScore(overview.players)} />
      <Figure label="Réussite moy." value={overview.avgShare === null ? "—" : formatPercent(overview.avgShare)} />
    </dl>
  );
}

function SiteRow({ site, modeId, isSelected, withinKm }: { site: RankedSite; modeId: string; isSelected: boolean; withinKm: number }) {
  const { target, stat } = site;
  return (
    <li>
      <Link
        href={`/stats/${modeId}?site=${encodeURIComponent(target.id)}#carte`}
        scroll={false}
        aria-current={isSelected ? "true" : undefined}
        className="-mx-3 grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl px-3 py-3 transition-colors duration-150 hover:bg-panel-solid aria-[current=true]:bg-accent/25"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{target.name}</span>
          {stat ? (
            <ScoreBar score={stat.avgScore} className="mt-1.5 max-w-48" />
          ) : (
            <span className="block text-xs text-muted">Pas encore assez de parties</span>
          )}
        </span>
        {stat && (
          <span className="text-right font-mono text-sm tabular-nums">
            <span className="block">{formatPercent(stat.withinShare)}<span className="text-xs text-muted"> à &lt; {formatDistance(withinKm)}</span></span>
            <span className="block text-xs text-muted">médiane {formatDistance(stat.medianKm)}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

async function Sites({ mode, searchParams }: { mode: GameMode; searchParams: StatsProps["searchParams"] }) {
  const [targets, crowd, { site }] = await Promise.all([mode.loadTargets(), getCrowdData(mode.id), searchParams]);
  const ranked = rankSites(targets, crowd.stats);
  const known = ranked.filter((s) => s.stat);
  const selected = targets.find((t) => t.id === site) ?? known[0]?.target ?? null;

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <section aria-labelledby="sites-heading">
        <h2 id="sites-heading" className="flex items-baseline justify-between border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          <span>Du mieux au moins bien placé</span>
        </h2>
        <ol className="divide-y divide-line" data-testid="site-stats">
          {ranked.map((s) => (
            <SiteRow key={s.target.id} site={s} modeId={mode.id} isSelected={s.target.id === selected?.id} withinKm={crowd.withinKm} />
          ))}
        </ol>
      </section>
      <section id="carte" aria-labelledby="heatmap-heading" className="lg:sticky lg:top-8">
        <h2 id="heatmap-heading" className="mb-3 text-sm font-semibold">
          {selected ? `Où les joueurs placent ${selected.name}` : "Placements des joueurs"}
        </h2>
        {selected ? (
          <StatsHeatmap area={mode.map} siteName={selected.name} answer={selected.coords} guesses={crowd.guesses[selected.id] ?? []} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-muted">Aucune partie enregistrée pour l’instant.</p>
        )}
      </section>
    </div>
  );
}

async function ModeStats(props: StatsProps) {
  const mode = getMode((await props.params).mode);
  if (!mode) notFound();
  return (
    <>
      <ModePageHeader mode={mode} current="stats" />
      <Suspense fallback={<div className="mt-10 h-24 animate-pulse rounded-2xl bg-line/50" />}>
        <Overview modeId={mode.id} />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-2xl bg-line/50" />}>
        <Sites mode={mode} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

export default function StatsPage(props: StatsProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <Suspense>
        <ModeStats {...props} />
      </Suspense>
    </main>
  );
}
