"use server";

import { updateTag } from "next/cache";
import { pseudoSchema } from "@/lib/scores/pseudo";
import { PROFILES_TAG } from "@/lib/scores/tags";
import type { PseudoResult } from "@/lib/scores/types";
import { serverSupabase } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

/** Names the current player on the leaderboards. Row-level security limits them to their own profile. */
export async function setPseudo(input: unknown): Promise<PseudoResult> {
  const parsed = pseudoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", message: parsed.error.issues[0]?.message };

  try {
    const supabase = await serverSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { ok: false, error: "unauthenticated" };

    const { error } = await supabase.from("profiles").upsert({ id: auth.user.id, pseudo: parsed.data });
    if (error?.code === UNIQUE_VIOLATION) return { ok: false, error: "taken", message: "Ce pseudo est déjà pris." };
    if (error) throw error;

    updateTag(PROFILES_TAG);
    return { ok: true, pseudo: parsed.data };
  } catch (error: unknown) {
    console.error("[setPseudo] failed", error);
    return { ok: false, error: "unavailable" };
  }
}
