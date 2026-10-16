"use client";

import { browserSupabase } from "./browser";

/** Signs the visitor in anonymously unless they already have a session; later visits reuse it. */
export async function ensureSession(): Promise<void> {
  const auth = browserSupabase().auth;
  const { data } = await auth.getSession();
  if (data.session) return;
  const { error } = await auth.signInAnonymously();
  if (error) throw error;
}
