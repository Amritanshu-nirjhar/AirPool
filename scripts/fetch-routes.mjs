// Fetches real road geometry from OSRM (OpenStreetMap data) and writes data/routes.json.
// Place coordinates come from Nominatim (OSM) lookups. Run: node scripts/fetch-routes.mjs
import { writeFileSync } from "node:fs";

const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";

// [lng, lat]
export const places = {
  t3: { name: "IGI Airport T3 · Arrivals", short: "DEL T3", coord: [77.085, 28.5553] },
  aerocity: { name: "Aerocity", short: "Aerocity", coord: [77.1298, 28.5534] },
  cyberCity: { name: "DLF Cyber City", short: "Cyber City", coord: [77.0918, 28.4973] },
  dlfPhase3: { name: "DLF Phase 3", short: "DLF Ph 3", coord: [77.0935, 28.4936] },
  sector29: { name: "Sector 29, Gurugram", short: "Sector 29", coord: [77.0671, 28.4669] },
  golfCourse: { name: "Golf Course Road", short: "Golf Course Rd", coord: [77.0991, 28.4498] },
  sector54: { name: "Sector 54, Gurugram", short: "Sector 54", coord: [77.1113, 28.4421] },
  vasantKunj: { name: "Vasant Kunj", short: "Vasant Kunj", coord: [77.1541, 28.5292] },
  dwarka21: { name: "Dwarka Sector 21", short: "Dwarka 21", coord: [77.0586, 28.5519] },
  saket: { name: "Saket", short: "Saket", coord: [77.2096, 28.5235] },
};

// Ordered stops per route. Group routes are synthetic groupings over real roads.
const routes = {
  solo: ["t3", "cyberCity"],
  groupA: ["t3", "aerocity", "cyberCity", "sector29"],
  groupB: ["t3", "dlfPhase3", "cyberCity"],
  groupC: ["t3", "vasantKunj", "cyberCity", "golfCourse", "sector54"],
  // Solo trips in different directions (problem sequence)
  toDwarka: ["t3", "dwarka21"],
  toSaket: ["t3", "saket"],
  toVasantKunj: ["t3", "vasantKunj"],
  toGolfCourse: ["t3", "golfCourse"],
};

const out = { source: "OSRM / OpenStreetMap contributors", fetchedAt: new Date().toISOString(), places, routes: {} };

for (const [key, stops] of Object.entries(routes)) {
  const coords = stops.map((s) => places[s].coord.join(",")).join(";");
  const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
  const json = await res.json();
  if (json.code !== "Ok") throw new Error(`${key}: ${json.code} ${json.message ?? ""}`);
  const r = json.routes[0];
  out.routes[key] = {
    stops,
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    legs: r.legs.map((l) => ({ distanceM: Math.round(l.distance), durationS: Math.round(l.duration) })),
    // 5 decimals ≈ 1 m precision; keeps the file small
    coordinates: r.geometry.coordinates.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]),
  };
  console.log(key, out.routes[key].coordinates.length, "pts", out.routes[key].distanceM, "m");
}

writeFileSync(new URL("../data/routes.json", import.meta.url), JSON.stringify(out));
