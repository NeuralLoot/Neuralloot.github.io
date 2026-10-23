// NeuralLoot agent FIGURE: the logo (brand/logo-x.jpg) as a rigged 3D character, built on a pivot-bone skeleton:
// root > hips > spine > chest > neck > head > (glasses, hat[lagged]) ; chest > shoulder.L/R > elbow > hand ; hips > leg.L/R > foot
// Stylized PBR in brand browns + cream; emissive brain emblem + circuit nodes. Actions: idle, hop, point, wave, carry.
import * as BMASK from './brain2d_mask.js';
import { THREE, PAL, hop as hopCurve, smooth, smoother, seg, lerp, clamp, spring, wobble } from './nl3d.js';

const BROWN = 0x7a4a2e, DARK = 0x3b2417, CREAM = 0xcdb999, LINE = 0xc98a5c;
const BLACK = 0x17171a, BLACK2 = 0x0d0d0f; // v2: black hat + coat; v9: hoodie replaces coat
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
const bone = (name, parent, [x, y, z] = [0, 0, 0]) => { const b = new THREE.Object3D(); b.name = name; b.position.set(x, y, z); parent && parent.add(b); return b; };
const mesh = (g, m, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => { const o = new THREE.Mesh(g, m); o.position.set(...pos); o.rotation.set(...rot); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
function pipe(points, r, m, parent) { const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.05);
  return mesh(new THREE.TubeGeometry(c, 48, r, 10, false), m, parent); }

const curve = pts => new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), false, 'centripetal');
/** tapered tube: radius r0 at start -> r1 at end (smooth), ends capped by shrinking to the tip */
function neurite(c, r0, r1, m, parent, seg = 40, rad = 10) {
  const g = new THREE.TubeGeometry(c, seg, 1, rad, false), P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const u = i / seg, ctr = c.getPointAt(u), r = r0 + (r1 - r0) * u * u * (3 - 2 * u);
    for (let j = 0; j <= rad; j++) { const n = i * (rad + 1) + j; v.fromBufferAttribute(P, n).sub(ctr).multiplyScalar(r).add(ctr); P.setXYZ(n, v.x, v.y, v.z); } }
  g.computeVertexNormals(); return mesh(g, m, parent); }
/** short curvy dendrite twig from p along dir (bent sideways), forking once near the tip; thin toward tips */
function twig(p, dir, s, bend, len, m, parent, fromSoma = false) {
  const d = dir.clone().normalize(), side = new THREE.Vector3(-d.y, d.x, 0.3).normalize().multiplyScalar(bend * len * 0.5);
  const a = p.clone(), b = p.clone().addScaledVector(d, len * 0.5).addScaledVector(side, 0.5), e = p.clone().addScaledVector(d, len).add(side);
  const c = curve([a, b, e]); const r0 = fromSoma ? 0.009 : 0.0065;
  neurite(c, r0, 0.0015, m, parent, 16, 8);
  if (len > 0.075) for (const sg of [-1, 1]) { const q = c.getPointAt(0.6), dd = c.getTangentAt(0.6).add(side.clone().normalize().multiplyScalar(0.9 * sg)).normalize();
    neurite(curve([q, q.clone().addScaledVector(dd, len * 0.22), q.clone().addScaledVector(dd, len * 0.42).add(new THREE.Vector3(0, 0.008 * sg, 0))]), r0 * 0.45, 0.001, m, parent, 10, 6); } }
