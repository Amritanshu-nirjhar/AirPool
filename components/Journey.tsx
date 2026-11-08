"use client";
// Opening narrative: hero → A (arrival) → B (problem) → C (connection), one sticky WebGL stage.
import { scrollToY } from "@/lib/scroll";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import RouteSvg from "./RouteSvg";
import { Flap, Magnetic, useReduced } from "./ui";
import { ROUTES } from "@/lib/geo";
import { useT } from "./i18n";

const JourneyScene = dynamic(() => import("./three/JourneyScene"), { ssr: false });

const HEIGHT_VH = 760;
/** Panels: [fade-in start, fade-out end] in journey progress. */
const PANELS = { hero: [-1, 0.07], A: [0.09, 0.2], B: [0.47, 0.625], C: [0.665, 0.8], D: [0.885, 1.5] } as const;
const CHAPTERS = [
  { id: "A", label: "Arrival", at: 0.1 },
  { id: "B", label: "The problem", at: 0.47 },
  { id: "C", label: "The connection", at: 0.67 },
  { id: "D", label: "One road", at: 0.89 },
];
const anchorTop = (p: number) => `${p * (HEIGHT_VH - 100)}vh`;

export default function Journey() {
  const reduced = useReduced();
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const rail = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [booted, setBooted] = useState(false);
  const [ready, setReady] = useState(false);
  const t = useT();
  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), reduced ? 0 : 1200);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const apply = (p: number) => {
      progress.current = p;
      for (const [k, [a, b]] of Object.entries(PANELS)) {
        const node = section.current?.querySelector<HTMLElement>(`[data-panel="${k}"]`);
        if (!node) continue;
        const fin = a < 0 ? 1 : gsap.utils.clamp(0, 1, (p - a) / 0.03);
        const fout = gsap.utils.clamp(0, 1, (b - p) / 0.03);
        const o = Math.min(fin, fout);
        node.style.opacity = String(o);
        node.style.transform = `translate3d(0, ${(1 - fin) * 30 - (1 - fout) * 30}px, 0)`;
        node.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      rail.current?.style.setProperty("--p", String(p));
      if (rail.current) rail.current.style.opacity = String(gsap.utils.clamp(0, 1, (p - 0.06) * 20));
      rail.current?.querySelectorAll<HTMLElement>("[data-at]").forEach((n) => n.toggleAttribute("data-active", p >= +n.dataset.at! - 0.02));
    };
    apply(0);
    const st = ScrollTrigger.create({ trigger: section.current, start: "top top", end: "bottom bottom", onUpdate: (s) => apply(s.progress) });
    return () => st.kill();
  }, []);

  // jump within the pinned story (p = journey progress 0..1)
  const goTo = (p: number) => {
    const el = section.current!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    scrollToY(top + p * (el.offsetHeight - window.innerHeight));
  };

  const board: [string, string, string?][] = [
    ["From", "DEL T3 GATE 4"],
    ["To", "CYBER CITY"],
    ["Road distance", `${(ROUTES.solo.distanceM / 1000).toFixed(1)} KM`],
    ["Free-flow time", `${Math.round(ROUTES.solo.durationS / 60)} MIN`],
    ["Travellers", "3 MATCHED", "Simulated"],
    ["Est. share", "₹150 / PERSON", "Illustrative"],
  ];
  const reveal = (i: number) => ({
    className: "block transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)]",
    style: { transform: booted ? "none" : "translateY(105%)", opacity: booted ? 1 : 0, transitionDelay: `${i * 110}ms` },
  });

  return (
    <section ref={section} id="top" className="relative" style={{ height: `${HEIGHT_VH}vh` }} aria-label="AirPool story: from arrival to shared ride">
      <div id="problem" className="absolute" style={{ top: anchorTop(0.5) }} />
      <div id="connection" className="absolute" style={{ top: anchorTop(0.7) }} />

      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0">
          {failed ? <RouteSvg routeKey="solo" className="h-full w-full opacity-50" /> : <JourneyScene progress={progress} reduced={reduced} onFail={onFail} onReady={onReady} />}
          {/* poster: instant first paint while the 3D world builds, then cross-fades away */}
          {!failed && (
            <Image src="/journey-poster.jpg" alt="" fill priority sizes="100vw" aria-hidden className={`pointer-events-none object-cover object-[70%_50%] transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />
          )}
        </div>

        {/* Progress rail */}
        <div ref={rail} className="absolute right-5 top-1/2 hidden -translate-y-1/2 md:block" style={{ ["--p" as string]: 0 }}>
          <div className="relative h-48 w-px bg-text/10">
            <div className="absolute inset-x-0 top-0 bg-flare" style={{ height: "calc(var(--p) * 100%)" }} />
          </div>
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-at={c.at}
              onClick={() => goTo(c.at + 0.02)}
              className="absolute right-3 flex min-h-8 -translate-y-1/2 items-center gap-2 whitespace-nowrap font-mono text-[11px] text-muted/60 transition-colors hover:text-text data-[active]:text-text"
              style={{ top: `${c.at * 192}px` }}
            >
              {c.label}
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            </button>
          ))}
        </div>

        <a href="#map" className="glass absolute bottom-5 right-5 z-10 hidden min-h-10 items-center gap-2 rounded-full px-4 text-xs text-text hover:bg-paper md:flex">Skip intro ↓</a>

        {/* HERO */}
        <div data-panel="hero" className="absolute inset-0 flex flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_22%,rgba(244,241,234,0.9)_48%,rgba(244,241,234,0.96)_100%)] md:bg-[linear-gradient(90deg,rgba(244,241,234,0.92)_0%,rgba(244,241,234,0.55)_40%,transparent_68%)]" />
          <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-5 pt-24 md:justify-center md:px-10">
            <h1 className="display text-[clamp(3rem,8vw,7.6rem)] md:mt-7">
              {[t("hero1"), t("hero2"), t("hero3")].map((l, i) => (
                <span key={i} className="block overflow-hidden pb-[0.08em]">
                  <span {...reveal(i + 1)}>{i < 2 ? <span className="text-[#8b857a]">{l}</span> : <span>{l}</span>}</span>
                </span>
              ))}
            </h1>
            <div {...reveal(4)} className={`${reveal(4).className} mt-8`}>
              <p className="max-w-[33rem] text-[0.95rem] leading-relaxed text-muted md:text-lg">
                {t("heroSub")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-10">
                <Magnetic><a href="#waitlist" className="btn btn-primary">{t("ctaAccess")} <span aria-hidden>→</span></a></Magnetic>
                <a href="#book" className="btn btn-ghost">{t("ctaDemo")}</a>
              </div>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-7 md:px-10">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 border-t border-text/10 pt-4 md:gap-x-6 md:gap-y-4 md:pt-5 lg:grid-cols-6">
              {board.map(([k, v, note], i) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="mono mt-1 text-[0.8rem] text-text md:mt-1.5 md:text-[0.95rem]">
                    <Flap text={v} delay={1.6 + i * 0.12} reduced={reduced} />
                    {note && <span className="label mt-1 block !text-[0.7rem] !text-warn/80">{note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="label mt-4 hidden md:block">Scroll to land ↓</p>
          </div>
        </div>

        {/* A — Arrival */}
        <div data-panel="A" className="pointer-events-none absolute inset-x-0 bottom-[12vh] mx-auto max-w-7xl px-5 md:px-10">
          <p className="label">Arrival</p>
          <h2 className="display mt-4 max-w-[14ch] text-[clamp(2.4rem,5.6vw,5rem)]">Your journey doesn&apos;t end at the airport.</h2>
          <p className="mt-5 max-w-md text-muted">You land at Terminal 3. Cyber City is still {(ROUTES.solo.distanceM / 1000).toFixed(1)} km of road away — and most people cover it alone.</p>
        </div>

        {/* B — Problem */}
        <div data-panel="B" className="pointer-events-none absolute inset-x-0 bottom-0 top-auto md:inset-y-0 md:left-auto md:right-0 md:w-[min(520px,42vw)]">
          <div className="flex h-full flex-col justify-end bg-gradient-to-t from-ink via-ink/90 to-transparent px-5 pb-10 pt-24 md:justify-center md:bg-gradient-to-l md:from-ink md:via-ink/95 md:px-10 md:pb-0">
            <p className="label">The problem</p>
            <h2 className="display mt-4 text-[clamp(2.1rem,4.2vw,3.8rem)]">Thousands land. Everyone travels alone.</h2>
            <ul className="mt-7 space-y-3 text-[0.95rem] text-muted">
              {["Airport taxis can be expensive.", "Surge pricing makes costs unpredictable.", "Public transport may not reach the final destination.", "Travellers heading the same way can't find each other."].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2.5 h-px w-4 shrink-0 bg-sodium" aria-hidden />{t}</li>
              ))}
            </ul>
            <div className="mt-8 border-t border-text/10 pt-5">
              <p className="mono text-3xl text-text">78.7M</p>
              <p className="label mt-1">annual passengers at DEL · pitch figure, unverified</p>
            </div>
          </div>
        </div>

        {/* C — Connection */}
        <div data-panel="C" className="pointer-events-none absolute inset-x-0 top-24 isolate mx-auto max-w-7xl px-5 md:top-28 md:px-10">
          <div className="absolute -top-28 bottom-[-9rem] left-1/2 -z-10 w-screen -translate-x-1/2 bg-gradient-to-b from-ink via-ink/85 to-transparent" aria-hidden />
          <p className="label">The connection</p>
          <h2 className="display mt-4 max-w-[16ch] text-[clamp(2.2rem,5vw,4.6rem)]">What if your route was already someone&apos;s route?</h2>
          <p className="mt-5 max-w-md text-muted">Every light is a traveller. AirPool links the ones who fit, three to a car.</p>
        </div>

        {/* D — One road */}
        <div data-panel="D" className="pointer-events-none absolute inset-x-0 bottom-0 isolate">
          <div className="absolute inset-x-0 -top-24 bottom-0 -z-10 bg-gradient-to-t from-ink via-ink/80 to-transparent" aria-hidden />
          <div className="mx-auto max-w-7xl px-5 pb-12 md:px-10 md:pb-16">
            <p className="label">One road</p>
            <h2 className="display mt-4 max-w-[18ch] text-[clamp(2.2rem,5vw,4.6rem)]">Thousands of lights. One shared road home.</h2>
            <p className="mt-5 max-w-lg text-muted">One car per group down the real {(ROUTES.solo.distanceM / 1000).toFixed(1)} km road to Cyber City. <span className="mono text-xs text-warn">Simulated groups · illustrative fare</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}
