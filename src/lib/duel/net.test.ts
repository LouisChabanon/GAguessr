import { describe, expect, it, vi } from "vitest";
import { retryUntil, singleFlight } from "./net";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("singleFlight", () => {
  it("runs one task at a time and merges the calls made meanwhile into one follow-up", async () => {
    const runs: ReturnType<typeof deferred>[] = [];
    const task = vi.fn(() => {
      const run = deferred();
      runs.push(run);
      return run.promise;
    });
    const refresh = singleFlight(task);

    const first = refresh();
    const second = refresh();
    const third = refresh();
    expect(task).toHaveBeenCalledTimes(1);
    expect(second).toBe(third);

    runs[0].resolve();
    await first;
    await vi.waitFor(() => expect(task).toHaveBeenCalledTimes(2));
    runs[1].resolve();
    await third;
    expect(task).toHaveBeenCalledTimes(2);

    refresh();
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("still runs the follow-up when the current run fails", async () => {
    let calls = 0;
    const refresh = singleFlight(() => (++calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve()));
    const first = refresh();
    const second = refresh();
    await expect(first).rejects.toThrow("offline");
    await second;
    expect(calls).toBe(2);
  });
});

describe("retryUntil", () => {
  const instant = () => Promise.resolve();

  it("retries until an attempt gives an answer", async () => {
    const results = ["timeout", "timeout", "ok"];
    const attempt = vi.fn(async () => results.shift()!);
    const result = await retryUntil(attempt, { shouldRetry: (r) => r === "timeout", until: () => Infinity, sleep: instant });
    expect(result).toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("gives up with the last result once the next try would come too late", async () => {
    let clock = 0;
    const sleep = async (ms: number) => {
      clock += ms;
    };
    const attempt = vi.fn(async () => "timeout");
    const result = await retryUntil(attempt, {
      shouldRetry: () => true,
      until: () => 1_000,
      delaysMs: [300],
      now: () => clock,
      sleep,
    });
    expect(result).toBe("timeout");
    // Tries at 0, 300, 600 and 900 ms; a fifth would start after the cut-off.
    expect(attempt).toHaveBeenCalledTimes(4);
  });

  it("returns an answer at once, even a refusal", async () => {
    const attempt = vi.fn(async () => "too_late");
    expect(await retryUntil(attempt, { shouldRetry: (r) => r === "timeout", until: () => Infinity, sleep: instant })).toBe("too_late");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
