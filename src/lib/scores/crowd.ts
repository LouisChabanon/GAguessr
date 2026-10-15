import { z } from "zod";
import type { CrowdData } from "./types";

const lonLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const crowdSchema = z.object({
  withinKm: z.number().nonnegative(),
  stats: z.record(
    z.string(),
    z.object({ plays: z.number().int().nonnegative(), avgScore: z.number(), medianKm: z.number(), withinShare: z.number().min(0).max(1) }),
  ),
  guesses: z.record(z.string(), z.array(lonLat)),
});

/** Validates the /api/crowd response; returns null for anything unexpected. */
export function parseCrowdData(input: unknown): CrowdData | null {
  const parsed = crowdSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Fewer plays than this and a site's crowd figures are noise; they are not shown. */
export const MIN_PLAYS_FOR_STATS = 5;
