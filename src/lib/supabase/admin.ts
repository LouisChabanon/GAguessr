import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

let client: SupabaseClient<Database> | null = null;

/** Service-role client: bypasses RLS. Only for writes the server has validated. */
export function adminSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Supabase is not configured: set SUPABASE_SECRET_KEY.");
  client = createClient<Database>(publicSupabaseEnv().url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
