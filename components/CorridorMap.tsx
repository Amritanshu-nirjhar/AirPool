"use client";
// Interactive MapLibre corridor map. Real tiles (OpenStreetMap via OpenFreeMap) and real OSRM road geometry;
// riders, names and timings on top are simulated demo data.
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import { PLACES, ROUTES, ROUTE_SOURCE, along, bounds, cumulative, slice } from "@/lib/geo";
import type { Group, LngLat, PlaceId } from "@/lib/types";
import RouteSvg from "./RouteSvg";
import { SimBadge } from "./ui";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
const CUSTOM_STYLE = !!process.env.NEXT_PUBLIC_MAP_STYLE_URL;

// Simulated rider start positions around T3 arrivals (offsets in degrees)
const RIDER_OFFSETS: LngLat[] = [[-0.0042, 0.0026], [0.0036, 0.0031], [0.0008, -0.0034]];
const RIDER_COLORS = ["#1f8f87", "#a6763a", "#0f3d34"];

type Camera = { center: LngLat; zoom: number; pitch: number; bearing: number };

export interface CorridorMapProps {
  group: Group;
  youDest?: PlaceId;
  /** Story scene 0–5. Omit for free exploration. */
  scene?: number;
  /** 0–1 vehicle progress along the route (scenes 4–5). */
  progress?: number;
  compact?: boolean;
  /** Stage mode: no route card or marker legend; frame the route inside `pad` (px) so overlays can sit around it. */
  bare?: boolean;
  pad?: { top: number; right: number; bottom: number; left: number };
  className?: string;
}

function tuneStyle(style: StyleSpecification) {
  if (CUSTOM_STYLE) return style;
  for (const l of style.layers as { id: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }[]) {
    if (l.id === "background") l.paint = { ...l.paint, "background-color": "#eef0ea" };
    if (l.id === "water") l.paint = { ...l.paint, "fill-color": "#bcd3dc" };
    if (l.id === "building") l.layout = { ...l.layout, visibility: "none" };
    if (/highway_(motorway|major)_inner/.test(l.id)) l.paint = { ...l.paint, "line-color": "#ffffff" };
    if (/aeroway-(runway|area)/.test(l.id)) l.paint = { ...l.paint, [l.id.includes("area") ? "fill-color" : "line-color"]: "#d8dbd3" };
  }
  return style;
}

