import Link from "next/link";
import type { ReactNode } from "react";

interface ModeCardProps {
  href: string;
  title: string;
  /** Size of the mode, part of the link's name: "10 sites", "10 manches". */
  meta: string;
  /** Extra line under the title, outside the link's name (e.g. the best score). */
  aside?: ReactNode;
  /** Small links shown under the card, such as the leaderboard. */
  links?: readonly { href: string; label: string }[];
  icon: ReactNode;
  isHighlighted?: boolean;
}

/** A secondary game mode: small, but still a real button, with its own icon. */
export function ModeCard({ href, title, meta, aside, links = [], icon, isHighlighted = false }: ModeCardProps) {
  return (
    <li className="flex flex-col">
      <Link
        href={href}
        data-highlighted={isHighlighted}
        className="group flex flex-1 flex-col rounded-2xl border border-line bg-panel-solid p-4 transition-[translate,border-color,box-shadow] duration-200 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:border-muted/40 hover:shadow-panel data-[highlighted=true]:border-accent/70 data-[highlighted=true]:bg-accent/5"
      >
        <span
          className="grid size-9 place-items-center rounded-xl bg-line/60 text-ink transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-ink group-data-[highlighted=true]:bg-accent group-data-[highlighted=true]:text-accent-ink"
          aria-hidden
        >
          {icon}
        </span>
        <span className="mt-4 text-base leading-snug font-semibold tracking-tight">{title}</span>
        <span className="mt-0.5 text-sm text-muted">{meta}</span>
      </Link>
      {(aside || links.length > 0) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted">
          {aside}
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">
              {link.label}
            </Link>
          ))}
        </p>
      )}
    </li>
  );
}
