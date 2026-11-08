import routesData from "../data/routes.json" with { type: "json" };
import type { CorridorId, LngLat, PlaceId, RouteKey } from "./types.ts";

export const PLACES = routesData.places as Record<PlaceId, { name: string; short: string; coord: LngLat }>;
export const ROUTES = routesData.routes as unknown as Record<
  RouteKey,
  { stops: PlaceId[]; distanceM: number; durationS: number; legs: { distanceM: number; durationS: number }[]; coordinates: LngLat[] }
>;
export const ROUTE_SOURCE = routesData.source;

export const CORRIDOR: Record<PlaceId, CorridorId | null> = {
  t3: null,
  aerocity: "nh48-gurugram",
  cyberCity: "nh48-gurugram",
  dlfPhase3: "nh48-gurugram",
  sector29: "nh48-gurugram",
  golfCourse: "nh48-gurugram",
  sector54: "nh48-gurugram",
  dwarka21: "dwarka",
  vasantKunj: "south-delhi",
  saket: "south-delhi",
};

export const CORRIDOR_LABEL: Record<CorridorId, string> = {
  "nh48-gurugram": "NH-48 → Gurugram",
  dwarka: "Dwarka",
  "south-delhi": "South Delhi",
};

/** Great-circle distance in km. */
export function haversineKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Cumulative distance (km) at each vertex of a line. */
export function cumulative(line: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversineKm(line[i - 1], line[i]));
  return out;
}

/** Point and bearing at fraction t (0..1) along a line. */
export function along(line: LngLat[], cum: number[], t: number): { point: LngLat; bearing: number; index: number } {
  const target = Math.min(Math.max(t, 0), 1) * cum[cum.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (target - cum[i - 1]) / seg;
  const [a, b] = [line[i - 1], line[i]];
  const point: LngLat = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
  return { point, bearing, index: i };
}

/** Line truncated at fraction t — used for the route-drawing animation. */
export function slice(line: LngLat[], cum: number[], t: number): LngLat[] {
  if (t >= 1) return line;
  const { point, index } = along(line, cum, t);
  return [...line.slice(0, index), point];
}

export function bounds(line: LngLat[]): [LngLat, LngLat] {
  const xs = line.map((p) => p[0]);
  const ys = line.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

export const fmtTime = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
export const parseTime = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
