"use client";

import { useCallback, useState } from "react";
import type { PseudoResult } from "@/lib/scores/types";

export interface PseudoDraft {
  value: string;
  setValue: (value: string) => void;
  error: string | null;
  isPending: boolean;
  /** Saves the typed pseudo; resolves to whether it was accepted. */
  save: () => Promise<boolean>;
}

/** A pseudo being typed on the summary, kept above the form so leaving the summary can still save it. */
export function usePseudoDraft(onChoosePseudo: (pseudo: string) => Promise<PseudoResult>): PseudoDraft {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const save = useCallback(async () => {
    setIsPending(true);
    const result = await onChoosePseudo(value);
    setIsPending(false);
    setError(result.ok ? null : (result.message ?? "Impossible d’enregistrer ce pseudo, réessayez."));
    return result.ok;
  }, [onChoosePseudo, value]);

  return { value, setValue, error, isPending, save };
}
