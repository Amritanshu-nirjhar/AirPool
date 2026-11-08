import assert from "node:assert/strict";
import { parseSignup } from "./waitlist.ts";

const base = { area: "Cyber City", frequency: "Monthly", arrival: "Evening" };
assert.deepEqual(parseSignup({ ...base, email: " Hasrat@Example.com " }), { ok: true, value: { ...base, email: "hasrat@example.com" } });
assert.equal(parseSignup({ ...base, email: "not-an-email" }).ok, false);
assert.equal(parseSignup({ ...base, email: "a@b.co", area: "Noida" }).ok, false);
assert.equal(parseSignup({ ...base, email: "a@b.co", frequency: "Daily" }).ok, false);
assert.equal(parseSignup({ ...base, email: "a@b.co", arrival: undefined }).ok, false);
assert.equal(parseSignup({ ...base, email: "a".repeat(250) + "@b.co" }).ok, false);
assert.equal(parseSignup(null).ok, false);
console.log("waitlist ok");
