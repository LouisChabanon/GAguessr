/** world-atlas abbreviates some names; map them to their usual English form. */
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "Antigua and Barb.": "Antigua and Barbuda",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Central African Rep.": "Central African Republic",
  Congo: "Republic of the Congo",
  "Dem. Rep. Congo": "DR Congo",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  eSwatini: "Eswatini",
  Macedonia: "North Macedonia",
  "S. Sudan": "South Sudan",
  "São Tomé and Principe": "São Tomé and Príncipe",
  "Solomon Is.": "Solomon Islands",
  "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "United States of America": "United States",
};

export function countryDisplayName(atlasName: string): string {
  return DISPLAY_NAMES[atlasName] ?? atlasName;
}
