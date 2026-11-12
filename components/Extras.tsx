"use client";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AREAS, ARRIVAL, FREQUENCY, type Area, type Signup } from "@/lib/waitlist";
import { useReduced } from "./ui";
import { track } from "@/lib/track";
import { Mark } from "./Nav";

/* ---------------- Kerbside: bilingual T3 wayfinding sign (Delhi airport signs are Hindi + English) ---------------- */
const Pict = {
  arrive: <path d="M3 19h18M5.5 12.5 3 8l1.6-.5 3 3 4.3-1.2L8.4 3l2-.6 5.6 6.2 4.3-1.2a1.7 1.7 0 0 1 .9 3.2L6.2 14.6Z" />,
  bag: <><rect x="5" y="7" width="14" height="12" rx="2" /><path d="M9 7V4h6v3M9 11v4M15 11v4" /></>,
  group: <><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="7" r="2.4" /><circle cx="12" cy="5.5" r="2.4" /><path d="M3 19v-3a4 4 0 0 1 8 0M13 19v-3a4 4 0 0 1 8 0M8 19v-4a4 4 0 0 1 8 0v4" /></>,
  car: <><path d="M3 15v-3l2-5h14l2 5v3Z" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /><path d="M5 12h14" /></>,
};
const icon = (k: keyof typeof Pict) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 md:h-9 md:w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{Pict[k]}</svg>
);
const SIGN = [
  { i: "arrive", hi: "आगमन", en: "Arrivals" },
  { i: "bag", hi: "सामान", en: "Baggage reclaim" },
  { i: "group", hi: "पिलर 4", en: "Pillar 4 · Meet your group" },
  { i: "car", hi: "आपकी कार", en: "Your shared car" },
] as const;

export function Kerbside() {
  const wrap = useRef<HTMLElement>(null);
  const reduced = useReduced();
  const { scrollY } = useScroll();
  const vel = useVelocity(scrollY);
  // scrolling down pushes the bottom edge away (sign tilts back), then a spring settles it
  const swing = useSpring(useTransform(vel, [-3000, 0, 3000], reduced ? [0, 0, 0] : [-14, 0, 14]), { stiffness: 90, damping: 9, mass: 0.6 });
  // the walk from the gate to the car: the current step lights up as the sign crosses the screen
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start 85%", "end 25%"] });
  const [lit, setLit] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setLit(Math.min(SIGN.length - 1, Math.floor(v * SIGN.length))));
  return (
    <section ref={wrap} aria-label="Terminal 3 wayfinding: from arrivals to your shared car" className="relative bg-ink pb-10 pt-16 [perspective:900px]">
      {/* gantry cables */}
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex h-16 max-w-5xl justify-between px-[12%]" aria-hidden>
        <span className="w-[3px] bg-gradient-to-b from-night/0 via-night/50 to-night/80" />
        <span className="w-[3px] bg-gradient-to-b from-night/0 via-night/50 to-night/80" />
      </div>
      {/* the sign hangs from its top edge and swings with scroll velocity */}
      <motion.div style={{ rotateX: swing, transformOrigin: "50% 0%" }} className="relative border-y-[3px] border-[#0b2a23] bg-sign text-[#0b2a23] shadow-[0_24px_40px_-24px_rgba(15,61,52,0.5)]">
        <ol className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {SIGN.map((s, i) => (
            <li key={s.en} aria-current={i === lit ? "step" : undefined} className={`flex items-center gap-3 border-[#0b2a23]/70 px-5 py-4 transition-opacity duration-500 md:gap-4 md:px-8 md:py-5 lg:border-r-2 lg:last:border-r-0 ${i <= lit ? "opacity-100" : "opacity-35"}`}>
              {icon(s.i)}
              <div className="leading-tight">
                <p className="text-sm font-semibold md:text-base" lang="hi">{s.hi}</p>
                <p className="text-base font-bold tracking-[-0.02em] md:text-lg">{s.en}</p>
              </div>
              <span className={`ml-auto text-2xl font-bold transition-transform duration-500 ${i === lit ? "translate-x-0" : "-translate-x-2 opacity-0"}`} aria-hidden>{i === SIGN.length - 1 ? "●" : "→"}</span>
            </li>
          ))}
        </ol>
      </motion.div>
      <p className="mt-3 px-5 text-right text-[10px] text-muted md:px-10">Illustrative signage · pickup pillar is a demo value</p>
    </section>
  );
}

