// End-to-end check of the booking demo in real Chrome (needs `npm run dev` running).
// Usage: node scripts/e2e.mjs [width height] [baseUrl]   e.g. node scripts/e2e.mjs 390 844
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const [w = "1440", h = "900", base = "http://localhost:3100"] = process.argv.slice(2);
const mobile = +w < 768;
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: +w, height: +h }, isMobile: mobile, hasTouch: mobile });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`${base}/#book`, { waitUntil: "load" });
const book = p.locator("#book");
const next = async (n) => { if (mobile) for (let i = 0; i < n; i++) await book.getByRole("button", { name: /^Next/ }).click(); };

// 1. defaults: Groups A and B fit, C is excluded by the 10-min detour limit
await next(3);
await book.getByRole("button", { name: /Find shared rides/ }).click();
await book.getByText("2/7 FEASIBLE").waitFor({ timeout: 5000 });
assert.ok(await book.getByText(/\+11 MIN DETOUR EXCEEDS YOUR 10 MIN LIMIT/).isVisible(), "Group C excluded");
await book.getByRole("button", { name: "VIEW GROUP →" }).first().click();
await book.getByText(/Shourya & Hasrat/).waitFor();

// 2. consent is never pre-selected and gates confirmation
await book.getByRole("button", { name: "Join this ride" }).click();
const confirm = book.getByRole("button", { name: "Confirm and join" });
assert.equal(await confirm.isDisabled(), true, "confirm disabled before consent");
const boxes = book.locator('input[type="checkbox"]');
for (let i = 0; i < (await boxes.count()); i++) assert.equal(await boxes.nth(i).isChecked(), false, "no pre-ticked boxes");
await boxes.nth(1).check();
await confirm.click();
await book.getByText("CONFIRMED", { exact: true }).waitFor();
await book.getByText(/Seat held with Group/).waitFor();
await book.getByRole("button", { name: "Start a new trip" }).click();

// 3. no match → closest fix → apply
await next(1);
await book.getByRole("radio", { name: "3 bags" }).click();
await next(2);
await book.getByRole("button", { name: /Find shared rides/ }).click();
await book.getByText("No compatible group right now.").waitFor();
assert.ok(await book.getByText(/Closest: Group/).isVisible(), "closest fix offered");
await book.getByRole("button", { name: "Apply and search again" }).click();
await book.getByRole("button", { name: "VIEW GROUP →" }).first().waitFor({ timeout: 4000 });

assert.deepEqual(errs, [], "no page errors");
console.log(`E2E OK ${w}×${h}`);
await b.close();
