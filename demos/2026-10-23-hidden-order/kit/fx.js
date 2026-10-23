// Juice: particle bursts, transient trails (footprints, ripples, ground rings), ambient life silhouettes.
// Everything is pooled + additive/transparent so it stays cheap on phones.
import * as THREE from 'three';

export class Burst {   // one Points cloud, many bursts
  constructor(scene, { max = 400, size = 0.14 } = {}) {
    this.max = max; this.n = 0; const g = new THREE.BufferGeometry();
    this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTex() }));
    this.pts.frustumCulled = false; scene.add(this.pts); }
  emit(at, { count = 80, colors = [0xffd36b, 0x6fe3ff, 0xff9c7e, 0xffffff], speed = 4, up = 3 } = {}) {
    const col = new THREE.Color();
    for (let k = 0; k < count; k++) { const i = this.n++ % this.max, th = Math.random() * 6.283, ph = Math.random() * 1.4, sp = speed * (0.4 + Math.random() * 0.8);
      this.p.set([at.x, at.y, at.z], i * 3); this.v.set([Math.cos(th) * Math.sin(ph) * sp, Math.cos(ph) * sp * 0.6 + up * Math.random(), Math.sin(th) * Math.sin(ph) * sp], i * 3);
      col.set(colors[k % colors.length]); this.c.set([col.r, col.g, col.b], i * 3); this.life[i] = 0.8 + Math.random() * 0.7; } }
  update(dt) { for (let i = 0; i < this.max; i++) { if (this.life[i] <= 0) { this.p[i * 3 + 1] = -99; continue; }
      this.life[i] -= dt; this.v[i * 3 + 1] -= 6 * dt; for (let a = 0; a < 3; a++) { this.v[i * 3 + a] *= 1 - 1.2 * dt; this.p[i * 3 + a] += this.v[i * 3 + a] * dt; }
      const k = Math.exp(-1.4 * dt); this.c[i * 3] *= k; this.c[i * 3 + 1] *= k; this.c[i * 3 + 2] *= k; }
    this.pts.geometry.attributes.position.needsUpdate = this.pts.geometry.attributes.color.needsUpdate = true; }
}
let _dot; function dotTex() { if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.35, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_dot = new THREE.CanvasTexture(c)); }

/** Fading decals on the ground: footprints (oval) and rings (ripple). Pool of N meshes. */
export class Trails {
  constructor(scene, { max = 40, color = 0x6b4426 } = {}) {
    this.items = []; const foot = new THREE.CircleGeometry(0.07, 12), ring = new THREE.RingGeometry(0.8, 1, 40);
    for (let i = 0; i < max; i++) { const isRing = i % 4 === 3;
      const m = new THREE.Mesh(isRing ? ring : foot, new THREE.MeshBasicMaterial({ color: isRing ? 0xfdf8ee : color, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.visible = false; scene.add(m); this.items.push({ m, ring: isRing, age: 9, life: 1, r0: 0, r1: 0 }); } }
  _get(ring) { let best = null; for (const it of this.items) if (it.ring === ring && (!best || it.age / it.life > best.age / best.life)) best = it; return best; }
  footprint(p, yaw, { life = 2.2, opacity = 0.22 } = {}) { const it = this._get(false); it.m.position.set(p.x, 0.012, p.z); it.m.rotation.z = -yaw; it.m.scale.set(1, 1.6, 1);
    it.age = 0; it.life = life; it.op = opacity; it.m.visible = true; }
  ring(p, { life = 1.1, r0 = 0.2, r1 = 1.3, opacity = 0.7, y = 0.015 } = {}) { const it = this._get(true); it.m.position.set(p.x, y, p.z);
    it.age = 0; it.life = life; it.r0 = r0; it.r1 = r1; it.op = opacity; it.m.visible = true; }
  update(dt) { for (const it of this.items) { if (!it.m.visible) continue; it.age += dt; const u = it.age / it.life;
      if (u >= 1) { it.m.visible = false; continue; } it.m.material.opacity = it.op * (1 - u) * (it.ring ? 1 : Math.min(1, u * 8));
      if (it.ring) it.m.scale.setScalar(it.r0 + (it.r1 - it.r0) * (1 - (1 - u) ** 2)); } }
}

/** Cheap ambient life: flat silhouettes gliding on loops (walkers behind glass, drones, birds). make(i) -> Object3D. */
export function ambientLife(scene, { count = 5, make, center = [0, 0, -9], rx = 9, rz = 1.2, y = 0, speed = 0.12, bob = 0.06 } = {}) {
  const items = []; for (let i = 0; i < count; i++) { const o = make ? make(i) : silhouette(); scene.add(o);
    items.push({ o, ph: i / count * 6.283 + Math.random(), sp: speed * (0.7 + Math.random() * 0.6) * (i % 2 ? 1 : -1) }); }
  return { items, update(dt, t) { for (const it of items) { it.ph += it.sp * dt; const x = center[0] + Math.cos(it.ph) * rx, z = center[2] + Math.sin(it.ph) * rz;
      it.o.position.set(x, y + center[1] + Math.abs(Math.sin(t * 6 + it.ph * 9)) * bob, z); it.o.rotation.y = it.sp > 0 ? 0 : Math.PI; } } };
}
export function silhouette({ color = 0x6b4426, opacity = 0.28, h = 1.3 } = {}) {   // little capsule person, flat-shaded dark
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * h, 0.5 * h, 4, 8), m); body.position.y = 0.55 * h;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * h, 10, 8), m); head.position.y = 1.15 * h; g.add(body, head); return g;
}
