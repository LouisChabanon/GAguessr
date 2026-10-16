"use client";

import type { PlayerName } from "@/hooks/usePlayerName";
import { PSEUDO_MAX } from "@/lib/scores/pseudo";

/** The player's name in a duel: shown when known, asked for otherwise. */
export function PseudoField({ name, id }: { name: PlayerName; id: string }) {
  if (name.pseudo) {
    return (
      <p className="text-sm text-muted">
        Vous jouez en tant que <span className="font-medium text-ink">{name.pseudo}</span>
      </p>
    );
  }
  const { draft } = name;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        Votre pseudo
      </label>
      <input
        id={id}
        value={draft.value}
        onChange={(event) => draft.setValue(event.target.value)}
        maxLength={PSEUDO_MAX}
        autoComplete="nickname"
        placeholder="Votre adversaire le verra"
        aria-invalid={draft.error !== null}
        aria-describedby={draft.error ? `${id}-error` : undefined}
        className="mt-1.5 h-11 w-full rounded-xl border border-line bg-panel-solid px-3 text-base transition-colors duration-150 placeholder:text-muted focus:border-accent-text focus:outline-none"
      />
      {draft.error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-poor" role="alert">
          {draft.error}
        </p>
      )}
    </div>
  );
}
