import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./sameOrigin";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("isSameOrigin", () => {
  it("trusts the browser's Sec-Fetch-Site when it is sent", () => {
    expect(isSameOrigin(headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(headers({ "sec-fetch-site": "cross-site", origin: "https://gaguessr.fr", host: "gaguessr.fr" }))).toBe(false);
    expect(isSameOrigin(headers({ "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("falls back to comparing Origin with the host", () => {
    expect(isSameOrigin(headers({ origin: "https://gaguessr.fr", host: "gaguessr.fr" }))).toBe(true);
    expect(isSameOrigin(headers({ origin: "https://evil.example", host: "gaguessr.fr" }))).toBe(false);
    expect(isSameOrigin(headers({ origin: "https://gaguessr.fr", host: "internal:3000", "x-forwarded-host": "gaguessr.fr" }))).toBe(true);
  });

  it("refuses requests that say nothing about where they come from", () => {
    expect(isSameOrigin(headers({ host: "gaguessr.fr" }))).toBe(false);
    expect(isSameOrigin(headers({ origin: "not a url", host: "gaguessr.fr" }))).toBe(false);
  });
});
