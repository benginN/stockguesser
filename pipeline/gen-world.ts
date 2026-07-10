/**
 * One-off (re-runnable) generator: Natural Earth 110m land + country borders
 * → equirectangular SVG path strings in public/data/world-paths.json.
 * Keeps the runtime dependency budget untouched — the app just renders two
 * <path> elements (ROADMAP §3 dependency budget; §1.4 map mode).
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-110m.json") as Topology<{
  countries: GeometryCollection;
  land: GeometryCollection;
}>;

export const MAP_W = 800;
export const MAP_H = 400;

/** equirectangular: lon/lat → SVG coords (same math the app uses) */
const px = (lon: number, lat: number): [number, number] => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H,
];

function ringToPath(ring: number[][]): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = px(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

function geometryToPath(geom: Geometry): string {
  if (geom.type === "Polygon") return (geom as Polygon).coordinates.map(ringToPath).join("");
  if (geom.type === "MultiPolygon")
    return (geom as MultiPolygon).coordinates.map((poly) => poly.map(ringToPath).join("")).join("");
  return "";
}

const land = feature(world, world.objects.land) as unknown as FeatureCollection;
const landPath = land.features.map((f) => geometryToPath(f.geometry)).join("");

// interior borders only (a-b mesh where a !== b)
const borders = mesh(world, world.objects.countries, (a, b) => a !== b);
const borderPath = borders.coordinates
  .map((line) =>
    line
      .map(([lon, lat], i) => {
        const [x, y] = px(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(""),
  )
  .join("");

writeFileSync(
  new URL("../public/data/world-paths.json", import.meta.url),
  JSON.stringify({ w: MAP_W, h: MAP_H, land: landPath, borders: borderPath }),
);
console.log(
  `world-paths.json: land ${(landPath.length / 1024).toFixed(0)}KB, borders ${(borderPath.length / 1024).toFixed(0)}KB`,
);
