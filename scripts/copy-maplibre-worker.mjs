/**
 * Copies MapLibre's web worker next to the app, so the browser can load it from
 * a stable URL (bundlers do not resolve the URL MapLibre computes for its worker).
 * Runs on postinstall/predev/prebuild, so it always matches the installed version.
 */
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
