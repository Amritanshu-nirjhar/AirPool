"use client";
// One continuous daylight WebGL world for the opening narrative, driven by scroll progress (0..1):
// A  aircraft on approach over real Delhi (orbiting camera)      T  chase to touchdown on 29L, rise over the real airfield
// B  every light on the ground ignites and lifts into a spiral galaxy above T3 — everyone alone
// C  stars pair off into constellations of three — matched co-travellers
// D  constellations rain down into a river along the real T3 → Cyber City route; a comet carries it home and bursts
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PLACES, ROUTES } from "@/lib/geo";
import type { LngLat } from "@/lib/types";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildAircraft } from "./aircraft";
import { buildWorld } from "./world";
import { buildStars } from "./stars";

const [LNG0, LAT0] = [77.09, 28.525];
const K = 111.32 * 10; // 1 unit = 100 m
const proj = ([lng, lat]: LngLat, y = 0) => new THREE.Vector3((lng - LNG0) * K * Math.cos((LAT0 * Math.PI) / 180), y, -(lat - LAT0) * K);
const curveOf = (coords: LngLat[], y: number) => {
  const step = Math.max(1, Math.floor(coords.length / 160));
  return new THREE.CatmullRomCurve3(coords.filter((_, i) => i % step === 0 || i === coords.length - 1).map((c) => proj(c, y)), false, "centripetal");
};
const clamp = (t: number) => Math.min(Math.max(t, 0), 1);
const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export const STAGES = { A: [0, 0.22], T: [0.22, 0.4], B: [0.4, 0.64], C: [0.64, 0.82], D: [0.82, 1] } as const;

