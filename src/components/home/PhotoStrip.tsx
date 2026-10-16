import Image from "next/image";
import type { Target } from "@/modes/types";

/** Slight, fixed tilts: a hand-laid stack, not a carousel. */
const SIZES = "(min-width: 640px) 160px, 112px";
const TILTS = ["-rotate-6", "rotate-3", "-rotate-2"] as const;

/** A few of the game's own prompts (photo and name): what a round asks, never where the answer is. */
export function PhotoStrip({ targets }: { targets: readonly Target[] }) {
  const shown = targets.filter((t): t is Target & { photo: NonNullable<Target["photo"]> } => t.photo !== undefined).slice(0, TILTS.length);
  return (
    <ul className="flex justify-center sm:justify-start" aria-label="Quelques sites à placer">
      {shown.map((target, i) => (
        <li
          key={target.id}
          className={`${TILTS[i]} -ml-5 w-28 shrink-0 rounded-xl border border-line bg-panel-solid p-1.5 shadow-pop transition-transform duration-300 ease-(--ease-out-expo) first:ml-0 hover:z-10 hover:-translate-y-1 hover:rotate-0 sm:w-40`}
        >
          <Image
            src={target.photo.src}
            width={target.photo.width}
            height={target.photo.height}
            alt={`Photo : ${target.name}`}
            sizes={SIZES}
            priority={i === 0}
            className="aspect-[4/3] w-full rounded-lg bg-line object-cover"
          />
          <p className="mt-1.5 px-0.5 text-[11px] leading-tight">
            <span className="block text-muted">Saurez-vous placer</span>
            <span className="block truncate font-medium">{target.name} ?</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
