"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

let client: SupabaseClient<Database> | null = null;

/** The browser's Supabase client; its session lives in cookies the server can read. */
export function browserSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = publicSupabaseEnv();
    client = createBrowserClient<Database>(url, publishableKey);
  }
  return client;
}
