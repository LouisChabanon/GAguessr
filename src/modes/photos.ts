import { z } from "zod";
import type { Target, TargetPhoto } from "./types";

const photoSchema = z.object({
  src: z.string().startsWith("/photos/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  author: z.string().min(1),
  license: z.string().min(1),
  licenseUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
});

/** Photos keyed by `<modeId>/<siteId>`, as written by scripts/fetch-site-photos.mjs. */
export type PhotoIndex = Readonly<Record<string, TargetPhoto>>;

export function parsePhotos(input: unknown): PhotoIndex {
  // `.loose()` keeps the import script's bookkeeping fields (commonsFile) out of the type, not out of the data.
  return z.record(z.string(), photoSchema.loose()).parse(input);
}

export function withPhotos(modeId: string, targets: readonly Target[], photos: PhotoIndex): Target[] {
  return targets.map((target) => {
    const photo = photos[`${modeId}/${target.id}`];
    return photo ? { ...target, photo } : target;
  });
}

/** Loads the photo index once; it is shared by every mode. */
export async function loadPhotos(): Promise<PhotoIndex> {
  return parsePhotos((await import("@/data/site-photos.json")).default);
}
