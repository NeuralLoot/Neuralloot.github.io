// Run the Agent: tap a tool, the agent walks over and calls it, the result (or the error) comes back.
// Built on the NeuralLoot game kit (three.js r170, vendored in ./kit). Game rules live in ./logic.js.
import * as GK from './kit/index.js';
import { LEVELS, newRun, callTool, stars, smartPick } from './logic.js';
const { THREE } = GK; const P = GK.PALETTE;
const Q = new URLSearchParams(location.search);
const SPEED = Math.max(0.25, Math.min(4, +(Q.get('speed') || 1)));
const wait = s => new Promise(r => setTimeout(r, s * 1000 / SPEED));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('c');
const stage = GK.createStage({ canvas, bg: 0xf3e7d3, fog: [20, 48] });
const { scene, camera } = stage;
const post = new GK.Post(stage, { bloom: 0.45 });
const rig = new GK.CameraRig(camera, { framings: {
  main: { off: [0, 7.0, 10.2], look: [0, 1.1, -1.7], fov: 40 },
  act:  { off: [0, 6.6, 9.6], look: [0, 1.2, -1.8], fov: 40 },
  mainP: { off: [0, 10.2, 9.0], look: [0, 0.9, -1.9], fov: 40 },
  actP:  { off: [0, 9.8, 8.6], look: [0, 0.9, -1.8], fov: 40 },
  win:   { off: [0.7, 2.4, 3.5], look: [0, 1.3, -0.6], fov: 36 } }, start: 'main' });
stage.onResize((w, h) => rig.setAspect(w, h));
const ui = GK.createUI();
const sound = await GK.initSound({ pack: 'cyber' });
const NLA = window.NLAudio || { play() {}, feedback() {}, outcome() {} };

// ---------- world
const HOME = new THREE.Vector3(0, 0, -0.9);
const floorG = new THREE.CylinderGeometry(6.4, 6.6, 0.3, 40);
const floor = new THREE.Mesh(floorG, GK.toon(0xeedcc0)); floor.position.y = -0.15; floor.receiveShadow = true; scene.add(floor);
const rug = new THREE.Mesh(new THREE.CircleGeometry(3.5, 48), GK.toon(0xe6cfaa)); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.006; rug.receiveShadow = true; scene.add(rug);
// circuit traces on the floor, from the think pad out to the tools (the agent's wiring)
const traceM = new THREE.MeshBasicMaterial({ color: 0xc9a77a, transparent: true, opacity: 0.55 });
const pad = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 40), GK.glow(0x52c7b8, 1.2, { side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.copy(HOME).setY(0.02); scene.add(pad);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ visible: false })); ground.rotation.x = -Math.PI / 2; scene.add(ground);

// back wall: two server racks with blinking LEDs + a window strip, plus drones (ambient life)
const leds = [];
function rack(x) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.8), GK.lowpoly(0x3a3346)); b.position.y = 1.3; b.castShadow = b.receiveShadow = true; g.add(b);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), GK.glow([0x52c7b8, 0xffb867, 0x9ad97a][(r + c) % 3], 1.5)); l.position.set(-0.3 + c * 0.3, 0.45 + r * 0.3, 0.41); g.add(l); leds.push({ l, ph: Math.random() * 6, sp: 1 + Math.random() * 3 }); }
  g.position.set(x, 0, -4.9); scene.add(g); }
rack(-4.6); rack(4.6);
const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 0.2), GK.toon(0xe9d6b7)); wall.position.set(0, 1.7, -5.6); wall.receiveShadow = true; scene.add(wall);
const win = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.1), new THREE.MeshBasicMaterial({ color: 0xf7c88e })); win.position.set(0, 2.55, -5.49); scene.add(win);
const life = GK.ambientLife(scene, { count: 5, center: [0, 2.0, -5.6], rx: 3.0, rz: 0.01, speed: 0.07, make: () => { const s = GK.silhouette({ opacity: 0.22, h: 0.55 }); return s; } });
const drones = GK.ambientLife(scene, { count: 3, center: [0, 3.4, -2.5], rx: 6, rz: 2.5, speed: 0.16, bob: 0.12,
  make: () => { const d = new THREE.Group(); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), GK.glow(P.amber, 0.9)); c.castShadow = true; d.add(c); return d; } });

