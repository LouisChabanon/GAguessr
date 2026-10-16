"use client";

import { useCallback, useState } from "react";
import { setPseudo } from "@/app/actions/setPseudo";
import type { PseudoResult } from "@/lib/scores/types";
import { ensureSession } from "@/lib/supabase/session";
import { usePseudoDraft, type PseudoDraft } from "./usePseudoDraft";

export interface PlayerName {
  /** The player's pseudo, or null while they have none. */
  pseudo: string | null;
  draft: PseudoDraft;
  /** Changes the pseudo the player already has. */
  rename: (pseudo: string) => Promise<PseudoResult>;
  /** Makes sure the visitor has a session and a pseudo, saving the typed one if needed. */
  ready: () => Promise<boolean>;
}

/** The pseudo a duel needs: `known` when the player already has one, else typed in a draft. */
export function usePlayerName(known: string | null): PlayerName {
  const [saved, setSaved] = useState<string | null>(null);
  const pseudo = saved ?? known;

  const choose = useCallback(async (value: string): Promise<PseudoResult> => {
    await ensureSession();
    const result = await setPseudo(value).catch((): PseudoResult => ({ ok: false, error: "unavailable" }));
    if (result.ok) setSaved(result.pseudo);
    return result;
  }, []);
  const draft = usePseudoDraft(choose);

  const ready = useCallback(async () => {
    await ensureSession();
    return pseudo !== null || draft.save();
  }, [pseudo, draft]);

  return { pseudo, draft, rename: choose, ready };
}
