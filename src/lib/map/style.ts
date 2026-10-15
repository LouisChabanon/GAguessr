import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon } from "geojson";
import type { CityFeature } from "@/lib/geo/frenchCities";
import { outsideOf } from "./mask";
import { PALETTES, type MapScheme, type Palette } from "./palette";

export type { MapScheme } from "./palette";

export const REVEAL_SOURCE = "reveal";
const TILE_SOURCE = "openmaptiles";
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

/** Our own overview département borders hand over to OpenStreetMap's here. */
const OSM_DETAIL_ZOOM = 9;
/** Our curated city list labels the overview; OpenStreetMap's places take over from here. */
const OSM_PLACES_ZOOM = 7;
/** Secondary cities get a label only once the map is zoomed in a little. */
const SECONDARY_CITY_ZOOM = 6.4;
/** The dim over neighbouring countries fades out by this zoom (its coarse border would cut French streets). */
const MASK_FADE_ZOOM = 10;
/** Neighbours' town names and road numbers show once their dim starts fading. */
const NEIGHBOUR_LABELS_ZOOM = MASK_FADE_ZOOM - 1.5;
/** The dim covers this box minus France: wider than anything the player can pan to. */
const MASK_BOUNDS: [[number, number], [number, number]] = [[-70, 15], [80, 80]];
/** Our simplified outline is only shaded on the overview; OpenStreetMap's water takes over from here. */
const COAST_FADE_ZOOM = 8;
/** On the world map, state and province borders wait until a continent fills the screen. */
const WORLD_REGION_BORDERS_ZOOM = 2.5;
/** On the world map, country names give way to OpenStreetMap's towns here. */
const WORLD_COUNTRY_NAMES_MAX_ZOOM = 6;
/** On the world map, large cities get a label from here, as landmarks. */
const WORLD_CITIES_ZOOM = 3.5;

const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> Données <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>';

const NAME: ExpressionSpecification = ["coalesce", ["get", "name:fr"], ["get", "name"]];
const CLASS: ExpressionSpecification = ["get", "class"];

/** Line width growing with the zoom, from `[zoom, width]` stops. */
function widthByZoom(...stops: [number, number | ExpressionSpecification][]): ExpressionSpecification {
  return ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as ExpressionSpecification;
}

/** Opacity going from 0 to 1 between two zooms. */
function fadeIn(from: number, to: number): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], from, 0, to, 1];
}

/** Opacity going from 1 to 0 between two zooms. */
function fadeOut(from: number, to: number): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], from, 1, to, 0];
}

/**
 * Background, land cover, water and roads from OpenStreetMap (OpenMapTiles schema).
 * Dropped on purpose: points of interest, industrial and military land, airfields and
 * buildings would all give answers away.
 */
