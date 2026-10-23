// Player = the approved mascot (mascot/agent.js makeAgentFigure, v10, look untouched) + real-time locomotion.
// Layers blended by smooth weights: idle (always, from pose()), walk (procedural gait on top), action + celebrate
// (agent acts 'carry' / 'point' / 'hop'+'wave', which already ease in/out). Tap-to-move via moveTo().
import * as THREE from 'three';
import { makeAgentFigure } from './mascot/agent.js';
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function createPlayer(scene, { scale = 0.62, speed = 3.2, onStep, bounds } = {}) {
  const fig = makeAgentFigure(); const holder = new THREE.Group(); holder.add(fig.root); holder.scale.setScalar(scale); scene.add(holder);
  const B = fig.bones; const P = { holder, fig, pos: holder.position, yaw: 0, speed, w: { walk: 0 }, acts: [], target: null, t: 0, phase: 0, lastStep: 0, onArrive: null };
  /** walk to a world point (y ignored). Resolves on arrival. */
  P.moveTo = (p) => new Promise(res => { const q = new THREE.Vector3(p.x, 0, p.z); if (bounds) bounds(q); P.target = q; P.onArrive = res; });
  P.stop = () => { P.target = null; };
  P.act = (name, dur = 1.4, extra = {}) => { P.acts.push({ name, t0: P.t, dur, ...extra }); };
  P.action = () => P.act('carry', 1.5);          // grab / catch (shows held prop)
  P.point = () => P.act('point', 1.2);
  P.celebrate = () => { P.act('hop', 0.75, { h: 0.7 }); P.act('wave', 1.8); };
  P.face = (p) => { P.yawGoal = Math.atan2(p.x - P.pos.x, p.z - P.pos.z); };
  P.busy = () => P.acts.some(a => P.t < a.t0 + a.dur);
  P.update = (dt, t) => {
    P.t = t; let moving = 0;
    if (P.target) { const d = P.target.clone().sub(P.pos); d.y = 0; const L = d.length();
      if (L < 0.06) { P.target = null; const f = P.onArrive; P.onArrive = null; f && f(); }
      else { const v = Math.min(L, P.speed * dt * Math.min(1, 0.35 + L)); P.pos.addScaledVector(d.normalize(), v); P.yawGoal = Math.atan2(d.x, d.z); moving = 1; } }
    if (P.yawGoal !== undefined) { let dy = P.yawGoal - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * (1 - Math.exp(-10 * dt)); }
    holder.rotation.y = P.yaw;
    P.w.walk = damp(P.w.walk, moving, 8, dt);
    P.acts = P.acts.filter(a => t < a.t0 + a.dur * 1.6);
    fig.pose(t, P.acts);
    // walk layer (additive on the posed skeleton)
    const w = P.w.walk; P.phase += dt * 9.5 * w; const s = Math.sin(P.phase), c = Math.cos(P.phase);
    if (w > 0.01) {
      B.leg[0].rotation.x += 0.75 * s * w; B.leg[1].rotation.x -= 0.75 * s * w;
      B.shoulder[0].rotation.x -= 0.6 * s * w; B.shoulder[1].rotation.x += 0.6 * s * w;
      B.hips.position.y += 0.045 * Math.abs(c) * w; B.hips.rotation.x += 0.1 * w; B.head.rotation.x -= 0.06 * w;
      B.hips.rotation.y += 0.08 * s * w;
      const step = Math.sign(s); if (step !== P.lastStep && w > 0.4) { P.lastStep = step; onStep && onStep(P.footWorld(step), P.yaw); } }
  };
  P.footWorld = (side) => { const v = new THREE.Vector3(side * 0.18, 0, 0.1).multiplyScalar(scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), P.yaw); return v.add(P.pos); };
  P.headWorld = () => B.head.getWorldPosition(new THREE.Vector3());
  P.handWorld = () => B.hand[1].getWorldPosition(new THREE.Vector3());
  return P;
}

/** Tap/click-to-move + single-button input. onTap(worldPointOnGround|null, event). Works with mouse, touch, pen. */
export function tapInput(stage, { ground, onTap, groundY = 0 } = {}) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
  const el = stage.renderer.domElement; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    let p = null; if (ground) { const h = ray.intersectObject(ground, true)[0]; p = h ? h.point : null; }
    if (!p) { p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) p = null; }
    onTap && onTap(p, e); });
  addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onTap && onTap(null, e); } });
}
