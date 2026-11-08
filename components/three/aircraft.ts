// Procedural narrow-body airliner (A320-class proportions, metres). Nose points +X, up +Y, starboard +Z.
// Built from lathed bodies and lofted NACA airfoil sections; no external model or licence needed.
import * as THREE from "three";

type V3 = THREE.Vector3;

/** NACA 4-digit loop (TE → upper → LE → lower → TE), x in 0..1 from leading edge. */
function airfoil(n: number, t: number, m = 0.02, p = 0.4): [number, number][] {
  const up: [number, number][] = [], lo: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    up.push([x, yc + yt]);
    lo.push([x, yc - yt]);
  }
  return [...up.reverse(), ...lo.slice(1)];
}

/** Airfoil section in 3D: leading-edge point, chord running aft (−X), thickness along `axis`. */
function section(le: V3, chord: number, t: number, axis: "y" | "z", n = 22, camber = 0.02): V3[] {
  return airfoil(n, t, camber).map(([x, y]) =>
    axis === "y" ? new THREE.Vector3(le.x - x * chord, le.y + y * chord, le.z) : new THREE.Vector3(le.x - x * chord, le.y, le.z + y * chord),
  );
}

/** Skin consecutive closed sections into one mesh, with end caps. */
function loft(sections: V3[][], colors?: THREE.Color[]): THREE.BufferGeometry {
  const n = sections[0].length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  sections.forEach((s, k) => s.forEach((v) => (pos.push(v.x, v.y, v.z), colors && col.push(colors[k].r, colors[k].g, colors[k].b))));
  for (let k = 0; k < sections.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + ((i + 1) % n), c = (k + 1) * n + i, d = (k + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  for (const [k, flip] of [[0, true], [sections.length - 1, false]] as const) {
    const s = sections[k];
    const cen = s.reduce((acc, v) => acc.add(v), new THREE.Vector3()).divideScalar(n);
    const ci = pos.length / 3;
    pos.push(cen.x, cen.y, cen.z);
    if (colors) col.push(colors[k].r, colors[k].g, colors[k].b);
    for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + ((i + 1) % n);
      if (flip) idx.push(ci, b, a);
      else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const mirrorZ = (g: THREE.BufferGeometry) => {
  const m = g.clone().scale(1, 1, -1);
  const i = m.index!.array as Uint16Array | Uint32Array;
  for (let k = 0; k < i.length; k += 3) [i[k + 1], i[k + 2]] = [i[k + 2], i[k + 1]];
  m.computeVertexNormals();
  return m;
};

const R = 1.98; // fuselage radius
const HALF = 18.8; // half length
export function fuselageRadius(x: number): number {
  if (x > 10) return R * Math.pow(Math.max(0, 1 - ((x - 10) / (HALF - 10)) ** 2), 0.5);
  if (x < -6) return R - (R - 0.3) * Math.pow((-6 - x) / (HALF - 6), 1.35);
  return R;
}
const upsweep = (x: number) => (x < -6 ? 1.5 * Math.pow((-6 - x) / (HALF - 6), 1.7) : x > 12 ? -0.3 * ((x - 12) / (HALF - 12)) ** 2 : 0);

/**
 * Painted fuselage skin. The lathe's UVs are swapped so canvas X runs nose-ward along the body and canvas Y runs around it
 * (φ: 0 = belly, π/2 = port, π = crown, 3π/2 = starboard). Everything is drawn in metres via `at(x, yAbs, side)`.
 */
function paintLivery(hi: boolean) {
  const W = hi ? 4096 : 2048, H = W / 4, LEN = 2 * HALF;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return [c, c.getContext("2d")!] as const;
  };
  const [cCol, col] = mk(), [cEm, em] = mk(), [cBump, bump] = mk();
  const xPx = (x: number) => ((x + HALF) / LEN) * W;
  const tPx = (phi: number) => (1 - phi / (Math.PI * 2)) * H;
  const phiAt = (y: number, z: number) => { const a = Math.atan2(-z, -y); return a < 0 ? a + Math.PI * 2 : a; };
  const at = (x: number, y: number, side: 1 | -1) => {
    const r = fuselageRadius(x), yy = Math.max(-r, Math.min(r, y));
    let ph = phiAt(yy, side * Math.sqrt(Math.max(r * r - yy * yy, 0)));
    if (side > 0 && ph < 1) ph += Math.PI * 2; // starboard lives in [π, 2π]; keep its belly seam at 2π
    return [xPx(x), tPx(ph)] as const;
  };
  const SIDES = [1, -1] as const;
  /** Fill between two height-ratio curves (y / r) on both sides. */
  const band = (ctx: CanvasRenderingContext2D, lo: (x: number) => number, hi2: (x: number) => number, fill: string, x0 = -HALF, x1 = HALF) => {
    ctx.fillStyle = fill;
    for (const sd of SIDES) {
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 0.05) { const [px, py] = at(x, lo(x) * fuselageRadius(x), sd); ctx.lineTo(px, py); }
      for (let x = x1; x >= x0; x -= 0.05) { const [px, py] = at(x, hi2(x) * fuselageRadius(x), sd); ctx.lineTo(px, py); }
      ctx.fill();
    }
  };
  const poly = (ctx: CanvasRenderingContext2D, pts: [number, number][], sd: 1 | -1) => {
    ctx.beginPath();
    pts.forEach(([x, y]) => { const [px, py] = at(x, y, sd); ctx.lineTo(px, py); });
    ctx.closePath();
  };
  const sm = (t: number) => { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); };
  const bellyTop = (x: number) => -0.42 + 0.3 * sm((x - 9) / 8) + 0.12 * sm((-x - 11) / 6);
  const stripeLo = (x: number) => bellyTop(x) + 0.07 + 0.55 * sm((-x - 8) / 9);
  const stripeHi = (x: number) => stripeLo(x) + 0.07 + 0.05 * sm((-x - 8) / 9);

  const draw = () => {
    // Base paint with a faint vertical sheen variation (real paint isn't one flat value)
    const g = col.createLinearGradient(0, 0, 0, H);
    [[0, "#d9d2cc"], [0.25, "#ece6df"], [0.5, "#f3eee8"], [0.75, "#ece6df"], [1, "#d9d2cc"]].forEach(([o, c]) => g.addColorStop(o as number, c as string));
    col.fillStyle = g;
    col.fillRect(0, 0, W, H);
    em.fillStyle = "#000";
    em.fillRect(0, 0, W, H);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, W, H);

    band(col, () => -1.01, bellyTop, "#0f3d34");
    band(col, stripeLo, stripeHi, "#b8935a", -HALF, 15.8);
    band(col, (x) => stripeHi(x) + 0.03, (x) => stripeHi(x) + 0.045, "#e2c896", -HALF, 15.2);
    // Radome: slightly different grey, as composite noses weather differently
    col.fillStyle = "rgba(150,140,140,0.35)";
    col.fillRect(xPx(17.3), 0, W - xPx(17.3), H);

    // Panel seams (bump): frame stations + lap joints
    bump.strokeStyle = "#5a5a5a";
    bump.lineWidth = hi ? 2 : 1;
    for (let x = -16; x < 17.5; x += 1.6) { bump.beginPath(); bump.moveTo(xPx(x), 0); bump.lineTo(xPx(x), H); bump.stroke(); }
    for (const phi of [0.6, 1.25, 1.95, Math.PI, 2 * Math.PI - 1.95, 2 * Math.PI - 1.25, 2 * Math.PI - 0.6]) { bump.beginPath(); bump.moveTo(0, tPx(phi)); bump.lineTo(W, tPx(phi)); bump.stroke(); }

    for (const sd of SIDES) {
      // Cabin windows: flush, dark glass with warm interior light in the emissive map
      for (let x = -12.6; x <= 12.2; x += 0.82) {
        if (Math.abs(x - 1.5) < 0.6 || Math.abs(x + 9.8) < 0.6) continue;
        const pts: [number, number][] = [];
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; pts.push([x + Math.cos(a) * 0.12, 0.42 + Math.sin(a) * 0.17]); }
        poly(col, pts, sd); col.fillStyle = "#151019"; col.fill();
        col.strokeStyle = "rgba(60,50,60,0.6)"; col.lineWidth = hi ? 3 : 2; col.stroke();
        poly(em, pts, sd); em.fillStyle = Math.sin(x * 12.9 + sd) > -0.7 ? "#ffcf96" : "#3a2a1a"; em.fill();
        poly(bump, pts, sd); bump.fillStyle = "#6a6a6a"; bump.fill();
      }
      // Doors (L1/R1, L4/R4) and overwing exits: outlined in paint + bump
      for (const [x, w, y0, y1] of [[12.9, 0.85, -0.8, 1.15], [-13.5, 0.8, -0.75, 1.1], [1.5, 0.5, -0.1, 0.85], [-9.8, 0.5, -0.1, 0.85]] as const) {
        const pts: [number, number][] = [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, y1], [x - w / 2, y1]];
        for (const [ctx, c] of [[col, "rgba(70,60,70,0.55)"], [bump, "#4a4a4a"]] as const) { poly(ctx, pts, sd); ctx.strokeStyle = c; ctx.lineWidth = hi ? 3 : 2; ctx.stroke(); }
      }
      // Cockpit glazing: four panes per side with frames
      const panes: [number, number][] = [[14.75, 15.3], [15.36, 15.88], [15.94, 16.36], [16.42, 16.78]];
      panes.forEach(([a, b], i) => {
        const lo = 0.32 + i * 0.03, top = 0.86 - i * 0.07;
        poly(col, [[a, lo], [b, lo + 0.03], [b - 0.06, top - 0.04], [a + 0.04, top]], sd);
        col.fillStyle = "#0d0a12"; col.fill();
      });
      // Titles: "AirPool" (Fraunces italic, two-tone) above the windows, registration aft
      const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-serif") || "Georgia, serif";
      const r = fuselageRadius(5);
      const [cx, cy] = at(6.2, 1.12, sd);
      const mx = W / LEN, mt = H / (2 * Math.PI * r);
      col.save();
      col.translate(cx, cy);
      col.scale(sd > 0 ? mx : -mx, sd > 0 ? -mt : mt);
      col.font = `700 1px ${fam}`;
      col.textBaseline = "middle";
      const size = 1.25;
      col.scale(size, size);
      const wAir = col.measureText("Air").width, wPool = col.measureText("Pool").width;
      col.fillStyle = "#0f3d34";
      col.fillText("Air", -(wAir + wPool) / 2, 0);
      col.fillStyle = "#a6763a";
      col.fillText("Pool", -(wAir + wPool) / 2 + wAir, 0);
      col.restore();
      const [rx, ry] = at(-12.3, 0.95, sd);
      col.save();
      col.translate(rx, ry);
      col.scale(sd > 0 ? mx : -mx, sd > 0 ? -mt : mt);
      col.font = "600 0.32px ui-sans-serif, system-ui";
      col.textAlign = "center";
      col.textBaseline = "middle";
      col.fillStyle = "#3a3038";
      col.fillText("VT-APL", 0, 0);
      col.restore();
    }
  };
  draw();
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const map = tex(cCol, true), emissiveMap = tex(cEm, true), bumpMap = tex(cBump, false);
  // Fonts may still be loading on first paint: redraw once they're ready
  document.fonts?.ready.then(() => { draw(); map.needsUpdate = emissiveMap.needsUpdate = bumpMap.needsUpdate = true; });
  return { map, emissiveMap, bumpMap };
}

