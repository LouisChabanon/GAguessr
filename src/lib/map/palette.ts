export type MapScheme = "light" | "dark";

export interface Palette {
  /** Land: OpenMapTiles has no land layer, so the background is the land. */
  land: string;
  water: string;
  /** Shaded band along France's shores and borders on the overview. */
  coastGlow: string;
  wood: string;
  urban: string;
  roadCasing: string;
  road: string;
  roadMajor: string;
  motorway: string;
  rail: string;
  countryBorder: string;
  regionBorder: string;
  departementBorder: string;
  mask: string;
  cityDot: string;
  label: string;
  labelMuted: string;
  labelHalo: string;
  adminLabel: string;
  waterLabel: string;
  revealLine: string;
  /** Other players' guesses: the heatmap fades in from transparent to this hue, peaking at `crowdPeak`. */
  crowd: string;
  crowdPeak: string;
}

// MapLibre does not parse oklch(); `water` matches --map-ocean in globals.css.
export const PALETTES: Readonly<Record<MapScheme, Palette>> = {
  light: {
    // Warm atlas paper on a calm sea; neighbours fall back to a cool grey.
    land: "#f4f1ea",
    water: "#c3d6e6",
    coastGlow: "#5f86aa",
    wood: "#dde6cf",
    urban: "#ebe5da",
    roadCasing: "#dcd5c7",
    road: "#ffffff",
    roadMajor: "#ffffff",
    motorway: "#f1cf85",
    rail: "#bcb5a7",
    countryBorder: "#ada696",
    regionBorder: "#aaa290",
    departementBorder: "#cbc4b4",
    mask: "#e3e4e2",
    cityDot: "#1d2230",
    label: "#2f3442",
    labelMuted: "#6b6f7a",
    labelHalo: "#f7f5ef",
    adminLabel: "#8c8473",
    waterLabel: "#4c7396",
    revealLine: "#1d2230",
    crowd: "#5546c9",
    crowdPeak: "#2b1d8f",
  },
  dark: {
    // Slate land lifted off an inky sea.
    land: "#323844",
    water: "#121925",
    coastGlow: "#000000",
    wood: "#303d37",
    urban: "#3a404d",
    roadCasing: "#262b35",
    road: "#4a505e",
    roadMajor: "#5a6171",
    motorway: "#8a7442",
    rail: "#5d6470",
    countryBorder: "#626b7b",
    regionBorder: "#6e7787",
    departementBorder: "#4b5361",
    mask: "#22272f",
    cityDot: "#f1f3f6",
    label: "#d5dae2",
    labelMuted: "#9aa1ac",
    labelHalo: "#1c2029",
    adminLabel: "#9ea6b3",
    waterLabel: "#7ea6cc",
    revealLine: "#f1f3f6",
    crowd: "#9d8cff",
    crowdPeak: "#e3dcff",
  },
};
