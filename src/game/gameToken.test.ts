import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_TOKEN_TTL_MS, signGameStart, verifyGameStart } from "./gameToken";

vi.mock("server-only", () => ({}));

const T0 = Date.UTC(2026, 9, 16, 9, 0);

describe("game start tokens", () => {
  beforeEach(() => vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-with-enough-entropy"));
  afterEach(() => vi.unstubAllEnvs());

  it("gives back when the server saw the game start", () => {
    const token = signGameStart("fr-nuclear-plants", T0);
    expect(verifyGameStart(token, "fr-nuclear-plants", T0 + 60_000)).toEqual({ ok: true, startedAt: T0 });
  });

  it("rejects a token for another mode", () => {
    const token = signGameStart("fr-nuclear-plants", T0);
    expect(verifyGameStart(token, "world-nuclear-plants", T0 + 60_000)).toEqual({ ok: false });
  });

  it("rejects a token whose start time was changed", () => {
    const [, signature] = signGameStart("fr-nuclear-plants", T0).split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ modeId: "fr-nuclear-plants", startedAt: T0 - 600_000 })).toString("base64url");
    expect(verifyGameStart(`${forgedPayload}.${signature}`, "fr-nuclear-plants", T0 + 60_000)).toEqual({ ok: false });
  });

  it("rejects a token signed with another secret", () => {
    const token = signGameStart("fr-nuclear-plants", T0);
    vi.stubEnv("GAME_TOKEN_SECRET", "another-secret-with-enough-entropy");
    expect(verifyGameStart(token, "fr-nuclear-plants", T0 + 60_000)).toEqual({ ok: false });
  });

  it("rejects expired tokens and tokens from the future", () => {
    const token = signGameStart("fr-nuclear-plants", T0);
    expect(verifyGameStart(token, "fr-nuclear-plants", T0 + GAME_TOKEN_TTL_MS + 1)).toEqual({ ok: false });
    expect(verifyGameStart(token, "fr-nuclear-plants", T0 - 1)).toEqual({ ok: false });
  });

  it.each(["", "garbage", "a.b.c", "!!!.???"])("rejects the malformed token %j", (token) => {
    expect(verifyGameStart(token, "fr-nuclear-plants", T0)).toEqual({ ok: false });
  });

  it("refuses to sign without a secret", () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "");
    expect(() => signGameStart("fr-nuclear-plants", T0)).toThrow(/GAME_TOKEN_SECRET/);
  });
});
