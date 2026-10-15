import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

let client: SupabaseClient<Database> | null = null;

/** Anonymous, cookie-less client for public aggregates: safe to call inside 'use cache'. */
export function publicSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const { url, publishableKey } = publicSupabaseEnv();
  client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
