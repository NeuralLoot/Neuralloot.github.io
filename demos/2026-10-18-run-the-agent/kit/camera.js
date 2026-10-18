// Camera rig: named framings relative to a follow target, critically-damped lerps between them, instant
// cinematic cuts (e.g. dramatic low angle) with optional DOF focus via post, and trauma-based shake.
import * as THREE from 'three';
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export const FRAMINGS = {
  wide:   { off: [0, 9, 11], look: [0, 0.8, 0], fov: 40 },
  follow: { off: [0, 6.5, 8], look: [0, 1.0, 0], fov: 40 },
  close:  { off: [1.6, 2.6, 4.2], look: [0, 1.3, 0], fov: 36 },
  low:    { off: [1.5, 0.3, 2.7], look: [0, 1.15, 0], fov: 32 },   // dramatic low-angle payoff cut
  top:    { off: [0, 14, 0.01], look: [0, 0, 0], fov: 45 },
};

export class CameraRig {
  constructor(camera, { framings = FRAMINGS, start = 'follow', stiffness = 3.2 } = {}) {
    this.cam = camera; this.F = { ...FRAMINGS, ...framings }; this.k = stiffness; this.target = new THREE.Vector3();
    this.name = start; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.fov = this.F[start].fov;
    this.trauma = 0; this.portrait = false; this.aspect = 16 / 9; this.yaw = 0; this.snap();
  }
  goal(name = this.name) { const f = this.F[name], o = new THREE.Vector3(...f.off);
    let fov = f.fov;   // phones (portrait): keep the desktop *horizontal* field of view so the goal stays on screen
    if (this.aspect < 1.2) { const hf = 2 * Math.atan(Math.tan(f.fov * Math.PI / 360) * 16 / 9);
      fov = Math.min(78, 2 * Math.atan(Math.tan(hf / 2) / this.aspect) * 180 / Math.PI) * (name === 'low' ? 0.8 : 1);
      if (name !== 'low') o.multiplyScalar(0.85); }
    o.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return { pos: this.target.clone().add(o), look: this.target.clone().add(new THREE.Vector3(...f.look)), fov }; }
  /** smooth lerp to a framing */
  frame(name, stiffness) { this.name = name; if (stiffness) this.k = stiffness; return this; }
  /** hard cut (film cut, no lerp) */
  cut(name) { this.name = name; this.snap(); return this; }
  snap() { const g = this.goal(); this.pos.copy(g.pos); this.look.copy(g.look); this.fov = g.fov; }
  follow(v) { this.target.copy(v); return this; }
  shake(a = 0.4) { this.trauma = Math.min(1, this.trauma + a); }
  setAspect(w, h) { this.aspect = w / h; this.portrait = h > w * 1.1; }
  update(dt, t) {
    const g = this.goal(), k = this.k;
    this.pos.set(damp(this.pos.x, g.pos.x, k, dt), damp(this.pos.y, g.pos.y, k, dt), damp(this.pos.z, g.pos.z, k, dt));
    this.look.set(damp(this.look.x, g.look.x, k * 1.4, dt), damp(this.look.y, g.look.y, k * 1.4, dt), damp(this.look.z, g.look.z, k * 1.4, dt));
    this.fov = damp(this.fov, g.fov, k, dt);
    const s = this.trauma * this.trauma * 0.35; this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const n = (f) => Math.sin(t * f) * Math.sin(t * f * 1.37 + 1.1);
    this.cam.position.copy(this.pos).add(new THREE.Vector3(n(37) * s, n(41) * s, n(29) * s));
    this.cam.lookAt(this.look); this.cam.rotation.z += n(23) * s * 0.15;
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
