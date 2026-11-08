// Fetch real OSM geometry for the 3D journey from OpenFreeMap vector tiles (z14, OpenMapTiles schema):
// buildings (with heights), aeroway (runways/taxiways/aprons/terminals), major roads, green space, water.
// Output: data/osm-corridor.json in local metres around the scene origin (x east, z south), integer-quantised.
// Run: npm run osm
import { writeFileSync } from "node:fs";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader as Pbf } from "pbf";

const [LNG0, LAT0] = [77.09, 28.525]; // must match JourneyScene
const M = 111320;
const COS = Math.cos((LAT0 * Math.PI) / 180);
const BBOX = { w: 77.035, e: 77.165, s: 28.43, n: 28.6 };
const Z = 14;
// Signed ring area in tile space; vector-tile outer rings are positive (clockwise in screen y-down)
const VectorTileFeature_area = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y); return a; };

const tj = await (await fetch("https://tiles.openfreemap.org/planet")).json();
const TILE = tj.tiles[0];
const lon2x = (lng) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const lat2y = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z);

const out = { origin: [LNG0, LAT0], buildings: [], runways: [], taxiways: [], aprons: [], terminals: [], roads: [], green: [], water: [] };
const q = (v) => Math.round(v);

for (let tx = lon2x(BBOX.w); tx <= lon2x(BBOX.e); tx++)
  for (let ty = lat2y(BBOX.n); ty <= lat2y(BBOX.s); ty++) {
    const url = TILE.replace("{z}", Z).replace("{x}", tx).replace("{y}", ty);
    const res = await fetch(url);
    if (!res.ok) { console.warn("skip", url, res.status); continue; }
    const vt = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
    const toM = (p, ext) => {
      const lng = ((tx + p.x / ext) / 2 ** Z) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * (ty + p.y / ext)) / 2 ** Z;
      const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
      return [q((lng - LNG0) * M * COS), q(-(lat - LAT0) * M)];
    };
    // Tiles carry a buffer beyond their extent: clip everything to [0, ext] so neighbouring tiles neither overlap nor leave gaps.
    const clipPoly = (ring, ext) => {
      let pts = ring.map((p) => [p.x, p.y]);
      for (const [axis, lim, keepLess] of [[0, 0, false], [0, ext, true], [1, 0, false], [1, ext, true]]) {
        const inn = (p) => (keepLess ? p[axis] <= lim : p[axis] >= lim);
        const next = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (inn(a)) next.push(a);
          if (inn(a) !== inn(b)) { const t = (lim - a[axis]) / (b[axis] - a[axis]); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
        }
        pts = next;
        if (!pts.length) break;
      }
      return pts.map(([x, y]) => ({ x, y }));
    };
    const clipLine = (line, ext) => { // split into runs inside the tile
      const runs = [];
      let cur = [];
      const inn = (p) => p.x >= 0 && p.x <= ext && p.y >= 0 && p.y <= ext;
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        if (inn(p)) { cur.push(p); continue; }
        if (cur.length) { cur.push(p); runs.push(cur); cur = []; } // keep the exit vertex so runs meet across tiles
        else if (i + 1 < line.length && inn(line[i + 1])) cur.push(p);
      }
      if (cur.length > 1) runs.push(cur);
      return runs.filter((r) => r.length > 1);
    };
    const inside = () => true;
    const each = (name, fn) => {
      const L = vt.layers[name];
      if (!L) return;
      for (let i = 0; i < L.length; i++) {
        const f = L.feature(i);
        fn(f, f.loadGeometry(), L.extent);
      }
    };
    each("building", (f, g, ext) => {
      if (f.type !== 3 || !inside(g[0], ext)) return;
      const h = f.properties.render_height ?? 6, h0 = f.properties.render_min_height ?? 0;
      // buildings: keep whole, owned by the tile containing their first vertex (no clipping seams on extrusions)
      const p0 = g[0][0];
      if (p0.x < 0 || p0.x >= ext || p0.y < 0 || p0.y >= ext) return;
      const ring = g[0].map((p) => toM(p, ext)).flat();
      if (ring.length >= 8) out.buildings.push([q(h), q(h0), ...ring]);
    });
    each("aeroway", (f, g, ext) => {
      const cls = f.properties.class;
      if (f.type === 2) for (const line of g) for (const run of clipLine(line, ext)) {
        const pts = run.map((p) => toM(p, ext)).flat();
        if (cls === "runway") out.runways.push({ ref: f.properties.ref ?? "", pts });
        else if (cls === "taxiway") out.taxiways.push(pts);
      }
      if (f.type === 3 && (cls === "apron" || cls === "runway" || cls === "taxiway")) for (const ring of g) {
        if (VectorTileFeature_area(ring) <= 0) continue; // skip holes
        const c = clipPoly(ring, ext);
        if (c.length > 2) out.aprons.push(c.map((p) => toM(p, ext)).flat());
      }
    });
    each("transportation", (f, g, ext) => {
      const cls = f.properties.class;
      if (f.type !== 2 || !["motorway", "trunk", "primary", "secondary", "tertiary"].includes(cls)) return;
      for (const line of g) for (const run of clipLine(line, ext)) out.roads.push([["motorway", "trunk", "primary", "secondary", "tertiary"].indexOf(cls), ...run.map((p) => toM(p, ext)).flat()]);
    });
    const polys = (g, ext, into) => { for (const ring of g) { if (VectorTileFeature_area(ring) <= 0) continue; const c = clipPoly(ring, ext); if (c.length > 2) into.push(c.map((p) => toM(p, ext)).flat()); } };
    each("park", (f, g, ext) => { if (f.type === 3) polys(g, ext, out.green); });
    each("landcover", (f, g, ext) => { if (f.type === 3 && ["grass", "wood", "farmland"].includes(f.properties.class)) polys(g, ext, out.green); });
    each("water", (f, g, ext) => { if (f.type === 3) polys(g, ext, out.water); });
    process.stdout.write(".");
  }

const json = JSON.stringify(out);
writeFileSync(new URL("../data/osm-corridor.json", import.meta.url), json);
console.log(`\nbuildings ${out.buildings.length} runways ${out.runways.length} taxiways ${out.taxiways.length} aprons ${out.aprons.length} roads ${out.roads.length} green ${out.green.length} water ${out.water.length} · ${(json.length / 1e6).toFixed(1)} MB`);
console.log("runway refs", out.runways.map((r) => r.ref).join(", "));
