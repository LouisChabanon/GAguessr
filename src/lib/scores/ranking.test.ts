import { describe, expect, it } from "vitest";
import type { Target } from "@/modes/types";
import { rankSites } from "./ranking";

const target = (id: string, name: string): Target => ({ id, name, coords: [0, 0] });
const stat = (avgScore: number, plays = 10) => ({ plays, avgScore, medianKm: 10, withinShare: 0.5 });

describe("rankSites", () => {
  it("puts the best-known sites first and unplayed ones last, by name", () => {
    const targets = [target("z", "Zèbre"), target("a", "Ain"), target("m", "Mur"), target("c", "Cher")];
    const ranked = rankSites(targets, { m: stat(1000), c: stat(4000), a: stat(4500, 2) });
    expect(ranked.map((s) => s.target.id)).toEqual(["c", "m", "a", "z"]);
    expect(ranked[2].stat).toBeNull(); // too few plays to count
  });
});