const k3 = (s, y) => (s + 2) * 13.7 + y * 31;
/** soma: slightly lumpy, teardrop-ish cell body */
function somaGeo(seed) { const g = new THREE.SphereGeometry(0.042, 24, 18), P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = v.clone().normalize();
    const f = 1 + 0.12 * Math.sin(n.x * 5 + seed) * Math.sin(n.y * 4 + seed * 0.7) + 0.08 * Math.sin(n.z * 6 + seed * 1.3);
    v.multiplyScalar(f); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
/** Critically-damped-ish spring follower for secondary motion (state carried frame to frame, fixed substeps). */
class Follow { constructor(k = 90, d = 9) { this.k = k; this.d = d; this.x = null; this.v = 0; this.t = null; }
  step(target, t) { if (this.x === null || this.t === null || t < this.t) { this.x = target; this.v = 0; this.t = t; return target; }
    let dt = Math.min(0.2, t - this.t); this.t = t; const h = 1 / 240;
    while (dt > 1e-6) { const s = Math.min(h, dt); const a = this.k * (target - this.x) - this.d * this.v; this.v += a * s; this.x += this.v * s; dt -= s; }
    return this.x; } }

// ---------- v3 brain geometry: value-noise sulci displacement + vertex-color fold shading
function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = v => v * v * (3 - 2 * v);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi); let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) r += (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w) * (hash3(xi + a, yi + b, zi + c) * 2 - 1);
  return r; }
