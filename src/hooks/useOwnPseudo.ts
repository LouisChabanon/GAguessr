"use client";

import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

/** The visitor's pseudo if they have one; null for visitors who never named themselves. */
export function useOwnPseudo(): string | null {
  const [pseudo, setPseudo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = browserSupabase();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: profile, error } = await supabase.from("profiles").select("pseudo").maybeSingle();
      if (error) throw error;
      if (!cancelled) setPseudo(profile?.pseudo ?? null);
    })().catch((error: unknown) => console.warn("[scores] own pseudo unavailable", error));
    return () => {
      cancelled = true;
    };
  }, []);

  return pseudo;
}
