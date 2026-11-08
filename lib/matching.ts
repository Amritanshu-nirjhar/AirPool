// Matching engine: hard constraints first, then weighted ranking, then a templated explanation.
// Pure functions; no UI imports. The explanation text never invents fares or flight status:
// every number in it comes from the evaluated match.
import { CORRIDOR, CORRIDOR_LABEL, PLACES, haversineKm } from "./geo.ts";
import type { Evaluation, Group, Match, Rejection, TripRequest, Weights } from "./types.ts";
import { fmtTime } from "./geo.ts";

/** Estimated share = estimated base fare / travellers + disclosed service fee (equal split). */
export function estimateShare(baseFare: number, travellers: number, serviceFee = 0): number {
  if (travellers < 1) throw new Error("travellers must be >= 1");
  return Math.round(baseFare / travellers + serviceFee);
}

/** Expected wait at the kerb: group departure minus the middle of the rider's window. */
export function expectedWait(req: TripRequest, departure: number): number {
  return Math.max(0, departure - (req.windowStart + req.windowEnd) / 2);
}

export function hardConstraints(req: TripRequest, g: Group): Rejection[] {
  const out: Rejection[] = [];
  const wait = expectedWait(req, g.departure);
  const detour = g.joinerDetour[req.destination];
  const bags = g.members.reduce((s, m) => s + m.bags, 0) + req.bags;

  if (g.departure < req.windowStart || g.departure > req.windowEnd + req.maxWait)
    out.push({ constraint: "window", message: `Departs ${fmtTime(g.departure)}, outside your ${fmtTime(req.windowStart)}–${fmtTime(req.windowEnd)} window` });
  if (CORRIDOR[req.destination] !== g.corridor || detour === undefined)
    out.push({ constraint: "corridor", message: `Heads to ${CORRIDOR_LABEL[g.corridor]}, not your route corridor` });
  if (g.members.length + 1 > g.vehicle.seats)
    out.push({ constraint: "seats", message: `No free seat (${g.vehicle.seats}-seat ${g.vehicle.type})` });
  if (bags > g.vehicle.bagCapacity)
    out.push({ constraint: "luggage", message: `${bags} bags exceed the ${g.vehicle.bagCapacity}-bag boot capacity` });
  if (detour !== undefined && detour > req.maxDetour)
    out.push({ constraint: "detour", message: `+${detour} min detour exceeds your ${req.maxDetour} min limit` });
  const over = g.members.find((m) => m.detourMin + g.joinerImpactMin > m.maxDetour);
  if (over) out.push({ constraint: "detour", message: `Adding you would push ${over.name} past their detour limit` });
  if (wait > req.maxWait)
    out.push({ constraint: "wait", message: `~${Math.round(wait)} min wait exceeds your ${req.maxWait} min limit` });
  if (!req.optIn || g.members.some((m) => !m.consent))
    out.push({ constraint: "consent", message: "A rider has not yet given consent to share" });
  return out;
}

export function scoreGroup(req: TripRequest, g: Group, w: Weights): Match {
  const detourMin = g.joinerDetour[req.destination] ?? 0;
  const waitMin = Math.round(expectedWait(req, g.departure));
  const detours = [detourMin, ...g.members.map((m) => m.detourMin + g.joinerImpactMin)];
  const limit = Math.max(req.maxDetour, ...g.members.map((m) => m.maxDetour));
  const factors = {
    route: g.routeSimilarity,
    wait: req.maxWait ? waitMin / req.maxWait : 0,
    detour: req.maxDetour ? detourMin / req.maxDetour : 0,
    // fare_fairness: equal split, so fairness = how evenly the detour burden is shared
    fairness: 1 - (Math.max(...detours) - Math.min(...detours)) / limit,
  };
  const score = w.route * factors.route - w.wait * factors.wait - w.detour * factors.detour + w.fairness * factors.fairness;
  const travellers = g.members.length + 1;
  return {
    requestId: req.id,
    groupId: g.id,
    score: Math.round(score * 1000) / 10,
    detourMin,
    waitMin,
    travellers,
    share: estimateShare(g.baseFare, travellers, g.serviceFee),
    reason: explain(g, detourMin, waitMin),
    factors,
  };
}

export function explain(g: Group, detourMin: number, waitMin: number): string {
  const corridor = g.routeSimilarity >= 0.85 ? "Same route corridor" : "Partly shared route corridor";
  const wait = waitMin === 0 ? "departs as you reach the kerb" : `${waitMin}-minute estimated wait`;
  return `${corridor}, ${detourMin}-minute detour and ${wait}.`;
}

/** Hard constraints run first; only feasible groups are scored and ranked. */
export function rankGroups(req: TripRequest, groups: Group[], w: Weights): { ranked: Match[]; evaluations: Evaluation[] } {
  const evaluations: Evaluation[] = groups.map((group) => {
    const rejections = hardConstraints(req, group);
    return rejections.length ? { group, feasible: false, rejections } : { group, feasible: true, match: scoreGroup(req, group, w) };
  });
  const ranked = evaluations.flatMap((e) => (e.feasible ? [e.match] : [])).sort((a, b) => b.score - a.score);
  return { ranked, evaluations };
}

// ---- Pool-level pipeline over many requests (used for the engine visualisation) ----

const ROAD_FACTOR = 1.3; // road distance ≈ 1.3 × straight line (estimate)
const KMH = 30; // assumed average city speed for detour estimates

