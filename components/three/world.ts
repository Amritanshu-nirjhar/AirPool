// Daylight ground world for the opening journey, built from real OpenStreetMap geometry (data/osm-corridor.json, via `npm run osm`):
// DEL runways / taxiways / aprons, roads, parks, water and building footprints with heights. Where OSM has no buildings,
// a procedural fill lines the real streets (aligned to them): Delhi low-rise with rooftop water tanks, Aerocity hotels,
// Gurugram glass towers. Street trees, moving traffic and sun shadows. T3 itself is not in the tiles, so its massing is
// approximated inside the real apron void. 1 unit = 100 m.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import osm from "../../data/osm-corridor.json" with { type: "json" };

const U = 0.01; // metres → units
type V2 = THREE.Vector2;
const v2 = (x: number, z: number) => new THREE.Vector2(x * U, z * U);
const pairs = (a: number[], from = 0) => {
  const out: V2[] = [];
  for (let i = from; i + 1 < a.length; i += 2) out.push(v2(a[i], a[i + 1]));
  return out;
};

/** Join polyline pieces that share endpoints (tile splits) into continuous chains. */
function chains(lines: { pts: V2[]; tag?: string }[]) {
  const pool = lines.map((l) => ({ pts: [...l.pts], tag: l.tag ?? "" }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < pool.length; i++)
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue;
        const a = pool[i], b = pool[j];
        const near = (p: V2, q: V2) => p.distanceTo(q) < 0.06;
        let joined: V2[] | null = null;
        if (near(a.pts[a.pts.length - 1], b.pts[0])) joined = [...a.pts, ...b.pts.slice(1)];
        else if (near(a.pts[a.pts.length - 1], b.pts[b.pts.length - 1])) joined = [...a.pts, ...b.pts.slice(0, -1).reverse()];
        if (joined) {
          a.pts = joined;
          a.tag ||= b.tag;
          pool.splice(j, 1);
          merged = true;
          break outer;
        }
      }
  }
  return pool;
}

/** Flat ribbon along a polyline (y-up), uv.x across 0..1, uv.y = distance / uvLen. */
function ribbon(pts: V2[], width: number, y: number, uvLen = 1): THREE.BufferGeometry | null {
  if (pts.length < 2) return null;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const d = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(width / 2);
    if (i) dist += pts[i].distanceTo(pts[i - 1]);
    pos.push(pts[i].x + n.x, y, pts[i].y + n.y, pts[i].x - n.x, y, pts[i].y - n.y);
    uv.push(0, dist / uvLen, 1, dist / uvLen);
    if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1); // counter-clockwise from above → faces up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Many flat polygons as one geometry at height y. */
function flats(polys: V2[][], y: number): THREE.BufferGeometry {
  const shapes = polys.map((p) => new THREE.Shape(p.map((q) => new THREE.Vector2(q.x, -q.y))));
  return new THREE.ShapeGeometry(shapes, 1).rotateX(-Math.PI / 2).translate(0, y, 0);
}

const flatMat = (color: number, layer: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4, ...extra });

/**
 * Building facade material, daylight. Windows are generated per floor in world space (3.4 m floors, 3.2 m bays) and rendered
 * as glass (low roughness, metallic) so they reflect the real sky; walls take Delhi plaster/stone tones per building.
 */
function facadeMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aSeed; varying vec3 vSeed; varying vec3 vWPos; varying vec3 vWN;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 apW = vec4(transformed, 1.0);
        vec3 apN = objectNormal;
        #ifdef USE_INSTANCING
          apW = instanceMatrix * apW; apN = mat3(instanceMatrix) * apN;
        #endif
        vWPos = (modelMatrix * apW).xyz; vWN = normalize(mat3(modelMatrix) * apN); vSeed = aSeed;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSeed; varying vec3 vWPos; varying vec3 vWN; float apGlass;\nfloat apH(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // kind (vSeed.y): 0 Delhi low-rise · 1 hotel/office · 2 glass tower · 3 terminal glazing
        float kind = vSeed.y;
        float pick = vSeed.x;
        vec3 wall;
        if (kind < 0.5) {
          // plaster: cream, sandstone, salmon, whitewash, pale yellow, dusty pink, brick
          vec3 P[7] = vec3[7](vec3(0.86,0.80,0.68), vec3(0.80,0.70,0.54), vec3(0.82,0.62,0.52), vec3(0.90,0.88,0.84), vec3(0.88,0.80,0.56), vec3(0.84,0.70,0.68), vec3(0.66,0.42,0.32));
          wall = P[int(floor(pick * 6.999))];
        } else if (kind < 1.5) {
          wall = mix(vec3(0.82,0.79,0.73), vec3(0.72,0.62,0.48), step(0.6, pick));
        } else if (kind < 2.5) {
          wall = mix(vec3(0.30,0.42,0.48), vec3(0.42,0.46,0.50), step(0.55, pick)); // blue-green / silver curtain wall
        } else {
          wall = vec3(0.62,0.70,0.76);
        }
        float roofish = step(0.6, vWN.y);
        float alongW = abs(vWN.x) > abs(vWN.z) ? vWPos.z : vWPos.x;
        float bayW = kind > 2.5 ? 0.04 : kind > 1.5 ? 0.016 : 0.032;
        vec2 cell = vec2(alongW / bayW, vWPos.y / 0.034);
        vec2 f = fract(cell);
        float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.8);
        if (kind > 1.5) win = step(0.08, f.x) * step(0.14, f.y);
        win *= 1.0 - roofish;
        vec3 glassTint = kind > 1.5 ? wall * 0.85 : vec3(0.22,0.26,0.31);
        diffuseColor.rgb = mix(wall, glassTint, win);
        // grime toward street level, sun-bleached tops
        diffuseColor.rgb *= mix(0.82, 1.0, smoothstep(0.0, 0.06, vWPos.y));
        // roofs: grey concrete for houses, darker for towers
        diffuseColor.rgb = mix(diffuseColor.rgb, kind > 1.5 ? vec3(0.32,0.33,0.35) : vec3(0.62,0.60,0.56) * (0.85 + 0.15 * apH(vec3(pick))), roofish);
        apGlass = win * (kind > 1.5 ? 1.0 : 0.85);`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, apGlass);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, apGlass);");
  };
  return m;
}

export interface World {
  group: THREE.Group;
  /** Landing runway (29L): threshold at the east end, direction pointing west along the runway. */
  runway: { thr: THREE.Vector3; dir: THREE.Vector3; side: THREE.Vector3; len: number; center: THREE.Vector3 };
  /** Every light in the world (runway, taxiway, approach, street lamps, windows on tall buildings): seeds for the stars. */
  lights: Float32Array;
  update: (time: number) => void;
  dispose: () => void;
}

export function buildWorld(opts: { mobile: boolean; t3: THREE.Vector3; keep: { cyber: THREE.Vector3; aerocity: THREE.Vector3 } }): World {
  const { mobile, t3 } = opts;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shadowy = <T extends THREE.Object3D>(o: T, cast = true) => ((o.castShadow = cast), (o.receiveShadow = true), o);

  const rwChains = chains(osm.runways.map((r) => ({ pts: pairs(r.pts), tag: r.ref }))).filter((c) => c.pts[0].distanceTo(c.pts[c.pts.length - 1]) > 15);
  const twChains = chains(osm.taxiways.map((t) => ({ pts: pairs(t) })));
  const aprons = osm.aprons.map((p) => pairs(p));

  // Airfield = convex hull of every runway/taxiway/apron vertex (infield grass + no-build zone)
  const af: V2[] = [...rwChains.flatMap((c) => c.pts), ...twChains.flatMap((c) => c.pts), ...aprons.flat()].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: V2, a: V2, b: V2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: V2[] = [], upper: V2[] = [];
  for (const p of af) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...af].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const hc = hull.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(hull.length);
  const hullBig = hull.map((p) => p.clone().sub(hc).multiplyScalar(1.04).add(hc));

  // ---------- Ground layers (daylight) ----------
  group.add(shadowy(new THREE.Mesh(keep(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2)), keep(flatMat(0x9b9183, 0))), false));
  group.add(shadowy(new THREE.Mesh(keep(flats([hullBig], 0.0008)), keep(flatMat(0x96a067, 1))), false));
  group.add(shadowy(new THREE.Mesh(keep(flats(osm.green.map((p) => pairs(p)), 0.001)), keep(flatMat(0x627a42, 1))), false));
  group.add(shadowy(new THREE.Mesh(keep(flats(osm.water.map((p) => pairs(p)), 0.0012)), keep(flatMat(0x4f6f7d, 2, { roughness: 0.12, metalness: 0.4 }))), false));
  group.add(shadowy(new THREE.Mesh(keep(flats(aprons, 0.002)), keep(flatMat(0xbdb8ae, 2, { roughness: 0.9 }))), false));

  // Roads: asphalt ribbons by class (motorway → tertiary)
  const ROAD_W = [26, 22, 16, 11, 8];
  const roadLines = osm.roads.map((r) => ({ cls: r[0], pts: pairs(r, 1) }));
  const roadGeos = roadLines.map((r) => ribbon(r.pts, ROAD_W[r.cls] * U, 0.003)).filter(Boolean) as THREE.BufferGeometry[];
  group.add(shadowy(new THREE.Mesh(keep(mergeGeometries(roadGeos)), keep(flatMat(0x57565b, 3, { roughness: 0.8 }))), false));
  roadGeos.forEach((g) => g.dispose());

  // Runways: 45 m grooved asphalt with centreline / edge paint (repeats every 50 m)
  const rc = document.createElement("canvas");
  rc.width = 128;
  rc.height = 256;
  const rx = rc.getContext("2d")!;
  rx.fillStyle = "#47474c";
  rx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 500; i++) { const v = 50 + Math.floor(rnd() * 30); rx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; rx.fillRect(rnd() * 128, rnd() * 256, 2, 4 + rnd() * 8); }
  for (let i = 0; i < 60; i++) { rx.fillStyle = "rgba(20,20,22,0.35)"; rx.fillRect(40 + rnd() * 48, rnd() * 256, 3, 30); } // tyre rubber
  rx.fillStyle = "#f2f1ec";
  rx.fillRect(62, 0, 4, 150);
  rx.fillRect(3, 0, 3, 256);
  rx.fillRect(122, 0, 3, 256);
  const rTex = keep(new THREE.CanvasTexture(rc));
  rTex.wrapT = THREE.RepeatWrapping;
  rTex.colorSpace = THREE.SRGBColorSpace;
  rTex.anisotropy = 8;
  const rwGeos = rwChains.map((c) => ribbon([c.pts[0], c.pts[c.pts.length - 1]], 0.45, 0.005, 0.5)!);
  group.add(shadowy(new THREE.Mesh(keep(mergeGeometries(rwGeos)), keep(flatMat(0xffffff, 5, { map: rTex, roughness: 0.75 }))), false));
  rwGeos.forEach((g) => g.dispose());

  // Taxiways: 23 m with a yellow centreline
  const tc = document.createElement("canvas");
  tc.width = 64;
  tc.height = 8;
  const tx = tc.getContext("2d")!;
  tx.fillStyle = "#56565b";
  tx.fillRect(0, 0, 64, 8);
  tx.fillStyle = "#e3b51e";
  tx.fillRect(30, 0, 4, 8);
  const tTex = keep(new THREE.CanvasTexture(tc));
  tTex.colorSpace = THREE.SRGBColorSpace;
  const twGeos = twChains.map((c) => ribbon(c.pts, 0.23, 0.004)).filter(Boolean) as THREE.BufferGeometry[];
  group.add(shadowy(new THREE.Mesh(keep(mergeGeometries(twGeos)), keep(flatMat(0xffffff, 4, { map: tTex, roughness: 0.8 }))), false));
  twGeos.forEach((g) => g.dispose());

  // Landing runway: 11R/29L, land on 29L (westbound)
  const main = rwChains.find((c) => c.tag.includes("29L")) ?? rwChains[0];
  const [pa, pb] = [main.pts[0], main.pts[main.pts.length - 1]];
  const [east, west] = pa.x > pb.x ? [pa, pb] : [pb, pa];
  const thr = new THREE.Vector3(east.x, 0.005, east.y);
  const dir = new THREE.Vector3(west.x - east.x, 0, west.y - east.y).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const len = east.distanceTo(west);
  const center = thr.clone().addScaledVector(dir, len / 2);

  // Threshold piano keys, touchdown-zone and aiming-point paint on every runway end
  const paint = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(flatMat(0xf2f1ec, 6, { roughness: 0.6 })), 2000);
  let pi = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const stamp = (p: THREE.Vector3, d: THREE.Vector3, along: number, across: number) => {
    if (pi >= 2000) return;
    q.setFromAxisAngle(Y, Math.atan2(-d.z, d.x));
    m4.compose(p.clone().setY(0.0055), q, sc.set(along, 1, across));
    paint.setMatrixAt(pi++, m4);
  };
  for (const c of rwChains) {
    const A = c.pts[0], B = c.pts[c.pts.length - 1];
    for (const [s, e] of [[A, B], [B, A]]) {
      const p0 = new THREE.Vector3(s.x, 0, s.y), d = new THREE.Vector3(e.x - s.x, 0, e.y - s.y).normalize(), sd = new THREE.Vector3(-d.z, 0, d.x);
      for (let k = -7; k <= 7; k++) if (k) stamp(p0.clone().addScaledVector(d, 0.3).addScaledVector(sd, k * 0.028), d, 0.3, 0.018);
      for (let k = 0; k < 6; k++) for (const sgn of [-1, 1]) stamp(p0.clone().addScaledVector(d, 1.5 + k * 1.5).addScaledVector(sd, sgn * 0.12), d, 0.22, 0.05);
      for (const sgn of [-1, 1]) stamp(p0.clone().addScaledVector(d, 3.0).addScaledVector(sd, sgn * 0.1), d, 0.45, 0.07);
    }
  }
  paint.count = pi;
  group.add(paint);

  // ---------- Light positions (not drawn in daylight — they become the stars) ----------
  const L: number[] = [];
  const put = (x: number, y: number, z: number) => L.push(x, y, z);
  for (const c of rwChains) {
    const A = c.pts[0], B = c.pts[c.pts.length - 1], n = Math.floor(A.distanceTo(B) / 0.6);
    const d = new THREE.Vector2(B.x - A.x, B.y - A.y).normalize(), sd = new THREE.Vector2(-d.y, d.x);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = A.x + (B.x - A.x) * t, z = A.y + (B.y - A.y) * t;
      for (const sg of [-1, 1]) put(x + sd.x * 0.24 * sg, 0.012, z + sd.y * 0.24 * sg);
      put(x, 0.008, z);
    }
  }
  for (let k = 1; k <= 30; k++) { const p = thr.clone().addScaledVector(dir, -k * 0.3); for (let w = -2; w <= 2; w++) put(p.x + side.x * w * 0.025, 0.03, p.z + side.z * w * 0.025); }
  for (const c of twChains) {
    let acc = 0;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i], seg = a.distanceTo(b);
      for (let s = (0.3 - acc) % 0.3; s < seg; s += 0.3) put(a.x + ((b.x - a.x) * s) / seg, 0.006, a.y + ((b.y - a.y) * s) / seg);
      acc = (acc + seg) % 0.3;
    }
  }
  for (const r of roadLines) {
    if (r.cls > 2) continue;
    const off = (ROAD_W[r.cls] * U) / 2 + 0.01;
    let acc = 0;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i], seg = a.distanceTo(b);
      if (!seg) continue;
      const nx = -(b.y - a.y) / seg, nz = (b.x - a.x) / seg;
      for (let s = (0.4 - acc) % 0.4; s < seg; s += 0.4) {
        const x = a.x + ((b.x - a.x) * s) / seg, z = a.y + ((b.y - a.y) * s) / seg;
        put(x + nx * off, 0.1, z + nz * off);
        put(x - nx * off, 0.1, z - nz * off);
      }
      acc = (acc + seg) % 0.4;
    }
  }

  // ---------- Buildings ----------
  const GX0 = -60, GZ0 = -70, GW = 140, GH = 160, CELL = 0.1;
  const NX = GW / CELL, NZ = GH / CELL;
  const occ = new Uint8Array(NX * NZ);
  const ang = new Float32Array(NX * NZ).fill(NaN);
  const ci = (x: number, z: number) => {
    const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL);
    return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i;
  };
  const stroke = (pts: V2[], halfW: number, alignW: number, v: number) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], seg = a.distanceTo(b);
      const th = Math.atan2(b.y - a.y, b.x - a.x);
      for (let s = 0; s <= seg; s += CELL * 0.7)
        for (let w = -alignW; w <= alignW; w += CELL * 0.7) {
          const x = a.x + ((b.x - a.x) * s) / (seg || 1) - Math.sin(th) * w, z = a.y + ((b.y - a.y) * s) / (seg || 1) + Math.cos(th) * w;
          const k = ci(x, z);
          if (k < 0) continue;
          if (Math.abs(w) <= halfW) occ[k] = v;
          if (Number.isNaN(ang[k])) ang[k] = th;
        }
    }
  };
  const fillPoly = (poly: V2[], v: number) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y); }
    for (let x = minX; x <= maxX; x += CELL)
      for (let z = minZ; z <= maxZ; z += CELL) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
          if (poly[i].y > z !== poly[j].y > z && x < ((poly[j].x - poly[i].x) * (z - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
        const k = ci(x, z);
        if (inside && k >= 0) occ[k] = v;
      }
  };
  fillPoly(hullBig, 2);
  osm.green.forEach((p) => fillPoly(pairs(p), 3));
  osm.water.forEach((p) => fillPoly(pairs(p), 6));
  for (const r of roadLines) stroke(r.pts, (ROAD_W[r.cls] * U) / 2 + 0.06, 1.2, 1);

  const facade = keep(facadeMaterial());
  const seedAttr = (g: THREE.BufferGeometry, s: number, kind: number) => g.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0).flatMap(() => [s, kind, 0]), 3));

  // Real OSM buildings: extruded footprints with real heights
  const osmGeos: THREE.BufferGeometry[] = [];
  for (const b of osm.buildings) {
    const h = Math.max(b[0], 4) * U, h0 = b[1] * U;
    const ring = pairs(b, 2);
    fillPoly(ring, 4);
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.y))), { depth: h - h0, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, h0, 0);
    seedAttr(g, rnd(), b[0] > 60 ? 2 : b[0] > 20 ? 1 : 0);
    g.deleteAttribute("uv");
    osmGeos.push(g);
    if (b[0] > 30) { const c = ring.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(ring.length); for (let k = 0; k < 6; k++) put(c.x + (rnd() - 0.5) * 0.2, h * rnd(), c.y + (rnd() - 0.5) * 0.2); }
  }
  if (osmGeos.length) {
    group.add(shadowy(new THREE.Mesh(keep(mergeGeometries(osmGeos)), facade)));
    osmGeos.forEach((x) => x.dispose());
  }

  // Procedural fill along the real streets
  const MAX = mobile ? 9000 : 24000;
  const box = keep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  box.deleteAttribute("uv");
  const fill = new THREE.InstancedMesh(box, facade, MAX);
  const seeds = new Float32Array(MAX * 3);
  const tanks: number[] = [];
  const aero = opts.keep.aerocity, cyber = opts.keep.cyber;
  const zoneOf = (x: number, z: number) => {
    const dc = Math.hypot(x - cyber.x, z - cyber.z), da = Math.hypot(x - aero.x, z - aero.z);
    if (dc < 14) return { kind: 2, h: [0.45, 1.5], w: [0.35, 0.7], gap: 0.12 };
    if (da < 6) return { kind: 1, h: [0.2, 0.55], w: [0.4, 0.8], gap: 0.1 };
    if (dc < 26) return { kind: 1, h: [0.12, 0.6], w: [0.2, 0.5], gap: 0.06 };
    return { kind: 0, h: [0.07, 0.2], w: [0.12, 0.28], gap: 0.03 };
  };
  const free = (x: number, z: number, hw: number, hd: number, th: number) => {
    const c = Math.cos(th), s = Math.sin(th);
    for (const [u, w] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd], [hw, 0], [-hw, 0], [0, hd], [0, -hd]]) {
      const k = ci(x + u * c - w * s, z + u * s + w * c);
      if (k < 0 || occ[k]) return false;
    }
    return true;
  };
  const mark = (x: number, z: number, hw: number, hd: number, th: number) => {
    const c = Math.cos(th), s = Math.sin(th);
    for (let u = -hw; u <= hw; u += CELL * 0.8) for (let w = -hd; w <= hd; w += CELL * 0.8) { const k = ci(x + u * c - w * s, z + u * s + w * c); if (k >= 0) occ[k] = 5; }
  };
  let count = 0;
  const tryPlace = (x: number, z: number) => {
    if (count >= MAX) return;
    const k = ci(x, z);
    if (k < 0 || occ[k]) return;
    const zn = zoneOf(x, z);
    const th = Number.isNaN(ang[k]) ? rnd() * Math.PI : ang[k];
    const w = zn.w[0] + rnd() * (zn.w[1] - zn.w[0]), d = w * (0.6 + rnd() * 0.8);
    const h = zn.h[0] + rnd() ** 2.2 * (zn.h[1] - zn.h[0]);
    if (!free(x, z, w / 2 + zn.gap, d / 2 + zn.gap, th)) return;
    mark(x, z, w / 2, d / 2, th);
    q.setFromAxisAngle(Y, -th);
    m4.compose(new THREE.Vector3(x, 0, z), q, sc.set(w, h, d));
    fill.setMatrixAt(count, m4);
    seeds.set([rnd(), zn.kind, 0], count * 3);
    if (zn.kind === 0 && rnd() < 0.55) tanks.push(x + (rnd() - 0.5) * w * 0.5, h, z + (rnd() - 0.5) * d * 0.5);
    if (rnd() < (zn.kind ? 0.6 : 0.25)) put(x, h * (0.3 + rnd() * 0.7), z);
    count++;
  };
  for (const r of roadLines) {
    for (let i = 1; i < r.pts.length && count < MAX; i++) {
      const a = r.pts[i - 1], b = r.pts[i], seg = a.distanceTo(b);
      if (!seg) continue;
      const nx = -(b.y - a.y) / seg, nz = (b.x - a.x) / seg;
      for (let s = 0; s < seg && count < MAX; s += 0.16)
        for (const sg of [-1, 1]) {
          const off = (ROAD_W[r.cls] * U) / 2 + 0.12 + rnd() * 0.5;
          tryPlace(a.x + ((b.x - a.x) * s) / seg + nx * off * sg, a.y + ((b.y - a.y) * s) / seg + nz * off * sg);
        }
    }
  }
  for (let n = 0; n < MAX * 8 && count < MAX; n++) {
    const x = GX0 + rnd() * GW, z = GZ0 + rnd() * GH;
    if (rnd() > Math.exp(-Math.min(Math.hypot(x - t3.x, z - t3.z), Math.hypot(x - cyber.x, z - cyber.z)) / 45)) continue;
    tryPlace(x, z);
  }
  fill.count = count;
  box.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 3));
  group.add(shadowy(fill));

  // Rooftop water tanks (the black Sintex tanks on Delhi roofs)
  const tankGeo = keep(new THREE.CylinderGeometry(0.011, 0.011, 0.016, 10).translate(0, 0.008, 0));
  const tankMesh = new THREE.InstancedMesh(tankGeo, keep(new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5 })), tanks.length / 3);
  for (let i = 0; i < tanks.length / 3; i++) { m4.makeTranslation(tanks[i * 3], tanks[i * 3 + 1], tanks[i * 3 + 2]); tankMesh.setMatrixAt(i, m4); }
  group.add(shadowy(tankMesh));

  // Trees: neem/peepal canopies along streets and through parks
  const TREES = mobile ? 6000 : 18000;
  const canopy = keep(new THREE.IcosahedronGeometry(1, 1));
  const trees = new THREE.InstancedMesh(canopy, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: false })), TREES);
  let tn = 0;
  const tcol = new THREE.Color();
  const plant = (x: number, z: number) => {
    if (tn >= TREES) return;
    const k = ci(x, z);
    if (k >= 0 && occ[k] !== 0 && occ[k] !== 3) return; // never on roads, the airfield, buildings or water
    const r = 0.035 + rnd() * 0.05;
    m4.compose(new THREE.Vector3(x, r * 0.95, z), q.setFromAxisAngle(Y, rnd() * 6), sc.set(r, r * (0.75 + rnd() * 0.3), r));
    trees.setMatrixAt(tn, m4);
    trees.setColorAt(tn, tcol.setHSL(0.24 + rnd() * 0.06, 0.32 + rnd() * 0.15, 0.2 + rnd() * 0.1));
    tn++;
  };
  for (const r of roadLines) {
    if (r.cls < 1) continue;
    const off = (ROAD_W[r.cls] * U) / 2 + 0.05;
    for (let i = 1; i < r.pts.length && tn < TREES * 0.6; i++) {
      const a = r.pts[i - 1], b = r.pts[i], seg = a.distanceTo(b);
      if (!seg) continue;
      const nx = -(b.y - a.y) / seg, nz = (b.x - a.x) / seg;
      for (let s = rnd() * 0.12; s < seg; s += 0.12 + rnd() * 0.1) for (const sg of [-1, 1]) if (rnd() < 0.7) plant(a.x + ((b.x - a.x) * s) / seg + nx * off * sg, a.y + ((b.y - a.y) * s) / seg + nz * off * sg);
    }
  }
  for (let n = 0; n < TREES * 30 && tn < TREES; n++) {
    const x = GX0 + rnd() * GW, z = GZ0 + rnd() * GH, k = ci(x, z);
    if (k >= 0 && occ[k] === 3) plant(x, z);
  }
  trees.count = tn;
  group.add(shadowy(trees));

  // ---------- Terminal 3 (approximated massing in the real apron void) ----------
  const term = new THREE.Group();
  const roofMat = keep(new THREE.MeshStandardMaterial({ color: 0xe4e2de, metalness: 0.55, roughness: 0.35 }));
  const glassBox = (w: number, h: number, d: number) => { const g = keep(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)); seedAttr(g, 0.5, 3); return g; };
  const skyMat = keep(new THREE.MeshStandardMaterial({ color: 0x9fc0d8, metalness: 0.9, roughness: 0.08 }));
  const roofOn = (w: number, d: number, h: number) => {
    const r = new THREE.Group();
    const slab = shadowy(new THREE.Mesh(keep(new THREE.BoxGeometry(w + 0.06, 0.012, d + 0.08)), roofMat));
    slab.position.y = h + 0.006;
    r.add(slab);
    for (let k = -2; k <= 2; k++) {
      const strip = new THREE.Mesh(keep(new THREE.BoxGeometry(w * 0.92, 0.004, 0.02)), skyMat);
      strip.position.set(0, h + 0.013, (k * d) / 6);
      r.add(strip);
    }
    return r;
  };
  const proc = new THREE.Group();
  proc.add(shadowy(new THREE.Mesh(glassBox(4.2, 0.24, 1.7), facade)), roofOn(4.2, 1.7, 0.24));
  proc.position.set(-6.2, 0, -34.4);
  proc.rotation.y = -1.27;
  term.add(proc);
  const gates: { p: THREE.Vector3; out: THREE.Vector3 }[] = [];
  const pier = (from: THREE.Vector2, to: THREE.Vector2) => {
    const plen = from.distanceTo(to), th = Math.atan2(to.y - from.y, to.x - from.x);
    const g = new THREE.Group();
    const body = shadowy(new THREE.Mesh(glassBox(plen, 0.17, 0.42), facade));
    body.position.x = plen / 2;
    const roof = roofOn(plen, 0.42, 0.17);
    roof.position.x = plen / 2;
    g.add(body, roof);
    g.position.set(from.x, 0, from.y);
    g.rotation.y = -th;
    term.add(g);
    const d = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)), n = new THREE.Vector3(-d.z, 0, d.x);
    for (let s = 0.6; s < plen - 0.2; s += 0.62) for (const sg of [-1, 1]) gates.push({ p: new THREE.Vector3(from.x, 0, from.y).addScaledVector(d, s).addScaledVector(n, 0.21 * sg), out: n.clone().multiplyScalar(sg) });
  };
  pier(new THREE.Vector2(-6.0, -35.4), new THREE.Vector2(-5.9, -39.3));
  pier(new THREE.Vector2(-6.7, -33.6), new THREE.Vector2(-8.1, -31.1));
  pier(new THREE.Vector2(-6.0, -33.2), new THREE.Vector2(-5.1, -30.5));
  group.add(term);

  // Jet bridges + parked aircraft at gates
  const bridges = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 0.035, 0.035).translate(0.5, 0.06, 0)), keep(new THREE.MeshStandardMaterial({ color: 0x9a9ca2, metalness: 0.6, roughness: 0.35 })), gates.length);
  const jetParts = [
    new THREE.CapsuleGeometry(0.019, 0.33, 4, 12).rotateZ(Math.PI / 2).translate(0, 0.045, 0),
    new THREE.BoxGeometry(0.06, 0.006, 0.34).translate(-0.01, 0.035, 0),
    new THREE.BoxGeometry(0.035, 0.004, 0.13).translate(-0.17, 0.05, 0),
    new THREE.BoxGeometry(0.06, 0.07, 0.004).translate(-0.17, 0.085, 0),
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12).rotateZ(Math.PI / 2).translate(0.02, 0.028, 0.08),
    new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12).rotateZ(Math.PI / 2).translate(0.02, 0.028, -0.08),
  ];
  const jetGeo = keep(mergeGeometries(jetParts.map((g) => g.toNonIndexed())));
  jetParts.forEach((g) => g.dispose());
  const jets = new THREE.InstancedMesh(jetGeo, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.3 })), gates.length);
  let gi = 0;
  const liveries = [0xf4f4f2, 0xf4f4f2, 0xf4f4f2, 0xa6763a, 0x1f4fa8, 0xd8262a, 0x1f8f87, 0xf0b400];
  gates.forEach((g) => {
    if (rnd() < 0.18) return;
    const thB = Math.atan2(-g.out.z, g.out.x);
    m4.compose(g.p.clone().setY(0), q.setFromAxisAngle(Y, thB), sc.set(0.16, 1, 1));
    bridges.setMatrixAt(gi, m4);
    m4.compose(g.p.clone().addScaledVector(g.out, 0.26), q.setFromAxisAngle(Y, thB + Math.PI), sc.set(1, 1, 1));
    jets.setMatrixAt(gi, m4);
    jets.setColorAt(gi, new THREE.Color(liveries[Math.floor(rnd() * liveries.length)]));
    gi++;
  });
  bridges.count = jets.count = gi;
  group.add(shadowy(bridges), shadowy(jets));

  // ---------- Traffic: real cars on motorway / trunk / primary (incl. Delhi's green-and-yellow CNG taxis) ----------
  const lanes = roadLines.filter((r) => r.cls <= 2 && r.pts.length > 1).map((r) => {
    const cum = [0];
    for (let i = 1; i < r.pts.length; i++) cum.push(cum[i - 1] + r.pts[i].distanceTo(r.pts[i - 1]));
    return { ...r, cum, len: cum[cum.length - 1] };
  }).filter((l) => l.len > 0.3);
  const totalLen = lanes.reduce((a, l) => a + l.len, 0);
  const NT = mobile ? 1200 : 3500;
  const carGeo = keep(mergeGeometries([new THREE.BoxGeometry(0.046, 0.012, 0.019).translate(0, 0.009, 0), new THREE.BoxGeometry(0.024, 0.009, 0.017).translate(-0.004, 0.019, 0)].map((g) => g.toNonIndexed())));
  const carMesh = new THREE.InstancedMesh(carGeo, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.35 })), NT);
  const CAR_COLS = [0xf2f2f0, 0xf2f2f0, 0xc9ccd1, 0x2a2c31, 0x8a8f99, 0xb3262a, 0x1f4f8a, 0x3f9a3a, 0xe9c21a];
  const cars = Array.from({ length: NT }, (_, i) => {
    let pick = rnd() * totalLen, li = 0;
    while (pick > lanes[li].len && li < lanes.length - 1) pick -= lanes[li++].len;
    carMesh.setColorAt(i, new THREE.Color(CAR_COLS[Math.floor(rnd() * CAR_COLS.length)]));
    return { li, s: rnd() * lanes[li].len, v: (0.1 + rnd() * 0.08) * (rnd() < 0.5 ? 1 : -1) };
  });
  carMesh.castShadow = true;
  group.add(carMesh);
  let lastT = 0;
  const cp = new THREE.Vector3();

  return {
    group,
    runway: { thr, dir, side, len, center },
    lights: new Float32Array(L),
    update: (time) => {
      const dt = Math.min(0.1, Math.max(0, time - lastT));
      lastT = time;
      for (let i = 0; i < NT; i++) {
        const c = cars[i], l = lanes[c.li];
        c.s = (((c.s + c.v * dt) % l.len) + l.len) % l.len;
        let j = 1;
        while (j < l.cum.length - 1 && l.cum[j] < c.s) j++;
        const a = l.pts[j - 1], b = l.pts[j], t = (c.s - l.cum[j - 1]) / (l.cum[j] - l.cum[j - 1] || 1);
        const seg = a.distanceTo(b) || 1, nx = -(b.y - a.y) / seg, nz = (b.x - a.x) / seg, off = (c.v > 0 ? 1 : -1) * ROAD_W[l.cls] * U * 0.24;
        cp.set(a.x + (b.x - a.x) * t + nx * off, 0.003, a.y + (b.y - a.y) * t + nz * off);
        const heading = Math.atan2(b.y - a.y, b.x - a.x) + (c.v > 0 ? 0 : Math.PI);
        m4.compose(cp, q.setFromAxisAngle(Y, -heading), sc.set(1, 1, 1));
        carMesh.setMatrixAt(i, m4);
      }
      carMesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
