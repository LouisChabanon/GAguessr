import { rectsIntersect, type Rect } from "./viewport";

export interface LabelCandidate {
  /** Anchor (the city dot) in screen px. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Lower ranks are placed first and win conflicts. */
  rank: number;
}

export type LabelSide = "right" | "left" | "above" | "below" | null;

const SIDES = ["right", "left", "above", "below"] as const;
type Side = (typeof SIDES)[number];

export interface LabelLayoutOptions {
  /** Gap between the dot and the text. */
  offset: number;
  /** Half-size of the square kept clear around every dot. */
  dotRadius: number;
}

/** Where the text's top-left corner goes for each side of the dot. */
export function labelOrigin(
  { x, y, width, height }: Pick<LabelCandidate, "x" | "y" | "width" | "height">,
  side: Side,
  offset: number,
): [number, number] {
  switch (side) {
    case "right":
      return [x + offset, y - height / 2];
    case "left":
      return [x - offset - width, y - height / 2];
    case "above":
      return [x - width / 2, y - offset - height];
    case "below":
      return [x - width / 2, y + offset];
  }
}

function labelBox(candidate: LabelCandidate, side: Side, offset: number): Rect {
  const [x0, y0] = labelOrigin(candidate, side, offset);
  return [
    [x0, y0],
    [x0 + candidate.width, y0 + candidate.height],
  ];
}

/**
 * Greedy label placement: by rank, each label goes right of its dot, else
 * left, above or below, else is hidden (the dot stays). Labels never cover another label or dot.
 * Returns the side for each candidate, in input order.
 */
export function layoutLabels(candidates: readonly LabelCandidate[], { offset, dotRadius }: LabelLayoutOptions): LabelSide[] {
  const dots: Rect[] = candidates.map(({ x, y }) => [
    [x - dotRadius, y - dotRadius],
    [x + dotRadius, y + dotRadius],
  ]);
  const order = candidates.map((_, i) => i).sort((a, b) => candidates[a].rank - candidates[b].rank);

  const placed: Rect[] = [];
  const sides: LabelSide[] = candidates.map(() => null);
  for (const i of order) {
    const fits = (box: Rect) =>
      !placed.some((other) => rectsIntersect(box, other)) &&
      !dots.some((dot, j) => j !== i && rectsIntersect(box, dot));
    const side = SIDES.find((s) => fits(labelBox(candidates[i], s, offset))) ?? null;
    if (side) placed.push(labelBox(candidates[i], side, offset));
    sides[i] = side;
  }
  return sides;
}
