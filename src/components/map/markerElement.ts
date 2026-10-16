export type MarkerKind = "guess" | "opponent" | "answer" | "past";

/** Teardrop whose tip sits at the bottom centre of a 20×28 box. */
const pinSvg = (fill: string, ink: string) => `<svg width="20" height="28" viewBox="-10 -27 20 28" aria-hidden="true">
  <path d="M0 0C-1.6-5.2-9-9.4-9-16.2a9 9 0 1 1 18 0C9-9.4 1.6-5.2 0 0Z" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>
  <circle cy="-16.2" r="3.4" fill="${ink}"/>
</svg>`;

const PIN_SVG = {
  guess: pinSvg("var(--accent)", "var(--accent-ink)"),
  opponent: pinSvg("var(--opponent)", "var(--panel-solid)"),
} as const;

const DOT_SVG = {
  answer: `<svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden="true">
  <circle r="10" fill="var(--answer)" fill-opacity="0.18"/>
  <circle r="5.5" fill="var(--answer)" stroke="var(--panel-solid)" stroke-width="2"/>
</svg>`,
  past: `<svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">
  <circle r="4" fill="var(--answer)" fill-opacity="0.55" stroke="var(--panel-solid)" stroke-width="1.5"/>
</svg>`,
} as const;

/** DOM element for a MapLibre marker. Static markup only: no user data goes into innerHTML. */
export function createMarkerElement(kind: MarkerKind, title?: string): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "map-marker";
  outer.dataset.kind = kind;
  outer.setAttribute("data-testid", `marker-${kind}`);
  if (title) outer.title = title; // set as text, never parsed as HTML
  const body = document.createElement("div");
  body.className = "map-marker-body";
  body.innerHTML = kind === "guess" || kind === "opponent" ? PIN_SVG[kind] : DOT_SVG[kind];
  outer.append(body);
  return outer;
}
