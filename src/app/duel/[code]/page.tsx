import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Duel } from "@/components/duel/Duel";
import { MapLoading } from "@/components/game/MapLoading";
import { normalizeDuelCode } from "@/game/duel/code";

type DuelParams = PageProps<"/duel/[code]">["params"];

export const metadata: Metadata = {
  title: "Duel · GAguessr",
  description: "Vous êtes invité à un duel : mêmes sites, même chrono.",
  robots: { index: false },
};

async function DuelByCode({ params }: { params: DuelParams }) {
  const { code: raw } = await params;
  const code = normalizeDuelCode(decodeURIComponent(raw));
  if (!code) notFound();
  if (code !== raw) redirect(`/duel/${code}`);
  return <Duel key={code} code={code} />;
}

// The URL-specific part streams in behind Suspense, as on the solo game page.
export default function DuelCodePage(props: PageProps<"/duel/[code]">) {
  return (
    <main className="relative h-dvh overflow-hidden">
      <Suspense fallback={<MapLoading />}>
        <DuelByCode params={props.params} />
      </Suspense>
    </main>
  );
}
