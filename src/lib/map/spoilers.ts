/** Splits a name into words, keeping the separators (space, apostrophe, hyphen) between them. */
const SEPARATOR = /([\s'’-]+)/;
/** Shorter runs ("de", "du", "Le") never name a place on their own. */
const MIN_LENGTH = 3;

/**
 * Every run of consecutive words in the site names: "Saint-Alban-du-Rhône" yields
 * "Saint-Alban-du-Rhône", "Saint-Alban", "Alban-du-Rhône", "Rhône"…, and
 * "Base aérienne d'Istres" yields "Istres". A town label matching one of these would
 * point straight at the answer, so the map hides it (exact match, so cheap to test).
 */
export function spoilerPlaceNames(siteNames: readonly string[]): string[] {
  const names = new Set<string>();
  for (const siteName of siteNames) {
    const parts = siteName.trim().split(SEPARATOR);
    // Words sit at even indexes, separators at odd ones.
    for (let start = 0; start < parts.length; start += 2) {
      for (let end = start; end < parts.length; end += 2) {
        const run = parts.slice(start, end + 1).join("");
        if (run.length >= MIN_LENGTH) names.add(run);
      }
    }
  }
  return [...names].sort();
}
