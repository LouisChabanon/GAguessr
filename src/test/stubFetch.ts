import { readFileSync } from "node:fs";
import { vi } from "vitest";

/** Serves `/geo/*.json` requests from the local `public/` folder. */
export function stubGeoFetch() {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => JSON.parse(readFileSync(`public${url}`, "utf8")),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function readGeo(file: string): unknown {
  return JSON.parse(readFileSync(`public/geo/${file}`, "utf8"));
}