// ---------- canvas textures (emoji icons render crisp at any size)
function iconTex(icon, { bg = null, size = 256, ring = null, check = false, ghost = false } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; rr(x, 8, 8, size - 16, size - 16, 40); x.fill(); }
  if (ring) { x.strokeStyle = ring; x.lineWidth = 12; x.setLineDash(ghost ? [22, 16] : []); rr(x, 14, 14, size - 28, size - 28, 36); x.stroke(); x.setLineDash([]); }
  x.globalAlpha = ghost ? 0.33 : 1; x.font = `${size * 0.56}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, size / 2, size * 0.54); x.globalAlpha = 1;
  if (check) { x.fillStyle = '#3f9b5a'; x.beginPath(); x.arc(size * 0.8, size * 0.2, size * 0.15, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = size * 0.04; x.beginPath(); x.moveTo(size * 0.73, size * 0.2); x.lineTo(size * 0.79, size * 0.26); x.lineTo(size * 0.88, size * 0.14); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

// ---------- the task board (the goal, in the world)
const board = new THREE.Group(); board.position.set(0, 0, -3.6); scene.add(board);
const bframe = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.9, 0.22), GK.lowpoly(P.wood)); bframe.position.y = 2.4; bframe.castShadow = bframe.receiveShadow = true; board.add(bframe);
const face = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.6, 0.05), GK.toon(0xfbf3e2)); face.position.set(0, 2.4, 0.12); board.add(face);
[-2.2, 2.2].forEach(x => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.55, 0.16), GK.lowpoly(0x8a6240)); leg.position.set(x, 0.78, 0); leg.castShadow = true; board.add(leg); });
const flag = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1), GK.matte(P.brown)); pole.position.y = 0.55;
const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), GK.glow(0x52c7b8, 0.5, { side: THREE.DoubleSide })); cloth.position.set(0.29, 0.92, 0); flag.add(pole, cloth); flag.position.set(2.3, 3.35, 0); board.add(flag);
let slotMeshes = [];
function buildSlots() { slotMeshes.forEach(m => board.remove(m)); slotMeshes = [];
  const n = S.L.slots.length, w = 1.15, gap = (4.4 - n * w) / (n - 1 || 1);
  S.L.slots.forEach((s, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: iconTex(s.icon, { ring: '#c9a77a', ghost: true }), transparent: true }));
    m.position.set(-2.2 + w / 2 + i * (w + gap), 2.4, 0.16); m.userData = { i, pop: 0 }; board.add(m); slotMeshes.push(m); }); }
function fillSlot(i) { const s = S.L.slots[i], m = slotMeshes[i]; m.material.map.dispose(); m.material.map = iconTex(s.icon, { bg: '#fff3dc', ring: '#52c7b8', check: true }); m.material.needsUpdate = true; m.userData.pop = 1; }
const slotWorld = i => slotMeshes[i].getWorldPosition(new THREE.Vector3());

// ---------- tool kiosks
let kiosks = [];
function makeKiosk(t) { const g = new THREE.Group(); const col = new THREE.Color(t.color);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.7), GK.toon(col)); base.position.y = 0.5; base.castShadow = base.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.8), GK.toon(col.clone().multiplyScalar(0.8))); cap.position.y = 1.06; cap.castShadow = true;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.62, 0.06), GK.lowpoly(0x2b2633)); bezel.position.set(0, 0.62, 0.36); bezel.rotation.x = -0.12;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), new THREE.MeshBasicMaterial({ map: iconTex(t.icon, { bg: '#e9dcc2' }), color: 0xd8d0c0 })); scr.position.set(0, 0.63, 0.395); scr.rotation.x = -0.12;
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), GK.lowpoly(0x2b2633)); chute.position.set(0, 0.18, 0.38);
  const lampM = GK.glow(0x9ad97a, 0.6); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), lampM); lamp.position.y = 1.24;
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2), GK.matte(0x2b2633)); ant.position.y = 1.16;
  [base, cap, bezel, scr, chute, ant, lamp].forEach(m => g.add(m)); g.userData = { t, lamp, lampM, scr, base, work: 0, shake: 0, flash: 0, flashCol: new THREE.Color(), dead: false };
  return g; }
function layoutKiosks(order) {
  kiosks.forEach(k => { scene.remove(k); k.userData.label.remove(); }); kiosks = [];
  const n = order.length, spread = n <= 4 ? 64 : 78, R = n <= 4 ? 3.15 : 3.35;
  order.forEach((id, i) => { const t = S.L.tools.find(x => x.id === id); const k = makeKiosk(t);
    const a = THREE.MathUtils.degToRad(-spread + (2 * spread) * (n === 1 ? 0.5 : i / (n - 1)));
    const px = rig.aspect < 0.8 ? 0.86 : 1.08; k.position.set(R * Math.sin(a) * px, 0, HOME.z + R * Math.cos(a) * (rig.aspect < 0.8 ? 1.0 : 0.92) + 0.25); k.lookAt(HOME.x, 0, HOME.z); k.rotateY(Math.PI); // screen faces the camera side
    k.lookAt(k.position.x * 0.35, 0, 9); scene.add(k);
    const lab = document.createElement('button'); lab.className = 'tool'; lab.dataset.id = id; lab.type = 'button';
    lab.innerHTML = `<span class="ti">${t.icon}</span><span class="tn">${t.name}</span>${t.needs != null ? `<span class="tq">needs ${S.L.slots[t.needs].icon}</span>` : ''}`;
    lab.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tapTool(id); });
    labelsEl.appendChild(lab); k.userData.label = lab; kiosks.push(k); });
}
const kioskOf = id => kiosks.find(k => k.userData.t.id === id);

// ---------- player (the approved NeuralLoot agent) + juice
const burst = new GK.Burst(scene), trails = new GK.Trails(scene);
const player = GK.createPlayer(scene, { speed: 4.2, onStep: (p, yaw) => trails.footprint(p, yaw) });
player.pos.copy(HOME); player.yaw = 0;
const ctx = { rig, post, burst, trails, player, sound, ui };
const loopRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40, Math.PI * 1.7), GK.glow(0xe0503c, 2.2)); loopRing.rotation.x = -Math.PI / 2; loopRing.visible = false; scene.add(loopRing);
const sprites = [];
function flySprite(icon, from, to, { dur = 0.8, bg = '#fff3dc', ring = '#52c7b8', arc = 1.6, scale = 0.62 } = {}) {
  return new Promise(res => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(icon, { bg, ring }), transparent: true, depthTest: false })); sp.renderOrder = 5; sp.scale.setScalar(scale); scene.add(sp);
    sprites.push({ sp, from: from.clone(), to: to.clone(), t: 0, dur: dur / SPEED, arc, res, kind: 'fly' }); }); }
function dropSlip(icon, at, bg) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(icon, { bg, ring: '#3b2417' }), transparent: true, depthTest: false })); sp.renderOrder = 5; sp.scale.setScalar(0.62); scene.add(sp);
  sprites.push({ sp, from: at.clone(), t: 0, dur: 1.6 / SPEED, kind: 'slip', vx: (Math.random() - 0.5) * 0.8 }); }

// ---------- DOM: labels, thought bubble, caption, steps
const labelsEl = document.getElementById('labels'), bubble = document.getElementById('bubble'), capEl = document.getElementById('cap');
function say(html, tone = '') { capEl.className = 'cap show ' + tone; capEl.innerHTML = html; }
function think(html) { bubble.innerHTML = html; bubble.classList.add('show'); bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
const seenTerms = new Set();
const term = (t, kid) => { if (seenTerms.has(t)) return `<b>${t}</b>`; seenTerms.add(t); return ui.term(t, kid); };
function setGoal() { const pips = Array.from({ length: S.budget }, (_, i) => `<i class="pip ${i < S.budget - S.used ? 'on' : ''}"></i>`).join('');
  ui.goal(`<b>${S.L.taskIcon} ${S.L.title}</b><span class="sub">Fill the board. Tap a tool.</span><span class="steps"><span class="sl">Steps</span>${pips}</span>`, { icon: '🧩', step: `Level ${li + 1}/3` }); }

// ---------- game state
let li = Math.max(0, Math.min(2, (+Q.get('level') || 1) - 1)), S = null, state = 'idle', totals = { steps: 0, loops: 0, errors: 0, stars: 0, retries: 0 }, attempts = 0;
const rnd = Q.get('seed') ? (() => { let a = +Q.get('seed'); return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })() : Math.random;
function startLevel(i, { fresh = true } = {}) {
  li = i; S = newRun(li, rnd); attempts++; labelsEl.style.visibility = ''; ui.card = null;
  // tutorial keeps a fixed layout; later levels shuffle the tools so position-spam fails
  const order = S.L.tools.map(t => t.id); if (li > 0) for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  S.order = order; buildSlots(); layoutKiosks(order); setGoal(); loopRing.visible = false;
  player.moveTo(HOME); state = 'idle';
  const intro = [
    `I need ${S.L.slots[0].icon} first. Which tool has it?`,
    `Tools can break now. Watch what comes back.`,
    `Send works anytime now. Only send a full board!`][li];
  think(`🧠 ${intro}`);
  if (li === 0) { say(`Each tap = one ${term('tool call', 'the AI uses an app')}. Fill the board!`); hint(); }
  else if (li === 1) say(`New: tools can fail. ⏳ = try again. 🚫 = use another tool.`);
  else say(`Last level: 7 steps, more tools, no hints.`);
  ev('level', { li });
}
function hint() { document.querySelectorAll('.tool').forEach(b => b.classList.remove('pulse')); if (!S.L.hints || S.done) return; const id = smartPick(S); const k = kioskOf(id); k && k.userData.label.classList.add('pulse'); }

async function tapTool(id) {
  if (state !== 'idle' || (ui.card && ui.card.isConnected)) return; // ui.card is a stale ref after the card is dismissed: only a card still on screen blocks taps
  state = 'busy'; const k = kioskOf(id), t = k.userData.t; document.querySelectorAll('.tool').forEach(b => b.classList.remove('pulse'));
  k.userData.label.classList.add('pressed'); setTimeout(() => k.userData.label.classList.remove('pressed'), 180);
  sound.neutral(); ev('tap', { id });
  // THINK
  const arg = t.needs != null && S.filled[t.needs] ? `(${S.L.slots[t.needs].icon})` : t.needs != null ? '(?)' : '()';
  think(`🧠 …`); await wait(0.25);
  think(`🔧 <b>${t.name}</b>${arg}`);
  const o = callTool(S, id); setGoal(); ev('obs', { id, kind: o.kind, repeat: o.repeat, left: o.stepsLeft });
  // ACT: walk to the tool, use it
  const front = k.position.clone().add(new THREE.Vector3(0, 0, 0).sub(k.position).setY(0).normalize().multiplyScalar(0.0));
  const toward = HOME.clone().sub(k.position).setY(0).normalize(); const stand = k.position.clone().addScaledVector(toward, 0.95);
  trails.ring(stand, { r1: 0.55, life: 0.5, opacity: 0.5 });
  await player.moveTo(stand); player.face(k.position); player.action();
  k.userData.work = 1; for (let n = 0; n < 3; n++) { NLA.play && NLA.play('tick'); await wait(0.22); } k.userData.work = 0;
  // OBSERVE
  const top = k.position.clone().setY(1.5);
  if (o.kind === 'ok') {
    k.userData.flash = 1; k.userData.flashCol.set(0x6fdc8c); think(`👀 ${S.L.slots[o.slot].icon} ${o.text}`);
    NLA.play && NLA.play('whoosh');
    await flySprite(S.L.slots[o.slot].icon, top, slotWorld(o.slot).add(new THREE.Vector3(0, 0, 0.2)), { arc: 1.4 });
    fillSlot(o.slot); burst.emit(slotWorld(o.slot), { count: 50, speed: 3 }); sound.play('success'); ev('verdict', { good: true });
    const fin = S.done && S.result === 'win';
    if (!fin) say(li === 0 && S.used === 1 ? `👀 That's the ${term('observation', 'what the tool sent back')}. Now the next one.` : `✓ Got ${S.L.slots[o.slot].icon}. ${o.stepsLeft} step${o.stepsLeft === 1 ? '' : 's'} left.`, 'good');
  } else {
    const look = { missing: ['✗', '#ffd9cf', `✗ ${t.name} ${o.text.toLowerCase()}. Step wasted.`],
      useless: ['🗑️', '#e9e1f5', `🔍 ${o.text} Step wasted.`],
      have: ['✗', '#ffd9cf', `${o.text}. Step wasted.`],
      timeout: ['⏳', '#ffe7a8', `⏳ ${term('Timeout', 'took too long')}: not your fault. Try again?`],
      closed: ['🚫', '#ffc9c0', `🚫 ${t.name}: ${o.text}. Pick another tool!`],
      blank: ['✉️', '#ffc9c0', `✉️ ${o.text}`] }[o.kind];
    k.userData.flash = 1; k.userData.flashCol.set(o.kind === 'timeout' ? 0xffc34d : 0xe0503c); k.userData.shake = 1;
    dropSlip(look[0], top, look[1]); think(`👀 ${look[0]} ${o.text}`);
    if (o.repeat) {
      loopRing.visible = true; loopRing.position.copy(player.pos).setY(0.08); rig.shake(0.35); NLA.play && NLA.play('alarm'); sound.play('fail');
      say(`↻ Same call, same error. That's a ${term('loop', 'the same move over and over')}!`, 'bad'); ev('verdict', { good: false, loop: true });
    } else if (o.fair || o.kind === 'closed') { NLA.play && NLA.play('alarm'); rig.shake(0.12); say(look[2], 'warn'); ev('verdict', { good: null }); }
    else { sound.play('fail'); rig.shake(0.2); say(look[2], 'bad'); ev('verdict', { good: false }); }
    if (o.kind === 'closed') { k.userData.dead = true; k.userData.label.classList.add('dead'); }
  }
  await wait(0.35);
  if (S.done) return endLevel();
  if (S.budget - S.used === 1) { NLA.play && NLA.play('alarm'); }
  player.moveTo(HOME.clone().lerp(k.position, 0.25)); state = 'idle'; if (!o.repeat) loopRing.visible = false;
  if (li === 0) hint();
}

