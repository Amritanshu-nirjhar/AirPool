// SYNTHETIC DEMO DATA. Names, times, fares and detours are simulated for the prototype.
// Only place coordinates and road geometry (data/routes.json) are real.
import type { Group, PlaceId, TripRequest, Weights } from "./types.ts";

export const DEMO_LABEL = "Simulated demo data";
export const SOLO_BASE_FARE = 450; // illustrative figure from the pitch material
export const TERMS_VERSION = "demo-2026-11";
export const DEFAULT_WEIGHTS: Weights = { route: 0.4, wait: 0.2, detour: 0.3, fairness: 0.1 };

const m = (name: string, destination: PlaceId, bags: number, detourMin: number, maxDetour: number, consent = true) => ({
  name, destination, bags, detourMin, maxDetour, verified: true, consent,
});
const nh48 = { cyberCity: 0, sector29: 0, golfCourse: 0 } as const;

export const OPEN_GROUPS: Group[] = [
  {
    id: "A",
    members: [m("Shourya", "aerocity", 1, 0, 10), m("Hasrat", "sector29", 1, 4, 12)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 4, T3 arrivals",
    departure: 18 * 60 + 25,
    routeKey: "groupA",
    dropOrder: ["aerocity", "cyberCity", "sector29"],
    baseFare: 450,
    serviceFee: 0,
    routeSimilarity: 0.92,
    joinerDetour: { ...nh48, cyberCity: 6, sector29: 7, golfCourse: 9 },
    joinerImpactMin: 2,
    status: "open",
  },
  {
    id: "B",
    members: [m("Kabir", "dlfPhase3", 2, 0, 8)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 6, T3 arrivals",
    departure: 18 * 60 + 40,
    routeKey: "groupB",
    dropOrder: ["dlfPhase3", "cyberCity"],
    baseFare: 420,
    serviceFee: 0,
    routeSimilarity: 0.97,
    joinerDetour: { ...nh48, cyberCity: 3, sector29: 6, golfCourse: 8 },
    joinerImpactMin: 1,
    status: "open",
  },
  {
    id: "C",
    members: [m("Meera", "vasantKunj", 1, 0, 15), m("Arjun", "golfCourse", 1, 5, 15), m("Sana", "sector54", 1, 8, 15)],
    vehicle: { type: "SUV", seats: 6, bagCapacity: 6 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 2, T3 arrivals",
    departure: 18 * 60 + 20,
    routeKey: "groupC",
    dropOrder: ["vasantKunj", "cyberCity", "golfCourse", "sector54"],
    baseFare: 480,
    serviceFee: 0,
    routeSimilarity: 0.71,
    joinerDetour: { ...nh48, cyberCity: 11, sector29: 14, golfCourse: 9 },
    joinerImpactMin: 3,
    status: "open",
  },
  {
    id: "D",
    members: [m("Dev", "cyberCity", 1, 0, 10), m("Nisha", "sector29", 1, 3, 10, false)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 4, T3 arrivals",
    departure: 18 * 60 + 30,
    routeKey: "groupA",
    dropOrder: ["cyberCity", "sector29"],
    baseFare: 450,
    serviceFee: 0,
    routeSimilarity: 0.95,
    joinerDetour: { ...nh48, cyberCity: 2, sector29: 4, golfCourse: 7 },
    joinerImpactMin: 1,
    status: "open",
  },
  {
    id: "E",
    members: [m("Ira", "cyberCity", 2, 0, 10), m("Zoya", "dlfPhase3", 1, 2, 10), m("Vikram", "golfCourse", 1, 6, 12)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 4, T3 arrivals",
    departure: 18 * 60 + 28,
    routeKey: "groupA",
    dropOrder: ["cyberCity", "dlfPhase3", "golfCourse"],
    baseFare: 480,
    serviceFee: 0,
    routeSimilarity: 0.9,
    joinerDetour: { ...nh48, cyberCity: 1, sector29: 6, golfCourse: 5 },
    joinerImpactMin: 2,
    status: "open",
  },
  {
    id: "F",
    members: [m("Rohan", "cyberCity", 1, 0, 10)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "nh48-gurugram",
    pickupPoint: "Gate 5, T3 arrivals",
    departure: 19 * 60 + 35,
    routeKey: "solo",
    dropOrder: ["cyberCity"],
    baseFare: 450,
    serviceFee: 0,
    routeSimilarity: 1,
    joinerDetour: { ...nh48, sector29: 5, golfCourse: 6 },
    joinerImpactMin: 0,
    status: "open",
  },
  {
    id: "G",
    members: [m("Tara", "dwarka21", 1, 0, 10), m("Neel", "dwarka21", 1, 0, 10)],
    vehicle: { type: "Sedan", seats: 4, bagCapacity: 4 },
    corridor: "dwarka",
    pickupPoint: "Gate 1, T3 arrivals",
    departure: 18 * 60 + 22,
    routeKey: "solo",
    dropOrder: ["dwarka21"],
    baseFare: 300,
    serviceFee: 0,
    routeSimilarity: 0.2,
    joinerDetour: {},
    joinerImpactMin: 0,
    status: "open",
  },
];

// Deterministic generator for the 48-request pool used by the matching pipeline visual.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const NAMES = ["Shourya", "Hasrat", "Kabir", "Meera", "Arjun", "Sana", "Dev", "Nisha", "Ira", "Zoya", "Vikram", "Rohan", "Tara", "Neel", "Anika", "Farhan", "Ishaan", "Kavya", "Laila", "Manav", "Nikhil", "Pooja", "Rahul", "Simran"];
const DESTS: PlaceId[] = ["cyberCity", "cyberCity", "dlfPhase3", "sector29", "golfCourse", "sector54", "dwarka21", "dwarka21", "vasantKunj", "saket"];

export function generateRequests(n = 48, seed = 7): TripRequest[] {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  return Array.from({ length: n }, (_, i) => {
    const start = 17 * 60 + 30 + Math.floor(r() * 16) * 10; // 17:30–20:00
    return {
      id: `R${String(i + 1).padStart(2, "0")}`,
      user: NAMES[i % NAMES.length],
      airport: "DEL",
      terminal: "T3",
      destination: pick(DESTS),
      windowStart: start,
      windowEnd: start + 20,
      bags: pick([0, 1, 1, 1, 2, 2, 3]),
      maxWait: pick([10, 15, 15, 20]),
      maxDetour: pick([5, 10, 10, 15]),
      optIn: r() > 0.06,
    };
  });
}
