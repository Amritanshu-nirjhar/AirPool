"use client";
// The AirPool experience: one pinned stage. Real map full-bleed behind; a step panel on the left; a 3D AirPool phone on
// the right showing what the traveller sees at each moment. Scroll drives the step (and the map camera).
import { scrollToY } from "@/lib/scroll";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OPEN_GROUPS, SOLO_BASE_FARE } from "@/lib/demo-data";
import { PLACES, ROUTES, inr } from "@/lib/geo";
import { estimateShare } from "@/lib/matching";
import { SimBadge, useReduced } from "./ui";
import { Mark } from "./Nav";

const CorridorMap = dynamic(() => import("./CorridorMap"), { ssr: false });
const GROUP = OPEN_GROUPS[0];
const RIDERS = [...GROUP.members.map((m) => ({ name: m.name, dest: m.destination })), { name: "You", dest: "cyberCity" as const }];
const AV = ["bg-taxi", "bg-flare", "bg-night"];
const PAD = { top: 90, right: 440, bottom: 90, left: 480 };

/** Mounts children only once near the viewport (keeps WebGL contexts lazy). */
export function LazyMount({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { rootMargin: "800px" });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className}>{on ? children : <div className="h-full w-full bg-ink-2" />}</div>;
}

const STEPS: { kicker: string; title: string; body: ReactNode }[] = [
  { kicker: "Landed", title: "You touch down at T3.", body: <>AirPool starts scanning the Delhi Airport → Cyber City corridor the moment you land.</> },
  { kicker: "Nearby", title: "Others are heading your way.", body: <>Travellers on the same road, landing minutes apart, each about to pay for a whole car. <SimBadge className="ml-1 align-middle">Simulated riders</SimBadge></> },
  { kicker: "Matched", title: "Three become one group.", body: <>Route, timing, seats, luggage and detour all pass. One pickup: <span className="text-text">{GROUP.pickupPoint}</span>.</> },
  { kicker: "Ride", title: "One car. A fair share each.", body: <>Drops in route order — {GROUP.dropOrder.map((d) => PLACES[d].short).join(" → ")}. Tap any marker on the map.</> },
];

