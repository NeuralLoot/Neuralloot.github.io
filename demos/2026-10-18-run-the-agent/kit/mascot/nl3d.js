// NeuralLoot 3D kit (three.js r170). Deterministic: every frame is a pure function of t (plus sequential
// AfterimagePass history, rendered in order from frame 0). No Math.random: use rng(seed).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
export { THREE };

export const PAL = { bg: 0x07070c, brown: 0x7a4a2e, line: 0xc98a5c, amber: 0xffb867, gold: 0xffd36b,
  cyan: 0x2de2ff, magenta: 0xff2e88, violet: 0x8b5cf6, gray: 0xd9d7d4 };

// ---------- math / easing / spring physics (closed form -> deterministic)
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = x => x * x * (3 - 2 * x);
export const smoother = x => x * x * x * (x * (6 * x - 15) + 10);
export const lerp = (a, b, u) => a + (b - a) * u;
/** damped spring step response 0->1, zeta<1 overshoots. t in seconds since release. */
export function spring(t, zeta = 0.35, freq = 2.2) {
  if (t <= 0) return 0; const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}
/** wobble around 1: impulse response for squash recovery */
export const wobble = (t, amp = 0.3, zeta = 0.22, freq = 3.0) => t <= 0 ? 0 :
  amp * Math.exp(-zeta * 2 * Math.PI * freq * t) * Math.cos(2 * Math.PI * freq * Math.sqrt(1 - zeta * zeta) * t);
/** anticipation: dip back by `back`, then spring forward */
export const anticipate = (t, dur = 0.25, back = 0.2) => t < dur ? -back * smooth(t / dur) : -back + (1 + back) * spring(t - dur);
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Weighted arc hop. Phases: anticipation crouch (~30%) reached early then HELD, launch stretch, slow-in/slow-out
 * hang around the apex, faster (gravity-like) fall with stretch, contact squash, damped wobble.
 * returns {x,y,z,sx,sy,air,contact,launch}; register whoosh at `launch`, clack at `contact`. */
export function hop(t, t0, dur, from, to, h = 1, crouch = 0.3) {
  const u = (t - t0) / dur, P0 = 0.3, P1 = 0.74, RISE = 0.62;           // crouch+hold | air (rise 62% / fall 38%) | land
  let p = from.slice(), sy = 1, air = 0;
  if (u <= 0) sy = 1;
  else if (u < P0) { const c = u / P0; sy = 1 - crouch * smooth(clamp(c / 0.55)) - 0.03 * Math.sin(Math.PI * clamp((c - 0.55) / 0.45)); } // squash, then hold (tiny tremble)
  else if (u < P1) {
    const v = (u - P0) / (P1 - P0); let hh, k;
    if (v < RISE) { const w = v / RISE; hh = 1 - Math.pow(1 - w, 2.6); k = w * 0.5; }               // ease-out rise -> long hang
    else { const w = (v - RISE) / (1 - RISE); hh = 1 - Math.pow(w, 2.4); k = 0.5 + 0.5 * Math.pow(w, 1.6); } // accelerating fall
    air = h * hh; p = from.map((a, i) => lerp(a, to[i], smooth(k))); p[1] += air;
    const rise = v < RISE ? 1 - v / RISE : 0, fall = v >= RISE ? (v - RISE) / (1 - RISE) : 0;
    sy = lerp(1 - crouch, 1, smooth(clamp(v / 0.08))) + 0.34 * Math.pow(rise, 1.5) * clamp(v / 0.08) + 0.22 * Math.pow(fall, 1.4);
  } else { p = to.slice(); const tl = (u - P1) * dur; sy = tl < 0.04 ? lerp(1.2, 1 - crouch * 1.1, tl / 0.04) : 1 - wobble(tl - 0.04, crouch * 1.1); }
  const sx = 1 / Math.pow(Math.max(0.4, sy), 0.7);
  return { x: p[0], y: p[1], z: p[2], sx, sy, air, contact: t0 + dur * P1, launch: t0 + dur * P0 };
}

