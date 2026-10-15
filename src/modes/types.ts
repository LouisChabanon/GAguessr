import type { LonLat } from "@/lib/geo/distance";
import type { MapArea } from "@/lib/map/bounds";

/** A freely licensed photo of the site, with the attribution its license requires. */
export interface TargetPhoto {
  src: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string | null;
  /** Wikimedia Commons page of the original file. */
  sourceUrl: string;
}

export interface Target {
  id: string;
  name: string;
  /** Short context shown under the name while guessing (country, river…). */
  hint?: string;
  /** Extra fact revealed with the answer. */
  detail?: string;
  /** One-sentence description of the site, revealed with the answer. */
  description?: string;
  coords: LonLat;
  /** Missing when no free photo of the site exists (most military sites). */
  photo?: TargetPhoto;
}

export interface GameModeMeta {
  id: string;
  title: string;
  description: string;
  /** Distance (km) at which a guess keeps ~37% of the points. */
  scaleKm: number;
  /** A fixed number of rounds, or "all" to play every target once. */
  roundsPerGame: number | "all";
  /** The map the targets are placed on. */
  map: MapArea;
  /** Whether targets come with photos; without, the banner shows no photo slot. */
  hasPhotos: boolean;
}

export interface GameMode extends GameModeMeta {
  loadTargets(): Promise<readonly Target[]>;
}
