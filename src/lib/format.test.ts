import { describe, expect, it } from "vitest";
import { formatClock, formatDistance, formatDuration, formatScore, formatDate } from "./format";

// French typography: no-break space before units, narrow no-break space between thousands.
const NBSP = " ";
const NNBSP = " ";

describe("formatDistance", () => {
  it.each([
    [0, "Dans le mille"],
    [0.4, `<${NBSP}1${NBSP}km`],
    [12.6, `13${NBSP}km`],
    [12345.2, `12${NNBSP}345${NBSP}km`],
  ])("%d → %s", (km, expected) => {
    expect(formatDistance(km)).toBe(expected);
  });
});

describe("formatScore", () => {
  it("groups thousands the French way", () => {
    expect(formatScore(48210)).toBe(`48${NNBSP}210`);
  });
});

describe("formatDate", () => {
  it("formats in French, in a fixed time zone", () => {
    expect(formatDate(new Date("2026-10-01T23:30:00Z"))).toBe("1 oct. 2026");
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [999, "0:00"],
    [65_400, "1:05"],
    [10 * 60_000, "10:00"],
    [3_723_000, "1:02:03"],
  ])("%d ms → %s", (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, `0${NBSP}s`],
    [42_900, `42${NBSP}s`],
    [192_000, `3${NBSP}min 12${NBSP}s`],
    [180_000, `3${NBSP}min`],
    [3_723_000, `1${NBSP}h 2${NBSP}min 3${NBSP}s`],
  ])("%d ms → %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
