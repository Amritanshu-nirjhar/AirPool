// Run: node lib/matching.test.ts
import assert from "node:assert/strict";
import { DEFAULT_WEIGHTS, OPEN_GROUPS, generateRequests } from "./demo-data.ts";
import { closestFix, estimateShare, hardConstraints, pairCheck, rankGroups, runPipeline } from "./matching.ts";
import type { TripRequest } from "./types.ts";

const req: TripRequest = {
  id: "me", user: "You", airport: "DEL", terminal: "T3", destination: "cyberCity",
  windowStart: 18 * 60 + 15, windowEnd: 18 * 60 + 35, bags: 1, maxWait: 15, maxDetour: 10, optIn: true,
};
const byId = (id: string) => OPEN_GROUPS.find((g) => g.id === id)!;

// Fare split
assert.equal(estimateShare(450, 3), 150);
assert.equal(estimateShare(450, 1), 450);
assert.equal(estimateShare(450, 3, 20), 170);

// PRD: A and B feasible, C excluded at 10 min max detour, A ranked first
const { ranked } = rankGroups(req, OPEN_GROUPS, DEFAULT_WEIGHTS);
assert.deepEqual(ranked.map((m) => m.groupId), ["A", "B"]);
assert.equal(ranked[0].share, 150);
assert.equal(ranked[0].detourMin, 6);
assert.equal(ranked[1].share, 210);
assert.deepEqual(hardConstraints(req, byId("C")).map((r) => r.constraint), ["detour"]);

// Raising the detour limit admits C — the rejection was only the detour
assert.ok(rankGroups({ ...req, maxDetour: 12 }, OPEN_GROUPS, DEFAULT_WEIGHTS).ranked.some((m) => m.groupId === "C"));

// Each other hard constraint fires
assert.ok(hardConstraints(req, byId("D")).some((r) => r.constraint === "consent"));
assert.ok(hardConstraints(req, byId("E")).some((r) => r.constraint === "luggage"));
assert.ok(hardConstraints(req, byId("F")).some((r) => r.constraint === "window"));
assert.ok(hardConstraints(req, byId("G")).some((r) => r.constraint === "corridor"));
assert.ok(hardConstraints({ ...req, bags: 3 }, byId("A")).some((r) => r.constraint === "luggage"));
assert.ok(hardConstraints({ ...req, optIn: false }, byId("A")).some((r) => r.constraint === "consent"));

// No feasible groups → empty ranking (UI shows notify-me fallback)
assert.equal(rankGroups({ ...req, maxDetour: 0 }, OPEN_GROUPS, DEFAULT_WEIGHTS).ranked.length, 0);

// Pipeline: every formed group is pairwise feasible and within capacity
const pool = generateRequests();
assert.equal(pool.length, 48);
const p = runPipeline(pool, DEFAULT_WEIGHTS);
for (const g of p.groups) {
  assert.ok(g.members.length >= 2 && g.members.length <= 4);
  assert.ok(g.members.reduce((s, m) => s + m.bags, 0) <= 4);
  for (const a of g.members) for (const b of g.members) if (a !== b) assert.equal(pairCheck(a, b), "ok");
}
console.log("matching ok", { feasiblePairs: p.feasiblePairs, groups: p.groups.length, unmatched: p.unmatched, rejected: p.rejected });

// closestFix: with a 0-min detour limit nothing matches; the fix is to relax detour only (not bags/wait)
const fix0 = closestFix({ ...req, maxDetour: 0 }, OPEN_GROUPS);
assert.ok(fix0 && fix0.changes.length === 1 && /detour/.test(fix0.changes[0]), JSON.stringify(fix0));
assert.equal(closestFix(req, OPEN_GROUPS)?.changes.length ?? 0, 0); // already matching → nothing to suggest
console.log("closestFix ok", fix0);