/** Estimated detour (min) for the rider dropped second when two riders share from T3. */
export function pairDetour(a: TripRequest, b: TripRequest): number {
  const t3 = PLACES.t3.coord, pa = PLACES[a.destination].coord, pb = PLACES[b.destination].coord;
  const d1 = haversineKm(t3, pa) + haversineKm(pa, pb) - haversineKm(t3, pb);
  const d2 = haversineKm(t3, pb) + haversineKm(pb, pa) - haversineKm(t3, pa);
  return Math.round((Math.min(d1, d2) * ROAD_FACTOR * 60) / KMH);
}

export type PairCheck = "window" | "corridor" | "luggage" | "detour" | "consent" | "ok";

export function pairCheck(a: TripRequest, b: TripRequest, bagCapacity = 4): PairCheck {
  if (CORRIDOR[a.destination] !== CORRIDOR[b.destination]) return "corridor";
  const start = Math.max(a.windowStart, b.windowStart), end = Math.min(a.windowEnd + a.maxWait, b.windowEnd + b.maxWait);
  if (start > end) return "window";
  if (a.bags + b.bags > bagCapacity) return "luggage";
  if (pairDetour(a, b) > Math.min(a.maxDetour, b.maxDetour)) return "detour";
  if (!a.optIn || !b.optIn) return "consent";
  return "ok";
}

export interface PipelineResult {
  requests: number;
  pairs: number;
  rejected: Record<Exclude<PairCheck, "ok">, number>;
  feasiblePairs: number;
  groups: { members: TripRequest[]; score: number }[];
  unmatched: number;
}

/** Greedy grouping: best-scoring feasible pairs first, groups grow while every pair stays feasible (max 4 riders, 4 bags). */
// ponytail: greedy O(n² · g) grouping, fine for demo pools; swap for ILP/min-cost matching at real volumes
export function runPipeline(reqs: TripRequest[], w: Weights): PipelineResult {
  const rejected = { corridor: 0, window: 0, luggage: 0, detour: 0, consent: 0 };
  const ok: { a: TripRequest; b: TripRequest; score: number }[] = [];
  for (let i = 0; i < reqs.length; i++)
    for (let j = i + 1; j < reqs.length; j++) {
      const [a, b] = [reqs[i], reqs[j]];
      const c = pairCheck(a, b);
      if (c !== "ok") { rejected[c]++; continue; }
      const det = pairDetour(a, b);
      const wait = Math.abs(a.windowStart - b.windowStart);
      const score = w.route * (a.destination === b.destination ? 1 : 0.8) - w.wait * (wait / 30) - w.detour * (det / 15) + w.fairness;
      ok.push({ a, b, score });
    }
  ok.sort((x, y) => y.score - x.score);

  const groupOf = new Map<string, TripRequest[]>();
  const groups: TripRequest[][] = [];
  const fits = (g: TripRequest[], r: TripRequest) =>
    g.length < 4 && g.reduce((s, x) => s + x.bags, r.bags) <= 4 && g.every((x) => pairCheck(x, r) === "ok");
  for (const { a, b } of ok) {
    const ga = groupOf.get(a.id), gb = groupOf.get(b.id);
    if (!ga && !gb) { const g = [a, b]; groups.push(g); groupOf.set(a.id, g); groupOf.set(b.id, g); }
    else if (ga && !gb && fits(ga, b)) { ga.push(b); groupOf.set(b.id, ga); }
    else if (gb && !ga && fits(gb, a)) { gb.push(a); groupOf.set(a.id, gb); }
  }
  const scored = groups
    .map((members) => ({ members, score: Math.round(ok.filter((p) => members.includes(p.a) && members.includes(p.b)).reduce((s, p) => s + p.score, 0) / Math.max(1, members.length - 1) * 100) }))
    .sort((x, y) => y.score - x.score);
  return {
    requests: reqs.length,
    pairs: (reqs.length * (reqs.length - 1)) / 2,
    rejected,
    feasiblePairs: ok.length,
    groups: scored,
    unmatched: reqs.length - groupOf.size,
  };
}

/**
 * When nothing matches: the smallest change to the traveller's own limits that makes some group feasible.
 * Only relaxes what the traveller controls (detour, wait, bags). Returns null if no relaxation helps.
 */
export interface Fix { groupId: string; changes: string[]; maxDetour: number; maxWait: number; bags: number }
export function closestFix(req: TripRequest, groups: Group[]): Fix | null {
  let best: (Fix & { cost: number }) | null = null;
  for (const g of groups)
    for (let d = req.maxDetour; d <= 20; d++)
      for (const w of [req.maxWait, 20, 30].filter((x, i, a) => x >= req.maxWait && a.indexOf(x) === i))
        for (let b = req.bags; b >= 0; b--) {
          const cost = (d - req.maxDetour) + (w - req.maxWait) * 0.5 + (req.bags - b) * 4;
          if (best && cost >= best.cost) continue;
          if (hardConstraints({ ...req, maxDetour: d, maxWait: w, bags: b }, g).length) continue;
          const changes = [
            ...(d > req.maxDetour ? [`allow a ${d}-min detour`] : []),
            ...(w > req.maxWait ? [`wait up to ${w} min`] : []),
            ...(b < req.bags ? [`bring ${b} ${b === 1 ? "bag" : "bags"}`] : []),
          ];
          best = { cost, groupId: g.id, changes, maxDetour: d, maxWait: w, bags: b };
        }
  if (!best || !best.changes.length) return null;
  const { cost: _cost, ...fix } = best; // eslint-disable-line @typescript-eslint/no-unused-vars
  return fix;
}
