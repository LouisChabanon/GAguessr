import type { ReactNode } from "react";

/** Centered card for the duel's screens outside play: lobby, join, errors. */
export function DuelScreen({ children, labelledBy, testId }: { children: ReactNode; labelledBy: string; testId?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <section
        aria-labelledby={labelledBy}
        data-testid={testId}
        className="enter-up w-full max-w-md rounded-3xl border border-line bg-panel-solid p-6 shadow-pop sm:p-8"
      >
        {children}
      </section>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">{children}</p>;
}
