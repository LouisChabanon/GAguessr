import type { CountryFeature } from "@/lib/geo/atlas";
import type { LonLat } from "@/lib/geo/distance";
import type { RegionId } from "@/lib/geo/regions";

interface TargetBase {
  id: string;
  name: string;
  /** Short context shown under the name while guessing (country, river…). */
  hint?: string;
  /** Extra fact revealed with the answer. */
  detail?: string;
}

export interface PointTarget extends TargetBase {
  kind: "point";
  coords: LonLat;
}

export interface AreaTarget extends TargetBase {
  kind: "area";
  feature: CountryFeature;
}

export type Target = PointTarget | AreaTarget;

export interface GameModeMeta {
  id: string;
  title: string;
  description: string;
  region: RegionId;
  /** Distance (km) at which a guess keeps ~37% of the points. */
  scaleKm: number;
  /** A fixed number of rounds, or "all" to play every target once. */
  roundsPerGame: number | "all";
}

export interface GameMode extends GameModeMeta {
  loadTargets(): Promise<readonly Target[]>;
}
