// Static map fallback: real route geometry drawn as SVG (no WebGL or tiles needed).
import { PLACES, ROUTES, bounds } from "@/lib/geo";
import type { RouteKey } from "@/lib/types";

export default function RouteSvg({ routeKey = "groupA", className = "" }: { routeKey?: RouteKey; className?: string }) {
  const r = ROUTES[routeKey];
  const all = [...ROUTES.solo.coordinates, ...r.coordinates];
  const [[x0, y0], [x1, y1]] = bounds(all);
  const pad = 0.012, kx = Math.cos((28.5 * Math.PI) / 180);
  const W = (x1 - x0 + pad * 2) * kx, H = y1 - y0 + pad * 2;
  const px = ([x, y]: number[]) => `${((x - x0 + pad) * kx * 1000 / W).toFixed(1)},${((y1 + pad - y) * 1000 / W).toFixed(1)}`;
  const vbH = (H * 1000) / W;
  return (
    <svg viewBox={`0 0 1000 ${vbH.toFixed(0)}`} className={className} role="img" aria-label={`Static route map: ${r.stops.map((s) => PLACES[s].short).join(" → ")}`}>
      <rect width="1000" height={vbH} fill="#ece6da" />
      <polyline points={ROUTES.solo.coordinates.map(px).join(" ")} fill="none" stroke="#d6cebf" strokeWidth="10" strokeLinejoin="round" />
      <polyline points={r.coordinates.map(px).join(" ")} fill="none" stroke="#a6763a" strokeOpacity="0.25" strokeWidth="14" strokeLinejoin="round" />
      <polyline points={r.coordinates.map(px).join(" ")} fill="none" stroke="#a6763a" strokeWidth="4" strokeLinejoin="round" />
      {r.stops.map((s, i) => {
        const [cx, cy] = px(PLACES[s].coord).split(",").map(Number);
        return (
          <g key={s}>
            <circle cx={cx} cy={cy} r={i === 0 ? 12 : 9} fill={i === 0 ? "#0f3d34" : i === r.stops.length - 1 ? "#1f8f87" : "#a6763a"} stroke="#f7f3eb" strokeWidth="3" />
            <text x={cx + 16} y={cy + 6} fill="#0f3d34" fontSize="22" fontFamily="var(--font-anek)">{PLACES[s].short}</text>
          </g>
        );
      })}
    </svg>
  );
}