function groundLayers(p: Palette): LayerSpecification[] {
  const roadClasses = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"];
  const roadWidth = (scale: number) =>
    widthByZoom(
      [5, ["match", CLASS, "motorway", 0.8 * scale, 0]],
      [8, ["match", CLASS, "motorway", 1.6 * scale, ["trunk", "primary"], 1 * scale, 0.5 * scale]],
      [12, ["match", CLASS, ["motorway", "trunk"], 3 * scale, ["primary", "secondary"], 2.4 * scale, "tertiary", 1.8 * scale, 1 * scale]],
      [16, ["match", CLASS, ["motorway", "trunk"], 12 * scale, ["primary", "secondary"], 10 * scale, "tertiary", 8 * scale, "service", 3 * scale, 6 * scale]],
      [19, ["match", CLASS, ["motorway", "trunk"], 30 * scale, ["primary", "secondary"], 26 * scale, "service", 10 * scale, 20 * scale]],
    );
  const roadMinZoom: ExpressionSpecification = [
    "step", ["zoom"],
    ["==", CLASS, "motorway"],
    7, ["in", CLASS, ["literal", ["motorway", "trunk", "primary"]]],
    9, ["in", CLASS, ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
    12, ["in", CLASS, ["literal", roadClasses]],
  ];
  const roadRank: ExpressionSpecification = ["match", CLASS, "motorway", 6, "trunk", 5, "primary", 4, "secondary", 3, "tertiary", 2, 1];
  return [
    { id: "background", type: "background", paint: { "background-color": p.land } },
    {
      id: "landcover-wood",
      type: "fill",
      source: TILE_SOURCE,
      "source-layer": "landcover",
      filter: ["==", CLASS, "wood"],
      paint: { "fill-color": p.wood, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 12, 0.7] },
    },
    {
      id: "landuse-urban",
      type: "fill",
      source: TILE_SOURCE,
      "source-layer": "landuse",
      minzoom: 8,
      filter: ["in", CLASS, ["literal", ["residential", "suburb", "neighbourhood", "commercial", "retail"]]],
      paint: { "fill-color": p.urban, "fill-opacity": fadeIn(8, 10) },
    },
    {
      id: "water",
      type: "fill",
      source: TILE_SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": p.water },
    },
    {
      id: "waterway",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "waterway",
      minzoom: OSM_DETAIL_ZOOM - 0.5,
      filter: ["all", ["!=", ["get", "brunnel"], "tunnel"], ["any", ["in", CLASS, ["literal", ["river", "canal"]]], [">=", ["zoom"], 13]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": p.water,
        // Wide rivers are already drawn as water areas up close; the centre line stays thin.
        "line-width": widthByZoom([9, ["match", CLASS, "river", 1, 0.5]], [14, ["match", CLASS, ["river", "canal"], 2, 1]], [18, ["match", CLASS, ["river", "canal"], 3, 2]]),
        "line-opacity": fadeIn(OSM_DETAIL_ZOOM - 0.5, OSM_DETAIL_ZOOM + 0.5),
      },
    },
    {
      id: "rail",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "transportation",
      minzoom: 10,
      filter: ["all", ["==", CLASS, "rail"], ["!=", ["get", "brunnel"], "tunnel"], ["!", ["has", "service"]]],
      paint: { "line-color": p.rail, "line-width": widthByZoom([10, 0.6], [16, 1.6]), "line-dasharray": [3, 2] },
    },
    {
      id: "paths",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["in", CLASS, ["literal", ["path", "track"]]],
      paint: { "line-color": p.roadCasing, "line-width": widthByZoom([14, 0.8], [18, 2]), "line-dasharray": [2, 1.5] },
    },
    {
      id: "roads-casing",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "transportation",
      minzoom: 11,
      filter: ["all", roadMinZoom, ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-join": "round", "line-cap": "round", "line-sort-key": roadRank },
      paint: { "line-color": p.roadCasing, "line-width": roadWidth(1.35) },
    },
    {
      id: "roads",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "transportation",
      minzoom: 5,
      filter: roadMinZoom,
      layout: { "line-join": "round", "line-cap": "round", "line-sort-key": roadRank },
      paint: {
        "line-color": ["match", CLASS, "motorway", p.motorway, ["trunk", "primary", "secondary"], p.roadMajor, p.road],
        "line-width": roadWidth(1),
        "line-opacity": ["case", ["==", ["get", "brunnel"], "tunnel"], 0.5, 1],
      },
    },
  ];
}

/** A faint shaded band along France's shores and borders, lifting it off the overview. */
function coastLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: "coast-glow",
      type: "line",
      source: "france",
      maxzoom: COAST_FADE_ZOOM,
      layout: { "line-join": "round" },
      paint: {
        "line-color": p.coastGlow,
        "line-width": widthByZoom([4, 6], [8, 16]),
        "line-blur": widthByZoom([4, 6], [8, 16]),
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.16, COAST_FADE_ZOOM - 1, 0.1, COAST_FADE_ZOOM, 0],
      },
    },
  ];
}

const osmBoundary = (level: number): ExpressionSpecification => [
  "all",
  ["==", ["get", "admin_level"], level],
  ["==", ["get", "maritime"], 0],
];

