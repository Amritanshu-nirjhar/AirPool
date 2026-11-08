// "Every light becomes a star": a GPU particle system seeded from the real light positions of the world (runway, taxiway,
// approach and street lamps, building windows). Scroll drives uK through four formations, each particle on its own
// staggered, arcing flight:
//   0 ground lights → 1 spiral galaxy above T3 (everyone alone) → 2 constellations of three (matched co-travellers)
//   → 3 a river of stars along the real T3 → Cyber City route, then a comet sweeps it up (uEat) and bursts at Cyber City.
import * as THREE from "three";

const PALETTE = [0xd9b06a, 0x2f8f6f, 0xf3e6c8, 0xe8c48a, 0x7fc8a9, 0xffffff]; // brand: brass, emerald, cream

// Shared position logic for points and constellation lines (keeps lines glued to their stars)
const POS = /* glsl */ `
uniform float uK, uTime, uEat;
uniform vec3 uCenter;
attribute vec3 aG, aS, aC, aR;
attribute vec4 aRnd; // x stagger, y phase, z size, w route s
vec3 spin(vec3 p, float rate) {
  vec3 r = p - uCenter;
  float a = uTime * rate / (0.6 + length(r.xz) * 0.04);
  float c = cos(a), s = sin(a);
  return uCenter + vec3(c * r.x - s * r.z, r.y, s * r.x + c * r.z);
}
vec3 formation(int k) {
  if (k == 0) return aG;
  if (k == 1) return spin(aS, 0.12);
  if (k == 2) return spin(aC, 0.05);
  return aR;
}
vec3 starPos(out float travel) {
  float kk = clamp(uK, 0.0, 3.0);
  int k0 = int(min(floor(kk), 2.0));
  float lt = clamp((kk - float(k0)) * 1.7 - aRnd.x * 0.7, 0.0, 1.0);
  float e = lt * lt * (3.0 - 2.0 * lt);
  vec3 a = formation(k0), b = formation(k0 + 1);
  vec3 d = b - a;
  vec3 side = normalize(cross(d + vec3(0.0001), vec3(0.0, 1.0, 0.0)));
  float arc = sin(3.14159 * e);
  vec3 p = mix(a, b, e) + vec3(0.0, arc * (k0 == 0 ? 3.0 + aRnd.y * 5.0 : 1.5), 0.0) + side * arc * (aRnd.y - 0.5) * length(d) * 0.35;
  travel = arc;
  return p;
}`;

export interface Stars {
  points: THREE.Points;
  lines: THREE.LineSegments;
  head: THREE.Sprite;
  ring: THREE.Mesh;
  trail: THREE.Mesh;
  setPx: (px: number) => void;
  update: (s: { k: number; time: number; ignite: number; eat: number; size: number; lines: number; burst: number }) => void;
  dispose: () => void;
}

