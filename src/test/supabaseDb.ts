import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/** The slice of Supabase's platform the migrations rely on: roles, auth.users and auth.uid(). */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

const MIGRATIONS_DIR = "supabase/migrations";

function migrations(): string[] {
  return readdirSync(MIGRATIONS_DIR).sort();
}

async function apply(db: PGlite, files: readonly string[]) {
  for (const file of files) await db.exec(readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8"));
}

/**
 * A fresh in-memory Postgres with every migration applied, as on a new Supabase project.
 * With `until`, only the migrations up to that file (included): for testing an upgrade.
 */
export async function createTestDb({ until }: { until?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const all = migrations();
  await apply(db, until === undefined ? all : all.slice(0, all.indexOf(until) + 1));
  return db;
}

/** Applies the migrations after `after`, as a deploy would on a project that already has it. */
export async function applyMigrationsAfter(db: PGlite, after: string): Promise<void> {
  const all = migrations();
  await apply(db, all.slice(all.indexOf(after) + 1));
}

/** Runs `fn` as a PostgREST request would: under `role`, with `userId` as the JWT subject. */
export async function asRole<T>(db: PGlite, role: "anon" | "authenticated" | "service_role", userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
