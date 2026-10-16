import type { Metadata } from "next";
import Link from "next/link";
import { DuelLobby } from "@/components/duel/DuelLobby";

export const metadata: Metadata = {
  title: "Duel · GAguessr",
  description: "Affrontez vos amis, de 2 à 8 joueurs : mêmes sites, même chrono.",
};

export default function DuelPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
      <header>
        <Link href="/" className="text-sm text-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">
          ← Accueil
        </Link>
      </header>
      <section aria-labelledby="duel-heading" className="mt-12 sm:mt-16">
        <h1 id="duel-heading" className="text-5xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
          Défiez vos{" "}
          <mark className="rounded-xl bg-accent px-2 leading-none text-accent-ink [box-decoration-break:clone]">amis</mark>.
        </h1>
      </section>
      <DuelLobby />
    </main>
  );
}