const R = {
  loop: { text: 'ReAct (Princeton + Google, 2022) had an AI write a short thought before each tool call. On a text game of house chores, the best run won', num: '71% vs 45%', after: 'for the same AI acting with no thoughts.', term: 'ReAct', kid: 'Reason + Act', source: 'Yao et al. 2022, ReAct (arXiv 2210.03629), Table 3', url: 'https://arxiv.org/abs/2210.03629' },
  errors: { text: 'In the same paper, the no-thoughts AI kept repeating the same commands after one went wrong, until it ran out of moves. When ReAct itself failed, useless search results caused', num: '23% of failures', after: '', term: 'Loop', kid: 'same move, same result', source: 'ReAct (arXiv 2210.03629), Table 2 + Appendix D.2.2', url: 'https://arxiv.org/abs/2210.03629' },
  budget: { text: 'τ-bench (Sierra, 2024) lets an agent take at most 30 actions per task. The best AI tested, GPT-4o, finished about', num: '61% of shop tasks · 35% of airline tasks', after: '', term: 'Step budget', kid: 'most moves allowed', source: 'Yao et al. 2024, τ-bench (arXiv 2406.12045), Sec. 5', url: 'https://arxiv.org/abs/2406.12045' },
  blank: { text: 'In τ-bench, about', num: '19% of GPT-4o\'s failures', after: 'came from stopping before every part of the request was done.', term: 'Premature finish', kid: 'saying "done" too early', source: 'τ-bench (arXiv 2406.12045), Sec. 5.2', url: 'https://arxiv.org/abs/2406.12045' },
};
const research = (r, tie) => ({ text: r.text, num: r.num, term: r.term, kid: r.kid, tie: (r.after ? r.after + '<br>' : '') + tie, source: r.source, url: r.url });

