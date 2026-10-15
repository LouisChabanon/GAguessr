import Link from "next/link";
import type { GameModeMeta } from "@/modes/types";

type Section = "classement" | "stats";

const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: "classement", label: "Classement" },
  { id: "stats", label: "Statistiques" },
];

interface ModePageHeaderProps {
  mode: Pick<GameModeMeta, "id" | "title">;
  current: Section;
}

/** Shared top of a mode's leaderboard and statistics pages. */
export function ModePageHeader({ mode, current }: ModePageHeaderProps) {
  return (
    <header>
      <Link href="/" className="text-sm font-semibold tracking-tight hover:text-accent-text">
        ← GAguessr
      </Link>
      <div className="mt-12 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">{mode.title}</h1>
        <Link href={`/play/${mode.id}`} className="inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-ink shadow-panel transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.97]">
          Jouer
        </Link>
      </div>
      <nav aria-label="Sections du mode" className="mt-8 flex gap-6 border-b border-line text-sm">
        {SECTIONS.map(({ id, label }) => (
          <Link
            key={id}
            href={`/${id}/${mode.id}`}
            aria-current={id === current ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent pb-3 font-medium text-muted transition-colors duration-150 hover:text-ink aria-[current=page]:border-accent aria-[current=page]:text-ink"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
