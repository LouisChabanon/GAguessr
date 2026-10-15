import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable · GAguessr", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-12">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Page introuvable</h1>
      <p className="mt-3 text-muted">Cette page n&apos;existe pas, ou ce mode de jeu a disparu de la carte.</p>
      <Link href="/" className={buttonClass("primary", "mt-8 self-start")}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