async function endLevel() {
  state = 'card'; document.querySelectorAll('.tool').forEach(b => b.classList.remove('pulse'));
  ev('end', { li, result: S.result, used: S.used, wasted: S.wasted, loops: S.loops });
  if (S.result === 'win') {
    const st = stars(S); totals.steps += S.used; totals.loops += S.loops; totals.errors += S.errors; totals.stars += st; totals.retries += S.retries;
    cloth.material.emissiveIntensity = 2.5; NLA.play && NLA.play('powerup');
    think(`✅ Done! ${S.L.taskIcon}`); say(`🏁 Board full in ${S.used} steps!`, 'good');
    const last = li === 2;
    const tie = li === 0 ? `You ran <b>${S.used}</b> think → act → look loops.` : li === 1 ? `You hit <b>${S.errors}</b> tool error${S.errors === 1 ? '' : 's'} and looped <b>${S.loops}</b>×.` : `You used <b>${S.used}</b> of ${S.budget} steps.`;
    const card = last ? { icon: '🎂', title: 'Agent run complete!', stars: st,
        body: `All 3 boards. ${totals.steps} steps, ${totals.errors} tool errors, ${totals.loops} loops. <button class="copy" type="button">📋 Copy result</button>`,
        research: research(R.budget, tie), buttons: [{ label: 'Play again', onClick: () => { totals = { steps: 0, loops: 0, errors: 0, stars: 0, retries: 0 }; startLevel(0); } }] }
      : { icon: S.L.taskIcon, title: `Level ${li + 1} done!`, stars: st, body: st === 3 ? 'No wasted steps.' : `${S.wasted} wasted step${S.wasted === 1 ? '' : 's'}.`,
        research: research(li === 0 ? R.loop : R.errors, tie), buttons: [{ label: 'Next level ▶', onClick: () => startLevel(li + 1) }] };
    // payoff: agent steps back onto the think pad and faces us, camera cuts in above the kiosks with the full board behind
    player.moveTo(HOME); await wait(0.75); player.yaw = 0; player.yawGoal = 0; labelsEl.style.visibility = 'hidden';
    await GK.payoff(ctx, { at: HOME.clone().setY(1.0), card, hold: 1.5 / SPEED, framing: 'win' });
    labelsEl.style.visibility = '';
  } else {
    const blank = S.result === 'blank';
    think(blank ? '😬 It filled the blanks with made-up stuff.' : '🪫 Out of steps. The run is cut off.');
    const card = { icon: blank ? '🙈' : '🪫', title: blank ? 'It made stuff up!' : 'Out of steps!',
      body: blank ? 'Send went out with empty spots, so the invite says made-up things.' : (S.loops ? `${S.loops} step${S.loops === 1 ? '' : 's'} went into a loop.` : `${S.wasted} step${S.wasted === 1 ? '' : 's'} went to the wrong tool.`) + ' Real agents get cut off too.',
      research: research(blank ? R.blank : li === 0 ? R.loop : li === 1 ? R.errors : R.budget, `You filled <b>${S.filled.filter(Boolean).length}</b> of ${S.L.slots.length}.`),
      buttons: [{ label: 'Try again ↻', onClick: () => startLevel(li) }] };
    say(blank ? '✉️ Said "done" with blanks on the board.' : '🪫 Step budget used up.', 'bad');
    await GK.fail(ctx, { at: player.pos.clone(), card, why: blank ? 'Made it up!' : 'Out of steps!' });
  }
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.copy'); if (!b) return;
  const txt = `Run the Agent 🧩 3/3 boards · ${totals.steps} steps · ${totals.errors} tool errors · ${totals.loops} loops · ${'★'.repeat(Math.round(totals.stars / 3))}\nhttps://neuralloot.github.io/demos/2026-10-18-run-the-agent/`;
  navigator.clipboard && navigator.clipboard.writeText(txt).then(() => b.textContent = '✓ Copied', () => b.textContent = txt); });

