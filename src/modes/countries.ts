import { geoArea } from "d3-geo";
import { loadCountries, type CountryFeature } from "@/lib/geo/atlas";
import { EARTH_RADIUS_KM } from "@/lib/geo/distance";
import { countryDisplayName } from "./country-names";
import { slugify } from "./slug";
import type { AreaTarget, GameMode } from "./types";

/** Below this, a country is a speck at world scale and frustrating to find. */
const MIN_AREA_KM2 = 250;

/** Dependent territories, disputed zones and non-country areas. */
const EXCLUDED = new Set([
  "Antarctica",
  "Cayman Is.",
  "Curaçao",
  "Falkland Is.",
  "Faeroe Is.",
  "Fr. Polynesia",
  "Fr. S. Antarctic Lands",
  "Guam",
  "Heard I. and McDonald Is.",
  "Hong Kong",
  "Isle of Man",
  "N. Cyprus",
  "N. Mariana Is.",
  "New Caledonia",
  "Puerto Rico",
  "S. Geo. and the Is.",
  "Siachen Glacier",
  "Somaliland",
  "Turks and Caicos Is.",
  "U.S. Virgin Is.",
  "W. Sahara",
  "Åland",
]);

export function areaKm2(feature: CountryFeature): number {
  return geoArea(feature) * EARTH_RADIUS_KM ** 2;
}

export function buildCountryTargets(countries: readonly CountryFeature[]): AreaTarget[] {
  return countries
    .filter((c) => !EXCLUDED.has(c.properties.name) && areaKm2(c) >= MIN_AREA_KM2)
    .map((feature) => ({
      kind: "area",
      id: slugify(feature.properties.name),
      name: countryDisplayName(feature.properties.name),
      feature,
    }));
}

export const countriesMode: GameMode = {
  id: "countries",
  title: "Countries",
  description: "Find every country on a blank world map. Clicking inside the borders scores full points.",
  region: "world",
  scaleKm: 2000,
  roundsPerGame: 10,
  loadTargets: async () => buildCountryTargets(await loadCountries()),
};
