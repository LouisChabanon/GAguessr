import { afterEach, describe, expect, it, vi } from "vitest";
import { publicSupabaseEnv } from "./env";

describe("publicSupabaseEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the configured project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(publicSupabaseEnv()).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_x" });
  });

  it("fails fast with a clear message when unset or malformed", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => publicSupabaseEnv()).toThrow(/Supabase is not configured/);
  });
});
