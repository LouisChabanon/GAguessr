import { describe, expect, it, vi } from "vitest";
import { cachedAsync, onceAsync } from "./cache";

describe("cachedAsync", () => {
  it("loads each key once", async () => {
    const load = vi.fn(async (key: string) => key.toUpperCase());
    const cached = cachedAsync(load);
    await expect(cached("a")).resolves.toBe("A");
    await cached("a");
    await cached("b");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("retries after a failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(42);
    const cached = cachedAsync<string, number>(load);
    await expect(cached("k")).rejects.toThrow("boom");
    await expect(cached("k")).resolves.toBe(42);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("onceAsync", () => {
  it("shares one pending promise", async () => {
    const load = vi.fn(async () => 1);
    const once = onceAsync(load);
    await Promise.all([once(), once()]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