/** Our own département borders for the overview of France, handing over to OpenStreetMap's. */
function departementOverviewLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: "departement-borders-overview",
      type: "line",
      source: "departementBorders",
      minzoom: 5.5,
      maxzoom: OSM_DETAIL_ZOOM + 0.5,
      layout: { "line-join": "round" },
      paint: {
        "line-color": p.departementBorder,
        "line-width": 0.7,
        "line-dasharray": [3, 2],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5.5, 0, 6.5, 1, OSM_DETAIL_ZOOM, 1, OSM_DETAIL_ZOOM + 0.5, 0],
      },
    },
  ];
}

/** Département (admin level 6) and region (level 4) borders from OpenStreetMap. Drawn under the dim. */
function adminBorderLayers(p: Palette, regionMinZoom: number): LayerSpecification[] {
  return [
    {
      id: "departement-borders",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "boundary",
      minzoom: OSM_DETAIL_ZOOM,
      filter: osmBoundary(6),
      layout: { "line-join": "round" },
      paint: {
        "line-color": p.departementBorder,
        "line-width": widthByZoom([9, 0.7], [14, 1.6]),
        "line-dasharray": [3, 2],
        "line-opacity": fadeIn(OSM_DETAIL_ZOOM, OSM_DETAIL_ZOOM + 0.5),
      },
    },
    {
      id: "region-borders",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "boundary",
      minzoom: regionMinZoom,
      filter: osmBoundary(4),
      layout: { "line-join": "round" },
      paint: { "line-color": p.regionBorder, "line-width": widthByZoom([4, 0.8], [10, 1.6], [16, 3]) },
    },
  ];
}

/**
 * Dims everything outside France, then puts OpenStreetMap's water back on top: the dim's
 * edge then only matters along land borders, and every coastline is OpenStreetMap's own.
 */
function maskLayers(p: Palette): LayerSpecification[] {
  const fade = fadeOut(MASK_FADE_ZOOM - 1.5, MASK_FADE_ZOOM);
  return [
    {
      id: "neighbours-mask",
      type: "fill",
      source: "outside",
      maxzoom: MASK_FADE_ZOOM,
      paint: { "fill-color": p.mask, "fill-opacity": fade },
    },
    {
      id: "water-over-mask",
      type: "fill",
      source: TILE_SOURCE,
      "source-layer": "water",
      maxzoom: MASK_FADE_ZOOM,
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": p.water, "fill-opacity": fade },
    },
  ];
}

/** National borders, drawn over the dim so neighbours stay outlined. */
function countryBorderLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: "country-borders",
      type: "line",
      source: TILE_SOURCE,
      "source-layer": "boundary",
      filter: osmBoundary(2),
      layout: { "line-join": "round" },
      paint: { "line-color": p.countryBorder, "line-width": widthByZoom([4, 1.1], [10, 2], [16, 4]) },
    },
  ];
}

const HALO = (p: Palette) => ({ "text-halo-color": p.labelHalo, "text-halo-width": 1.4 });

/**
 * Street, water and place names from OpenStreetMap, minus the towns that share a site's name.
 * With France's outline, the neighbours' names are held back until their dim fades.
 */