/** camera distance that fits a bounding sphere (center, radius) in a perspective camera with margin */
export function fitDist(camera, radius, margin = 1.15) { const f = THREE.MathUtils.degToRad(camera.fov) / 2; return margin * radius / Math.sin(f); }
/** world box of several objects/points -> {center:[x,y,z], radius} for framing */
export function framing(items) { const b = new THREE.Box3();
  for (const it of items) it.isVector3 ? b.expandByPoint(it) : b.expandByObject(it);
  const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2; return { center: c.toArray(), radius: r }; }
/** Powers-of-ten dive that DECELERATES to a stop outside the geometry (stopDist >= clearance), then flashes.
 * u in [0,1] over the dive. returns {dist, targetMix, flash}: flash rises over the last `flashIn` and the cut belongs at u=1. */
export function dive(u, startDist, stopDist, flashIn = 0.3) {
  const e = 1 - Math.pow(1 - clamp(u), 3);                                  // ease-out cubic on log-distance: hard brake
  return { dist: startDist * Math.pow(stopDist / startDist, e), targetMix: smoother(clamp(u / 0.6)), flash: smooth(seg(u, 1 - flashIn, 1)), speed: 3 * Math.pow(1 - clamp(u), 2) };
}
/** Flash-cut envelope centered on the cut time tc: eases up over `up` s before the cut and down over `down` s after
 * (default 8 frames each @60fps), capped at `peak` (~70% white). Use instead of hand-built ramps. */
export const flashEnv = (t, tc, peak = 0.7, up = 8 / 60, down = 8 / 60) =>
  peak * (t < tc ? smoother(seg(t, tc - up, tc)) : 1 - smoother(seg(t, tc, tc + down)));
/** after a flash-cut: flash fades out over `dur` seconds (legacy; prefer flashEnv) */
export const flashOut = (t, tc, dur = 0.35) => t < tc ? 0 : 1 - smooth(seg(t, tc, tc + dur));

/** Contact AO: soft radial dark blob on the floor under an object (grounds it; fades + spreads with height).
 * const ao = contactAO(scene, 2.4); per frame: ao.update(x, z, air, scaleX) */
export function contactAO(scene, size = 2.4, strength = 0.75) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: strength }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.renderOrder = 1; scene.add(m);
  return { mesh: m, update(x, z, air = 0, sx = 1) { const k = 1 / (1 + 1.2 * Math.max(0, air)); m.position.set(x, 0.004, z + 0.05);
    m.scale.set(sx * (1.2 - 0.2 * k), 1.2 - 0.2 * k, 1); m.material.opacity = strength * k * k; } };
}

/** Spiral stream: piece i is emitted at ti = t0 + lag*i/n from a high outer ring and travels a curved, tightening
 * helix around `center` into `target`, settling with a small spring. Gives streams, not a chaotic clump. */
export function spiralPos(t, t0, i, n, center, target, { lag = 1.0, fly = 0.9, turns = 1.25, r0 = 4.5, lift = 3.2, arms = 3 } = {}) {
  const ti = t0 + lag * i / n; if (t < ti) return { p: null, ti, landed: false };
  const u = clamp((t - ti) / fly), e = smoother(u);
  const tr = new THREE.Vector3().subVectors(target, center); const rT = Math.hypot(tr.x, tr.z), aT = Math.atan2(tr.z, tr.x);
  const arm = (i % arms) * 2 * Math.PI / arms;
  const th = aT + arm * (1 - e) + turns * 2 * Math.PI * (1 - e);
  const r = lerp(r0, rT, e), y = center.y + lerp(lift, tr.y, Math.pow(e, 0.8));
  const p = new THREE.Vector3(center.x + r * Math.cos(th), y, center.z + r * Math.sin(th));
  if (u >= 1) { const s = wobble(t - ti - fly, 0.06, 0.3, 3); p.copy(target).addScaledVector(tr.clone().normalize(), s); }
  return { p, ti, landed: u >= 1, u };
}

// ---------- cue track (frame-snapped) -> mix.py --cues
export class Cues {
  constructor(fps) { this.fps = fps; this.events = []; }
  add(t, name, vol = 1) { const f = Math.round(t * this.fps); this.events.push({ t: f / this.fps, frame: f, name, vol }); return t; }
  json() { return { fps: this.fps, events: this.events.sort((a, b) => a.t - b.t) }; }
}

