import { z } from "zod";
import { slugify } from "./slug";
import type { Target } from "./types";

export const siteSchema = z.object({
  name: z.string().min(1),
  /** One of the 13 metropolitan regions, as named in public/geo/france.json. */
  region: z.string().min(1),
  department: z.string().min(1),
  /** What the site does, revealed with the answer. */
  role: z.string().min(1),
  /** One sentence revealed with the answer, only when there is something worth saying. */
  description: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type Site = z.infer<typeof siteSchema>;

export function buildSiteTargets(input: unknown): Target[] {
  return z
    .array(siteSchema)
    .parse(input)
    .map((site) => ({
      id: slugify(site.name),
      name: site.name,
      // No hint: the player has to know the site. Context comes with the answer.
      detail: `${site.role} · ${site.department}`,
      description: site.description,
      coords: [site.lon, site.lat],
    }));
}