export default function JourneyScene({ progress, reduced, onFail, onReady }: { progress: React.RefObject<number>; reduced: boolean; onFail: () => void; onReady?: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
    } catch {
      onFail();
      return;
    }
    const mobile = window.innerWidth < 768;
    // Quality tier: phones, low-memory/low-core devices and Data Saver get a lighter world (fewer stars, no shadows)
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lite = mobile || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 || !!nav.connection?.saveData;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.25 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !lite;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const HAZE = new THREE.Color(0xe2c7a3); // warm golden-hour haze: the city fades into it
    scene.fog = new THREE.FogExp2(HAZE, 0.0075);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.003, 1500);

    // Delhi afternoon sun from the south-west, ~38° up
    const sunDir = new THREE.Vector3(-0.78, 0.26, 0.5).normalize(); // golden hour: low sun from the west-south-west, long shadows
    const sun = new THREE.DirectionalLight(0xffc68f, 3.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.002;
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xa9bbd8, 0x7a5c40, 0.75));

    // Glow sprite texture (comet head, aircraft lights)
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g2 = cv.getContext("2d")!;
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.22, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);

    // ---------- Daylight sky: deep zenith blue → warm Delhi haze at the horizon, sun disk + glow ----------
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: { uSun: { value: sunDir }, uDeep: { value: 0 }, uHor: { value: HAZE } },
        vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        // linear colours: the horizon equals the fog colour so terrain melts into the haze without a seam
        fragmentShader: `uniform vec3 uSun; uniform float uDeep; uniform vec3 uHor; varying vec3 vDir;
          void main(){ float h = vDir.y; float s = max(dot(vDir, uSun), 0.0);
            vec3 zen = mix(vec3(0.07,0.2,0.48), vec3(0.012,0.06,0.32), uDeep);
            vec3 hor = uHor;
            vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.6));
            c += vec3(1.0,0.7,0.42) * pow(s, 4.0) * 0.45 * (1.0 - smoothstep(0.0, 0.45, h));
            c += vec3(1.0,0.88,0.7) * (pow(s, 1400.0) * 14.0 + pow(s, 30.0) * 0.55);
            c = mix(hor, c, smoothstep(-0.06, 0.0, h));
            gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    sky.renderOrder = -1;
    scene.add(sky);
    // Environment for reflections (glass towers, aircraft paint): the same sky, baked once
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(sky.geometry, sky.material));
    envScene.add(new THREE.HemisphereLight(0xffe2c0, 0x6a5038, 1));
    const envTex = pmrem.fromScene(envScene, 0.01).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.8;

    // ---------- Ground world: real OSM airport, roads, buildings, trees, traffic (see world.ts) ----------
    const t3 = proj(PLACES.t3.coord);
    const cyber = proj(PLACES.cyberCity.coord);
    const world = buildWorld({ mobile: lite, t3, keep: { cyber, aerocity: proj(PLACES.aerocity.coord) } });
    scene.add(world.group);
    const rwDir = world.runway.dir;
    const thr = world.runway.thr;

    // ---------- Stars ----------
    const route = curveOf(ROUTES.solo.coordinates, 0.05);
    const galaxy = t3.clone().add(new THREE.Vector3(2, 18, 6));
    const stars = buildStars({ lights: world.lights, count: lite ? 4000 : 14000, center: galaxy, route, glowTex: tex });
    scene.add(stars.points, stars.lines, stars.head, stars.ring, stars.trail);

    // ---------- Aircraft ----------
    const plane = buildAircraft(tex, lite ? "low" : "high");
    const S = 0.011; // ≈ real size: 37.6 m fuselage on a 45 m runway
    const F = S / 0.12;
    plane.group.scale.setScalar(S);
    plane.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
    scene.add(plane.group);
    const APP = 60, ALT = APP * Math.tan((3 * Math.PI) / 180);
    const GEAR = 4.2 * S + 0.006;
    const approachStart = thr.clone().addScaledVector(rwDir, -APP).setY(ALT);
    const rollEnd = thr.clone().addScaledVector(rwDir, 14).setY(GEAR);
    const touch = thr.clone().addScaledVector(rwDir, 3).setY(GEAR);
    const planeAt = (a: number) => {
      if (a < 0.8) {
        const k = a / 0.8;
        const pos = approachStart.clone().lerp(touch, k);
        pos.y = GEAR + (ALT - GEAR) * Math.pow(1 - k, 1.15);
        return { pos, pitch: 0.05 + (k > 0.93 ? (k - 0.93) * 1.1 : 0) };
      }
      const k = (a - 0.8) / 0.2;
      return { pos: touch.clone().lerp(rollEnd, 1 - (1 - k) ** 2), pitch: Math.max(0, 0.11 - k * 0.4) };
    };
    plane.group.rotation.order = "YZX";
    plane.group.rotation.y = Math.atan2(-rwDir.z, rwDir.x);

    // ---------- DOM tag for the comet ----------
    const tagLayer = document.createElement("div");
    tagLayer.className = "pointer-events-none absolute inset-0";
    tagLayer.setAttribute("aria-hidden", "true");
    el.appendChild(tagLayer);
    const cometTag = document.createElement("div");
    cometTag.className = "absolute left-0 top-0 whitespace-nowrap rounded-full border border-text/10 bg-paper/90 px-3 py-1 font-mono text-[11px] text-text shadow-sm backdrop-blur";
    cometTag.textContent = "3 riders · 1 car · ₹150 each est.";
    cometTag.style.opacity = "0";
    tagLayer.appendChild(cometTag);
    const placeTag = (t: HTMLElement, v: THREE.Vector3, op: number) => {
      const s = v.clone().project(camera);
      const vis = s.z < 1 && op > 0.01;
      t.style.opacity = vis ? String(op) : "0";
      if (vis) t.style.transform = `translate(${((s.x + 1) / 2) * el.clientWidth}px, ${((1 - s.y) / 2) * el.clientHeight - 26}px) translate(-50%, -100%)`;
    };

    // ---------- Camera rigs ----------
    const orbitCam = (target: THREE.Vector3, theta: number, radius: number, h: number) => target.clone().add(rwDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), theta).multiplyScalar(radius)).setY(target.y + h);
    const lookTop = t3.clone().lerp(rollEnd, 0.45);
    const camTop = lookTop.clone().add(new THREE.Vector3(-6, 9, 13)); // sun behind the camera
    const camSky = t3.clone().add(new THREE.Vector3(-30, 5, 36)); // looking up into the galaxy
    const routeMid = t3.clone().lerp(cyber, 0.48);
    const camRoute = cyber.clone().add(new THREE.Vector3(-17, 15, 24)); // south-west of Cyber City, route running away to T3

    // Cinematic bloom: only HDR (star cores, sun, comet) blooms in daylight
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), mobile ? 0.35 : 0.5, 0.45, 0.96);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.fov = w < 768 ? 55 : 38;
      camera.updateProjectionMatrix();
      stars.setPx((h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    let sp = progress.current ?? 0;
    let last = performance.now();
    const start = last;
    let raf = 0;
    let shadowSize = 0;
    let readySent = false;
    const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();

    // Adaptive quality: sample the first ~2 s of real frames. If the device is struggling, step down once
    // (no bloom, 1× resolution, no shadows). Slow phones keep a smooth story instead of a stuttering one.
    let sampleFrames = 0, sampleMs = 0, degraded = false;
    const degrade = () => {
      degraded = true;
      bloom.enabled = false;
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      composer.setPixelRatio(1);
      resize();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const frameMs = now - last;
      if (!degraded && sampleFrames < 60 && frameMs > 0) {
        sampleFrames++;
        sampleMs += Math.min(frameMs, 500); // slow frames count (capped), so a struggling device is detected
        if (sampleFrames === 60 && sampleMs / sampleFrames > 40) degrade(); // under ~25 fps on average
      }
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      const time = reduced ? 0 : Math.max(0, now - start) / 1000;
      const target = progress.current ?? 0;
      sp = reduced ? target : sp + (target - sp) * (1 - Math.exp(-dt * 5));
      const p = sp;

      const pA = range(p, ...STAGES.A), pT = range(p, ...STAGES.T), pB = range(p, ...STAGES.B), pC = range(p, ...STAGES.C), pD = range(p, ...STAGES.D);
      const intro = reduced ? 1 : ease(clamp(time / 2.6));

      // Aircraft: approach → touchdown → rollout
      const a = 0.04 + 0.26 * pA + 0.7 * ease(pT);
      const { pos, pitch } = planeAt(a);
      plane.group.position.copy(pos);
      plane.group.position.y += reduced || a > 0.75 ? 0 : Math.sin(time * 0.8) * 0.12 * F;
      plane.group.rotation.z = pitch + (reduced ? 0 : Math.sin(time * 0.5) * 0.01);
      plane.group.rotation.x = reduced || a > 0.75 ? 0 : Math.sin(time * 0.37) * 0.025;
      plane.gear.visible = a > 0.55;
      plane.fans.forEach((f) => (f.rotation.x += dt * (a > 0.8 ? 2 : 9)));
      const blink = (time * 1.1) % 1;
      plane.beacons.forEach((b) => ((b.material as THREE.SpriteMaterial).opacity = blink < 0.12 ? 1 : 0.08));
      plane.strobes.forEach((b) => ((b.material as THREE.SpriteMaterial).opacity = (time * 0.9) % 1 < 0.06 ? 1 : 0));
      plane.group.visible = pB < 0.35;
      world.update(time);

      // Stars: ignite (B 0–.3), galaxy (B .15–1), constellations (C), river (D 0–.4), comet (D .4–.85), burst (D .82–1)
      const ignite = ease(range(pB, 0.02, 0.3));
      const k = ease(range(pB, 0.15, 1)) + ease(range(pC, 0.0, 0.55)) + ease(range(pD, 0, 0.42));
      const eat = ease(range(pD, 0.42, 0.86));
      stars.update({ k, time, ignite, eat, size: THREE.MathUtils.lerp(0.06, 0.32, clamp(k)) - 0.14 * clamp(k - 2), lines: range(pC, 0.6, 0.8) * (1 - range(pD, 0, 0.2)), burst: range(pD, 0.84, 1) });
      (sky.material as THREE.ShaderMaterial).uniforms.uDeep.value = clamp(k) * (1 - clamp(k - 2)) * 0.9;

      // Camera: orbit (A) → chase → oblique airfield (T) → up into the galaxy (B) → orbit constellations (C) → route vista (D)
      const theta = THREE.MathUtils.lerp(Math.PI * 0.27, Math.PI * 0.92, ease(pA)) + (reduced ? 0 : Math.sin(time * 0.12) * 0.08);
      const radius = ((mobile ? 13 : 10) - pA * 2.5 + (1 - intro) * 7) * F;
      const camOrbit = orbitCam(pos, theta, radius, THREE.MathUtils.lerp(-0.2, 1.6, pA) * F);
      const lookOrbit = pos.clone().addScaledVector(rwDir, pA * 2.5 * F);
      const eRise = ease(range(pT, 0.55, 1));
      const chase = pos.clone().addScaledVector(rwDir, -9 * F).setY(pos.y + 2.2 * F);
      tmpPos.copy(camOrbit).lerp(chase, ease(range(pT, 0, 0.4))).lerp(camTop, eRise);
      tmpLook.copy(lookOrbit).lerp(pos.clone().addScaledVector(rwDir, 3 * F), ease(range(pT, 0, 0.4))).lerp(lookTop, eRise);
      const eSky = ease(range(pB, 0.2, 0.85));
      if (eSky > 0) {
        tmpPos.lerp(camSky, eSky);
        tmpLook.lerp(galaxy, eSky);
      }
      if (pC > 0) {
        // fly up through the disk and look down on the constellations
        const orb = camSky.clone().sub(galaxy).multiplyScalar(THREE.MathUtils.lerp(1, 0.62, ease(pC))).applyAxisAngle(new THREE.Vector3(0, 1, 0), ease(pC) * 0.9).add(galaxy);
        orb.y = THREE.MathUtils.lerp(camSky.y, galaxy.y + 22, ease(range(pC, 0, 0.7)));
        tmpPos.copy(orb);
        tmpLook.copy(galaxy);
      }
      if (pD > 0) {
        const eR = ease(range(pD, 0, 0.45));
        tmpPos.lerp(camRoute, eR);
        tmpLook.lerp(routeMid, eR);
        const dolly = ease(range(pD, 0.5, 1));
        tmpPos.lerp(cyber.clone().add(new THREE.Vector3(-9, 7, 13)), dolly * 0.55);
      }
      const w = el.clientWidth, h = el.clientHeight;
      const heroK = 1 - ease(clamp(pA * 1.6));
      const panelB = Math.sin(Math.PI * clamp(pB)) * (1 - clamp(pC * 3));
      const shift = w >= 1024 ? 0.24 * heroK - 0.15 * panelB : 0;
      const lift = w < 768 ? h * 0.3 * heroK : h * 0.1 * heroK;
      if (Math.abs(shift) > 0.001 || lift > 1) camera.setViewOffset(w, h, -w * shift, lift, w, h);
      else camera.clearViewOffset();
      camera.position.copy(tmpPos);
      camera.lookAt(tmpLook);
      sky.position.copy(camera.position);

      // Sun shadows follow what the camera is looking at
      const dist = camera.position.distanceTo(tmpLook);
      const want = THREE.MathUtils.clamp(dist * 0.8, 1.2, 40);
      if (Math.abs(want - shadowSize) / want > 0.08) {
        shadowSize = want;
        const c = sun.shadow.camera;
        c.left = c.bottom = -want;
        c.right = c.top = want;
        c.near = 0.1;
        c.far = want * 6 + 20;
        c.updateProjectionMatrix();
      }
      sun.target.position.copy(tmpLook);
      sun.position.copy(tmpLook).addScaledVector(sunDir, want * 3 + 10);

      // Haze thins as we leave the ground; the city stays visible below the galaxy
      (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.02, 0.0065, ease(clamp(pA * 0.5 + pT))); // denser haze in the hero: city reads as soft silhouettes

      placeTag(cometTag, stars.head.position, stars.head.visible ? clamp((eat - 0.03) * 10) * clamp((0.97 - eat) * 10) : 0);

      composer.render();
      if (!readySent) { readySent = true; onReady?.(); }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      plane.dispose();
      world.dispose();
      stars.dispose();
      composer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mm) ? mm : mm ? [mm] : []).forEach((x) => x.dispose());
      });
      tex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, [progress, reduced, onFail, onReady]);

  return <div ref={host} className="absolute inset-0" />;
}
