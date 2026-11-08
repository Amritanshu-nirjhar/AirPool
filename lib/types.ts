import type routesData from "../data/routes.json";

export type PlaceId = keyof typeof routesData.places;
export type RouteKey = keyof typeof routesData.routes;
export type CorridorId = "nh48-gurugram" | "dwarka" | "south-delhi";
export type LngLat = [number, number];

/** Minutes since midnight, local time. */
export type Minutes = number;

export interface TripRequest {
  id: string;
  user: string; // first name only
  airport: "DEL";
  terminal: "T3";
  destination: PlaceId;
  windowStart: Minutes;
  windowEnd: Minutes;
  bags: number;
  maxWait: number;
  maxDetour: number;
  flight?: string;
  /** Rider explicitly opted into shared matching. */
  optIn: boolean;
}

export interface Member {
  name: string;
  destination: PlaceId;
  bags: number;
  detourMin: number; // detour this member already accepts in the group
  maxDetour: number;
  verified: boolean;
  consent: boolean;
}

export interface Group {
  id: string;
  members: Member[]; // existing members, excluding the joiner
  vehicle: { type: "Sedan" | "SUV"; seats: number; bagCapacity: number };
  corridor: CorridorId;
  pickupPoint: string;
  departure: Minutes;
  routeKey: RouteKey;
  dropOrder: PlaceId[];
  baseFare: number; // estimated, INR, whole vehicle
  serviceFee: number; // disclosed per-rider fee
  routeSimilarity: number; // 0..1 overlap of joiner's route with group route
  joinerDetour: Partial<Record<PlaceId, number>>; // joiner detour by destination
  joinerImpactMin: number; // extra detour the joiner adds to existing members
  status: "open" | "full";
}

export type ConstraintId = "window" | "corridor" | "seats" | "luggage" | "detour" | "wait" | "consent";

export interface Rejection {
  constraint: ConstraintId;
  message: string;
}

export interface Weights {
  route: number;
  wait: number;
  detour: number;
  fairness: number;
}

export interface Match {
  requestId: string;
  groupId: string;
  score: number;
  detourMin: number;
  waitMin: number;
  travellers: number;
  share: number;
  reason: string;
  factors: { route: number; wait: number; detour: number; fairness: number };
}

export type Evaluation =
  | { group: Group; feasible: true; match: Match }
  | { group: Group; feasible: false; rejections: Rejection[] };

export interface Consent {
  user: string;
  groupId: string;
  acceptedAt: string;
  termsVersion: string;
}
