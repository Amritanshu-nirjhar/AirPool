// Screenshot helper for design review: node scripts/shots.mjs outDir width height target[,target...]
// target = a CSS selector (scrolled into view) or a pixel scroll offset. Waits for WebGL + Lenis to settle.
import { chromium } from "playwright-core";
const [out, w, h, targets, wait = "3200"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, isMobile: +w < 768, hasTouch: +w < 768 });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("http://localhost:3100", { waitUntil: "load" });
await p.waitForTimeout(2500);
for (const t of targets.split(",")) {
  await p.evaluate((t) => {
    const y = /^\d+$/.test(t) ? +t : document.querySelector(t).getBoundingClientRect().top + scrollY;
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
    else scrollTo(0, y);
  }, t);
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: `${out}/${w}-${t.replace(/[^\w]/g, "") || "x"}.png` });
}
console.log(errs.length ? errs : "no errors");
await b.close();