// tap on a kiosk mesh in the world also works (same as its label)
GK.tapInput(stage, { ground, onTap: (p, e) => { if (!e || e.type === 'keydown') return; const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(kiosks, true)[0]; if (hit) { let o = hit.object; while (o && !kiosks.includes(o)) o = o.parent; o && tapTool(o.userData.t.id); } } });

// ---------- frame loop
const fps = GK.fpsMeter({ onLow: () => Q.get('auto') !== '0' && post.downgrade() });
const clock = new THREE.Clock(); let t = 0; const v = new THREE.Vector3();
function frame() { const dt = Math.min(clock.getDelta(), 1 / 20); t += dt; fps.tick(dt);
  player.update(dt, t); trails.update(dt); burst.update(dt); life.update(dt, t); drones.update(dt, t);
  leds.forEach(o => o.l.material.emissiveIntensity = 0.4 + 1.4 * (Math.sin(t * o.sp + o.ph) > 0.2 ? 1 : 0));
  pad.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(t * 3);
  cloth.rotation.y = 0.35 * Math.sin(t * 2.2); cloth.material.emissiveIntensity += (0.5 - cloth.material.emissiveIntensity) * dt * 0.8;
  kiosks.forEach(k => { const u = k.userData; const base = u.dead ? 0xe0503c : 0x9ad97a;
    if (u.work) u.lampM.emissive.set(Math.sin(t * 22) > 0 ? 0xffb867 : 0x553311), u.lampM.emissiveIntensity = 2.2;
    else if (u.flash > 0.01) { u.lampM.emissive.copy(u.flashCol); u.lampM.emissiveIntensity = 1 + 3 * u.flash; u.flash *= Math.exp(-1.6 * dt); }
    else { u.lampM.emissive.set(base); u.lampM.emissiveIntensity = 0.7; }
    u.scr.position.x = u.shake > 0.01 ? Math.sin(t * 60) * 0.03 * u.shake : 0; u.shake *= Math.exp(-5 * dt);
    k.children[0].scale.y = 1 + (u.work ? 0.04 * Math.sin(t * 30) : 0); });
  slotMeshes.forEach(m => { const u = m.userData; if (u.pop > 0.001) { m.scale.setScalar(1 + 0.35 * Math.sin(u.pop * Math.PI) * u.pop); u.pop = Math.max(0, u.pop - dt * 1.8); } else m.scale.setScalar(1); });
  if (loopRing.visible) { loopRing.rotation.z += dt * 6; loopRing.position.copy(player.pos).setY(0.08); }
  for (let i = sprites.length - 1; i >= 0; i--) { const s = sprites[i]; s.t += dt; const u = Math.min(1, s.t / s.dur);
    if (s.kind === 'fly') { const e = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; s.sp.position.lerpVectors(s.from, s.to, e); s.sp.position.y += Math.sin(Math.PI * e) * s.arc; s.sp.scale.setScalar(0.62 + 0.25 * Math.sin(Math.PI * u)); }
    else { s.sp.position.set(s.from.x + s.vx * u, s.from.y + 0.9 * Math.sin(Math.min(1, u * 2.2) * Math.PI / 2) - 2.2 * Math.max(0, u - 0.45) ** 2 * 3, s.from.z + 0.3 * u); s.sp.material.opacity = 1 - Math.max(0, (u - 0.6) / 0.4); s.sp.material.rotation = Math.sin(t * 9) * 0.25 * (1 - u); }
    if (u >= 1) { scene.remove(s.sp); s.sp.material.map.dispose(); s.sp.material.dispose(); sprites.splice(i, 1); s.res && s.res(); } }
  // camera: steady wide framing (goal board + agent + all tools in view), leaning toward the action
  if (rig.name !== 'low') { rig.frame((state === 'busy' ? 'act' : 'main') + (rig.aspect < 0.8 ? 'P' : '')); rig.follow(v.copy(player.pos).multiplyScalar(state === 'busy' ? 0.35 : 0.12)); }
  rig.update(dt, t); stage.followSun(v.set(0, 0, -0.5));
  // project DOM labels + bubble
  const B = kiosks.map(k => { const p = k.position.clone().setY(0.42).project(camera); const lab = k.userData.label; const w = lab.offsetWidth || 70, h = lab.offsetHeight || 48;
    return { lab, w, h, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight - h / 2 }; });
  // narrow screens: nudge labels apart so no two buttons overlap (push along the smaller overlap)
  for (let it = 0; it < 8; it++) for (let a = 0; a < B.length; a++) for (let b = a + 1; b < B.length; b++) { const A = B[a], C = B[b];
    const ix = Math.min(A.x + A.w / 2, C.x + C.w / 2) - Math.max(A.x - A.w / 2, C.x - C.w / 2) + 4, iy = Math.min(A.y + A.h, C.y + C.h) - Math.max(A.y, C.y) + 4;
    if (ix > 0 && iy > 0) { if (ix < iy) { const s = A.x < C.x ? -1 : 1; A.x += s * ix / 2; C.x -= s * ix / 2; } else { const s = A.y < C.y ? -1 : 1; A.y += s * iy / 2; C.y -= s * iy / 2; } } }
  B.forEach(({ lab, w, h, x, y }) => { x = Math.max(w / 2 + 4, Math.min(innerWidth - w / 2 - 4, x)); y = Math.max(4, Math.min(innerHeight - h - 4, y)); lab.style.transform = `translate(${x - w / 2}px, ${y}px)`; });
  const hp = player.pos.clone().setY(rig.aspect < 0.8 ? 1.75 : 2.0).project(camera); bubble.style.transform = `translate(-50%,-100%) translate(${(hp.x + 1) / 2 * innerWidth}px, ${(1 - hp.y) / 2 * innerHeight}px)`;
  post.render(); if (!document.hidden) requestAnimationFrame(frame); else hiddenWait(); }
function hiddenWait() { document.addEventListener('visibilitychange', () => { clock.getDelta(); requestAnimationFrame(frame); }, { once: true }); }

// ---------- test hooks (headless playtest + clip capture)
const events = []; const ev = (type, extra = {}) => events.push({ type, li, t: +(performance.now() / 1000).toFixed(3), ...extra });
window.__gk = { get state() { return state; }, get round() { return li; }, rounds: LEVELS, events, get fps() { return fps.avg; }, quality: () => stage.quality,
  get S() { return S; }, smart: () => S && smartPick(S), tapTool, labelRect: id => { const k = kioskOf(id); return k && k.userData.label.getBoundingClientRect(); },
  inFrame: (v3, m = 0) => { const p = v3.clone().project(camera); return p.z < 1 && Math.abs(p.x) <= 1 - m && Math.abs(p.y) <= 1 - m; },
  goalInFrame: () => slotMeshes.every(m => window.__gk.inFrame(m.getWorldPosition(new THREE.Vector3()), 0.02)), playerInFrame: () => window.__gk.inFrame(player.pos.clone().setY(1), 0.02),
  card: () => !!(ui.card && ui.card.isConnected) };
document.getElementById('load').remove();
startLevel(li); rig.snap(); frame();