export default function CorridorMap({ group, youDest = "cyberCity", scene, progress = 1, compact = false, bare = false, pad, className = "" }: CorridorMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const drawRef = useRef(0); // current route draw fraction
  const riderT = useRef(0); // 0 = scattered, 1 = converged
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const is3d = true; // MVP: always the 3D corridor view
  const [selected, setSelected] = useState<PlaceId | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const route = ROUTES[group.routeKey];
  const coords = route.coordinates;
  const cum = useMemo(() => cumulative(coords), [coords]);
  const stops = route.stops;

  const stopInfo = useMemo(() => {
    return stops.map((id, i) => {
      const t = route.legs.slice(0, i).reduce((s, l) => s + l.durationS, 0);
      const who = [...group.members.filter((m) => m.destination === id).map((m) => m.name), ...(id === youDest ? ["You"] : [])];
      const role = i === 0 ? "Airport pickup" : i === stops.length - 1 ? "Final destination" : `Drop-off ${i}`;
      return { id, role, who, etaMin: Math.round(t / 60), kind: i === 0 ? "pickup" : i === stops.length - 1 ? "final" : "drop" };
    });
  }, [stops, route.legs, group.members, youDest]);

  const riders = useMemo(
    () => [...group.members.map((m) => m.name), "You"].slice(0, 3).map((name, i) => ({ name, from: [PLACES.t3.coord[0] + RIDER_OFFSETS[i][0], PLACES.t3.coord[1] + RIDER_OFFSETS[i][1]] as LngLat, color: RIDER_COLORS[i] })),
    [group.members],
  );

  const camFor = (s: number | undefined): Camera | "fit" => {
    const t3 = PLACES.t3.coord;
    switch (s) {
      case 0: return { center: [t3[0] + 0.004, t3[1] - 0.002], zoom: 14.2, pitch: 55, bearing: -25 };
      case 1: return { center: t3, zoom: 15.3, pitch: 62, bearing: 15 };
      case 2: return { center: t3, zoom: 15.7, pitch: 60, bearing: 40 };
      case 5: return { center: PLACES[youDest].coord, zoom: 15.6, pitch: 62, bearing: -30 };
      default: return "fit";
    }
  };

  const moveCamera = (s: number | undefined, instant = false) => {
    const map = mapRef.current;
    if (!map) return;
    const c = camFor(s);
    const narrow = map.getContainer().clientWidth < 640;
    // stage padding is set on the map itself (it persists and is added to any per-call padding)
    if (pad) map.setPadding(narrow ? { top: 0, right: 0, bottom: 0, left: 0 } : pad);
    if (c === "fit") {
      map.fitBounds(bounds(coords), { padding: narrow || pad ? 40 : { top: 80, bottom: 80, left: 80, right: compact ? 80 : 360 }, pitch: is3d ? 48 : 0, bearing: is3d ? -12 : 0, duration: instant || reduced ? 0 : 2200 });
    } else {
      const opts = { ...c, pitch: is3d ? c.pitch : 0, zoom: narrow ? c.zoom - 0.7 : c.zoom };
      if (instant || reduced) map.jumpTo(opts);
      else map.flyTo({ ...opts, duration: 2200, essential: false, curve: 1.2 });
    }
  };

  // ---- create map once ----
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      try {
        const [maplibregl, styleRes] = await Promise.all([import("maplibre-gl"), fetch(STYLE_URL)]);
        if (!styleRes.ok) throw new Error(`style ${styleRes.status}`);
        const style = tuneStyle(await styleRes.json());
        mlRef.current = maplibregl;
        maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs"); // served from public/ (Turbopack can't bundle the worker)
        if (cancelled || !host.current) return;
        const mobile = window.innerWidth < 768;
        map = new maplibregl.Map({
          container: host.current,
          style,
          bounds: bounds(coords),
          fitBoundsOptions: { padding: 40 },
          pitch: 45,
          maxPitch: 70,
          // never hijack page scroll: no wheel zoom, no "use ⌘ + scroll" overlay; on phones one-finger swipes scroll the page
          cooperativeGestures: false,
          scrollZoom: false,
          dragPan: !mobile,
          attributionControl: { compact: true },
          fadeDuration: 0,
        });
        mapRef.current = map;
        map.on("error", (e) => console.warn("map:", e.error?.message));
        const m = map;
        m.once("load", () => {
          if (cancelled) return;
          const map = m;
          const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
          map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.4 });
          if (map.getSource("openmaptiles")) {
            map.addLayer({
              id: "ap-buildings",
              type: "fill-extrusion",
              source: "openmaptiles",
              "source-layer": "building",
              minzoom: mobile ? 14 : 13,
              paint: {
                "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#e4e6e0", 30, "#d6d9d2", 90, "#c5c9c1"],
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.88,
              },
            }, firstSymbol);
          }
          const empty = { type: "FeatureCollection" as const, features: [] };
          map.addSource("route-full", { type: "geojson", data: empty });
          map.addSource("route", { type: "geojson", data: empty });
          map.addSource("vehicle", { type: "geojson", data: empty });
          map.addSource("riders", { type: "geojson", data: empty });
          map.addLayer({ id: "route-ghost", type: "line", source: "route-full", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#a6763a", "line-opacity": 0.18, "line-width": 2, "line-dasharray": [2, 2] } });
          map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#a6763a", "line-opacity": 0.35, "line-width": 16, "line-blur": 10 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#b8935a", "line-width": 4.5 } });
          map.addLayer({ id: "vehicle-glow", type: "circle", source: "vehicle", paint: { "circle-radius": 18, "circle-color": "#a6763a", "circle-opacity": 0.35, "circle-blur": 1 } });
          map.addLayer({ id: "vehicle-core", type: "circle", source: "vehicle", paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#a6763a", "circle-stroke-width": 3 } });
          map.addLayer({ id: "riders-glow", type: "circle", source: "riders", paint: { "circle-radius": 16, "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-blur": 1 } });
          map.addLayer({ id: "riders-core", type: "circle", source: "riders", paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-color": "#f7f3eb", "circle-stroke-width": 2 } });
          map.addLayer({ id: "riders-label", type: "symbol", source: "riders", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-offset": [0, 1.4], "text-anchor": "top" }, paint: { "text-color": "#0f3d34", "text-halo-color": "#f7f3eb", "text-halo-width": 1.5 } });

          map.on("click", () => setSelected(null));
          setStatus("ready");
        });
      } catch (err) {
        console.warn("CorridorMap fallback:", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- route + markers: swap in place when the group changes (no map rebuild) ----
  useEffect(() => {
    const map = mapRef.current, ml = mlRef.current;
    if (status !== "ready" || !map || !ml) return;
    (map.getSource("route-full") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
    drawRef.current = 0;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = stopInfo.map((s) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${s.role}: ${PLACES[s.id].name}`);
      el.className = `ap-marker ap-${s.kind}`;
      el.innerHTML = `<span></span>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelected(s.id); });
      return new ml.Marker({ element: el, anchor: s.kind === "final" ? "bottom" : "center" }).setLngLat(PLACES[s.id].coord).addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.routeKey, status, stopInfo]);

  // ---- scene-driven state (camera, route draw, riders) ----
  const effScene = scene ?? 5;
  useEffect(() => {
    if (status !== "ready") return;
    const map = mapRef.current!;
    if (scene !== undefined && scene !== 4) moveCamera(scene);
    if (scene === undefined) moveCamera(undefined, true);

    const routeTarget = effScene >= 3 ? 1 : 0;
    const riderTarget = effScene >= 2 ? 1 : 0;
    const from = { d: drawRef.current, r: riderT.current };
    const t0 = performance.now();
    const dur = reduced ? 0 : 1800;
    let raf = 0;
    const tick = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      drawRef.current = from.d + (routeTarget - from.d) * e;
      riderT.current = from.r + (riderTarget - from.r) * e;
      (map.getSource("route") as GeoJSONSource)?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: drawRef.current > 0.001 ? slice(coords, cum, drawRef.current) : [] } });
      const pick = PLACES.t3.coord;
      (map.getSource("riders") as GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: effScene >= 1 && effScene < 4 ? riders.map((r) => ({ type: "Feature" as const, properties: { name: r.name, color: r.color }, geometry: { type: "Point" as const, coordinates: [r.from[0] + (pick[0] - r.from[0]) * riderT.current, r.from[1] + (pick[1] - r.from[1]) * riderT.current] } })) : [],
      });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, status, group.routeKey]);

  // ---- vehicle follows route (scroll-tied in scene 4) ----
  useEffect(() => {
    if (status !== "ready") return;
    const map = mapRef.current!;
    const p = effScene >= 4 ? progress : 0;
    const { point, bearing } = along(coords, cum, p);
    (map.getSource("vehicle") as GeoJSONSource)?.setData(effScene >= 4 ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point } } : { type: "FeatureCollection", features: [] });
    if (scene === 4) map.easeTo({ center: point, zoom: map.getContainer().clientWidth < 640 ? 13.6 : 14.4, pitch: is3d ? 62 : 0, bearing: is3d ? bearing : 0, duration: reduced ? 0 : 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, scene, status, group.routeKey]);

  // ---- toggles ----
  const focusStop = (id: PlaceId) => {
    setSelected(id);
    mapRef.current?.flyTo({ center: PLACES[id].coord, zoom: 15.4, duration: reduced ? 0 : 1600, essential: false });
  };

  const sel = stopInfo.find((s) => s.id === selected);
  const km = (route.distanceM / 1000).toFixed(1);

  if (status === "error")
    return (
      <div className={`relative overflow-hidden bg-ink-2 ${className}`}>
        <RouteSvg routeKey={group.routeKey} className="h-full w-full" />
        <p className="glass absolute left-3 top-3 max-w-xs rounded-xl px-3 py-2 text-xs text-muted" role="status">
          Static map shown: the interactive map couldn&apos;t load (WebGL or tile service unavailable). Route geometry is still real.
        </p>
      </div>
    );

  return (
    <div className={`relative overflow-hidden bg-ink-2 ${className}`}>
      <div ref={host} className="!absolute inset-0" role="region" aria-label={`Map of route ${stops.map((s) => PLACES[s].short).join(" to ")}`} />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-ink-2" role="status">
          <div className="flex flex-col items-center gap-3 text-sm text-muted">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-flare/20 border-t-flare" aria-hidden />
            Loading 3D corridor…
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          {/* Route info card */}
          {!bare && <div className={`glass pointer-events-none absolute right-3 top-3 rounded-xl p-3 text-xs ${compact ? "max-md:hidden" : "md:right-5 md:top-5 md:w-60 md:p-4"}`}>
            <p className="text-muted">{PLACES[stops[0]].short} → {PLACES[stops[stops.length - 1]].short}</p>
            <p className="num mt-1 text-base font-semibold">{km} km · {Math.round(route.durationS / 60)} min</p>
            <p className="mt-1 text-[10px] leading-snug text-muted">Road distance &amp; free-flow time from {ROUTE_SOURCE}. Excludes traffic.</p>
          </div>}

          {/* Selected marker card */}
          {sel && (
            <div className="glass absolute left-3 top-3 w-64 rounded-xl p-4 text-sm" role="dialog" aria-label={`${sel.role} details`}>
              <div className="flex items-start justify-between gap-2">
                <p className="eyebrow !text-[10px]">{sel.role}</p>
                <button className="-mr-1 -mt-1 px-1 text-muted hover:text-text" onClick={() => setSelected(null)} aria-label="Close">✕</button>
              </div>
              <p className="mt-2 font-display text-lg">{sel.kind === "pickup" ? group.pickupPoint : PLACES[sel.id].name}</p>
              <dl className="mt-3 space-y-1.5 text-muted">
                {sel.kind !== "pickup" && <div className="flex justify-between"><dt>From pickup</dt><dd className="num text-text">~{sel.etaMin} min</dd></div>}
                <div className="flex justify-between"><dt>{sel.kind === "pickup" ? "Boarding" : "Dropping"}</dt><dd className="text-text">{sel.kind === "pickup" ? `${group.members.length + 1} travellers` : sel.who.join(", ") || "—"}</dd></div>
              </dl>
              <SimBadge className="mt-3">Riders simulated</SimBadge>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end gap-2 md:right-auto">
            <div className="glass flex flex-wrap gap-1 rounded-xl p-1 text-xs">
              <Ctl onClick={() => { setSelected(null); moveCamera(scene === 4 ? 3 : scene); }}>Reset view</Ctl>
            </div>
            {!compact && !bare && (
              <div className="glass hidden gap-1 rounded-xl p-1 text-xs sm:flex" role="group" aria-label="Route markers">
                {stopInfo.map((s) => (
                  <Ctl key={s.id} pressed={selected === s.id} onClick={() => focusStop(s.id)}>
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${s.kind === "pickup" ? "bg-text" : s.kind === "final" ? "bg-taxi" : "bg-flare"}`} aria-hidden />
                    {PLACES[s.id].short}
                  </Ctl>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Ctl({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`min-h-9 rounded-lg px-3 transition-colors ${pressed ? "bg-flare/15 text-flare" : "text-muted hover:bg-text/5 hover:text-text"}`}
    >
      {children}
    </button>
  );
}