export interface Aircraft {
  group: THREE.Group;
  fans: THREE.Object3D[];
  gear: THREE.Group;
  beacons: THREE.Sprite[];
  strobes: THREE.Sprite[];
  dispose: () => void;
}

export function buildAircraft(glowTex: THREE.Texture, detail: "high" | "low" = "high"): Aircraft {
  const hi = detail === "high";
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const paint = keep(new THREE.MeshPhysicalMaterial({ color: 0xe6e0da, metalness: 0.3, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
  const wingMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xa4a7ae, metalness: 0.75, roughness: 0.38, clearcoat: 0.3, side: THREE.DoubleSide }));
  const tailMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xb8935a, emissive: 0x1a1206, metalness: 0.4, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }));
  const nacelleMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xdfe3e9, metalness: 0.55, roughness: 0.22, clearcoat: 0.7, side: THREE.DoubleSide }));
  const darkMetal = keep(new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.9, roughness: 0.38, side: THREE.DoubleSide }));
  // AirPool livery: aubergine belly, marigold cheatline, dusk-gradient tail lit by logo lights
  const bellyMat = keep(new THREE.MeshPhysicalMaterial({ color: 0x0f3d34, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }));
  const finMat = keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, emissive: 0x04110e, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }));

  // Fuselage (lathe around Y, then rotated so the axis is X)
  const prof: THREE.Vector2[] = [];
  const steps = hi ? 140 : 70;
  for (let i = 0; i <= steps; i++) {
    const x = -HALF + (2 * HALF * i) / steps;
    prof.push(new THREE.Vector2(Math.max(fuselageRadius(x), 0.001), x));
  }
  const fus = keep(new THREE.LatheGeometry(prof, hi ? 72 : 36));
  fus.rotateZ(-Math.PI / 2);
  fus.rotateX(Math.PI / 2);
  const p = fus.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + upsweep(p.getX(i)));
  fus.computeVertexNormals();
  const uv = fus.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i)); // canvas X = along body, Y = around
  const liv = paintLivery(hi);
  [liv.map, liv.emissiveMap, liv.bumpMap].forEach(keep);
  const skin = keep(new THREE.MeshPhysicalMaterial({ map: liv.map, emissive: 0xffffff, emissiveMap: liv.emissiveMap, emissiveIntensity: 0.22, bumpMap: liv.bumpMap, bumpScale: 1.2, metalness: 0.15, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.14 }));
  group.add(new THREE.Mesh(fus, skin));

  // Wing-body fairing
  const fair = keep(new THREE.SphereGeometry(1, 40, 20));
  const fairing = new THREE.Mesh(fair, bellyMat);
  fairing.scale.set(7.2, 1.05, 2.05);
  fairing.position.set(-1.2, -1.3, 0);
  group.add(fairing);

  const m4 = new THREE.Matrix4();

  // Wings: root, kink, tip — swept with dihedral
  const dih = (z: number) => -1.35 + (z - 1.6) * 0.088;
  const wingSecs = (zs: [number, number, number, number][]) => zs.map(([z, le, c, t]) => section(new THREE.Vector3(le, dih(z), z), c, t, "y"));
  const wingR = keep(loft(wingSecs([[1.6, 3.1, 6.8, 0.15], [6.4, 0.6, 4.1, 0.13], [16.8, -4.4, 1.55, 0.1]])));
  group.add(new THREE.Mesh(wingR, wingMat), new THREE.Mesh(keep(mirrorZ(wingR)), wingMat));

  // Flap-track fairings: the canoe pods under the trailing edge that make an airliner wing read as real
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const wingAt = (z: number) => {
    const [z0, le0, c0, z1, le1, c1] = z < 6.4 ? [1.6, 3.1, 6.8, 6.4, 0.6, 4.1] : [6.4, 0.6, 4.1, 16.8, -4.4, 1.55];
    const t = (z - z0) / (z1 - z0);
    return { le: lerp(le0, le1, t), c: lerp(c0, c1, t) };
  };
  const podGeo = keep(new THREE.SphereGeometry(1, 20, 10));
  for (const z of [3.6, 8.6, 11.4, 14.0]) {
    const { le, c } = wingAt(z);
    for (const sd of [1, -1]) {
      const pod = new THREE.Mesh(podGeo, wingMat);
      pod.scale.set(c * 0.42, 0.26, 0.2);
      pod.position.set(le - c * 0.85, dih(z) - 0.2, sd * z);
      pod.rotation.y = sd * -0.08;
      group.add(pod);
    }
  }

  // Sharklets
  const tipY = dih(16.8);
  const shark = keep(loft([
    section(new THREE.Vector3(-4.45, tipY + 0.05, 16.8), 1.5, 0.08, "z", 14, 0),
    section(new THREE.Vector3(-4.85, tipY + 0.55, 17.15), 1.15, 0.08, "z", 14, 0),
    section(new THREE.Vector3(-5.75, tipY + 2.3, 17.35), 0.55, 0.08, "z", 14, 0),
  ]));
  group.add(new THREE.Mesh(shark, tailMat), new THREE.Mesh(keep(mirrorZ(shark)), tailMat));

  // Horizontal stabiliser
  const hs = keep(loft([
    section(new THREE.Vector3(-13.9, 0.7, 0.4), 4.3, 0.11, "y", 18, 0),
    section(new THREE.Vector3(-17.3, 1.15, 6.2), 1.7, 0.09, "y", 18, 0),
  ]));
  group.add(new THREE.Mesh(hs, wingMat), new THREE.Mesh(keep(mirrorZ(hs)), wingMat));

  // Vertical fin: marigold root fading to aubergine tip
  const fin = keep(loft([
    section(new THREE.Vector3(-10.6, 1.2, 0), 7.2, 0.11, "z", 20, 0),
    section(new THREE.Vector3(-13.2, 4.2, 0), 4.6, 0.1, "z", 20, 0),
    section(new THREE.Vector3(-15.9, 7.7, 0), 2.6, 0.09, "z", 20, 0),
  ], [new THREE.Color(0xb8935a), new THREE.Color(0x1d5a4b), new THREE.Color(0x0f3d34)]));
  group.add(new THREE.Mesh(fin, finMat));

  // Engines: nacelle lathe, fan with blades, spinner, exhaust cone, pylon
  const fans: THREE.Object3D[] = [];
  const nacProf = [[0.6, 0], [0.78, 0.6], [0.95, 1.6], [1.04, 2.8], [1.04, 3.7], [1.0, 4.2], [0.9, 4.32], [0.84, 4.18], [0.86, 3.6]].map(([r, h]) => new THREE.Vector2(r, h));
  const nac = keep(new THREE.LatheGeometry(nacProf, hi ? 48 : 24));
  nac.rotateZ(-Math.PI / 2);
  const bladeGeo = keep(new THREE.BoxGeometry(0.04, 0.78, 0.16));
  const lipGeo = keep(new THREE.TorusGeometry(0.92, 0.075, 12, 48)).rotateY(Math.PI / 2);
  const lipMat = keep(new THREE.MeshPhysicalMaterial({ color: 0xd9dee5, metalness: 1, roughness: 0.12 }));
  for (const s of [1, -1]) {
    const eng = new THREE.Group();
    eng.add(new THREE.Mesh(nac, nacelleMat));
    const lip = new THREE.Mesh(lipGeo, lipMat); // polished intake lip
    lip.position.x = 4.26;
    eng.add(lip);
    const fan = new THREE.Group();
    fan.position.x = 3.7;
    fan.add(new THREE.Mesh(keep(new THREE.CircleGeometry(0.84, 36)).rotateY(Math.PI / 2).translate(-0.05, 0, 0), darkMetal));
    const blades = new THREE.InstancedMesh(bladeGeo, darkMetal, 22);
    for (let b = 0; b < 22; b++) {
      const a = (b / 22) * Math.PI * 2;
      m4.compose(new THREE.Vector3(0, Math.cos(a) * 0.46, Math.sin(a) * 0.46), new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0.5, 0)), new THREE.Vector3(1, 1, 1));
      blades.setMatrixAt(b, m4);
    }
    fan.add(blades);
    const spinner = new THREE.Mesh(keep(new THREE.ConeGeometry(0.26, 0.6, 24)).rotateZ(-Math.PI / 2).translate(0.28, 0, 0), keep(new THREE.MeshPhysicalMaterial({ color: 0x3a404b, metalness: 1, roughness: 0.2 })));
    fan.add(spinner);
    eng.add(fan);
    fans.push(fan);
    const core = new THREE.Mesh(keep(new THREE.ConeGeometry(0.5, 1.2, 24)).rotateZ(Math.PI / 2).translate(-0.55, 0, 0), darkMetal);
    eng.add(core);
    const pylon = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 0.95, 0.22)), paint);
    pylon.position.set(1.0, 0.95, 0);
    eng.add(pylon);
    eng.position.set(-0.4, dih(5.75) - 1.35, s * 5.75);
    group.add(eng);
  }

  // Lights: nav (port red, starboard green), white tail, red beacons, wingtip strobes
  const light = (color: number, size: number, pos: V3) => {
    const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
    sp.scale.setScalar(size);
    sp.position.copy(pos);
    group.add(sp);
    return sp;
  };
  light(0x3dff9a, 1.6, new THREE.Vector3(-4.5, tipY + 0.1, 16.95));
  light(0xff3b4a, 1.6, new THREE.Vector3(-4.5, tipY + 0.1, -16.95));
  light(0xffffff, 1.2, new THREE.Vector3(-HALF + 0.1, upsweep(-HALF) + 0.1, 0));
  const beacons = [light(0xff2a3a, 1.4, new THREE.Vector3(-1, R + 0.15, 0)), light(0xff2a3a, 1.4, new THREE.Vector3(-1, -R - 0.15, 0))];
  const strobes = [light(0xffffff, 1.9, new THREE.Vector3(-4.7, tipY + 0.1, 17)), light(0xffffff, 1.9, new THREE.Vector3(-4.7, tipY + 0.1, -17))];
  // Landing lights
  light(0xfff1d6, 2.2, new THREE.Vector3(1.8, -1.3, 2.4));
  light(0xfff1d6, 2.2, new THREE.Vector3(1.8, -1.3, -2.4));

  // Landing gear (deployed on approach): main bogies + nose gear. Ground contact at y = -4.2.
  const gear = new THREE.Group();
  const strutGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 10));
  const wheelGeo = keep(new THREE.CylinderGeometry(0.58, 0.58, 0.42, 20)).rotateX(Math.PI / 2);
  const tyre = keep(new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.9 }));
  for (const [x, z, n] of [[-2.2, 3.8, 2], [-2.2, -3.8, 2], [12, 0, 1]] as const) {
    const strut = new THREE.Mesh(strutGeo, darkMetal);
    strut.position.set(x, -2.6, z);
    gear.add(strut);
    for (let k = 0; k < n; k++) {
      const w = new THREE.Mesh(wheelGeo, tyre);
      w.position.set(x, -3.62, z + (n === 2 ? (k ? 0.3 : -0.3) : 0));
      if (n === 1) {
        w.scale.setScalar(0.75);
        w.position.y = -3.75;
      }
      gear.add(w);
    }
  }
  gear.visible = false;
  group.add(gear);

  return {
    group,
    fans,
    gear,
    beacons,
    strobes,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