/* ---------------- Launch scope: what the MVP ships with, and what comes next ---------------- */
const V1 = [
  ["One corridor", "Delhi Airport T3 arrivals → Gurugram: Cyber City, Golf Course Road, Sohna Road."],
  ["Shared cabs, 2–4 riders", "Booked through a partner fleet. No new cars on the road."],
  ["Matching that respects your limits", "Route, arrival window, seats, luggage, wait and detour, checked before anyone is grouped."],
  ["Fare split shown upfront", "₹450 solo becomes about ₹150 each when three share (illustrative). Your share is on screen before you join. No surge."],
  ["Safety built in", "First names only, explicit consent, Help on every screen."],
];
const NEXT = ["Flight-status sync for delays", "In-app payment & auto-split", "Rides to the airport", "More corridors: T1, Noida, South Delhi", "Women-only groups"];

/** Drag the divider: one rider paying for the whole car vs three sharing it. */
function SoloShared() {
  const [v, setV] = useState(50);
  const dot = (c: string) => <span className={`h-9 w-9 rounded-full border-2 border-[#07140f] md:h-11 md:w-11 ${c}`} />;
  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <div className="relative h-44 overflow-hidden rounded-2xl ring-1 ring-white/10 md:h-52">
        {/* shared (underneath) */}
        <div className="absolute inset-0 flex items-center justify-end gap-6 bg-[#10261f] px-6 text-right md:px-10">
          <div>
            <p className="mono text-[10px] text-muted">SHARED · 3 RIDERS · ONE CAR</p>
            <p className="font-display text-5xl text-flare md:text-6xl">₹150 <span className="text-2xl text-text/70">each</span></p>
          </div>
          <div className="flex -space-x-3">{dot("bg-[#5b7f73]")}{dot("bg-[#c9a063]")}{dot("bg-[#f1ede3]")}</div>
        </div>
        {/* solo (on top, clipped to the divider) */}
        <div className="absolute inset-0 flex items-center gap-6 bg-[#f4f1ea] px-6 text-[#0e211c] md:px-10" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }}>
          <div className="flex">{dot("bg-[#0b2a23]")}</div>
          <div>
            <p className="mono text-[10px] text-[#59615c]">SOLO · 1 RIDER · WHOLE CAR</p>
            <p className="font-display text-5xl md:text-6xl">₹450</p>
          </div>
        </div>
        {/* divider */}
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#c9a063]" style={{ left: `${v}%` }} aria-hidden>
          <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#c9a063] text-[#07140f] shadow-lg">⇆</span>
        </div>
        <input type="range" min={5} max={95} value={v} onChange={(e) => setV(+e.target.value)} aria-label="Compare solo and shared fare" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
      </div>
      <p className="mt-3 text-center text-[10px] text-muted">Drag to compare · illustrative fares from the pitch, not live quotes</p>
    </div>
  );
}