function osmLabelLayers(p: Palette, hiddenPlaceNames: readonly string[], land: Feature<MultiPolygon> | null): LayerSpecification[] {
  const hidden = ["literal", [...hiddenPlaceNames]] as ExpressionSpecification;
  const inFranceUntilZoomedIn: ExpressionSpecification | boolean = land
    ? ["any", [">=", ["zoom"], NEIGHBOUR_LABELS_ZOOM], ["within", land]]
    : true;
  const notSpoiler: ExpressionSpecification = [
    "any",
    // Large cities stay: everyone knows where they are, and the map needs its landmarks.
    ["==", CLASS, "city"],
    // Site names are French or English; the tiles' `name` is in the local script.
    ["!", ["any", ["in", ["get", "name"], hidden], ["in", NAME, hidden], ["in", ["coalesce", ["get", "name:en"], ""], hidden]]],
  ];
  const place = (id: string, classes: string[], minzoom: number, size: ExpressionSpecification | number, font = FONT): LayerSpecification => ({
    id,
    type: "symbol",
    source: TILE_SOURCE,
    "source-layer": "place",
    minzoom,
    filter: ["all", ["in", CLASS, ["literal", classes]], notSpoiler, inFranceUntilZoomedIn],
    layout: {
      "text-field": NAME,
      "text-font": font,
      "text-size": size,
      "text-max-width": 8,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
    },
    paint: { "text-color": p.label, ...HALO(p) },
  });
  return [
    {
      id: "water-names",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "water_name",
      filter: ["any", ["in", CLASS, ["literal", ["sea", "ocean", "bay", "strait"]]], [">=", ["zoom"], 11]],
      layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": 12, "text-max-width": 6, "text-letter-spacing": 0.08 },
      paint: { "text-color": p.waterLabel, ...HALO(p) },
    },
    {
      id: "waterway-names",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "waterway",
      minzoom: 11,
      filter: ["in", CLASS, ["literal", ["river", "canal"]]],
      layout: { "text-field": NAME, "text-font": FONT_ITALIC, "text-size": 11.5, "symbol-placement": "line", "symbol-spacing": 400 },
      paint: { "text-color": p.waterLabel, ...HALO(p) },
    },
    {
      id: "road-refs",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "transportation_name",
      minzoom: 8,
      filter: ["all", ["in", CLASS, ["literal", ["motorway", "trunk"]]], ["has", "ref"], ["<=", ["length", ["get", "ref"]], 6], inFranceUntilZoomedIn],
      layout: { "text-field": ["get", "ref"], "text-font": FONT_BOLD, "text-size": 10, "symbol-placement": "line", "symbol-spacing": 500, "text-rotation-alignment": "viewport" },
      paint: { "text-color": p.labelMuted, ...HALO(p) },
    },
    {
      id: "street-names",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "transportation_name",
      minzoom: 12,
      filter: [
        "step", ["zoom"],
        ["in", CLASS, ["literal", ["primary", "secondary", "tertiary"]]],
        14, ["in", CLASS, ["literal", ["primary", "secondary", "tertiary", "minor", "service"]]],
        16, ["in", CLASS, ["literal", ["primary", "secondary", "tertiary", "minor", "service", "path", "track"]]],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 17, 13],
        "symbol-placement": "line",
        "text-max-angle": 30,
      },
      paint: { "text-color": p.label, ...HALO(p) },
    },
    place("places-local", ["suburb", "quarter", "neighbourhood", "hamlet", "isolated_dwelling", "locality"], 12.5, 10.5),
    place("places-villages", ["village"], 10, ["interpolate", ["linear"], ["zoom"], 10, 10.5, 14, 13]),
    place("places-towns", ["city", "town"], OSM_PLACES_ZOOM, ["interpolate", ["linear"], ["zoom"], 7, ["match", CLASS, "city", 13, 11], 12, ["match", CLASS, "city", 17, 14]], FONT_BOLD),
  ];
}

/** Country names on the world overview, then large cities as landmarks, until OpenStreetMap's towns take over. */
function worldLabelLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: "country-names",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "place",
      maxzoom: WORLD_COUNTRY_NAMES_MAX_ZOOM,
      filter: ["==", CLASS, "country"],
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 13],
        "text-max-width": 7,
        "text-letter-spacing": 0.06,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": p.adminLabel, ...HALO(p) },
    },
    {
      id: "world-cities",
      type: "symbol",
      source: TILE_SOURCE,
      "source-layer": "place",
      minzoom: WORLD_CITIES_ZOOM,
      maxzoom: OSM_PLACES_ZOOM,
      filter: ["==", CLASS, "city"],
      layout: {
        "text-field": NAME,
        "text-font": FONT,
        "text-size": 11,
        "text-max-width": 8,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": p.label, ...HALO(p) },
    },
  ];
}