const BR_LIGHT = new THREE.Color(0xc98a8e), BR_DARK = new THREE.Color(0x3a141c);
function displaceBrain(g, groove, depth) { const P = g.attributes.position, N = P.count, col = new Float32Array(N * 3), c = new THREE.Color();
  g.computeVertexNormals(); const Nm = g.attributes.normal;
  for (let i = 0; i < N; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const k = groove(x, y, z);
    P.setXYZ(i, x - Nm.getX(i) * depth * k, y - Nm.getY(i) * depth * k, z - Nm.getZ(i) * depth * k);
    c.copy(BR_LIGHT).lerp(BR_DARK, Math.min(1, k * 1.4)); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; }
function makeBrain() { // local units: x lateral, y superior, z anterior; ~1.1 wide, 1.6 long
  const sulci = (x, y, z) => { const wx = x * 5.5 + 0.8 * vnoise(x * 2, y * 2, z * 2), wy = y * 5.5 + 0.8 * vnoise(y * 2 + 5, z * 2, x * 2), wz = z * 5.5 + 0.8 * vnoise(z * 2 + 9, x * 2, y * 2);
    const n = vnoise(wx, wy, wz) + 0.5 * vnoise(wx * 2.1, wy * 2.1, wz * 2.1); return Math.exp(-(n * n) / 0.009); };
  const parts = [];
  for (const s of [-1, 1]) { const g = new THREE.SphereGeometry(1, 192, 144); const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { let dx = P.getX(i) * s, dy = P.getY(i), dz = P.getZ(i);
      let x = dx * 0.6, y = dy * 0.6, z = dz * 0.72;
      if (dx < 0) x *= 0.12;                                   // flat medial wall -> clean center split
      if (dy < 0) y *= 0.6;                                     // flatter base
      z *= 1 + 0.08 * dy;                                       // slightly longer on top
      const temporal = Math.exp(-((dz - 0.1) ** 2) / 0.2 - ((dy + 0.3) ** 2) / 0.12) * Math.max(0, dx); // temporal lobe bulge
      x += 0.08 * temporal; y -= 0.06 * temporal;
      if (dz < 0 && dy < 0) y += 0.18 * dy * -dz * 0.6;         // occipital tuck
      P.setXYZ(i, s * (x + 0.035), y, z); }
    displaceBrain(g, (x, y, z) => sulci(x * s, y, z), 0.075);
    // lateral (Sylvian) fissure: emphasize via extra groove
    const P2 = g.attributes.position, C = g.attributes.color, c = new THREE.Color();
    for (let i = 0; i < P2.count; i++) { const x = Math.abs(P2.getX(i)), y = P2.getY(i), z = P2.getZ(i);
      if (x > 0.3) { const line = y - (-0.05 + 0.35 * (z - 0.1)); const k = Math.exp(-(line * line) / 0.0012) * (z > -0.35 && z < 0.55 ? 1 : 0);
        if (k > 0.02) { P2.setY(i, y); P2.setX(i, P2.getX(i) * (1 - 0.06 * k)); c.fromBufferAttribute(C, i).lerp(BR_DARK, k); C.setXYZ(i, c.r, c.g, c.b); } } }
    g.computeVertexNormals(); parts.push(g); }
  const cb = new THREE.SphereGeometry(1, 96, 64); const Pc = cb.attributes.position; // cerebellum: fine horizontal folia
  for (let i = 0; i < Pc.count; i++) Pc.setXYZ(i, Pc.getX(i) * 0.42, Pc.getY(i) * 0.2, Pc.getZ(i) * 0.25);
  cb.translate(0, -0.3, -0.6); displaceBrain(cb, (x, y) => Math.pow(0.5 + 0.5 * Math.cos((y + 0.3) * 90), 6), 0.02); parts.push(cb);
  return parts; }

export function makeAgentFigure() {
  const M = { coat: std(0x1c1c20, { roughness: 0.34, metalness: 0.25 }), coatDark: std(BLACK2, { roughness: 0.45, metalness: 0.15 }), cream: std(CREAM, { roughness: 0.75 }),
    line: std(0xd9b88a, { roughness: 0.3, metalness: 0.4, emissive: 0x8a5a36, emissiveIntensity: 0.15 }),
    hat: std(0x25252b, { roughness: 0.22, metalness: 0.4 }),
    brain: std(0xffffff, { vertexColors: true, roughness: 0.62, metalness: 0.0, emissive: 0xff8a8a, emissiveIntensity: 0.03 }),
    node: () => std(0xf6d2c4, { emissive: 0xff9c7e, emissiveIntensity: 0.6, roughness: 0.4 }),
    neur: std(0xdcb7aa, { roughness: 0.5, metalness: 0.0, emissive: 0xb86a5e, emissiveIntensity: 0.07 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.97, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 }),
    frame: std(0x2a1a10, { roughness: 0.25, metalness: 0.6 }) };
  // ---------- skeleton
  const root = bone('root'), hips = bone('hips', root, [0, 0.42, 0]), spine = bone('spine', hips, [0, 0.12, 0]), chest = bone('chest', spine, [0, 0.42, 0]);
  const neck = bone('neck', chest, [0, 0.3, 0]), head = bone('head', neck, [0, 0.1, 0]);
  const hatB = bone('hat', head, [0, 0.3, 0]), glassesB = bone('glasses', head, [0, 0.02, 0.33]);
  const sh = [-1, 1].map(s => bone(`shoulder.${s < 0 ? 'R' : 'L'}`, chest, [s * 0.4, 0.2, 0]));
  const el = sh.map((b, i) => bone(`elbow.${i ? 'L' : 'R'}`, b, [0, -0.3, 0]));
  const hand = el.map((b, i) => bone(`hand.${i ? 'L' : 'R'}`, b, [0, -0.28, 0]));
  const leg = [-1, 1].map(s => bone(`leg.${s < 0 ? 'R' : 'L'}`, hips, [s * 0.18, 0, 0]));
  // ---------- legs + feet (short, cute)
  leg.forEach(l => { mesh(new THREE.CapsuleGeometry(0.084, 0.2, 6, 12), M.coatDark, l, [0, -0.2, 0]);
    mesh(new THREE.SphereGeometry(0.15, 20, 14), M.coatDark, l, [0, -0.38, 0.06]).scale.set(1, 0.55, 1.35); });
  // ---------- v9 HOODIE (Elliott Oct 14: hoodie, not a suit): soft rounded torso, hood down behind neck, kangaroo pocket,
  // two spring-lagged drawstrings, ribbed cuffs + hem. Same black family as the hat.
  M.hood = std(0x1a1a1e, { roughness: 0.82, metalness: 0.0 }); M.rib = std(0x111114, { roughness: 0.9, metalness: 0.0 }); M.cord = std(0xd9d4cc, { roughness: 0.7 });
  const hoodG = new THREE.LatheGeometry([[0.0, 0.04], [0.4, 0.05], [0.47, 0.12], [0.49, 0.28], [0.47, 0.46], [0.42, 0.6], [0.32, 0.69], [0.2, 0.73], [0, 0.74]].map(([x, y]) => new THREE.Vector2(x, y)), 48);
  mesh(hoodG, M.hood, spine, [0, -0.1, 0]).scale.set(0.83, 1, 0.78); // v10: slimmed ~17% wide / ~15% deep
  const ribHem = mesh(new THREE.TorusGeometry(0.41, 0.045, 12, 48), M.rib, spine, [0, -0.04, 0], [Math.PI / 2, 0, 0]); ribHem.scale.set(0.83, 0.78, 1);
  // hood resting down: thick rolled torus behind neck draped over the shoulders + soft fold lump at the back
  mesh(new THREE.TorusGeometry(0.25, 0.085, 14, 36, Math.PI * 1.25), M.hood, chest, [0, 0.24, -0.04], [Math.PI / 2 - 0.35, 0, Math.PI * 1.875]).scale.set(0.9, 0.9, 1);
  const hb = mesh(new THREE.SphereGeometry(0.26, 24, 16), M.hood, chest, [0, 0.12, -0.25]); hb.scale.set(0.92, 0.75, 0.45);
  mesh(new THREE.TorusGeometry(0.19, 0.035, 10, 28), M.rib, chest, [0, 0.27, 0.0], [Math.PI / 2 - 0.2, 0, 0]); // neckline rib
  // kangaroo pocket: rounded slab on the belly with darker slanted openings
  const pk = new THREE.Shape(); pk.moveTo(-0.24, 0); pk.lineTo(0.24, 0); pk.lineTo(0.18, 0.2); pk.quadraticCurveTo(0, 0.24, -0.18, 0.2); pk.closePath();
  const pkt = mesh(new THREE.ExtrudeGeometry(pk, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.015, bevelSegments: 3 }), M.hood, spine, [0, 0.07, 0.36]); pkt.rotation.x = -0.05; pkt.scale.set(0.86, 0.95, 1);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), M.rib, spine, [s * 0.172, 0.17, 0.413], [-0.05, 0, s * 0.3]);
  // drawstrings: pivot at neckline eyelets, cord + aglet tip; swing driven by springs in pose()
  const cords = [-1, 1].map(s => { const piv = bone(`cord.${s < 0 ? 'R' : 'L'}`, chest, [s * 0.09, 0.1, 0.31]);
    mesh(new THREE.TorusGeometry(0.014, 0.006, 6, 12), M.rib, piv, [0, 0, 0.005]);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), M.cord, piv, [0, -0.13, 0.015]);
    mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.05, 8), M.cord, piv, [0, -0.28, 0.015]); return piv; });
  // ---------- arms (soft hoodie sleeves + ribbed cuffs + cream hands)
  sh.forEach((b, i) => { mesh(new THREE.CapsuleGeometry(0.086, 0.2, 8, 14), M.hood, b, [0, -0.15, 0]);
    mesh(new THREE.CapsuleGeometry(0.078, 0.16, 8, 14), M.hood, el[i], [0, -0.13, 0]);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), M.rib, el[i], [0, -0.25, 0]);
    mesh(new THREE.SphereGeometry(0.085, 16, 12), M.cream, hand[i], [0, 0, 0]); });
  // ---------- head (cream), glasses (real frame + lenses)
  mesh(new THREE.SphereGeometry(0.34, 32, 24), M.cream, head, [0, 0, 0]).scale.set(1, 0.92, 0.95);
  const lensShape = (() => { const s = new THREE.Shape(); const w = 0.15, h = 0.11, r = 0.07; s.moveTo(-w, h); s.lineTo(w, h); s.lineTo(w, -h + r);
    s.quadraticCurveTo(w, -h, w - r, -h); s.lineTo(-w + r, -h); s.quadraticCurveTo(-w, -h, -w, -h + r); s.closePath(); return s; })();
  const lenses = [];
  for (const x of [-0.17, 0.17]) {
    const pts = lensShape.getPoints(12).map(p => new THREE.Vector3(p.x + x, p.y, 0)); pts.push(pts[0].clone());
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.0), 64, 0.018, 8, true), M.frame, glassesB);
    const l = mesh(new THREE.ShapeGeometry(lensShape), M.lens.clone(), glassesB, [x, 0, -0.005]); lenses.push(l); }
  pipe([[-0.03, 0.06, 0.01], [0, 0.075, 0.02], [0.03, 0.06, 0.01]], 0.016, M.frame, glassesB);
  for (const s of [-1, 1]) pipe([[s * 0.32, 0.08, -0.01], [s * 0.34, 0.08, -0.2], [s * 0.3, 0.02, -0.3]], 0.014, M.frame, glassesB); // temples
  const glint = mesh(new THREE.PlaneGeometry(0.035, 0.26), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), glassesB, [0, 0, 0.012], [0, 0, -0.6]);
  // ---------- v11 FEDORA (Elliott Oct 15: hat should be a fedora like the AgentMail logo): wide drooping/lifted-side brim, short rounded
  // crown with centre dent + two front pinches, band at the base. Brain emblem on crown front, 4 stepped traces over the brim to glowing rings.
  const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const gridGeo = (nu, nv, fn, flip) => { const pos = [], idx = []; for (let i = 0; i <= nu; i++) for (let j = 0; j < nv; j++) pos.push(...fn(i / nu, j / nv * Math.PI * 2));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * nv + j, b = (i + 1) * nv + j, c = i * nv + (j + 1) % nv, d = (i + 1) * nv + (j + 1) % nv;
      if (flip) idx.push(a, c, b, c, d, b); else idx.push(a, b, c, c, b, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const merge = gs => { const pos = [], idx = []; let o = 0; for (const g of gs) { const p = g.attributes.position.array; pos.push(...p); g.index.array.forEach(i => idx.push(i + o)); o += p.length / 3; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx); m.computeVertexNormals(); return m; };
  // brim: R=0.75, droops at front/back, lifts at the sides (saddle), 0.03 thick, curled-up edge
  const BR0 = 0.28, BRR = 0.75, BT = 0.03;
  const brimY = (r, th) => { const u = Math.max(0, (r - BR0) / (BRR - BR0)); return u * u * (0.02 - 0.075 * Math.cos(2 * th)); };
  const brimP = (r, th, dy = 0) => [r * Math.sin(th), brimY(r, th) + dy, r * Math.cos(th) * 0.97];
  const brimG = merge([gridGeo(14, 72, (u, th) => brimP(BR0 + u * (BRR - BR0), th), false), gridGeo(14, 72, (u, th) => brimP(BR0 + u * (BRR - BR0), th, -BT), true),
    gridGeo(1, 72, (u, th) => brimP(BRR, th, -u * BT), false)]);
  mesh(brimG, M.hat, hatB, [0, 0, 0]);
  const brimEdge = [...Array(72)].map((_, j) => new THREE.Vector3(...brimP(BRR, j / 72 * Math.PI * 2, 0.004)));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(brimEdge, true), 144, 0.014, 6, true), M.line, hatB); // cream rim line on brim edge
  // crown: superellipse section (flatter front for the emblem), H tall, rounded shoulder, centre dent + two front pinches
  const H = 0.56, CRX = 0.37, CRZ = 0.41, CN = 2.6, E2 = 2 / CN;
  const prof = new THREE.SplineCurve([[1.0, -0.03], [1.0, 0.0], [0.96, 0.3 * H], [0.9, 0.66 * H], [0.84, 0.9 * H], [0.7, H], [0.4, H], [0.0, H]].map(([f, y]) => new THREE.Vector2(f, y))).getPoints(40).map(p => ({ f: Math.max(0, p.x), y: p.y }));
  prof[prof.length - 1].f = 0;
  const fAt = y => { for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; if (y >= a.y && y <= b.y && b.y > a.y) return a.f + (b.f - a.f) * (y - a.y) / (b.y - a.y); } return 0.84; };
  const sgn = Math.sign;
  const crownP = (f, y, th) => { const w = sstep(0.6 * H, H, y); let x = sgn(Math.sin(th)) * Math.abs(Math.sin(th)) ** E2 * f * CRX, z = sgn(Math.cos(th)) * Math.abs(Math.cos(th)) ** E2 * f * CRZ;
    const thf = Math.atan2(Math.sin(th), Math.cos(th)); let pinch = 0; for (const tp of [-0.95, 0.95]) pinch += Math.exp(-(((thf - tp) / 0.32) ** 2));
    const k = 1 - 0.13 * w * pinch; x *= k; z *= k; const dent = 0.085 * w * Math.exp(-((x / 0.095) ** 2)) * sstep(0.0, 0.25, f + 0.0);
    return [x, y - dent, z]; };
  const crownG = gridGeo(prof.length - 1, 72, (u, th) => { const p = prof[Math.round(u * (prof.length - 1))]; return crownP(p.f, p.y, th); }, true);
  mesh(crownG, M.hat, hatB, [0, 0, 0]);
  // band: slightly proud ring following the crown base
  const bandG = gridGeo(1, 72, (u, th) => { const y = 0.004 + u * 0.085, f = fAt(y) + 0.03; return crownP(f, y, th); }, true);
  mesh(bandG, M.coatDark, hatB, [0, 0, 0]).material = M.coatDark;
  // front surface height of crown at (x, y) for decal/trace conforming
  const zSurf = (x, y) => { const f = fAt(y), a = Math.min(0.999, Math.abs(x) / (f * CRX)); return f * CRZ * (1 - a ** CN) ** (1 / CN); };
  const emb = bone('emblem', hatB, [0, 0, 0]);
  const bin = atob(BMASK.B64), msk = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) msk[i] = bin.charCodeAt(i);
  const rgba = new Uint8Array(BMASK.W * BMASK.H * 4); for (let y = 0; y < BMASK.H; y++) for (let x = 0; x < BMASK.W; x++) {
    const i = (BMASK.H - 1 - y) * BMASK.W + x, o = (y * BMASK.W + x) * 4; rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255; rgba[o + 3] = msk[i]; }
  const brainTex = new THREE.DataTexture(rgba, BMASK.W, BMASK.H, THREE.RGBAFormat); brainTex.colorSpace = THREE.SRGBColorSpace;
  brainTex.magFilter = brainTex.minFilter = THREE.LinearFilter; brainTex.generateMipmaps = false; brainTex.needsUpdate = true;
  const BW = 0.35, BH = BW * BMASK.H / BMASK.W, yC = 0.30;
  M.brain = new THREE.MeshStandardMaterial({ color: 0xeedcbc, map: brainTex, emissive: 0xffd2a0, emissiveMap: brainTex, emissiveIntensity: 0.25,
    transparent: true, alphaTest: 0.04, roughness: 0.5, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const conform = (g, off) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, zSurf(p.getX(i), yC + p.getY(i)) + off); g.computeVertexNormals(); return g; };
  const decal = mesh(conform(new THREE.PlaneGeometry(BW, BH, 24, 20), 0.004), M.brain, hatB, [0, yC, 0]); decal.castShadow = false; decal.renderOrder = 2;
  decal.position.z = 0; decal.geometry.translate(0, 0, 0); decal.position.y = yC; // plane y already local; z absolute
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffcf9a, map: brainTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = mesh(conform(new THREE.PlaneGeometry(BW * 1.04, BH * 1.04, 24, 20), 0.007), glowM, hatB, [0, yC, 0]); glow.castShadow = false;
  // v11b: antenna traces + rings removed (backup: agent.v11-antennas.js); brain emblem only
  const neurons = [];
  const nodes = neurons.map(n => n.ring), signals = neurons.map(n => n.sig);
  const bulb = new THREE.PointLight(0xfff0e8, 0.6, 2.5, 2); bulb.position.set(0, 0.6, 0.9); hatB.add(bulb);
  // optional carried prop
  const prop = mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), std(PAL.cyan, { emissive: PAL.cyan, emissiveIntensity: 0.5, roughness: 0.3 }), root, [0.6, 0.11, 0.5]);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const F = { hatX: new Follow(70, 7), hatZ: new Follow(70, 7), glX: new Follow(160, 12), spX: new Follow(120, 10), cdX: new Follow(45, 4), cdZ: new Follow(45, 4) };
  const B = { root, hips, spine, chest, neck, head, hat: hatB, glasses: glassesB, shoulder: sh, elbow: el, hand, leg };
  /** pose(t, act): act = {name, t0, dur, from, to, h, look:[x,y,z]} or array; returns info (e.g. contact time for cues) */
  function pose(t, acts = []) {
    // rest + idle layer (always on): breathing, weight shift, head micro-motion
    let rp = [0, 0, 0], sx = 1, sy = 1, air = 0, lean = 0, yaw = 0;
    const br = Math.sin(t * 2 * Math.PI / 2.4);
    let headYaw = 0.12 * Math.sin(t * 0.7), headTilt = 0.05 * Math.sin(t * 0.9 + 1), spineBend = 0.02 * br;
    let arm = [{ x: 0.05, z: -0.18, e: -0.25 }, { x: 0.05, z: 0.18, e: -0.25 }].map((a, i) => ({ ...a, x: a.x + 0.04 * Math.sin(t * 1.3 + i) }));
    let crouch = 0; prop.visible = false;
    for (const a of [].concat(acts)) { const u = (t - a.t0) / a.dur; if (u < 0) continue; const k = clamp(u);
      if (a.name === 'hop') { const q = hopCurve(t, a.t0, a.dur, a.from || rp, a.to || a.from || rp, a.h || 0.8, 0.3); if (u <= 1.6) { rp = [q.x, q.y, q.z]; sx = q.sx; sy = q.sy; air = q.air; arm = arm.map((m, i) => ({ ...m, z: m.z + (i ? 1 : -1) * 1.1 * clamp(air / (a.h || 0.8)) })); } }
      if (a.name === 'wave' && u <= 1) { const w = smooth(seg(k, 0, 0.18)) * (1 - smooth(seg(k, 0.85, 1)));
        arm[1] = { x: lerp(arm[1].x, -0.2, w), z: lerp(arm[1].z, 2.55, w), e: lerp(arm[1].e, -0.5 + 0.55 * Math.sin((t - a.t0) * 2 * Math.PI * 2.2), w) };
        headTilt += 0.12 * w; headYaw += 0.15 * w; }
      if (a.name === 'point' && u <= 1) { const w = spring(t - a.t0, 0.45, 1.8) * (1 - smooth(seg(k, 0.82, 1)));
        arm[0] = { x: lerp(arm[0].x, -1.45, w), z: lerp(arm[0].z, -0.35, w), e: lerp(arm[0].e, 0, w) }; headYaw += -0.45 * w; lean += 0.06 * w; }
      if (a.name === 'carry' && u <= 1.5) { // crouch, grab, lift with weight, hold in front
        const down = smooth(seg(k, 0, 0.3)) * (1 - smooth(seg(k, 0.45, 0.75))); const hold = smooth(seg(k, 0.4, 0.75));
        crouch = 0.22 * down; spineBend += 0.55 * down; prop.visible = true;
        arm = arm.map((m, i) => ({ x: lerp(m.x, -1.2 + 0.4 * hold, Math.max(down, hold)), z: lerp(m.z, (i ? 1 : -1) * 0.25, Math.max(down, hold)), e: lerp(m.e, -0.6 * hold, hold) }));
        const pickup = new THREE.Vector3(0.0, 0.11, 0.62), held = new THREE.Vector3(0, 0.95 + 0.02 * br, 0.48);
        prop.position.copy(k < 0.42 ? pickup : pickup.clone().lerp(held, smoother(seg(k, 0.42, 0.78)))).add(new THREE.Vector3(rp[0], 0, rp[2]).sub(root.position).multiplyScalar(0));
        prop.rotation.set(0, 0.3 * hold, 0); }
      if (a.look) { const d = new THREE.Vector3(...a.look).sub(root.position); headYaw += 0.5 * Math.atan2(d.x, Math.max(0.5, d.z)) * clamp(u) * (u <= 1); }
    }
    root.position.set(rp[0], rp[1], rp[2]);
    hips.position.y = 0.42 - crouch; hips.scale.set(sx, sy, sx); hips.rotation.x = lean;
    spine.rotation.x = F.spX.step(spineBend, t); spine.scale.y = 1 + 0.012 * br;
    head.rotation.set(-0.5 * spineBend + 0.04 * Math.sin(t * 1.1), headYaw, headTilt);
    // secondary motion: hat lags behind head/hips (follow-through), glasses settle with a stiffer spring
    const hv = sy - 1; hatB.rotation.x = F.hatX.step(-0.9 * spine.rotation.x * 0.3 + 0.25 * hv, t) * 0.6; hatB.rotation.z = F.hatZ.step(-headTilt * 0.6, t);
    hatB.position.y = 0.3 + 0.06 * F.glX.step(hv, t);
    glassesB.position.y = 0.02 - 0.03 * hv;
    // drawstrings lag: inertial swing vs. vertical squash/air and torso bend/lean (spring follow-through)
    const cx = F.cdX.step(0.9 * spine.rotation.x + 0.5 * lean - 0.6 * hv + 0.25 * clamp(air), t), cz = F.cdZ.step(-0.5 * headTilt + 0.15 * Math.sin(t * 1.7), t);
    cords.forEach((c, i) => c.rotation.set(-Math.max(-0.2, cx) - 0.1, 0, cz + (i ? 0.04 : -0.04)));
    sh.forEach((b, i) => { b.rotation.set(arm[i].x, 0, arm[i].z); el[i].rotation.set(arm[i].e, 0, 0); });
    leg.forEach((l, i) => { l.rotation.x = -crouch * 1.2 * (i ? 1 : 1); l.position.y = 0; });
    // emissive life: brain breathing, nodes pulse in turn, glasses glint sweep
    M.brain.emissiveIntensity = 0.22 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 2.2)); bulb.intensity = 0.6;
    const PER = 2.4, TRAVEL = 0.55; // v7: rings fire in sequence (0.6s apart); a pulse leaves the brain TRAVEL s before each ring's peak
    neurons.forEach(n => { const ph = ((t - n.order * PER / 4) % PER + PER) % PER; // ph in [0,PER): 0..TRAVEL = signal in flight, peak at TRAVEL
      const pk = Math.exp(-((ph - TRAVEL) ** 2) / 0.02) + (ph < TRAVEL - PER + 0.6 ? 0 : 0);
      n.ring.material.emissiveIntensity = 0.45 + 2.2 * pk; n.ring.scale.setScalar(1 + 0.1 * pk); n.halo.material.opacity = 0.55 * pk; n.halo.scale.setScalar(1 + 0.25 * pk);
      if (ph < TRAVEL) { const u = ph / TRAVEL; n.sig.position.copy(n.path.getPointAt(smooth(u))); n.sig.material.opacity = 0.95 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)); } else n.sig.material.opacity = 0; });
    const gp = (t % 3.1) / 0.4; glint.material.opacity = gp < 1 ? Math.sin(Math.PI * gp) * 0.9 : 0; glint.position.x = -0.3 + 0.6 * clamp(gp);
  }
  return { root, bones: { ...B, cords }, pose, nodes, signals, materials: M, prop };
}
