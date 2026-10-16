"use client";

import { useCallback, useState } from "react";
import { setPseudo } from "@/app/actions/setPseudo";
import { PseudoEditor } from "@/components/ui/PseudoEditor";
import { useOwnPseudo } from "@/hooks/useOwnPseudo";
import type { PseudoResult } from "@/lib/scores/types";

/** The visitor's pseudo, changeable in place; nothing for visitors who never chose one. */
export function PlayerBadge() {
  const known = useOwnPseudo();
  const [renamed, setRenamed] = useState<string | null>(null);
  const pseudo = renamed ?? known;

  const rename = useCallback(async (value: string): Promise<PseudoResult> => {
    const result = await setPseudo(value).catch((): PseudoResult => ({ ok: false, error: "unavailable" }));
    if (result.ok) setRenamed(result.pseudo);
    return result;
  }, []);

  if (!pseudo) return null;
  return <PseudoEditor pseudo={pseudo} onRename={rename} label="Vous jouez en tant que" className="enter-up text-right" />;
}
