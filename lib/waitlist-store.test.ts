import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { addSignup, migrate, summary } from "./waitlist-store.ts";
import type { Area, Signup } from "./waitlist.ts";

const db = new DatabaseSync(":memory:");
migrate(db);
const s = (email: string, area: Area = "Cyber City"): Signup => ({ email, area, frequency: "Monthly", arrival: "Evening" });
assert.deepEqual(addSignup(db, s("a@x.co")), { position: 1, existing: false });
assert.deepEqual(addSignup(db, s("b@x.co", "Sohna Road")), { position: 2, existing: false });
assert.deepEqual(addSignup(db, s("a@x.co")), { position: 1, existing: true }); // de-duplicated, keeps original place
const sum = summary(db);
assert.equal(sum.total, 2);
assert.deepEqual(sum.byArea.map((r) => r.k).sort(), ["Cyber City", "Sohna Road"]);
assert.equal(sum.recent[0].email, "b@x.co");
console.log("waitlist-store ok");
