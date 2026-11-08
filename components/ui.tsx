"use client";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export function SimBadge({ children = "Simulated", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-warn ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
      {children}
    </span>
  );
}

export function SectionHead({ eyebrow, title, children, id }: { eyebrow: string; title: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <header className="max-w-3xl">
      <p className="eyebrow mb-5">{eyebrow}</p>
      <h2 id={id} className="display text-[clamp(2.4rem,6vw,5rem)] text-balance">{title}</h2>
      {children && <div className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

/** Number that counts to `value` when scrolled into view (instant with reduced motion). */
export function Counter({ value, format = (n) => String(Math.round(n)), className = "" }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: false, margin: "-10%" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (!inView) return;
    if (reduced) { prev.current = value; return; }
    const c = animate(prev.current, value, { duration: 0.8, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    prev.current = value;
    return () => c.stop();
  }, [value, inView, reduced]);
  return <span ref={ref} className={`num ${className}`}>{format(reduced ? value : shown)}</span>;
}

/** Subtle magnetic pull toward the pointer (fine pointers only, disabled for reduced motion). */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const move = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
  };
  const leave = () => ref.current && (ref.current.style.transform = "");
  return (
    <span ref={ref} onPointerMove={move} onPointerLeave={leave} className="inline-block transition-transform duration-300 ease-out">
      {children}
    </span>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** Split-flap style text: characters cycle briefly before settling (static with reduced motion). */
export function Flap({ text, delay = 0, reduced }: { text: string; delay?: number; reduced: boolean }) {
  const [out, setOut] = useState(reduced ? text : text.replace(/[^\s]/g, " "));
  useEffect(() => {
    if (reduced) return;
    let frame = 0, raf = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      if (now >= start) {
        frame++;
        setOut(text.split("").map((c, i) => (c === " " || frame > 6 + i * 1.2 ? c : GLYPHS[(frame * 7 + i * 13) % GLYPHS.length])).join(""));
        if (frame > 8 + text.length * 1.2) return setOut(text);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, reduced]);
  return <span aria-label={text}><span aria-hidden>{reduced ? text : out}</span></span>;
}


const motionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
/** prefers-reduced-motion, hydration-safe (false on the server and during hydration). */
export function useReduced(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = motionQuery(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => motionQuery().matches,
    () => false,
  );
}
