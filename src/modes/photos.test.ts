import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import photosData from "@/data/site-photos.json";
import { parsePhotos, withPhotos } from "./photos";
import { GAME_MODES } from "./registry";

/** Sites with no freely licensed photo of the site itself; the game shows a placeholder. */
const WITHOUT_PHOTO = [
  "fr-nuclear-research/cea-fontenay-aux-roses",
  "fr-military-nuclear/cea-valduc",
  "fr-military-nuclear/cea-dam-ile-de-france",
  "fr-military-nuclear/cea-cesta",
  "fr-military-nuclear/cea-gramat",
  "fr-military-nuclear/cea-le-ripault",
  "fr-military-nuclear/pierrelatte",
];

const photos = parsePhotos(photosData);

describe("site photos", () => {
  it("cover every site except the ones without a free photo", async () => {
    const missing: string[] = [];
    for (const mode of GAME_MODES) {
      for (const target of await mode.loadTargets()) {
        if (!target.photo) missing.push(`${mode.id}/${target.id}`);
      }
    }
    expect(missing.sort()).toEqual([...WITHOUT_PHOTO].sort());
  });

  it("only describe existing sites, and every file is in public/", async () => {
    const keys = new Set<string>();
    for (const mode of GAME_MODES) {
      for (const target of await mode.loadTargets()) keys.add(`${mode.id}/${target.id}`);
    }
    for (const [key, photo] of Object.entries(photos)) {
      expect(keys, key).toContain(key);
      expect(existsSync(join("public", photo.src)), photo.src).toBe(true);
    }
  });

  it("carry an author and a free license for attribution", () => {
    for (const photo of Object.values(photos)) {
      expect(photo.author.length).toBeGreaterThan(0);
      expect(photo.license).toMatch(/^(CC BY-SA \d\.\d|CC BY \d\.\d|CC0|Public domain)$/);
      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("attaches photos by mode and site id without touching other fields", () => {
    const target = { id: "chinon", name: "Chinon", coords: [0.17, 47.23] as const };
    const [withPhoto] = withPhotos("fr-nuclear-plants", [target], photos);
    expect(withPhoto).toMatchObject({ id: "chinon", name: "Chinon", photo: { src: "/photos/fr-nuclear-plants/chinon.jpg" } });
    expect(target).not.toHaveProperty("photo");
    expect(withPhotos("fr-military-nuclear", [{ ...target, id: "cea-valduc" }], photos)[0].photo).toBeUndefined();
  });

  it("rejects malformed photo data", () => {
    expect(() => parsePhotos({ "x/y": { src: "/a.jpg" } })).toThrow();
  });
});
