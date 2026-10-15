import { describe, expect, it } from "vitest";
import type { FeatureCollection } from "geojson";
import type { FilterSpecification, LayerSpecification } from "maplibre-gl";
import { FRENCH_CITIES } from "@/lib/geo/frenchCities";
import { buildMapStyle, REVEAL_SOURCE, type FranceOverlay } from "./style";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const TILES = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const FRANCE: FranceOverlay = {
  cities: FRENCH_CITIES,
  land: { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [] } },
  departementBorders: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [] } },
  departementLabels: EMPTY,
  regionLabels: EMPTY,
};

const style = (scheme: "light" | "dark" = "light", france: FranceOverlay | null = FRANCE) =>
  buildMapStyle({ scheme, tilesUrl: TILES, glyphsUrl: GLYPHS, hiddenPlaceNames: ["Flamanville", "Chinon"], france });
const worldStyle = () => style("light", null);

const sourceLayer = (layer: LayerSpecification) => ("source-layer" in layer ? layer["source-layer"] : undefined);
const filterOf = (layer: LayerSpecification): FilterSpecification | undefined => ("filter" in layer ? layer.filter : undefined);

describe("buildMapStyle", () => {
  it("reads OpenFreeMap's tiles and fonts, and credits them", () => {
    const s = style();
    expect(s.sources.openmaptiles).toMatchObject({ type: "vector", url: TILES });
    expect(s.glyphs).toBe(GLYPHS);
    expect(s.sources.openmaptiles).toHaveProperty("attribution", expect.stringContaining("OpenStreetMap"));
    expect(s.sources.openmaptiles).toHaveProperty("attribution", expect.stringContaining("OpenFreeMap"));
  });

  it("never draws points of interest, airfields, buildings or house numbers", () => {
    const used = new Set(style().layers.map(sourceLayer));
    for (const leak of ["poi", "aeroway", "aerodrome_label", "building", "housenumber", "mountain_peak", "park"]) {
      expect(used).not.toContain(leak);
    }
    // Industrial and military land would outline the sites themselves.
    const landuse = style().layers.find((l) => l.id === "landuse-urban");
    expect(JSON.stringify(filterOf(landuse!))).not.toMatch(/industrial|military/);
  });

  it("hides towns named after a site, but keeps large cities", () => {
    const places = style().layers.filter((l) => sourceLayer(l) === "place");
    expect(places.map((l) => l.id).sort()).toEqual(["places-local", "places-towns", "places-villages"]);
    for (const layer of places) {
      const filter = JSON.stringify(filterOf(layer));
      expect(filter).toContain('["literal",["Flamanville","Chinon"]]');
      expect(filter).toContain('["==",["get","class"],"city"]');
    }
  });

  it("shows régions, départements, towns, street names and seas", () => {
    const ids = style().layers.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "background", "water", "waterway", "roads", "region-borders", "departement-borders", "departement-borders-overview",
        "country-borders", "street-names", "road-refs", "water-names", "places-towns", "places-villages",
        "region-labels", "departement-labels", "coast-glow", "neighbours-mask", "water-over-mask", "city-dots", "city-labels", "reveal-line",
      ]),
    );
    // The dim sits on the land, under the sea, the national borders and every label.
    expect(ids.indexOf("neighbours-mask")).toBeGreaterThan(ids.indexOf("roads"));
    expect(ids.indexOf("neighbours-mask")).toBeGreaterThan(ids.indexOf("region-borders"));
    expect(ids.indexOf("water-over-mask")).toBe(ids.indexOf("neighbours-mask") + 1);
    expect(ids.indexOf("country-borders")).toBeGreaterThan(ids.indexOf("water-over-mask"));
    expect(ids.indexOf("places-towns")).toBeGreaterThan(ids.indexOf("water-over-mask"));
    expect(ids.at(-1)).toBe("reveal-line");
  });

  it("dims everything outside France, and holds back the neighbours' labels until zoomed in", () => {
    const s = style();
    expect(s.sources.outside).toMatchObject({ type: "geojson", data: { geometry: { type: "Polygon" } } });
    expect(s.layers.find((l) => l.id === "neighbours-mask")).toMatchObject({ source: "outside" });
    for (const id of ["places-towns", "road-refs"]) {
      expect(JSON.stringify(filterOf(s.layers.find((l) => l.id === id)!))).toContain('"within"');
    }
  });

  it("no longer draws our own overview rivers", () => {
    const s = style();
    expect(s.sources).not.toHaveProperty("rivers");
    expect(s.layers.map((l) => l.id)).not.toContain("rivers-overview");
  });

  it("feeds our own cities, France's outline and its outside, admin labels and the reveal line as GeoJSON", () => {
    const s = style();
    for (const source of ["cities", "france", "outside", "departementBorders", "departementLabels", "regionLabels", REVEAL_SOURCE]) {
      expect(s.sources[source]).toMatchObject({ type: "geojson" });
    }
    expect((s.sources.cities as { data: FeatureCollection }).data.features).toHaveLength(FRENCH_CITIES.length);
    expect(s.sources[REVEAL_SOURCE]).toMatchObject({ type: "geojson", data: EMPTY });
  });

  it("has distinct light and dark palettes", () => {
    const water = (scheme: "light" | "dark") => style(scheme).layers.find((l) => l.id === "water");
    expect(JSON.stringify(water("light"))).not.toEqual(JSON.stringify(water("dark")));
  });
});

describe("buildMapStyle without France's overlay (world map)", () => {
  const FRANCE_ONLY_SOURCES = ["france", "outside", "departementBorders", "departementLabels", "regionLabels", "cities"];

  it("draws the whole world evenly: no dim, no French overview data", () => {
    const s = worldStyle();
    for (const source of FRANCE_ONLY_SOURCES) expect(s.sources).not.toHaveProperty(source);
    const ids = s.layers.map((l) => l.id);
    for (const id of ["neighbours-mask", "water-over-mask", "coast-glow", "departement-borders-overview", "region-labels", "departement-labels", "city-labels"]) {
      expect(ids).not.toContain(id);
    }
    // Every layer reads a source the style defines.
    for (const layer of s.layers) {
      if ("source" in layer) expect(s.sources).toHaveProperty(layer.source as string);
    }
  });

  it("names countries on the overview and large cities closer in, and keeps borders and the reveal line", () => {
    const s = worldStyle();
    const ids = s.layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["country-names", "world-cities", "country-borders", "region-borders", "places-towns"]));
    expect(ids.at(-1)).toBe("reveal-line");
    expect(s.layers.find((l) => l.id === "region-borders")).toHaveProperty("minzoom", expect.any(Number));
  });

  it("shows every country's labels, but still hides towns named after a site, in English too", () => {
    for (const layer of worldStyle().layers.filter((l) => sourceLayer(l) === "place" && l.id.startsWith("places-"))) {
      const filter = JSON.stringify(filterOf(layer));
      expect(filter).not.toContain('"within"');
      expect(filter).toContain('["literal",["Flamanville","Chinon"]]');
      expect(filter).toContain('"name:en"');
    }
  });
});

