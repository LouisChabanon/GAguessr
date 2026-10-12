import { describe, expect, it } from "vitest";
import { labelOrigin, layoutLabels, type LabelCandidate } from "./labelLayout";

const OPTIONS = { offset: 5, dotRadius: 3 };
const label = (x: number, y: number, rank = 1, width = 50): LabelCandidate => ({ x, y, width, height: 12, rank });

describe("layoutLabels", () => {
  it("puts isolated labels on the right", () => {
    expect(layoutLabels([label(0, 0), label(0, 100)], OPTIONS)).toEqual(["right", "right"]);
  });

  it("flips a label left when the right side is taken", () => {
    // B's right-hand label would cover C's dot.
    expect(layoutLabels([label(0, 0), label(200, 0), label(230, 0, 2)], OPTIONS)).toEqual(["right", "left", "right"]);
  });

  it("falls back above, then below, when both sides are taken", () => {
    // Clermont-Ferrand between Limoges and Lyon.
    const sides = layoutLabels([label(100, 0, 2, 100), label(160, 0, 1), label(-20, 0, 1)], OPTIONS);
    expect(sides).toEqual(["above", "right", "right"]);
    const crowded = layoutLabels(
      [label(100, 0, 2, 100), label(160, 0, 1), label(-20, 0, 1), label(100, -20, 1)],
      OPTIONS,
    );
    expect(crowded[0]).toBe("below");
  });

  it("hides the lower-ranked label when nothing fits", () => {
    const sides = layoutLabels(
      [label(100, 0, 2, 100), label(160, 0, 1), label(-20, 0, 1), label(100, -20, 1), label(100, 20, 1)],
      OPTIONS,
    );
    expect(sides[0]).toBeNull();
  });

  it("computes the text origin for each side", () => {
    const c = { x: 100, y: 50, width: 40, height: 10 };
    expect(labelOrigin(c, "right", 5)).toEqual([105, 45]);
    expect(labelOrigin(c, "left", 5)).toEqual([55, 45]);
    expect(labelOrigin(c, "above", 5)).toEqual([80, 35]);
    expect(labelOrigin(c, "below", 5)).toEqual([80, 55]);
  });

  it("never covers another city's dot", () => {
    const sides = layoutLabels([label(0, 0, 1), label(20, 0, 1)], OPTIONS);
    expect(sides[0]).toBe("left");
    expect(sides[1]).toBe("right");
  });

  it("returns an empty layout for no labels", () => {
    expect(layoutLabels([], OPTIONS)).toEqual([]);
  });
});