/** Région and département names, and our curated major cities for the overview. */
function franceLabelLayers(p: Palette): LayerSpecification[] {
  return [
    {
      id: "departement-labels",
      type: "symbol",
      source: "departementLabels",
      minzoom: 6.5,
      maxzoom: 11,
      layout: {
        "text-field": ["format", ["get", "name"], {}, "\n", {}, ["get", "code"], { "font-scale": 0.85 }],
        "text-font": FONT,
        "text-size": 10.5,
        "text-max-width": 7,
        "text-letter-spacing": 0.04,
      },
      paint: { "text-color": p.adminLabel, ...HALO(p), "text-opacity": fadeIn(6.5, 7) },
    },
    {
      id: "region-labels",
      type: "symbol",
      source: "regionLabels",
      minzoom: 4,
      maxzoom: 7,
      layout: {
        "text-field": ["upcase", ["get", "name"]],
        "text-font": FONT_BOLD,
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9.5, 7, 12],
        "text-max-width": 7,
        "text-letter-spacing": 0.12,
      },
      paint: { "text-color": p.adminLabel, ...HALO(p) },
    },
    {
      id: "city-dots",
      type: "circle",
      source: "cities",
      maxzoom: OSM_PLACES_ZOOM,
      filter: ["any", ["==", ["get", "rank"], 1], [">=", ["zoom"], SECONDARY_CITY_ZOOM]],
      paint: { "circle-radius": 2.5, "circle-color": p.cityDot },
    },
    {
      id: "city-labels",
      type: "symbol",
      source: "cities",
      maxzoom: OSM_PLACES_ZOOM,
      filter: ["any", ["==", ["get", "rank"], 1], [">=", ["zoom"], SECONDARY_CITY_ZOOM]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONT_BOLD,
        "text-size": 11,
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 0.5,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": p.label, ...HALO(p) },
    },
  ];
}

/** France's own overview data, drawn over OpenStreetMap's on the France map. */
export interface FranceOverlay {
  land: Feature<MultiPolygon>;
  cities: readonly CityFeature[];
  departementBorders: Feature<MultiLineString>;
  departementLabels: FeatureCollection;
  regionLabels: FeatureCollection;
}

export interface MapStyleOptions {
  scheme: MapScheme;
  /** TileJSON URL of an OpenMapTiles-schema vector tileset, e.g. OpenFreeMap's planet. */
  tilesUrl: string;
  glyphsUrl: string;
  hiddenPlaceNames: readonly string[];
  /** Spotlights France with its own overview layers; `null` draws the whole world evenly. */
  france: FranceOverlay | null;
}

function franceSources(france: FranceOverlay): StyleSpecification["sources"] {
  return {
    france: { type: "geojson", data: france.land },
    outside: { type: "geojson", data: outsideOf(france.land, MASK_BOUNDS) },
    departementBorders: { type: "geojson", data: france.departementBorders },
    departementLabels: { type: "geojson", data: france.departementLabels },
    regionLabels: { type: "geojson", data: france.regionLabels },
    cities: { type: "geojson", data: { type: "FeatureCollection", features: [...france.cities] } },
  };
}

export function buildMapStyle({ scheme, tilesUrl, glyphsUrl, hiddenPlaceNames, france }: MapStyleOptions): StyleSpecification {
  const p = PALETTES[scheme];
  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {
      [TILE_SOURCE]: { type: "vector", url: tilesUrl, attribution: ATTRIBUTION },
      ...(france ? franceSources(france) : {}),
      [REVEAL_SOURCE]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      ...groundLayers(p),
      ...(france ? departementOverviewLayers(p) : []),
      ...adminBorderLayers(p, france ? 0 : WORLD_REGION_BORDERS_ZOOM),
      ...(france ? [...maskLayers(p), ...coastLayers(p)] : []),
      ...countryBorderLayers(p),
      ...osmLabelLayers(p, hiddenPlaceNames, france?.land ?? null),
      ...(france ? franceLabelLayers(p) : worldLabelLayers(p)),
      {
        id: "reveal-line",
        type: "line",
        source: REVEAL_SOURCE,
        layout: { "line-cap": "round" },
        paint: { "line-color": p.revealLine, "line-width": 1.5, "line-dasharray": [1, 2.5] },
      },
    ],
  };
}