export default function MapStory() {
  const [step, setStep] = useState(0);
  const section = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (s) => {
        setStep(Math.min(3, Math.floor(s.progress * 4)));
        bar.current?.style.setProperty("transform", `scaleY(${s.progress})`);
        section.current?.style.setProperty("--sp", s.progress.toFixed(3)); // phone turns slowly as you scroll
      },
    });
    return () => st.kill();
  }, []);

  const jump = (i: number) => {
    const el = section.current!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    scrollToY(top + ((i + 0.5) / 4) * (el.offsetHeight - window.innerHeight));
  };

  return (
    <section ref={section} id="map" className="relative h-[420vh] border-t border-text/5" aria-labelledby="map-title">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden">
        {/* Real corridor map, full-bleed */}
        <LazyMount className="absolute inset-0">
          <CorridorMap group={GROUP} scene={step} bare pad={PAD} className="h-full w-full" />
        </LazyMount>
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-16 bg-[linear-gradient(90deg,rgba(244,241,234,0.96)_0%,rgba(244,241,234,0.75)_24%,transparent_42%,transparent_66%,rgba(244,241,234,0.7)_82%,rgba(244,241,234,0.92)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(244,241,234,0.35)_0%,transparent_30%,rgba(244,241,234,0.95)_48%)]" />

        {/* Left: heading + steps */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-20 lg:inset-y-0 lg:left-0 lg:right-auto lg:flex lg:w-[440px] lg:flex-col lg:justify-center lg:pb-0 lg:pl-10 xl:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]">
          <p className="label">The AirPool experience</p>
          <h2 id="map-title" className="display mt-3 text-[1.7rem] lg:text-[clamp(2rem,3.4vw,3.2rem)]">Land. Match. <span className="serif-word text-glow">Ride.</span></h2>

          <div className="pointer-events-auto mt-4 flex gap-5 lg:mt-12">
            {/* progress rail */}
            <div className="relative hidden w-px shrink-0 bg-text/10 lg:block" aria-hidden>
              <div ref={bar} className="absolute inset-x-0 top-0 h-full origin-top bg-flare" style={{ transform: "scaleY(0)" }} />
            </div>
            <div className="min-h-[11rem] flex-1">
              <div className="mb-5 flex gap-1.5" role="tablist" aria-label="Experience steps">
                {STEPS.map((s, i) => (
                  <button
                    key={s.kicker}
                    role="tab"
                    aria-selected={step === i}
                    onClick={() => jump(i)}
                    className={`min-h-9 rounded-full border px-3 text-[11px] transition-colors ${step === i ? "border-flare bg-flare text-paper" : "border-text/15 bg-paper/70 text-muted hover:text-text"}`}
                  >
                    0{i + 1} {s.kicker}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -14, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                  <h3 className="font-display text-[1.7rem] leading-tight">{STEPS[step].title}</h3>
                  <p className="mt-3 max-w-sm leading-relaxed text-muted">{STEPS[step].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile: the phone is the main visual (scaled, top-centre); hidden on very short screens */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center lg:hidden [@media(max-height:700px)]:hidden" aria-hidden>
          <div className="origin-top scale-[0.52]">
            <Phone step={step} />
          </div>
        </div>

        {/* Right: the AirPool phone */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[420px] items-center justify-center lg:flex xl:right-[max(0px,calc((100vw-80rem)/2))]">
          <Phone step={step} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- 3D phone ---------------- */
function Phone({ step }: { step: number }) {
  const reduced = useReduced();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced) return;
    const move = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      ref.current?.style.setProperty("--ry", `${-16 + x * 10}deg`);
      ref.current?.style.setProperty("--rx", `${6 - y * 8}deg`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduced]);

  return (
    <div className="relative [perspective:1400px]">
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-10 w-[78%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(11,42,35,0.35),transparent)] blur-md" aria-hidden />
      <motion.div animate={reduced ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
        <div
          ref={ref}
          className="relative h-[600px] w-[292px] rounded-[48px] bg-night p-[11px] shadow-[0_60px_120px_-40px_rgba(15,61,52,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-transform duration-500 ease-out [transform-style:preserve-3d]"
          style={{ transform: "rotateY(calc(var(--ry,-16deg) + var(--sp,0) * 26deg)) rotateX(var(--rx,6deg))" }}
          aria-label="AirPool app preview"
          role="img"
        >
          {/* side buttons + glare */}
          <span className="absolute -left-[3px] top-28 h-14 w-[3px] rounded-l bg-night" aria-hidden />
          <span className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-night" aria-hidden />
          <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-paper">
            <div className="absolute left-1/2 top-2.5 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-night" aria-hidden />
            <div className="flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-night">
              <span>18:22</span>
              <span className="flex items-center gap-1" aria-hidden><span className="h-2 w-3 rounded-sm bg-night/80" /><span className="h-2.5 w-5 rounded-[3px] border border-night/70" /></span>
            </div>
            <div className="px-5 pt-6">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-brand text-[15px] font-bold tracking-tight text-night"><Mark size={16} />AirPool</p>
                <span className="mono rounded-full bg-text/5 px-2 py-0.5 text-[9px] text-muted">DEL T3 → CYB</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                  {[<ScreenLanded key="0" />, <ScreenNearby key="1" />, <ScreenMatch key="2" />, <ScreenRide key="3" />][step]}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[38px] bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.42)_32%,transparent_44%)] bg-[length:260%_100%]" style={{ backgroundPosition: "calc(100% - var(--sp,0) * 100%) 0" }} aria-hidden />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const pop = (i: number) => ({ initial: { opacity: 0, y: 14, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { delay: 0.15 + i * 0.12, type: "spring" as const, stiffness: 260, damping: 22 } });

function ScreenLanded() {
  return (
    <div className="pt-5">
      <p className="font-display text-[26px] leading-tight text-night">Welcome to Delhi.</p>
      <motion.div {...pop(0)} className="mt-4 rounded-2xl bg-night p-4 text-paper">
        <div className="flex justify-between text-[10px] text-paper/60"><span className="mono">6E 2134</span><span className="mono">LANDED 18:16</span></div>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-2xl font-bold tracking-tight">BOM</span>
          <svg viewBox="0 0 60 12" className="mb-2 w-14 text-paper/50" aria-hidden><path d="M1 6h52" stroke="currentColor" strokeDasharray="2 3" /><path d="M50 2l6 4-6 4" fill="none" stroke="currentColor" /></svg>
          <span className="text-2xl font-bold tracking-tight">DEL</span>
        </div>
        <p className="mono mt-2 text-[10px] text-paper/60">TERMINAL 3 · BELT 7 · <span className="text-sign">SIMULATED</span></p>
      </motion.div>
      {/* radar scan */}
      <div className="relative mx-auto mt-7 grid h-44 w-44 place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="absolute inset-0 rounded-full border border-flare/50" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }} />
        ))}
        <motion.span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(166,118,58,0.28),transparent_28%)]" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-night text-[11px] font-semibold text-paper">You</span>
      </div>
      <p className="mt-4 text-center text-[10px] text-muted">Scanning your corridor…</p>
    </div>
  );
}

