"use client";
// Sequence E — matching engine as an ATC radar scope centred on DEL T3.
// Blips sit at each request's real destination bearing/distance (with a small simulated jitter);
// every line, count and group is computed live by lib/matching.
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "framer-motion";
import { DEFAULT_WEIGHTS, generateRequests } from "@/lib/demo-data";
import { CORRIDOR, PLACES, haversineKm } from "@/lib/geo";
import { pairCheck, runPipeline, type PairCheck } from "@/lib/matching";
import type { CorridorId, LngLat, PlaceId } from "@/lib/types";

const POOL = generateRequests();
const GATES = ["corridor", "window", "luggage", "detour", "consent"] as const;
const GATE_LABEL: Record<(typeof GATES)[number], string> = { corridor: "Route corridor", window: "Arrival window", luggage: "Seats & luggage", detour: "Max detour", consent: "Consent" };
const CORR_RGB: Record<CorridorId, string> = { "nh48-gurugram": "224,176,106", dwarka: "143,209,187", "south-delhi": "159,182,255" };
const RANGE_KM = 16;
// Phases of the sticky sequence
const PH = { sweep: [0, 0.2], gates: [0.2, 0.6], score: [0.6, 0.75], groups: [0.75, 1] } as const;
const PHASES = [
  { k: "sweep", n: "01", t: "Incoming trip requests", d: "Every request is plotted from T3 by the real bearing and distance of its destination." },
  { k: "gates", n: "02", t: "Hard constraints", d: "Each pair of riders must pass every rule. A single failure rejects the pair before any scoring." },
  { k: "score", n: "03", t: "Match scoring", d: "Only feasible pairs are scored: route similarity, wait, detour and fare fairness." },
  { k: "groups", n: "04", t: "Ranked groups", d: "Compatible riders lock into groups of up to four. Everyone else keeps waiting rather than being forced in." },
] as const;
const clamp = (t: number) => Math.min(Math.max(t, 0), 1);
const range = (p: number, [a, b]: readonly [number, number]) => clamp((p - a) / (b - a));

function polar(coord: LngLat): { a: number; r: number } {
  const t3 = PLACES.t3.coord;
  const km = haversineKm(t3, coord);
  const dx = (coord[0] - t3[0]) * Math.cos((t3[1] * Math.PI) / 180), dy = coord[1] - t3[1];
  return { a: Math.atan2(dx, dy), r: km }; // a: bearing from north, clockwise
}