export function LaunchScope() {
  // the pass tilts toward the pointer and a foil highlight follows it
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty("--rx", `${(0.5 - y) * 7}deg`);
    e.currentTarget.style.setProperty("--ry", `${(x - 0.5) * 9}deg`);
    e.currentTarget.style.setProperty("--mx", `${x * 100}%`);
    e.currentTarget.style.setProperty("--my", `${y * 100}%`);
  };
  const untilt = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };
  return (
    <section id="mvp" className="mood-night relative overflow-hidden" aria-labelledby="mvp-title">
      {/* soft brass light behind the pass */}
      <div className="pointer-events-none absolute left-1/2 top-[38%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,160,99,0.16),transparent_62%)]" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 py-28 md:px-10 md:py-40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="label">Launch scope</p>
          <h2 id="mvp-title" className="display display-xl mx-auto mt-5 max-w-[15ch] text-[clamp(2.4rem,5vw,4.4rem)]">Small on purpose. <span className="serif-word foil">One</span> corridor, done well.</h2>
        </div>

        <div className="pass-tilt mx-auto mt-16 max-w-3xl md:mt-20" onPointerMove={tilt} onPointerLeave={untilt}>
          <LaunchTicket />
        </div>

        <SoloShared />

        <ol className="mx-auto mt-20 grid max-w-6xl gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {V1.map(([t, d], i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="border-t border-text/15 pt-5"
            >
              <span className="mono text-xs text-flare">0{i + 1}</span>
              <p className="mt-3 font-display text-xl leading-tight">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The MVP as a boarding pass: v1 limits on the ticket, the roadmap on the tear-off stub. */
function LaunchTicket() {
  const reduced = useReduced();
  const card = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: card, offset: ["start 40%", "end start"] });
  const tear = useSpring(useTransform(scrollYProgress, [0.25, 0.9], reduced ? [0, 0] : [0, -5]), { stiffness: 70, damping: 16 });
  const tearY = useSpring(useTransform(scrollYProgress, [0.25, 0.9], reduced ? [0, 0] : [0, 22]), { stiffness: 70, damping: 16 });
  const field = (k: string, v: string) => (
    <div key={k}>
      <dt className="mono text-[10px] text-night/55">{k}</dt>
      <dd className="mono mt-0.5 text-base font-medium text-night">{v}</dd>
    </div>
  );
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 40, rotate: -2 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      ref={card}
      className="mood-paper paper relative rounded-[22px] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.06)]"
    >
      {/* header strip */}
      <div className="flex items-center justify-between rounded-t-[22px] bg-night px-6 py-4 text-paper md:px-9">
        <span className="flex items-center gap-2.5 font-brand text-2xl font-bold"><Mark size={24} stem="#f1ede3" foil /><span className="foil">AirPool</span></span>
        <span className="mono text-[10px] tracking-widest text-[#d9b77a]">LAUNCH PASS · MVP</span>
      </div>

      <div className="relative px-6 pb-7 pt-6 md:px-9 md:pb-9 md:pt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="mono text-[10px] text-night/55">FROM</p>
            <p className="text-6xl font-bold tracking-[-0.05em] text-night md:text-8xl">DEL</p>
            <p className="mono text-[10px] text-night/55">T3 · ARRIVALS</p>
          </div>
          <svg viewBox="0 0 90 24" className="mb-7 w-20 text-flare md:w-40" aria-hidden>
            <path d="M2 12h70" stroke="currentColor" strokeDasharray="3 4" />
            <path d="M74 12l-6-6h4l8 6-8 6h-4z" fill="currentColor" />
          </svg>
          <div className="text-right">
            <p className="mono text-[10px] text-night/55">TO</p>
            <p className="text-6xl font-bold tracking-[-0.05em] text-night md:text-8xl">GGN</p>
            <p className="mono text-[10px] text-night/55">GURUGRAM</p>
          </div>
        </div>
        <dl className="mt-7 grid grid-cols-3 gap-x-4 gap-y-5 border-t border-dashed border-night/20 pt-6 md:grid-cols-6">
          {field("FLIGHT", "AP 001")}
          {field("CLASS", "Shared")}
          {field("GATE", "Pillar 4")}
          {field("SEATS", "2–4 / car")}
          {field("MAX DETOUR", "10 min")}
          {field("MAX WAIT", "15 min")}
        </dl>
        {/* stamp */}
        <motion.span
          initial={reduced ? false : { scale: 2.2, opacity: 0, rotate: -30 }}
          whileInView={{ scale: 1, opacity: 1, rotate: -14 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7, type: "spring", stiffness: 260, damping: 15 }}
          className="mono pointer-events-none absolute left-[40%] top-[10px] max-md:hidden rounded-md border-[3px] border-flare px-3 py-1 text-sm font-bold tracking-widest text-flare opacity-80 md:top-[20px] md:text-base"
          aria-hidden
        >
          BOARDING · MVP
        </motion.span>
      </div>

      {/* perforation */}
      <div className="relative border-t-2 border-dashed border-night/15">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#07140f]" aria-hidden />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#07140f]" aria-hidden />
      </div>

      {/* stub: the roadmap — tears away along the perforation as you scroll past */}
      <motion.div style={{ rotate: tear, y: tearY, transformOrigin: "0% 0%" }} className="paper rounded-b-[22px] px-6 pb-7 pt-6 shadow-[0_-1px_0_rgba(15,61,52,0.08)] md:px-9">
        <p className="mono text-[10px] text-night/55">NEXT DESTINATIONS · AFTER LAUNCH</p>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-night/80 md:grid-cols-2">
          {NEXT.map((n, i) => (
            <li key={n} className="flex items-center gap-3">
              <span className="mono w-10 shrink-0 text-[10px] text-flare">AP {String(i + 2).padStart(3, "0")}</span>
              {n}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex h-10 items-end gap-[2px]" aria-hidden>
          {Array.from({ length: 64 }, (_, i) => <span key={i} className="bg-night" style={{ width: (i * 7) % 5 === 0 ? 3 : 1.5, height: `${55 + ((i * 37) % 45)}%` }} />)}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Draws the early-access pass to a canvas and downloads it as a PNG. Runs entirely in the browser. */
function savePass(position: number, area: string) {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 630;
  const x = c.getContext("2d")!;
  const sans = getComputedStyle(document.body).fontFamily;
  x.fillStyle = "#07140f";
  x.fillRect(0, 0, 1200, 630);
  x.fillStyle = "#f4f1ea";
  x.beginPath();
  x.roundRect(60, 60, 1080, 510, 28);
  x.fill();
  x.fillStyle = "#0b2a23";
  x.beginPath();
  x.roundRect(60, 60, 1080, 96, [28, 28, 0, 0]);
  x.fill();
  x.fillStyle = "#d9b77a";
  x.font = `700 40px ${sans}`;
  x.fillText("AirPool", 104, 122);
  x.font = `500 20px ${sans}`;
  x.textAlign = "right";
  x.fillText("EARLY ACCESS PASS", 1096, 118);
  x.textAlign = "left";
  x.fillStyle = "#59615c";
  x.font = `500 22px ${sans}`;
  x.fillText("YOUR PLACE", 104, 226);
  x.fillStyle = "#0e211c";
  x.font = `700 230px ${sans}`;
  x.fillText(`#${position}`, 96, 440);
  x.textAlign = "right";
  x.fillStyle = "#59615c";
  x.font = `500 22px ${sans}`;
  x.fillText("CORRIDOR", 1096, 226);
  x.fillStyle = "#0e211c";
  x.font = `700 54px ${sans}`;
  x.fillText(`DEL T3 → ${area}`, 1096, 292);
  x.fillStyle = "#8a6128";
  x.font = `500 26px ${sans}`;
  x.fillText("Many travellers · One ride", 1096, 510);
  const a = document.createElement("a");
  a.download = `airpool-pass-${position}.png`;
  a.href = c.toDataURL("image/png");
  a.click();
}

/* ---------------- Early-access waitlist (posts to /api/waitlist) ---------------- */
export function Waitlist() {
  const [email, setEmail] = useState("");
  const [area, setArea] = useState<Area>("Cyber City");
  const [frequency, setFrequency] = useState<Signup["frequency"]>("A few times a year");
  const [arrival, setArrival] = useState<Signup["arrival"]>("Evening");
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; position: number; existing: boolean } | { kind: "error"; msg: string }>({ kind: "idle" });
  const [shared, setShared] = useState("");
  // the cheapest growth loop: native share sheet on phones, copy link elsewhere
  const shareAirPool = async () => {
    const data = { title: "AirPool", text: "Shared rides from Delhi Airport T3 to Gurugram. Early access is open.", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); setShared("Link copied."); }
    } catch { /* share sheet dismissed */ }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, area, frequency, arrival }) });
      const data = await res.json();
      setState(res.ok ? { kind: "done", position: data.position, existing: data.existing } : { kind: "error", msg: data.error ?? "Something went wrong." });
      if (res.ok && !data.existing) track("Waitlist signup", { area, arrival, frequency });
    } catch {
      setState({ kind: "error", msg: "Couldn't reach the server. Try again." });
    }
  };
  if (state.kind === "done")
    return (
      <motion.div initial={{ opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 16 }} className="mt-10 max-w-lg" role="status">
        <div className="mood-paper paper overflow-hidden rounded-[20px] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between bg-[#0b2a23] px-6 py-3 text-[#f1ede3]">
            <span className="flex items-center gap-2 font-brand text-lg font-bold"><Mark size={18} stem="#f1ede3" foil /><span className="foil">AirPool</span></span>
            <span className="mono text-[10px] tracking-widest text-[#d9b77a]">{state.existing ? "ALREADY ON THE LIST" : "EARLY ACCESS PASS"}</span>
          </div>
          <div className="flex items-end justify-between px-6 pb-5 pt-5">
            <div>
              <p className="mono text-[10px] text-muted">YOUR PLACE</p>
              <p className="font-display text-7xl leading-none">#{state.position}</p>
            </div>
            <div className="text-right">
              <p className="mono text-[10px] text-muted">CORRIDOR</p>
              <p className="font-display text-2xl">DEL T3 → {area}</p>
              <p className="mono mt-1 text-[10px] text-muted">LANDS {arrival.toUpperCase()}</p>
            </div>
          </div>
          <p className="border-t border-dashed border-text/20 px-6 py-3 text-sm text-muted">We&apos;ll email {email.trim().toLowerCase()} when the corridor opens.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => savePass(state.position, area)} className="btn btn-primary">Save pass as image</button>
          <button type="button" onClick={shareAirPool} className="btn btn-ghost">Share AirPool <span aria-hidden>↗</span></button>
        </div>
        {shared && <p className="mt-2 text-xs text-muted">{shared}</p>}
      </motion.div>
    );
  return (
    <form id="waitlist" onSubmit={submit} className="mt-10 max-w-lg scroll-mt-28" noValidate>
      <p className="label">Early access · DEL T3 → Gurugram</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="wl-email">Email</label>
        <input id="wl-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="field" aria-invalid={state.kind === "error"} aria-describedby="wl-msg" />
        <label className="sr-only" htmlFor="wl-area">Heading to</label>
        <select id="wl-area" value={area} onChange={(e) => setArea(e.target.value as Area)} className="field sm:w-48">
          {AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted">
          How often do you fly into Delhi?
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Signup["frequency"])} className="field mt-1">
            {FREQUENCY.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          You usually land in the…
          <select value={arrival} onChange={(e) => setArrival(e.target.value as Signup["arrival"])} className="field mt-1">
            {ARRIVAL.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <button type="submit" disabled={state.kind === "busy"} className="btn btn-primary mt-3 w-full">{state.kind === "busy" ? "Joining…" : <>Get early access <span aria-hidden>→</span></>}</button>
      <p id="wl-msg" className={`mt-2 min-h-5 text-sm ${state.kind === "error" ? "text-bad" : "text-muted"}`} role={state.kind === "error" ? "alert" : undefined}>
        {state.kind === "error" ? state.msg : <>Used only to plan the launch and tell you when it opens. <a href="/privacy" className="underline underline-offset-2 hover:text-text">Privacy</a></>}
      </p>
    </form>
  );
}