// ---------- stage: renderer, lights, shadows, floor, fog, post (bloom + DOF + motion smear)
export function makeStage({ W = 1080, H = 1080, shadow = 2048 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;  // blurred soft shadows (radius/blurSamples below)
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.bg); scene.fog = new THREE.FogExp2(PAL.bg, 0.045);
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.01, 200);
  const hemi = new THREE.HemisphereLight(0x9a8cff, 0x2a1a10, 1.0); scene.add(hemi);
  const key = new THREE.SpotLight(0xfff1dd, 260, 40, 0.55, 0.55, 1.5); key.position.set(4, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(shadow, shadow); key.shadow.radius = 10; key.shadow.blurSamples = 16; key.shadow.bias = -0.0006; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fd8ff, 1.2); rim.position.set(-6, 4, -6); scene.add(rim);
  const warmRim = new THREE.DirectionalLight(0xffa860, 2.4); warmRim.position.set(5, 3, -5); scene.add(warmRim);
  const fillL = new THREE.DirectionalLight(0xcfd8ff, 0.9); fillL.position.set(-5, 3, 6); scene.add(fillL);
  const warm = new THREE.PointLight(PAL.amber, 2, 8, 2); warm.position.set(0, 2.5, 1.5); scene.add(warm);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x24222f, roughness: 0.4, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  [rim, warmRim, fillL].forEach(l => l.castShadow = false);
  // faint lab grid lines on the floor
  const grid = new THREE.GridHelper(80, 160, 0x3a3758, 0x2a2840); grid.position.y = 0.002; grid.material.transparent = true; grid.material.opacity = 0.4; scene.add(grid);
  const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.004, maxblur: 0.008 }); composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.45, 0.9); composer.addPass(bloom);
  const smear = new AfterimagePass(0); composer.addPass(smear);
  // flash-cut pass: warm additive bloom-white wash (amount 0..1), for cutting between worlds
  const flash = new ShaderPass({ uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, tint: { value: new THREE.Color(0xffdcb4) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float amount; uniform vec3 tint; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float r = length(vUv-0.5); float a = clamp(amount, 0.0, 0.7) * (1.0 - 0.3 * r); vec3 warm = c.rgb * mix(vec3(1.0), vec3(1.08, 0.96, 0.82), a); gl_FragColor = vec4(mix(warm, tint, a), 1.0); }' });
  composer.addPass(flash);
  composer.addPass(new OutputPass());
  return { renderer, scene, camera, composer, bokeh, bloom, smear, flash, key, rim, warmRim, fillL, warm, floor, grid, hemi };
}
/** camera rig: orbit (yaw/pitch/dist) around a target with optional handheld drift (deterministic). */
export function rig(camera, { target = [0, 1, 0], yaw = 0, pitch = 0.12, dist = 8, roll = 0, drift = 0.05, orbit = 0.07, t = 0 }) {
  // never-still camera: slow continuous orbit (yaw/pitch sway, ~14-20s periods) + handheld drift, so parallax never stops
  yaw += orbit * Math.sin(t * 0.33) + orbit * 0.35 * Math.sin(t * 0.71 + 0.4); pitch += orbit * 0.25 * Math.sin(t * 0.27 + 1.3);
  const dy = drift * Math.sin(t * 0.9), dx = drift * Math.sin(t * 0.63 + 1), dz = drift * 0.6 * Math.sin(t * 0.47 + 2);
  const x = target[0] + dist * Math.sin(yaw) * Math.cos(pitch), z = target[2] + dist * Math.cos(yaw) * Math.cos(pitch), y = target[1] + dist * Math.sin(pitch);
  camera.position.set(x + dx, y + dy, z + dz); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(...target);
  return camera.position.distanceTo(new THREE.Vector3(...target));
}
/** DOF: set focus distance (world units) and aperture; small aperture = subtle. */
export function focusOn(st, dist, aperture = 0.004, maxblur = 0.008) {
  const u = st.bokeh.uniforms; u.focus.value = dist; u.aperture.value = aperture; u.maxblur.value = maxblur;
}

// ---------- mascot from the logo (brand/logo-x.jpg): line-art agent, hat w/ circuit brain, nodes, glasses, collar
const P2 = a => a.map(([x, y]) => new THREE.Vector3(x, y, 0));
function tube(pts, r, mat, closed = false) {
  const path = new THREE.CurvePath(); const v = P2(pts); const n = closed ? v.length : v.length - 1;
  for (let i = 0; i < n; i++) path.add(new THREE.LineCurve3(v[i], v[(i + 1) % v.length]));
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 16 * n, r, 10, false), mat));
  v.forEach(p => { const j = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat); j.position.copy(p); g.add(j); }); // round joints
  g.traverse(o => { o.castShadow = true; }); return g;
}
function roundRect(w, h, r) { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function extrudeFill(shapePts, depth, mat) {
  const s = new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), mat);
  m.position.z = -depth / 2; m.castShadow = m.receiveShadow = true; return m;
}
/** LEGACY (kept for compatibility): new videos use makeAgentFigure() v9 (hoodie) from ./agent.js. Build the NeuralLoot agent. Origin at the feet (coat hem), ~2.6 units tall. Returns {root, body, parts, update(t, look)}. */
export function makeMascot() {
  const line = new THREE.MeshStandardMaterial({ color: 0xb87a50, emissive: PAL.brown, emissiveIntensity: 0.22, roughness: 0.35, metalness: 0.45 });
  const fill = new THREE.MeshStandardMaterial({ color: 0x24160e, roughness: 0.6, metalness: 0.1 });
  const brainM = new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: PAL.amber, emissiveIntensity: 1.6, roughness: 0.3 });
  const nodeM = () => new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: PAL.amber, emissiveIntensity: 0.4, roughness: 0.3 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x1a2030, roughness: 0.05, metalness: 0.2, transmission: 0, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0 });
  const R = 0.05, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const Y = 1.3; // lift logo coords (coat hem at -1.25) so feet = 0
  // FRAME first: joint hierarchy. body (root joint) -> hat pivot (at brim) and glasses pivot (at bridge), each a child
  // joint whose inner group is offset back so parts keep logo coords. rigMascot() drives lag + follow-through.
  const mkJoint = y => { const j = new THREE.Group(), inner = new THREE.Group(); j.position.y = y; inner.position.y = -y; j.add(inner); body.add(j); return { j, inner }; };
  const hatJ = mkJoint(-0.1 + Y), glsJ = mkJoint(-0.36 + Y); let tgt = hatJ.inner;
  const L = (pts, closed) => { const g = tube(pts.map(([x, y]) => [x, y + Y]), R, line, closed); tgt.add(g); return g; };
  const hatPts = [[-0.52, 1.0], [0, 0.92], [0.52, 1.0], [0.66, -0.02], [-0.66, -0.02]];
  L(hatPts, true); tgt.add(Object.assign(extrudeFill(hatPts.map(([x, y]) => [x, y + Y]), 0.16, fill), {}));
  L([[-0.95, -0.1], [0.95, -0.1]]);
  // brain: ONE small brain icon centered on the hat (like the logo), not two glowing lobes
  const brain = new THREE.Group(); brain.position.set(0, 0.5 + Y, 0.1);
  const bs = new THREE.Shape(); bs.absellipse(0, 0, 0.21, 0.17, 0, Math.PI * 2);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), brainM);
  plate.position.z = -0.025; brain.add(plate);
  const foldM = new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.5 });
  const ft = (pts, r = 0.013) => { const g = tube(pts, r, foldM); g.position.z = 0.05; brain.add(g); };
  ft([[0, 0.17], [0, -0.17]], 0.016);                                   // hemisphere split
  for (const sx of [-1, 1]) { ft([[sx * 0.04, 0.1], [sx * 0.12, 0.1], [sx * 0.12, 0.02]]); ft([[sx * 0.04, -0.02], [sx * 0.15, -0.02]]);
    ft([[sx * 0.04, -0.1], [sx * 0.1, -0.1], [sx * 0.1, -0.14]]); }
  const brainOutline = tube(new THREE.EllipseCurve(0, 0, 0.21, 0.17).getPoints(28).map(p => [p.x, p.y]), 0.02, line, true); brainOutline.position.z = 0.03; brain.add(brainOutline);
  // traces from the brain to the hat edges, continuing into the outer circuit traces (attached, like the logo)
  for (const sx of [-1, 1]) for (const yy of [0.72, 0.34]) {
    const yb = yy > 0.5 ? 0.6 : 0.42; const xe = yy > 0.5 ? 0.58 : 0.62;
    const g = tube([[sx * 0.2, yb + Y], [sx * 0.34, yb + Y], [sx * 0.4, yy + Y], [sx * xe, yy + Y]], 0.025, line); g.position.z = 0.1; tgt.add(g); }
  tgt.add(brain);
  // circuit traces + node rings with glowing cores
  const nodes = [];
  for (const sx of [-1, 1]) for (const [y0, y1, x0] of [[0.72, 0.86, 0.58], [0.34, 0.26, 0.62]]) {
    L([[sx * x0, y0], [sx * 0.84, y0], [sx * 0.84, y1], [sx * 0.98, y1]]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, R, 12, 32), line); ring.position.set(sx * 1.08, y1 + Y, 0); ring.castShadow = true; tgt.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), nodeM()); core.position.copy(ring.position); tgt.add(core); nodes.push(core);
  }
  // glasses: lens rings + glass with glint
  const lenses = []; tgt = glsJ.inner;
  for (const x of [-0.32, 0.32]) {
    const ring = tube(roundRect(0.5, 0.36, 0.16).getPoints(10).map(p => [p.x + x, p.y - 0.36 + Y]), 0.04, line, true); tgt.add(ring);
    const g = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(0.46, 0.32, 0.14)), glassM.clone()); g.position.set(x, -0.36 + Y, 0.01); tgt.add(g); lenses.push(g);
  }
  L([[-0.07, -0.26], [0.07, -0.26]]);
  const glint = new THREE.Group(); const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  for (const x of [-0.32, 0.32]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.4), gm); b.position.set(x, -0.36 + Y, 0.05); b.rotation.z = -0.6; glint.add(b); }
  tgt.add(glint); tgt = body;
  // coat collar + shoulders
  const coat = [[-1.12, -1.25], [-1.12, -1.02], [-0.5, -0.78], [0, -1.05], [0.5, -0.78], [1.12, -1.02], [1.12, -1.25]];
  L(coat.concat([[-1.12, -1.25]]), false); body.add(extrudeFill(coat.map(([x, y]) => [x, y + Y]), 0.3, fill));
  L([[-1.0, -1.02], [-0.62, -0.5], [-0.28, -0.95]]); L([[1.0, -1.02], [0.62, -0.5], [0.28, -0.95]]);
  const bulb = new THREE.PointLight(PAL.amber, 0, 3, 2); bulb.position.set(0, 0.5 + Y, 0.6); hatJ.inner.add(bulb);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  /** idle life: bob, brain breathing glow, nodes pulse in turn, glasses blink/glint, head tracks `look` (world pos) */
  function update(t, look = null, alive = 1) {
    body.position.y = alive * 0.04 * Math.sin(t * 2 * Math.PI / 1.6);
    const br = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 2.2)); brainM.emissiveIntensity = br; bulb.intensity = 0.8 * br;
    nodes.forEach((n, k) => n.material.emissiveIntensity = 0.3 + 2.2 * Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI / 1.8 - k * 0.9)), 6));
    const ph = t % 2.6, blink = ph > 2.45 || (t % 7.8) > 7.65;              // blink = lenses flash dark->bright
    lenses.forEach(l => l.material.emissiveIntensity = blink ? 0.9 : 0.0);
    const gp = (t % 3.1) / 0.35; gm.opacity = gp < 1 ? Math.sin(Math.PI * gp) * 0.85 : 0; glint.children.forEach((b, i) => b.position.x = (i ? 0.32 : -0.32) - 0.2 + 0.4 * clamp(gp));
    if (look) { const lp = root.worldToLocal(new THREE.Vector3(...look)); body.rotation.y = 0.5 * Math.atan2(lp.x, Math.max(0.5, lp.z + 3)); body.rotation.x = -0.15 * Math.atan2(lp.y - 2, 4); }
    else { body.rotation.y *= 0.0; body.rotation.x = 0; }
  }
  return { root, body, brain, nodes, lenses, update, joints: { hat: hatJ.j, glasses: glsJ.j }, materials: { line, fill, brainM } };
}
/** Reusable rig (skeleton -> flesh -> warp). Stateless follow-through so frame ranges can render in parallel:
 * each child joint is a damped spring driven by the root's acceleration, evaluated by convolving the past `win` seconds
 * of the root pose. pose(t) -> {x,y,z,sy}. Hat lags most (heavy, high pivot), glasses less and faster. */
