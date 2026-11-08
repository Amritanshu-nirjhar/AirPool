"use client";
// Site-wide finish: Lenis inertial scrolling, the logo loader, a brass cursor (desktop), film grain and chart grid lines.
import Lenis from "lenis";
import { useEffect, useRef } from "react";
import { useReduced } from "./ui";

export default function Chrome() {
  const reduced = useReduced();
  const dot = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);

  // Smooth, weighted scrolling. Native scroll stays the source of truth, so sticky sections and ScrollTrigger keep working.
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -64 }, autoRaf: true });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    return () => {
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, [reduced]);

  // Brass cursor dot: grows over interactive things, says "Drag" over the maps. Fine pointers only.
  useEffect(() => {
    if (reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const el = dot.current!;
    let x = -100, y = -100, tx = -100, ty = -100, raf = 0;
    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const t = e.target as Element;
      const map = t.closest?.(".maplibregl-canvas-container");
      const hot = !map && t.closest?.("a, button, select, summary, input, label, [role=radio], [role=tab]");
      el.dataset.mode = map ? "drag" : hot ? "hot" : "";
      tag.current!.textContent = map ? "Drag" : "";
    };
    const loop = () => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    el.style.display = "grid";
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <>
      <div className="chart-grid" aria-hidden />
      <div className="grain" aria-hidden />
      <div ref={dot} className="cursor-dot" aria-hidden><span ref={tag} /></div>
      {/* Loader: the logo mark draws itself while the 3D world builds */}
      <div className="loader" aria-hidden>
        <svg width="64" height="80" viewBox="0 0 40 50" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path className="loader-path" pathLength={1} d="M5 46 C5 36 19 33 20 24 M35 46 C35 36 21 33 20 24" stroke="#c9a063" strokeWidth="3" />
          <path className="loader-path loader-path-2" pathLength={1} d="M20 46 V5 M12 13 L20 5 L28 13" stroke="#f1ede3" strokeWidth="3" />
        </svg>
        <p className="loader-word">AirPool</p>
      </div>
    </>
  );
}