/* ---------------- Mobile: slim sticky "Get early access" bar ---------------- */
// Appears once the hero has scrolled away; hides while the waitlist form or the booking demo is on screen.
export function MobileCta() {
  const [past, setPast] = useState(false);
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const visible = new Set<Element>();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      setCovered(visible.size > 0);
    });
    ["#waitlist", "#book", "footer"].forEach((s) => { const el = document.querySelector(s); if (el) io.observe(el); });
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);
  const show = past && !covered;
  return (
    <div className={`fixed inset-x-3 bottom-3 z-40 transition-[transform,opacity] duration-300 md:hidden ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0"}`} aria-hidden={!show}>
      <a href="#waitlist" tabIndex={show ? 0 : -1} onClick={() => track("Mobile CTA tapped")} className="flex min-h-[3.75rem] items-center justify-between gap-3 rounded-2xl bg-night px-5 text-[1.05rem] text-paper shadow-[0_18px_40px_-16px_rgba(15,61,52,0.6)]">
        <span className="flex items-center gap-2.5">
          <Mark size={20} stem="#f7f7f4" />
          <span className="leading-tight"><span className="block text-sm font-semibold">Get early access</span><span className="block text-[11px] text-paper/70">DEL T3 → Gurugram</span></span>
        </span>
        <span aria-hidden className="text-lg">→</span>
      </a>
    </div>
  );
}