export function rigMascot(M, { hat = { k: 1.0, zeta: 0.28, freq: 2.6 }, glasses = { k: 0.45, zeta: 0.35, freq: 4.2 }, win = 0.9, dt = 1 / 120 } = {}) {
  const resp = (pose, t, { zeta, freq }) => { const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - zeta * zeta); let ox = 0, oy = 0, os = 0;
    const P = s => pose(s); const acc = (s, key) => (P(s + dt)[key] - 2 * P(s)[key] + P(s - dt)[key]) / (dt * dt);
    for (let tau = 0; tau < win; tau += dt) { const s = t - tau, h = Math.exp(-zeta * w * tau) * Math.sin(wd * tau) / wd * dt;
      ox += -acc(s, 'x') * h; oy += -acc(s, 'y') * h; os += -acc(s, 'sy') * h; }
    return { ox, oy, os }; };
  return function drive(t, pose) {
    const H = resp(pose, t, hat), G = resp(pose, t, glasses), j = M.joints;
    // hat: lifts/drops on its brim pivot, tips forward on landings, sways with sideways travel, counter-squashes
    j.hat.position.y = j.hat.userData.y0 ?? (j.hat.userData.y0 = j.hat.position.y);
    j.hat.position.y = j.hat.userData.y0 + clamp(0.55 * hat.k * H.oy, -0.12, 0.22);
    j.hat.rotation.x = clamp(-1.4 * hat.k * H.oy, -0.35, 0.35); j.hat.rotation.z = clamp(-1.6 * hat.k * H.ox, -0.4, 0.4);
    j.hat.scale.set(1, Math.max(0.8, 1 + 0.6 * hat.k * H.os), 1);
    j.glasses.userData.y0 ??= j.glasses.position.y;
    j.glasses.position.y = j.glasses.userData.y0 + clamp(0.4 * glasses.k * G.oy, -0.06, 0.06);
    j.glasses.rotation.z = clamp(-2.0 * glasses.k * G.ox, -0.18, 0.18); j.glasses.rotation.x = clamp(-1.0 * glasses.k * G.oy, -0.15, 0.15);
    return { hat: H, glasses: G };
  };
}
/** sample points on the mascot surface (for voxel-swarm assembly), local coords */
export function samplePoints(obj, n, seed = 3) {
  obj.updateMatrixWorld(true); const meshes = []; obj.traverse(o => { if (o.isMesh && o.geometry.attributes.position) meshes.push(o); });
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) { const m = meshes[Math.floor(r() * meshes.length)]; const a = m.geometry.attributes.position; const j = Math.floor(r() * a.count);
    out.push(new THREE.Vector3().fromBufferAttribute(a, j).applyMatrix4(m.matrixWorld)); }
  return out;
}
/** voxel swarm: InstancedMesh of cubes; call set(i, pos, scale, rotY) then commit() */
export function makeVoxels(n, color = PAL.cyan, size = 0.09, emissive = 0.6) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.25, metalness: 0.3 }), n);
  m.castShadow = true; const d = new THREE.Object3D();
  return { mesh: m, set(i, p, s = 1, r = 0) { d.position.copy(p); d.scale.setScalar(Math.max(1e-4, s)); d.rotation.set(r, r * 1.3, r * 0.7); d.updateMatrix(); m.setMatrixAt(i, d.matrix); },
    commit() { m.instanceMatrix.needsUpdate = true; } };
}
/** swarm position for piece i: scattered start -> spring to target with stagger. */
export function swarmPos(t, t0, i, n, start, target, lag = 0.9, fly = 0.55) {
  const ti = t0 + lag * i / n; const u = spring(t - ti, 0.42, 1.6) ; const v = t < ti ? 0 : u;
  const p = start.clone().lerp(target, v); p.y += Math.sin(Math.PI * clamp((t - ti) / fly)) * 0.6 * (1 - clamp(v)); return { p, landed: t - ti > fly * 0.7, ti };
}