export default function Engine() {
  const reduced = !!useReducedMotion();
  const section = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const prog = useRef(0);
  const [p, setP] = useState(0);

  // Engine runs (pure, memoised)
  const data = useMemo(() => {
    const pairs: { a: number; b: number; c: PairCheck }[] = [];
    for (let i = 0; i < POOL.length; i++) for (let j = i + 1; j < POOL.length; j++) pairs.push({ a: i, b: j, c: pairCheck(POOL[i], POOL[j]) });
    // Deterministic jitter (simulated) so riders sharing a destination don't overlap
    const blips = POOL.map((r, i) => {
      const { a, r: km } = polar(PLACES[r.destination].coord);
      const j = Math.sin(i * 12.9898) * 43758.5453;
      const f = j - Math.floor(j);
      return { a: a + (f - 0.5) * 0.22, r: Math.max(1.2, km + (f - 0.5) * 1.6), req: r, corr: CORRIDOR[r.destination]! };
    });
    return { pairs, blips };
  }, []);
  const pipe = useMemo(() => runPipeline(POOL, DEFAULT_WEIGHTS), []);
  const groupsIdx = useMemo(() => pipe.groups.map((g) => g.members.map((m) => POOL.indexOf(m))), [pipe]);

  // Scroll → progress
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: section.current, start: "top top", end: "bottom bottom",
      onUpdate: (s) => { prog.current = s.progress; setP(Math.round(s.progress * 300) / 300); },
    });
    return () => st.kill();
  }, []);

  // Radar renderer
  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, visible = true, sp = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);
    const start = performance.now();
    const monoFont = getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() || "monospace";
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const size = cv.clientWidth;
      if (cv.width !== size * dpr) { cv.width = cv.height = size * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sp = reduced ? prog.current : sp + (prog.current - sp) * 0.12;
      const P = sp, t = (now - start) / 1000;
      const c = size / 2, R = size * 0.46;
      const k = R / RANGE_KM;
      const pos = (a: number, r: number) => [c + Math.sin(a) * r * k, c - Math.cos(a) * r * k] as const;
      ctx.clearRect(0, 0, size, size);

      // Scope face
      const face = ctx.createRadialGradient(c, c, 0, c, c, R);
      face.addColorStop(0, "rgba(20,70,58,0.55)");
      face.addColorStop(1, "rgba(8,24,20,0.2)");
      ctx.fillStyle = face;
      ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();

      // Corridor sectors
      const sectors: [CorridorId, PlaceId[]][] = [["nh48-gurugram", ["cyberCity", "sector29", "golfCourse", "sector54", "dlfPhase3"]], ["dwarka", ["dwarka21"]], ["south-delhi", ["vasantKunj", "saket"]]];
      ctx.font = `500 ${Math.max(9, size * 0.016)}px ${monoFont}, monospace`;
      for (const [corr, ids] of sectors) {
        const as = ids.map((id) => { const a = polar(PLACES[id].coord).a; return a < 0 ? a + Math.PI * 2 : a; });
        const a0 = Math.min(...as) - 0.18, a1 = Math.max(...as) + 0.18;
        ctx.fillStyle = `rgba(${CORR_RGB[corr]},0.05)`;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, a0 - Math.PI / 2, a1 - Math.PI / 2); ctx.closePath(); ctx.fill();
        const [lx, ly] = pos((a0 + a1) / 2, RANGE_KM * 0.93);
        ctx.fillStyle = `rgba(${CORR_RGB[corr]},0.75)`;
        ctx.textAlign = "center";
        ctx.fillText(corr === "nh48-gurugram" ? "NH-48 · GURUGRAM" : corr === "dwarka" ? "DWARKA" : "SOUTH DELHI", lx, ly);
      }

      // Rings + bearings
      ctx.strokeStyle = "rgba(224,176,106,0.14)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(163,152,174,0.8)";
      ctx.textAlign = "left";
      for (let km = 4; km <= RANGE_KM; km += 4) {
        ctx.beginPath(); ctx.arc(c, c, km * k, 0, Math.PI * 2); ctx.stroke();
        ctx.fillText(`${km} KM`, c + 4, c - km * k + 12);
      }
      for (let d = 0; d < 360; d += 10) {
        const a = (d * Math.PI) / 180, long = d % 30 === 0;
        const [x0, y0] = pos(a, RANGE_KM * (long ? 0.965 : 0.98)), [x1, y1] = pos(a, RANGE_KM);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (long) {
          const [tx, ty] = pos(a, RANGE_KM * 1.055);
          ctx.textAlign = "center";
          ctx.fillText(d === 0 ? "N" : d === 90 ? "E" : d === 180 ? "S" : d === 270 ? "W" : String(d).padStart(3, "0"), tx, ty + 4);
        }
      }
      ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();

      // Sweep: scroll-driven during phase 1, then continuous
      const p1 = range(P, PH.sweep);
      const sweepA = p1 < 1 ? p1 * Math.PI * 2 : Math.PI * 2 + (reduced ? 0 : t * 0.9);
      const wedge = ctx.createConicGradient(sweepA - Math.PI / 2 - 0.9, c, c);
      wedge.addColorStop(0, "rgba(224,176,106,0)");
      wedge.addColorStop(0.143, "rgba(224,176,106,0.22)");
      wedge.addColorStop(0.1432, "rgba(224,176,106,0)");
      ctx.fillStyle = wedge;
      ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
      const [sx, sy] = pos(sweepA, RANGE_KM);
      ctx.strokeStyle = "rgba(240,222,190,0.7)";
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(sx, sy); ctx.stroke();

      // Pair lines by phase
      const gp = range(P, PH.gates), scp = range(P, PH.score), grp = range(P, PH.groups);
      const gateIdx = Math.floor(gp * GATES.length);
      ctx.lineWidth = 1;
      for (const pr of data.pairs) {
        const A = data.blips[pr.a], B = data.blips[pr.b];
        let alpha = 0, col = "255,95,114";
        if (pr.c !== "ok") {
          const gi = GATES.indexOf(pr.c as (typeof GATES)[number]);
          if (gp > 0 && gi <= gateIdx && gp < 1) alpha = gi === gateIdx ? 0.16 : 0.025;
          if (grp > 0) alpha = 0;
        } else if (scp > 0) {
          col = "95,216,245";
          alpha = 0.35 * scp * (1 - grp * 0.75);
        }
        if (alpha < 0.005) continue;
        const [ax, ay] = pos(A.a, A.r), [bx, by] = pos(B.a, B.r);
        ctx.strokeStyle = `rgba(${col},${alpha})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(c + (ax + bx - 2 * c) * 0.3, c + (ay + by - 2 * c) * 0.3, bx, by); ctx.stroke();
      }

      // Groups lock in
      const inGroup = new Set<number>();
      groupsIdx.forEach((g, gi) => {
        const show = clamp((grp - gi / Math.max(groupsIdx.length, 1) * 0.6) * 5);
        if (show <= 0) return;
        g.forEach((i) => inGroup.add(i));
        const pts = g.map((i) => pos(data.blips[i].a, data.blips[i].r));
        ctx.strokeStyle = `rgba(240,222,190,${0.9 * show})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (pts.length > 2) ctx.closePath();
        ctx.stroke();
        const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
        const rad = Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy))) + 9;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = `rgba(240,222,190,${0.22 * show})`;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      });

      // Blips (revealed by the sweep)
      data.blips.forEach((b, i) => {
        const rel = ((b.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (p1 < 1 && rel > sweepA) return;
        const since = p1 < 1 ? sweepA - rel : (((sweepA - rel) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const fresh = Math.max(0, 1 - since / 2.5);
        const [x, y] = pos(b.a, b.r);
        const dim = grp > 0.3 && !inGroup.has(i) ? 0.3 : 1;
        const consentFail = !b.req.optIn && gateIdx >= 4 && gp > 0;
        ctx.fillStyle = `rgba(${CORR_RGB[b.corr]},${(0.55 + fresh * 0.45) * dim})`;
        ctx.beginPath(); ctx.arc(x, y, 2.6 + fresh * 2, 0, Math.PI * 2); ctx.fill();
        if (fresh > 0.05) {
          ctx.fillStyle = `rgba(${CORR_RGB[b.corr]},${fresh * 0.25})`;
          ctx.beginPath(); ctx.arc(x, y, 9 * fresh + 3, 0, Math.PI * 2); ctx.fill();
        }
        if (consentFail) {
          ctx.strokeStyle = "rgba(255,95,114,0.9)";
          ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // T3 origin + you
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(c, c, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(246,239,230,0.9)";
      ctx.textAlign = "left";
      ctx.fillText("DEL T3", c + 8, c + 4);
      const yc = polar(PLACES.cyberCity.coord);
      const [yx, yy] = pos(yc.a, yc.r);
      const pulse = reduced ? 0.5 : (t % 1.6) / 1.6;
      ctx.strokeStyle = `rgba(255,255,255,${1 - pulse})`;
      ctx.beginPath(); ctx.arc(yx, yy, 5 + pulse * 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.fillText("YOU → CYBER CITY", yx + 12, yy + 4);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [data, groupsIdx, reduced]);

  const phaseIdx = p < PH.gates[0] ? 0 : p < PH.score[0] ? 1 : p < PH.groups[0] ? 2 : 3;
  const ph = PHASES[phaseIdx];
  const gp = range(p, PH.gates);

  return (
    <section id="engine" aria-labelledby="engine-title" className="mood-night relative border-t border-white/5" style={{ background: "#091a14" }}>
      <div ref={section} className="relative h-[240vh]">
        <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden lg:flex-row">
          {/* left: narrative + gates */}
          <div className="relative z-10 flex flex-col px-5 pb-4 pt-20 md:px-10 lg:w-[38%] lg:justify-center lg:gap-10 lg:py-24">
            <div>
              <p className="label">How matching works</p>
              <h2 id="engine-title" className="display mt-4 text-[clamp(1.9rem,3.6vw,3.4rem)]">Intelligence behind every shared ride.</h2>
              <div className="mt-8 hidden lg:block" aria-live="polite">
                <p className="mono text-xs text-flare">PHASE {ph.n} / 04</p>
                <p className="mt-2 font-display text-xl">{ph.t}</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{ph.d}</p>
              </div>
            </div>
            <ol className="mt-6 hidden space-y-0 border-t border-text/10 lg:block" aria-label="Hard constraints">
              {GATES.map((g, i) => {
                const local = clamp(gp * GATES.length - i);
                const state = gp <= 0 ? "idle" : local >= 1 ? "done" : local > 0 ? "active" : "idle";
                return (
                  <li key={g} className={`mono flex items-center justify-between border-b border-text/10 py-2.5 text-xs transition-colors ${state === "idle" ? "text-muted/50" : "text-text"}`}>
                    <span className="flex items-center gap-3">
                      <span className={`h-1.5 w-1.5 rounded-full ${state === "done" ? "bg-good" : state === "active" ? "animate-pulse bg-bad" : "bg-text/20"}`} />
                      {GATE_LABEL[g].toUpperCase()}
                    </span>
                    <span className={state === "idle" ? "" : "text-bad"}>{state === "idle" ? "—" : `−${Math.round(pipe.rejected[g] * local)}`}</span>
                  </li>
                );
              })}
              <li className="mono flex justify-between py-2.5 text-xs">
                <span className="text-muted">FEASIBLE PAIRS</span>
                <span className="text-good">{p >= PH.score[0] ? pipe.feasiblePairs : "—"} / {pipe.pairs}</span>
              </li>
            </ol>
          </div>

          {/* scope: a dark instrument screen set into the light page */}
          <div className="relative flex flex-1 items-center justify-center px-3 pb-3 lg:p-8">
            <div className="scope-instrument relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] shadow-[0_40px_80px_-40px_rgba(15,61,52,0.55),inset_0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-white/10">
            <div className="scope-lines pointer-events-none absolute inset-0" aria-hidden />
            <p className="mono absolute right-4 top-4 text-[10px] tracking-widest text-muted">ATC SCOPE · DEL T3 · SYNTHETIC POOL</p>
            <canvas ref={canvas} className="aspect-square w-[min(86vw,calc(100svh-18rem))] lg:w-[min(48vw,calc(100svh-10rem))]" role="img" aria-label={`Radar of ${POOL.length} synthetic trip requests around Delhi T3; ${pipe.feasiblePairs} feasible pairs, ${pipe.groups.length} groups formed.`} />
            <div className="absolute left-4 top-4 flex gap-4 text-[11px] text-muted">
              <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-flare" />NH-48</span>
              <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-taxi" />Dwarka</span>
              <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sodium" />South Delhi</span>
            </div>
            <div className="absolute bottom-4 left-4 lg:hidden">
              <p className="mono text-xs text-flare">PHASE {ph.n} · {ph.t.toUpperCase()}</p>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* What the AI does, and what it doesn't */}
      <div className="relative mx-auto max-w-7xl px-5 pb-28 md:px-10 md:pb-40">
        {/* principles */}
        <div className="grid gap-10 border-t border-text/10 pt-16 md:grid-cols-3">
          {[
            ["Rules before ranking", "Infeasible groups are removed before any scoring happens."],
            ["AI explains, never decides", "Reasons are phrased from the computed numbers (templated in this demo). Fares and limits come from the engine."],
            ["You approve every match", "Nothing is booked until you review the group and confirm."],
          ].map(([t, d], i) => (
            <div key={t}>
              <span className="serif-word text-6xl leading-none text-flare/80">{i + 1}</span>
              <p className="mt-5 font-display text-2xl">{t}</p>
              <p className="mt-2 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