function ScreenNearby() {
  const rows = [
    ...GROUP.members.map((m, i) => ({ n: m.name, to: PLACES[m.destination].short, at: ["18:25", "18:31"][i] ?? "18:28", c: AV[i] })),
    { n: "Kabir", to: "DLF Ph 3", at: "18:34", c: "bg-sodium" },
  ];
  return (
    <div className="pt-5">
      <p className="font-display text-[24px] leading-tight text-night">On your route right now</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r, i) => (
          <motion.li key={r.n} {...pop(i)} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_18px_-12px_rgba(15,61,52,0.4)]">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-paper ${r.c}`}>{r.n[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-night">{r.n} <span className="font-normal text-muted">→ {r.to}</span></p>
              <p className="mono text-[10px] text-muted">lands {r.at} · solo {inr(SOLO_BASE_FARE)}</p>
            </div>
            <motion.span className="h-2 w-2 rounded-full bg-flare" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} aria-hidden />
          </motion.li>
        ))}
      </ul>
      <motion.p {...pop(4)} className="mt-4 text-center text-[10px] text-muted">+ 44 more requests in the pool · simulated</motion.p>
    </div>
  );
}

function ScreenMatch() {
  return (
    <div className="pt-5">
      <p className="mono text-[10px] text-good">● MATCH FOUND</p>
      <p className="mt-1 font-display text-[24px] leading-tight text-night">Group {GROUP.id} · {RIDERS.length} travellers</p>
      {/* avatars converge into one cluster */}
      <div className="relative mx-auto mt-6 h-24 w-full">
        {RIDERS.map((r, i) => (
          <motion.span
            key={r.name}
            className={`absolute top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full border-[3px] border-paper text-base font-semibold text-paper ${AV[i]}`}
            initial={{ left: `${[2, 40, 76][i]}%`, scale: 0.8 }}
            animate={{ left: `${30 + i * 13}%`, scale: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 120, damping: 14 }}
          >
            {r.name[0]}
          </motion.span>
        ))}
      </div>
      <dl className="mt-3 divide-y divide-text/5 rounded-2xl bg-white px-4 text-[12px] shadow-[0_6px_18px_-12px_rgba(15,61,52,0.4)]">
        {[["Pickup", GROUP.pickupPoint], ["Your detour", "+6 min"], ["Wait", "0 min"], ["Seats · bags", "3/4 · 3/4"]].map(([k, v], i) => (
          <motion.div key={k} {...pop(i + 2)} className="flex justify-between py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold text-night">{v}</dd>
          </motion.div>
        ))}
      </dl>
      <motion.p {...pop(6)} className="mt-3 text-[11px] leading-snug text-muted">Same NH-48 corridor, arrival windows overlap, detour within your 10-min limit.</motion.p>
    </div>
  );
}

function ScreenRide() {
  const share = estimateShare(GROUP.baseFare, RIDERS.length, GROUP.serviceFee);
  const stops = ROUTES[GROUP.routeKey].stops;
  return (
    <div className="pt-5">
      <p className="font-display text-[24px] leading-tight text-night">Your shared ride</p>
      <ol className="relative mt-4 space-y-3 pl-6">
        <motion.span className="absolute bottom-2 left-[7px] top-2 w-[2px] origin-top bg-flare" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} aria-hidden />
        {stops.map((s, i) => {
          const who = RIDERS.filter((r) => r.dest === s).map((r) => r.name).join(", ");
          return (
            <motion.li key={s} {...pop(i)} className="relative text-[12px]">
              <span className={`absolute -left-6 top-0.5 h-4 w-4 rounded-full border-[3px] border-paper ${i === 0 ? "bg-night" : s === "cyberCity" ? "bg-flare" : "bg-taxi"}`} />
              <span className="font-semibold text-night">{i === 0 ? GROUP.pickupPoint : PLACES[s].short}</span>
              <span className="text-muted">{i === 0 ? " · pickup" : who ? ` · ${who}` : ""}</span>
            </motion.li>
          );
        })}
      </ol>
      <motion.div {...pop(4)} className="mt-5 flex items-end justify-between rounded-2xl bg-night p-4 text-paper">
        <div>
          <p className="mono text-[10px] text-paper/60">YOUR SHARE</p>
          <p className="text-3xl font-bold tracking-tight">{inr(share)}</p>
        </div>
        <p className="mono text-sm text-paper/50 line-through">{inr(SOLO_BASE_FARE)}</p>
      </motion.div>
      <motion.a {...pop(5)} href="#book" className="pointer-events-auto mt-3 flex min-h-11 items-center justify-center rounded-2xl bg-flare text-[13px] font-semibold text-paper">
        Try booking it →
      </motion.a>
      <p className="mt-2 text-center text-[9px] text-muted">Simulated group · illustrative fare</p>
    </div>
  );
}