export function buildStars(opts: { lights: Float32Array; count: number; center: THREE.Vector3; route: THREE.Curve<THREE.Vector3>; glowTex: THREE.Texture }): Stars {
  const { lights, center, route } = opts;
  const total = lights.length / 3;
  const N = Math.min(opts.count, total) - (Math.min(opts.count, total) % 3);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const G = new Float32Array(N * 3), S = new Float32Array(N * 3), C = new Float32Array(N * 3), R = new Float32Array(N * 3), RND = new Float32Array(N * 4), COL = new Float32Array(N * 3);
  // ground: random subset of real light positions
  for (let i = 0; i < N; i++) {
    const j = Math.floor(rnd() * total);
    G.set([lights[j * 3], lights[j * 3 + 1], lights[j * 3 + 2]], i * 3);
  }
  // galaxy: three spiral arms around the centre, thicker core
  for (let i = 0; i < N; i++) {
    const r = 2 + Math.pow(rnd(), 0.7) * 30, arm = i % 3, th = (arm * Math.PI * 2) / 3 + r * 0.16 + (rnd() - 0.5) * 0.5;
    S.set([center.x + Math.cos(th) * r, center.y + (rnd() - 0.5) * (3 - r * 0.06) , center.z + Math.sin(th) * r], i * 3);
  }
  // constellations: groups of three on a golden-angle disk, each a small rotated triangle
  const groups = N / 3;
  const col = new THREE.Color();
  for (let g = 0; g < groups; g++) {
    const r = Math.sqrt(g / groups) * 28 + 1.5, th = g * 2.39996;
    const cx = center.x + Math.cos(th) * r, cz = center.z + Math.sin(th) * r, cy = center.y + (rnd() - 0.5) * 2;
    const rot = rnd() * Math.PI * 2, sz = 0.35 + rnd() * 0.35;
    col.setHex(PALETTE[g % PALETTE.length]);
    for (let m = 0; m < 3; m++) {
      const a = rot + (m * Math.PI * 2) / 3 + (rnd() - 0.5) * 0.6;
      const i = g * 3 + m;
      C.set([cx + Math.cos(a) * sz, cy + (rnd() - 0.5) * 0.3, cz + Math.sin(a) * sz], i * 3);
      COL.set([col.r, col.g, col.b], i * 3);
    }
  }
  // river: along the real route, jittered across the road and a little above it
  const pts = route.getSpacedPoints(1500);
  for (let i = 0; i < N; i++) {
    const s = rnd(), f = s * 1500, k = Math.min(1499, Math.floor(f));
    const p = pts[k].clone().lerp(pts[k + 1], f - k);
    const d = pts[k + 1].clone().sub(pts[k]).setY(0).normalize();
    const w = (rnd() - 0.5) * 0.5 * (0.4 + rnd());
    R.set([p.x - d.z * w, 0.08 + rnd() ** 2 * 0.6, p.z + d.x * w], i * 3);
    RND.set([rnd(), rnd(), 0.6 + rnd() ** 3 * 1.6, s], i * 4);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(G, 3));
  geo.setAttribute("aG", new THREE.BufferAttribute(G, 3));
  geo.setAttribute("aS", new THREE.BufferAttribute(S, 3));
  geo.setAttribute("aC", new THREE.BufferAttribute(C, 3));
  geo.setAttribute("aR", new THREE.BufferAttribute(R, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(RND, 4));
  geo.setAttribute("aCol", new THREE.BufferAttribute(COL, 3));
  geo.boundingSphere = new THREE.Sphere(center.clone(), 400);

  const uniforms = {
    uK: { value: 0 }, uTime: { value: 0 }, uEat: { value: 0 }, uIgnite: { value: 0 }, uSize: { value: 0.12 }, uPx: { value: 1000 }, uLines: { value: 0 },
    uCenter: { value: center.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      ${POS}
      attribute vec3 aCol;
      uniform float uIgnite, uSize, uPx;
      varying vec3 vCol; varying float vA; varying float vHot;
      void main() {
        float travel;
        vec3 p = starPos(travel);
        // river pulse: bright waves running toward Cyber City; the comet eats everything behind it
        float onRiver = smoothstep(2.4, 3.0, uK);
        float wave = pow(0.5 + 0.5 * sin(aRnd.w * 60.0 - uTime * 4.0), 10.0) * onRiver;
        float eaten = step(aRnd.w, uEat) * step(0.001, uEat);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
        float flash = uIgnite * (1.0 + 2.5 * exp(-pow((uIgnite - aRnd.x * 0.6 - 0.25) * 6.0, 2.0)));
        float tw = 0.7 + 0.3 * sin(uTime * (1.5 + aRnd.y * 3.0) + aRnd.y * 40.0);
        float sz = uSize * aRnd.z * flash * tw * (1.0 + travel * 0.8 + wave * 1.5) * (1.0 - eaten);
        gl_PointSize = clamp(sz * uPx / -mv.z, 0.0, 90.0);
        // ground lights are warm lamps; in the sky they take their constellation colour
        vec3 lamp = vec3(1.0, 0.82, 0.55);
        vCol = mix(lamp, aCol, smoothstep(0.15, 0.85, uK));
        vHot = wave + travel * 0.4;
        vA = clamp(flash, 0.0, 1.0) * (1.0 - eaten);
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      varying vec3 vCol; varying float vA; varying float vHot;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        float core = smoothstep(0.13, 0.0, r);
        float spike = smoothstep(0.03, 0.0, abs(d.x)) * smoothstep(0.5, 0.05, abs(d.y)) + smoothstep(0.03, 0.0, abs(d.y)) * smoothstep(0.5, 0.05, abs(d.x));
        float halo = smoothstep(0.5, 0.0, r);
        float a = clamp(core + spike * 0.9 + halo * halo * 0.7, 0.0, 1.0) * vA;
        if (a < 0.01) discard;
        // saturated colour so stars read against a daylight sky; HDR white core blooms
        vec3 c = mix(vCol, vec3(1.0), core * 0.65) * (1.0 + core * (1.4 + vHot * 2.0));
        gl_FragColor = vec4(c, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  // Constellation lines: each segment endpoint replicates its star's attributes so the same POS logic moves it
  const LG = Math.min(groups, 900);
  const lineAttr = (src: Float32Array, size: number) => {
    const out = new Float32Array(LG * 6 * size);
    let o = 0;
    for (let g = 0; g < LG; g++)
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) for (const m of [a, b]) { out.set(src.subarray((g * 3 + m) * size, (g * 3 + m) * size + size), o); o += size; }
    return new THREE.BufferAttribute(out, size);
  };
  const lgeo = new THREE.BufferGeometry();
  for (const [name, src, size] of [["position", G, 3], ["aG", G, 3], ["aS", S, 3], ["aC", C, 3], ["aR", R, 3], ["aRnd", RND, 4], ["aCol", COL, 3]] as const) lgeo.setAttribute(name, lineAttr(src, size));
  const lmat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      ${POS}
      attribute vec3 aCol;
      varying vec3 vCol;
      void main() {
        float travel;
        vec3 p = starPos(travel);
        vCol = aCol;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform float uLines;
      varying vec3 vCol;
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(vCol * 0.9, 0.9 * uLines);
      }`,
  });
  const lines = new THREE.LineSegments(lgeo, lmat);
  lines.frustumCulled = false;

  // Comet head + arrival shockwave
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.glowTex, color: new THREE.Color(0xd9a55a).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.scale.setScalar(1.2);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd9a55a).multiplyScalar(1.6), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  const end = route.getPointAt(1);
  ring.position.set(end.x, 0.06, end.z);

  // The shared route the comet leaves behind: drawn up to uDraw, with soft pulses flowing toward Cyber City
  const trailMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uDraw: { value: 0 }, uTime: uniforms.uTime },
    vertexShader: "#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n#include <logdepthbuf_vertex>\n}",
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform float uDraw, uTime; varying vec2 vUv;
      void main(){
        #include <logdepthbuf_fragment>
        if (vUv.x > uDraw) discard;
        float p = pow(1.0 - fract(vUv.x * 12.0 - uTime * 0.5), 5.0);
        vec3 c = mix(vec3(0.65,0.46,0.23), vec3(1.0,0.9,0.7), p);
        gl_FragColor = vec4(c * (1.0 + p * 1.5), 0.95);
      }`,
  });
  const trail = new THREE.Mesh(new THREE.TubeGeometry(route, 700, 0.07, 8), trailMat);
  trail.position.y = 0.06;
  trail.frustumCulled = false;

  return {
    points,
    lines,
    head,
    ring,
    trail,
    setPx: (px) => (uniforms.uPx.value = px),
    update: ({ k, time, ignite, eat, size, lines: l, burst }) => {
      uniforms.uK.value = k;
      uniforms.uTime.value = time;
      uniforms.uIgnite.value = ignite;
      uniforms.uEat.value = eat;
      uniforms.uSize.value = size;
      uniforms.uLines.value = l;
      points.visible = ignite > 0.001;
      lines.visible = l > 0.01;
      head.visible = eat > 0.001 && eat < 0.999;
      if (head.visible) {
        const p = route.getPointAt(Math.min(eat, 1));
        head.position.set(p.x, 0.25, p.z);
        head.scale.setScalar(1.1 + Math.sin(time * 9) * 0.12);
      }
      trailMat.uniforms.uDraw.value = eat;
      trail.visible = eat > 0.001;
      // shockwave on arrival, then a calm repeating beacon over Cyber City
      const pulse = burst < 1 ? burst : (time * 0.45) % 1;
      ring.visible = burst > 0.001;
      ring.scale.setScalar(0.3 + pulse * (burst < 1 ? 9 : 4));
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * (burst < 1 ? 0.9 : 0.6);
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      lgeo.dispose();
      lmat.dispose();
      (head.material as THREE.Material).dispose();
      ring.geometry.dispose();
      trail.geometry.dispose();
      trailMat.dispose();
      (ring.material as THREE.Material).dispose();
    },
  };
}
