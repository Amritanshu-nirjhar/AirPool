"use client";
import Link from "next/link";
import { setLang, useLang } from "./i18n";
import { track } from "@/lib/track";
import { useEffect, useId, useRef, useState } from "react";

const LINKS = [
  ["How it works", "#map"],
  ["MVP", "#mvp"],
  ["Safety", "#safety"],
  ["Demo", "#book"],
  ["Matching", "#engine"],
  ["FAQ", "#faq"],
] as const;

/** AirPool "Converge" mark: two brass paths merge into one rising arrow — many travellers, one ride. */
export function Mark({ size = 28, stem = "#0b2a23", brass = "#b8935a", foil = false }: { size?: number; stem?: string; brass?: string; foil?: boolean }) {
  const id = useId();
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 40 50" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {foil && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8a6128" /><stop offset=".35" stopColor="#f3dda6" /><stop offset=".6" stopColor="#b58a48" /><stop offset="1" stopColor="#e7c98d" />
          </linearGradient>
        </defs>
      )}
      <path d="M5 46 C5 36 19 33 20 24 M35 46 C35 36 21 33 20 24" stroke={foil ? `url(#${id})` : brass} strokeWidth="3.6" />
      <path d="M20 46 V5 M12 13 L20 5 L28 13" stroke={stem} strokeWidth="3.6" />
    </svg>
  );
}

export function Logo({ tagline = false, light = false }: { tagline?: boolean; light?: boolean }) {
  return (
    <Link href="/#top" aria-label="AirPool home" className="flex items-center gap-2.5">
      <Mark stem={light ? "#f1ede3" : "#0b2a23"} />
      <span className="flex flex-col">
        <span className={`font-brand text-[1.45rem] font-bold leading-none tracking-[-0.02em] ${light ? "text-[#f1ede3]" : "text-[#0b2a23]"}`}>AirPool</span>
        {tagline && <span className="mt-1.5 font-sans text-[9px] font-medium uppercase tracking-[0.28em] text-sodium">Many travellers · One ride</span>}
      </span>
    </Link>
  );
}

export default function Nav() {
  const lang = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]); // screen readers switch voice with the toggle
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = () => {
      const y = window.scrollY;
      setSolid(y > 40);
      // hide while reading down, return on any upward scroll
      if (y > lastY.current + 8 && y > 240) setHidden(true);
      else if (y < lastY.current - 8) setHidden(false);
      lastY.current = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? window.scrollY / max : 0})`);
    };
    f();
    window.addEventListener("scroll", f, { passive: true });
    // highlight the section currently in the middle of the viewport
    const seen = new Set<string>();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      setActive(`#${e.target.id}`);
      if (!seen.has(e.target.id)) { seen.add(e.target.id); track("Section viewed", { section: e.target.id }); } // scroll depth
    }), { rootMargin: "-45% 0px -50% 0px" });
    LINKS.forEach(([, h]) => { const el = document.querySelector(h); if (el) io.observe(el); });
    return () => { window.removeEventListener("scroll", f); io.disconnect(); };
  }, []);
  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-[background-color,transform] duration-300 ${solid || open ? "glass !border-x-0 !border-t-0" : ""} ${hidden && !open ? "-translate-y-full" : ""}`} aria-label="Main" onFocus={() => setHidden(false)}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
        <Logo />
        <ul className="hidden items-center gap-7 text-sm text-muted lg:flex">
          {LINKS.map(([l, h]) => (
            <li key={h}>
              <a href={h} aria-current={active === h ? "location" : undefined} className="relative transition-colors hover:text-text aria-[current]:text-text">
                {l}
                <span className={`absolute -bottom-1.5 left-0 h-px w-full origin-left bg-flare transition-transform duration-300 ${active === h ? "scale-x-100" : "scale-x-0"}`} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "hi" ? "en" : "hi")}
            className="btn btn-ghost !min-h-10 !px-3 text-sm"
            aria-label={lang === "hi" ? "Switch to English" : "हिन्दी में देखें"}
            lang={lang === "hi" ? "en" : "hi"}
          >
            {lang === "hi" ? "EN" : "हिन्दी"}
          </button>
          <a href="#waitlist" className="btn btn-primary !min-h-10 !px-4 text-sm">Early access</a>
          <button className="btn btn-ghost !min-h-10 !px-3 lg:hidden" aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)}>
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d={open ? "M3 3l12 12M15 3L3 15" : "M2 5h14M2 13h14"} stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
        </div>
      </div>
      <div ref={bar} className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-flare" style={{ transform: "scaleX(0)" }} aria-hidden />
      {open && (
        <ul id="mnav" className="px-5 pb-5 lg:hidden">
          {LINKS.map(([l, h]) => (
            <li key={h}><a href={h} onClick={() => setOpen(false)} className="block py-3 text-lg">{l}</a></li>
          ))}
        </ul>
      )}
    </nav>
  );
}
