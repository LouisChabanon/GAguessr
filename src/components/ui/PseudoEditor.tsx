"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { usePseudoDraft } from "@/hooks/usePseudoDraft";
import { PSEUDO_MAX } from "@/lib/scores/pseudo";
import type { PseudoResult } from "@/lib/scores/types";
import { buttonClass } from "./button";

interface PseudoEditorProps {
  pseudo: string;
  /** Saves a new pseudo; the editor closes once it is accepted. */
  onRename: (pseudo: string) => Promise<PseudoResult>;
  /** Text before the pseudo, e.g. "Vous jouez en tant que". */
  label: string;
  className?: string;
}

/**
 * The player's pseudo with a "Modifier" link that turns it into a small form, in place.
 * Not a <form> element: it often sits inside one (the duel lobby's), and forms cannot nest.
 */
export function PseudoEditor({ pseudo, onRename, label, className = "" }: PseudoEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const draft = usePseudoDraft(onRename);
  const inputId = useId();
  const errorId = useId();

  const startEditing = () => {
    draft.setValue(pseudo);
    setIsEditing(true);
  };

  const save = async () => {
    // Nothing to save: closing is enough.
    if (draft.value.trim() === pseudo || (await draft.save())) setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setIsEditing(false);
    if (event.key === "Enter") {
      // Keeps Enter from submitting a surrounding form.
      event.preventDefault();
      void save();
    }
  };

  if (!isEditing) {
    return (
      <p className={`text-sm text-muted ${className}`} data-testid="pseudo-current">
        {label} <span className="font-medium text-ink">{pseudo}</span>
        {" · "}
        <button
          type="button"
          onClick={startEditing}
          className="font-medium underline decoration-line decoration-2 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-accent"
        >
          Modifier
        </button>
      </p>
    );
  }

  return (
    <div role="group" aria-labelledby={`${inputId}-label`} className={className} data-testid="pseudo-rename">
      <label id={`${inputId}-label`} htmlFor={inputId} className="text-sm font-medium">
        Nouveau pseudo
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id={inputId}
          value={draft.value}
          onChange={(event) => draft.setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          required
          autoFocus
          maxLength={PSEUDO_MAX}
          autoComplete="nickname"
          aria-invalid={draft.error !== null}
          aria-describedby={draft.error ? errorId : undefined}
          className="h-10 min-w-40 flex-1 basis-full rounded-xl sm:basis-auto border border-line bg-panel-solid px-3 text-sm transition-[border-color,box-shadow] duration-150 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
        />
        <button type="button" className={buttonClass("primary", "h-10")} disabled={draft.isPending} onClick={() => void save()}>
          Enregistrer
        </button>
        <button type="button" className={buttonClass("ghost", "h-10")} onClick={() => setIsEditing(false)}>
          Annuler
        </button>
      </div>
      {draft.error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-poor">
          {draft.error}
        </p>
      )}
    </div>
  );
}
