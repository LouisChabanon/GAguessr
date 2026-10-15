import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PhotoCredit } from "@/components/photo/SitePhoto";
import { GAME_MODES } from "@/modes/registry";
import type { GameMode } from "@/modes/types";

export const metadata: Metadata = {
  title: "Crédits photos · GAguessr",
  description: "Auteurs et licences des photos des sites nucléaires, issues de Wikimedia Commons.",
};

async function ModeCredits({ mode }: { mode: GameMode }) {
  const targets = await mode.loadTargets();
  return (
    <section aria-labelledby={`credits-${mode.id}`} className="mt-12">
      <h2 id={`credits-${mode.id}`} className="border-b border-line pb-3 text-sm font-semibold">
        {mode.title}
      </h2>
      <ul className="divide-y divide-line">
        {targets.map((target) => (
          <li key={target.id} className="flex items-center gap-4 py-3">
            {target.photo ? (
              <Image
                src={target.photo.src}
                alt=""
                width={target.photo.width}
                height={target.photo.height}
                sizes="64px"
                className="h-12 w-16 shrink-0 rounded-md bg-line object-cover"
              />
            ) : (
              <span className="photo-placeholder h-12 w-16 shrink-0 rounded-md border border-line" aria-hidden />
            )}
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{target.name}</span>
              <span className="block text-xs text-muted">
                {target.photo ? <PhotoCredit photo={target.photo} /> : "Aucune photo libre de droits de ce site."}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CreditsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <Link href="/" className="text-sm font-semibold tracking-tight hover:text-accent-text">
        ← GAguessr
      </Link>
      <h1 className="mt-12 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Crédits photos</h1>
      <p className="mt-4 max-w-xl text-muted">
        Les photos proviennent de Wikimedia Commons et sont réutilisées selon leur licence. Les sites militaires
        sensibles n&apos;ont, pour la plupart, aucune photo libre : un motif les remplace.
      </p>
      {GAME_MODES.map((mode) => (
        <ModeCredits key={mode.id} mode={mode} />
      ))}
    </main>
  );
}
