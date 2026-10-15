import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Game } from "@/components/game/Game";
import { MapLoading } from "@/components/game/MapLoading";
import { GAME_MODES, getMode } from "@/modes/registry";

type ModeParams = PageProps<"/play/[mode]">["params"];

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode: mode.id }));
}

export async function generateMetadata(props: PageProps<"/play/[mode]">): Promise<Metadata> {
  const mode = getMode((await props.params).mode);
  return mode ? { title: `${mode.title} · GAguessr`, description: mode.description } : {};
}

async function ModeGame({ params }: { params: ModeParams }) {
  const { mode: modeId } = await params;
  if (!getMode(modeId)) notFound();
  return <Game modeId={modeId} />;
}

// The shell is shared by every mode; the URL-specific part streams in behind Suspense.
export default function PlayPage(props: PageProps<"/play/[mode]">) {
  return (
    <main className="relative h-dvh overflow-hidden">
      <Suspense fallback={<MapLoading />}>
        <ModeGame params={props.params} />
      </Suspense>
    </main>
  );
}
