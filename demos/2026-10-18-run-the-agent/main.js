// Run the Agent: tap a tool, the agent walks over and calls it, the result (or the error) comes back.
// Built on the NeuralLoot game kit (three.js r170, vendored in ./kit). Game rules live in ./logic.js.
import * as GK from './kit/index.js';
import { LEVELS, newRun, callTool, stars, smartPick } from './logic.js?v=4';
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
  mainP: { off: [0, 18.4, 6.6], look: [0, 0.6, -0.55], fov: 40 },
  actP:  { off: [0, 18.0, 6.4], look: [0, 0.6, -0.55], fov: 40 },
  winP:  { off: [0, 2.6, 4.6], look: [0, 1.5, -1.0], fov: 40 },
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
  x.globalAlpha = ghost ? 0.5 : 1; x.font = `${size * 0.56}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, size / 2, size * 0.54); x.globalAlpha = 1;
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
  S.L.slots.forEach((s, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: iconTex(s.icon, { bg: '#efe2c8', ring: '#b98a5e', ghost: true }), transparent: true }));
    m.position.set(-2.2 + w / 2 + i * (w + gap), 2.4, 0.16); m.userData = { i, pop: 0 }; board.add(m); slotMeshes.push(m); }); }
function fillSlot(i) { const s = S.L.slots[i], m = slotMeshes[i]; m.material.map.dispose(); m.material.map = iconTex(s.icon, { bg: '#fff3dc', ring: '#52c7b8', check: true }); m.material.needsUpdate = true; m.userData.pop = 1; }
const slotWorld = i => slotMeshes[i].getWorldPosition(new THREE.Vector3());

// ---------- tool machines: the label IS the machine's screen (canvas texture, in the world), tap targets are
// invisible DOM hit-boxes over each machine's projected bounds (>=44 px, keyboard + screen reader friendly)
let kiosks = [];
const MW = 1.7, MH = 1.78;            // machine width / height (world units, before per-layout scale)
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
function screenTex(t, st = 'idle', c0 = null) {
  const W = 512, H = 240; const c = c0 || document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const col = '#' + new THREE.Color(t.color).getHexString(); const dead = st === 'dead', done = st === 'done';
  x.clearRect(0, 0, W, H);
  x.fillStyle = dead ? '#f3d9d3' : done ? '#e4ecdf' : '#fff8ea'; rr(x, 0, 0, W, H, 34); x.fill();
  x.fillStyle = dead ? '#c4493a' : col; rr(x, 0, 0, 128, H, 34); x.fill(); x.fillRect(92, 0, 36, H);
  const EM = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const ic = st === 'work' ? '⋯' : st === 'timeout' ? '⏳' : st === 'okflash' ? '✅' : t.icon;
  x.globalAlpha = done ? 0.55 : 1; x.font = `${st === 'work' ? 'bold 110px sans-serif' : '92px ' + EM}`; x.fillStyle = '#fff'; x.fillText(ic, 64, H / 2 + 6); x.globalAlpha = 1;
  x.textAlign = 'left'; x.fillStyle = dead ? '#7a2a20' : '#2b1a10';
  let fs = 96; const F = n => `900 ${n}px "Nunito","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif`; x.font = F(fs);
  while (x.measureText(t.name).width > W - 160 && fs > 40) x.font = F(fs -= 2);
  const hasSub = dead || done || t.needs != null; x.fillText(t.name, 146, hasSub ? 84 : H / 2 + 4);
  if (hasSub) { const sub = dead ? (/booked/i.test(t.closedText || '') ? '🚫 booked' : '🚫 closed') : done ? '✓ done' : `needs ${S.L.slots[t.needs].icon}`;
    x.font = `800 52px "Nunito","Trebuchet MS",system-ui,${EM}`; const w = x.measureText(sub).width + 34;
    x.fillStyle = dead ? '#c4493a' : done ? '#3f9b5a' : '#f1e1c4'; rr(x, 140, 140, Math.min(w, W - 154), 72, 22); x.fill();
    x.fillStyle = dead || done ? '#fff' : '#6b4426'; x.fillText(sub, 157, 177); }
  return c; }
function makeKiosk(t) { const g = new THREE.Group(); const col = new THREE.Color(t.color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(MW * 0.9, 0.8, 0.72), GK.toon(col)); body.position.y = 0.4; body.castShadow = body.receiveShadow = true;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(MW * 0.94, 0.1, 0.78), GK.toon(col.clone().multiplyScalar(0.78))); trim.position.y = 0.82; trim.castShadow = true;
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.12), GK.lowpoly(0x2b2633)); chute.position.set(0, 0.3, 0.37);
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.06); head.rotation.x = -0.42; // display tilted back toward the camera
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(MW, 0.86, 0.12), GK.lowpoly(0x2b2633)); bezel.position.y = 0.43; bezel.castShadow = true;
  const glowM = GK.glow(0x52c7b8, 0, { transparent: true }); const glowF = new THREE.Mesh(new THREE.PlaneGeometry(MW + 0.2, 1.06), glowM); glowF.position.set(0, 0.43, 0.05);
  const cv = screenTex(t); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const scrM = new THREE.MeshBasicMaterial({ map: tex, color: 0xe2dccf }); const scr = new THREE.Mesh(new THREE.PlaneGeometry(MW - 0.1, (MW - 0.1) * 240 / 512), scrM); scr.position.set(0, 0.43, 0.065);
  head.add(glowF, bezel, scr);
  const lampM = GK.glow(0x9ad97a, 0.6); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), lampM); lamp.position.set(MW / 2 - 0.16, 0.92, -0.05); head.add(lamp);
  [body, trim, chute, head].forEach(m => g.add(m));
  g.userData = { t, lamp, lampM, scr, scrM, cv, tex, head, body, glowM, work: 0, shake: 0, flash: 0, flashCol: new THREE.Color(), dead: false, st: 'idle', squash: 0, hint: false };
  return g; }
function setScreen(k, st) { const u = k.userData; if (u.st === st) return; u.st = st; screenTex(u.t, st, u.cv); u.tex.needsUpdate = true; }
const portrait = () => rig.aspect < 0.8;
function placeKiosks() {
  const n = kiosks.length; if (!n) return;
  if (portrait()) {
    // phones: an aisle. Machines line the left and right walls, the agent walks up the middle, the board is at the far end.
    const nl = Math.ceil(n / 2), nr = n - nl;
    kiosks.forEach((k, i) => { const left = i < nl, row = left ? i : i - nl, m = left ? nl : nr;
      const zs = m === 1 ? [0.2] : m === 2 ? [-1.3, 1.0] : [-2.05, -0.1, 1.85];
      k.scale.setScalar(1); k.position.set(left ? -1.55 : 1.55, 0, zs[row]); k.rotation.set(0, left ? 0.18 : -0.18, 0); k.userData.head.rotation.x = -1.1; });
    board.rotation.x = -0.45; board.position.z = -3.5;
  } else {
    const spread = n <= 4 ? 58 : n <= 5 ? 66 : 72, R = n <= 4 ? 3.3 : 3.6, sc = n <= 4 ? 0.82 : 0.74;
    kiosks.forEach((k, i) => { const a = THREE.MathUtils.degToRad(-spread + (2 * spread) * (n === 1 ? 0.5 : i / (n - 1)));
      k.scale.setScalar(sc); k.position.set(R * Math.sin(a) * 1.12, 0, HOME.z + R * Math.cos(a) * 0.9 + 0.1); k.rotation.set(0, -a * 0.55, 0); k.userData.head.rotation.x = -0.55; });
    board.rotation.x = 0; board.position.z = -3.6;
  }
  kiosks.forEach(k => { k.updateMatrixWorld(true); k.userData.stand = standOf(k); });
}
function standOf(k) { if (portrait()) return new THREE.Vector3(Math.sign(k.position.x) * 0.42, 0, k.position.z - 0.25); // aisle side, never between machine and camera
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(k.quaternion); return k.position.clone().addScaledVector(fwd, 0.75 * k.scale.x + 0.35).setY(0); }
function layoutKiosks(order) {
  kiosks.forEach(k => { scene.remove(k); k.userData.hit.remove(); }); kiosks = [];
  order.forEach(id => { const t = S.L.tools.find(x => x.id === id); const k = makeKiosk(t); scene.add(k);
    const hit = document.createElement('button'); hit.className = 'hit'; hit.dataset.id = id; hit.type = 'button';
    hit.setAttribute('aria-label', `${t.name}${t.needs != null ? ', needs ' + S.L.slots[t.needs].what : ''}`);
    hit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tapTool(id); });
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapTool(id); } });
    labelsEl.appendChild(hit); k.userData.hit = hit; kiosks.push(k); });
  placeKiosks();
}
const kioskOf = id => kiosks.find(k => k.userData.t.id === id);
// hint (tutorial only): the right machine's screen glows + a bobbing hand above it + a ring on the floor
const hand = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex('👆', { size: 128 }), transparent: true, depthTest: false })); hand.renderOrder = 6; hand.visible = false; scene.add(hand);
const hintRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), GK.glow(0x52c7b8, 1.6, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); hintRing.rotation.x = -Math.PI / 2; hintRing.visible = false; scene.add(hintRing);
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

// ---------- DOM: hit-boxes, thought bubble, caption, steps
const labelsEl = document.getElementById('labels'), bubble = document.getElementById('bubble'), capEl = document.getElementById('cap');
function say(html, tone = '') { capEl.className = 'cap show ' + tone; capEl.innerHTML = html; }
function think(html) { bubble.innerHTML = html; bubble.classList.add('show'); bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
const seenTerms = new Set();
const term = (t, kid) => { if (seenTerms.has(t)) return `<b>${t}</b>`; seenTerms.add(t); return ui.term(t, kid); };
function setGoal(spent = -1) { const left = S.budget - S.used;
  const pips = Array.from({ length: S.budget }, (_, i) => `<i class="pip ${i < left ? 'on' : ''} ${i === spent ? 'spent' : ''}"></i>`).join('');
  ui.goal(`<b>${S.L.taskIcon} ${S.L.title}</b><span class="steps ${left <= 1 && !S.done ? 'low' : ''}"><span class="sl">Steps</span>${pips}<span class="sn">${left}</span></span>`, { icon: '🧩', step: `${li + 1}/3` }); }

// ---------- game state
let li = Math.max(0, Math.min(2, (+Q.get('level') || 1) - 1)), S = null, state = 'idle', attempts = 0;
let totals, runLog; const resetTotals = () => { totals = { steps: 0, loops: 0, errors: 0, stars: 0, retries: 0, fails: 0, blanks: 0, outs: 0, switched: 0 }; runLog = []; }; resetTotals();
const rnd = Q.get('seed') ? (() => { let a = +Q.get('seed'); return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })() : Math.random;
function startLevel(i) {
  li = i; S = newRun(li, rnd); attempts++; labelsEl.style.visibility = ''; ui.card = null;
  // tutorial keeps a fixed layout; later levels shuffle the tools so position-spam fails
  const order = S.L.tools.map(t => t.id); if (li > 0) for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  S.order = order; buildSlots(); layoutKiosks(order); setGoal(); watchGoal(); fitCamera(); loopRing.visible = false;
  player.moveTo(HOME); state = 'idle';
  const intro = [`I need ${S.L.slots[0].icon} first. Which tool has it?`, `Tools can break now. Watch what comes back.`, `Send works anytime now. Fill the board first!`][li];
  think(`🧠 ${intro}`);
  if (li === 0) { say(`Tap a tool to fill the board. Each tap = 1 ${term('step', 'one tool call')}.`); }
  else if (li === 1) say(`New: tools fail. ⏳ = try again. 🚫 = pick another.`);
  else say(`Last level: more tools, no hints.`);
  hint(); ev('level', { li });
}
let hintId = null;
function hint() { hintId = null; if (!S.L.hints || S.done) return; hintId = smartPick(S); }

async function tapTool(id) {
  if (state !== 'idle' || performance.now() < settleUntil || (ui.card && ui.card.isConnected)) return; // ui.card is a stale ref after the card is dismissed: only a card still on screen blocks taps
  state = 'busy'; const k = kioskOf(id), t = k.userData.t; hintId = null;
  k.userData.squash = 1; sound.neutral(); ev('tap', { id });
  // THINK
  const arg = t.needs != null && S.filled[t.needs] ? `(${S.L.slots[t.needs].icon})` : t.needs != null ? '(?)' : '()';
  think(`🧠 …`); await wait(0.2);
  think(`🔧 <b>${t.name}</b>${arg}`);
  const spent = S.budget - S.used - 1;
  const o = callTool(S, id); setGoal(spent); ev('obs', { id, kind: o.kind, repeat: o.repeat, left: o.stepsLeft });
  // ACT: walk to the machine, use it
  const stand = k.userData.stand; trails.ring(stand, { r1: 0.5, life: 0.5, opacity: 0.5 });
  await player.moveTo(stand); player.face(k.position); player.action();
  k.userData.work = 1; setScreen(k, 'work'); for (let n = 0; n < 3; n++) { NLA.play && NLA.play('tick'); await wait(0.2); } k.userData.work = 0;
  // OBSERVE
  const top = k.position.clone().setY(1.9 * k.scale.x);
  if (o.kind === 'ok') {
    setScreen(k, 'okflash'); k.userData.flash = 1; k.userData.flashCol.set(0x6fdc8c); think(`👀 ${S.L.slots[o.slot].icon} ${o.text}`);
    NLA.play && NLA.play('whoosh');
    await flySprite(S.L.slots[o.slot].icon, top, slotWorld(o.slot).add(new THREE.Vector3(0, 0, 0.2)), { arc: 1.4 });
    fillSlot(o.slot); landFx(o.slot); sound.play('success'); ev('verdict', { good: true });
    setScreen(k, 'done');
    const fin = S.done && S.result === 'win';
    if (!fin) say(li === 0 && S.used === 1 ? `👀 That's the ${term('observation', 'what the tool sent back')}. Next one!` : `✓ Got ${S.L.slots[o.slot].icon}. ${o.stepsLeft} step${o.stepsLeft === 1 ? '' : 's'} left.`, 'good');
  } else {
    const look = { missing: ['✗', '#ffd9cf', `✗ ${t.name} ${o.text.toLowerCase()}. Step wasted.`],
      useless: ['🗑️', '#e9e1f5', `🔍 ${o.text} Step wasted.`],
      have: ['✗', '#ffd9cf', `${o.text}. Step wasted.`],
      timeout: ['⏳', '#ffe7a8', `⏳ ${term('Timeout', 'took too long')}: not your fault. Try again?`],
      closed: ['🚫', '#ffc9c0', `🚫 ${t.name}: ${o.text}. Pick another tool!`],
      blank: ['✉️', '#ffc9c0', `✉️ ${o.text}`] }[o.kind];
    k.userData.flash = 1; k.userData.flashCol.set(o.kind === 'timeout' ? 0xffc34d : 0xe0503c); k.userData.shake = 1;
    if (o.kind === 'timeout') setScreen(k, 'timeout');
    dropSlip(look[0], top, look[1]); think(`👀 ${look[0]} ${o.text}`);
    if (o.repeat) {
      loopRing.visible = true; loopRing.position.copy(player.pos).setY(0.08); rig.shake(0.35); NLA.play && NLA.play('alarm'); sound.play('fail');
      say(`↻ Same call, same error. That's a ${term('loop', 'the same move over and over')}!`, 'bad'); ev('verdict', { good: false, loop: true });
    } else if (o.fair || o.kind === 'closed') { NLA.play && NLA.play('alarm'); rig.shake(0.12); say(look[2], 'warn'); ev('verdict', { good: null }); }
    else { sound.play('fail'); rig.shake(0.2); say(look[2], 'bad'); ev('verdict', { good: false }); }
    if (o.kind === 'closed') { k.userData.dead = true; setScreen(k, 'dead'); k.userData.hit.setAttribute('aria-label', `${t.name}, ${t.closedText}`); }
  }
  await wait(0.35);
  if (o.kind === 'timeout' && !k.userData.dead) setScreen(k, 'idle');
  if (S.done) return endLevel();
  if (S.budget - S.used === 1) { NLA.play && NLA.play('alarm'); say(`🪫 1 step left! Make it count.`, 'warn'); }
  player.moveTo(HOME.clone().lerp(k.position, 0.2)); state = 'idle'; if (!o.repeat) loopRing.visible = false;
  hint();
}
// a result landing on the board: slot pop + sparks + the board jolts + tiny camera kick
let boardKick = 0;
function landFx(i) { const p = slotWorld(i); burst.emit(p, { count: 60, speed: 3.2 }); trails.ring(p.clone().setY(0.05), { r1: 0.8, life: 0.4, opacity: 0.4 }); boardKick = 1; rig.shake(0.1); }

const R = {
  loop: { text: 'ReAct (Princeton + Google, 2022) had an AI write a short thought before each tool call. On a text game of house chores, the best run won', num: '71% vs 45%', after: 'for the same AI acting with no thoughts.', term: 'ReAct', kid: 'Reason + Act', source: 'Yao et al. 2022, ReAct (arXiv 2210.03629), Table 3', url: 'https://arxiv.org/abs/2210.03629' },
  errors: { text: 'In the same paper, the no-thoughts AI kept repeating the same commands after one went wrong, until it ran out of moves. When ReAct itself failed, useless search results caused', num: '23% of failures', after: '', term: 'Loop', kid: 'same move, same result', source: 'ReAct (arXiv 2210.03629), Table 2 + Appendix D.2.2', url: 'https://arxiv.org/abs/2210.03629' },
  budget: { text: 'τ-bench (Sierra, 2024) lets an agent take at most 30 actions per task. The best AI tested, GPT-4o, finished about', num: '61% of shop tasks · 35% of airline tasks', after: '', term: 'Step budget', kid: 'most moves allowed', source: 'Yao et al. 2024, τ-bench (arXiv 2406.12045), Sec. 5', url: 'https://arxiv.org/abs/2406.12045' },
  blank: { text: 'In τ-bench, about', num: '19% of GPT-4o\'s failures', after: 'came from stopping before every part of the request was done.', term: 'Premature finish', kid: 'saying "done" too early', source: 'τ-bench (arXiv 2406.12045), Sec. 5.2', url: 'https://arxiv.org/abs/2406.12045' },
};
const research = (r, tie) => ({ text: r.text, num: r.num, term: r.term, kid: r.kid, tie: (r.after ? r.after + '<br>' : '') + tie, source: r.source, url: r.url });
// the run trace: one emoji per tool call, so the ending (and the share text) shows the exact run the player made
const GLYPH = { ok: '✅', timeout: '⏳', closed: '🚫', useless: '🗑️', missing: '✗', have: '✗', blank: '🙈' };
const traceOf = calls => calls.map(c => c.repeat ? '↻' : GLYPH[c.kind] || '·').join('');
function realLines() {
  // tie what the player actually did to the real failure modes (most relevant first, max 3)
  const L = [];
  if (totals.loops) L.push(`↻ You looped <b>${totals.loops}×</b>: same call, same error. The ReAct paper shows agents stuck repeating the same command until they run out of moves.`);
  if (totals.blanks) L.push(`🙈 You sent with blanks <b>${totals.blanks}×</b>. About <b>19%</b> of GPT-4o's τ-bench failures were stopping before the job was done.`);
  if (totals.outs) L.push(`🪫 You ran out of steps <b>${totals.outs}×</b>. Real runs get cut off too: τ-bench stops an agent at <b>30 actions</b>.`);
  if (totals.retries) L.push(`⏳ You retried a timeout and it worked. Real tools fail the same way: the error comes back as text the agent has to read.`);
  if (totals.switched) L.push(`🚫 You switched tools after a dead one. That is the move agents miss when they loop.`);
  if (!totals.loops && !totals.blanks && !totals.outs) L.push(`🧠 Clean run. The best AI in τ-bench (GPT-4o) finished about <b>61%</b> of shop tasks.`);
  return L.slice(0, 3);
}
const shareText = () => `Run the Agent 🧩 3/3 ${'★'.repeat(Math.max(1, Math.round(totals.stars / Math.max(1, runLog.length))))}\n` + runLog.map(r => `L${r.li + 1} ${r.trace}`).join('\n') +
  `\n${totals.steps} steps · ${totals.errors} tool errors · ${totals.loops} loops\nhttps://neuralloot.github.io/demos/2026-10-18-run-the-agent/`;

async function endLevel() {
  state = 'card'; hintId = null;
  ev('end', { li, result: S.result, used: S.used, wasted: S.wasted, loops: S.loops });
  const closedHit = S.calls.some(c => c.kind === 'closed'), okAfterClosed = closedHit && S.calls.findIndex(c => c.kind === 'closed') < S.calls.map(c => c.kind).lastIndexOf('ok');
  totals.loops += S.loops; totals.errors += S.errors; totals.retries += S.retries; if (okAfterClosed && S.L.faults) totals.switched++;
  if (S.result === 'win') {
    const st = stars(S); totals.steps += S.used; totals.stars += st; runLog.push({ li, trace: traceOf(S.calls) });
    cloth.material.emissiveIntensity = 2.5; NLA.play && NLA.play('powerup');
    think(`✅ Done! ${S.L.taskIcon}`); say(`🏁 Board full in ${S.used} steps!`, 'good');
    const last = li === 2;
    const tie = li === 0 ? `Your run: <b>${traceOf(S.calls)}</b> = ${S.used} think → act → look loops.` : li === 1 ? `Your run: <b>${traceOf(S.calls)}</b> · ${S.errors} tool error${S.errors === 1 ? '' : 's'}, ${S.loops} loop${S.loops === 1 ? '' : 's'}.` : `You used <b>${S.used}</b> of ${S.budget} steps.`;
    const card = last ? { icon: '🎂', title: 'Agent run complete!', stars: Math.max(1, Math.round(totals.stars / Math.max(1, runLog.length))),
        body: `<div class="trace">${runLog.map(r => `<div><span>L${r.li + 1}</span>${r.trace}</div>`).join('')}</div>` +
          `<div class="sub2">${totals.steps} steps · ${totals.errors} tool errors · ${totals.loops} loops${totals.fails ? ` · ${totals.fails} retr${totals.fails === 1 ? 'y' : 'ies'}` : ''}</div>` +
          `<div class="real"><b>Real agents hit the same walls:</b>${realLines().map(l => `<p>${l}</p>`).join('')}</div>` +
          `<button class="copy" type="button">📋 Copy my run</button>`,
        research: null, buttons: [{ label: 'Play again', onClick: () => { resetTotals(); startLevel(0); } }] }
      : { icon: S.L.taskIcon, title: `Level ${li + 1} done!`, stars: st, body: st === 3 ? 'No wasted steps.' : `${S.wasted} wasted step${S.wasted === 1 ? '' : 's'}.`,
        research: research(li === 0 ? R.loop : R.errors, tie), buttons: [{ label: 'Next level ▶', onClick: () => startLevel(li + 1) }] };
    if (last) card.body += `<div class="src">Sources: <a href="${R.loop.url}" target="_blank" rel="noopener">ReAct (arXiv 2210.03629)</a> · <a href="${R.budget.url}" target="_blank" rel="noopener">τ-bench (arXiv 2406.12045)</a></div>`;
    // payoff: agent steps back onto the think pad and faces us, camera cuts in with the full board behind
    player.moveTo(HOME); await wait(0.75); player.yaw = 0; player.yawGoal = 0; labelsEl.style.visibility = 'hidden';
    await GK.payoff(ctx, { at: HOME.clone().setY(1.0), card, hold: 1.5 / SPEED, framing: portrait() ? 'winP' : 'win' });
    labelsEl.style.visibility = '';
  } else {
    const blank = S.result === 'blank'; totals.fails++; blank ? totals.blanks++ : totals.outs++;
    think(blank ? '😬 It filled the blanks with made-up stuff.' : '🪫 Out of steps. The run is cut off.');
    const card = { icon: blank ? '🙈' : '🪫', title: blank ? 'It made stuff up!' : 'Out of steps!',
      body: `<div class="trace"><div><span>Run</span>${traceOf(S.calls)}</div></div>` + (blank ? 'Send went out with empty spots, so the invite says made-up things.' : (S.loops ? `${S.loops} step${S.loops === 1 ? '' : 's'} went into a loop.` : `${S.wasted} step${S.wasted === 1 ? '' : 's'} went to the wrong tool.`) + ' Real agents get cut off too.'),
      research: research(blank ? R.blank : li === 0 ? R.loop : li === 1 ? R.errors : R.budget, `You filled <b>${S.filled.filter(Boolean).length}</b> of ${S.L.slots.length}.`),
      buttons: [{ label: 'Try again ↻', onClick: () => startLevel(li) }] };
    say(blank ? '✉️ Said "done" with blanks on the board.' : '🪫 Step budget used up.', 'bad');
    await GK.fail(ctx, { at: player.pos.clone(), card, why: blank ? 'Made it up!' : 'Out of steps!' });
  }
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.copy'); if (!b) return; const txt = shareText();
  const done = () => b.textContent = '✓ Copied'; const show = () => { b.outerHTML = `<pre class="share">${txt}</pre>`; };
  navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt).then(done, show) : show(); });

// tap on a machine in the world also works (same as its hit-box)
GK.tapInput(stage, { ground, onTap: (p, e) => { if (!e || e.type === 'keydown') return; const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(kiosks, true)[0]; if (hit) { let o = hit.object; while (o && !kiosks.includes(o)) o = o.parent; o && tapTool(o.userData.t.id); } } });

// ---------- framing: phones get their own steeper camera + a vertical FOV that fills the screen (no dead bands)
let lastPortrait = null;
function fitCamera() { const a = rig.aspect; const vf = V => 2 * Math.atan(Math.tan(V * Math.PI / 360) * a * 9 / 16) * 180 / Math.PI; // undo the rig's portrait widening
  if (a < 0.8) {
    // fit the whole scene (board + machines) into the free band between the goal card and the thought + caption stack
    const H = innerHeight, W = innerWidth, g = document.querySelector('.gk-goal');
    const top = g ? g.getBoundingClientRect().bottom + 4 : 150, bot = H - 124, band = Math.max(200, bot - top);
    const V0 = 50; rig.F.mainP.fov = vf(V0); const gl = rig.goal('mainP');
    const tmp = new THREE.PerspectiveCamera(gl.fov, a, 0.1, 100); tmp.position.copy(gl.pos); tmp.lookAt(gl.look); tmp.updateMatrixWorld(); tmp.updateProjectionMatrix();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1; const box = new THREE.Box3(), v = new THREE.Vector3();
    [board, ...kiosks].forEach(o => { box.setFromObject(o, true); for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(tmp);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } });
    const need = Math.max((y1 - y0) / 2 * H / (band * 0.97), (x1 - x0) / 2 / 0.97);
    const V = Math.max(30, Math.min(75, 2 * Math.atan(Math.tan(gl.fov * Math.PI / 360) * need) * 180 / Math.PI));
    ['mainP', 'actP'].forEach(n => rig.F[n].fov = vf(V)); rig.F.winP.fov = vf(44);
    const cpx = -(y0 + y1) / 2 * H / 2 / need;
    const hpx = (y1 - y0) / 2 * H / need; // content height on screen: pin it to the top of the band, spare room goes above the thought bubble
    camera.setViewOffset(W, H, 0, -(top + hpx / 2 + 4 - H / 2 - cpx), W, H);
  } else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  if (portrait() !== lastPortrait && kiosks.length) { lastPortrait = portrait(); placeKiosks(); } lastPortrait = portrait(); }
stage.onResize(() => fitCamera());
// the goal card changes height as fonts load / text wraps: refit the phone camera whenever it does
// settleUntil: a tap right as the view re-fits would land on whatever machine slid under the finger, so drop it
let goalRO = null, settleUntil = 0; function watchGoal() { const g0 = document.querySelector('.gk-goal'); if (goalRO || !g0 || !window.ResizeObserver) return; goalRO = new ResizeObserver(() => { fitCamera(); if ((state === 'idle' || state === 'boot') && !S.used) { rig.snap(); settleUntil = performance.now() + 350; } }); goalRO.observe(g0); }

// ---------- frame loop
const fps = GK.fpsMeter({ onLow: () => Q.get('auto') !== '0' && post.downgrade() });
const clock = new THREE.Clock(); let t = 0; const v = new THREE.Vector3();
const corners = [...Array(8)].map(() => new THREE.Vector3());
function rectOf(k) { const s = MW / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; let i = 0;
  for (const X of [-s, s]) for (const Y of [0.05, MH]) for (const Z of [-0.3, 0.42]) { const c = corners[i++].set(X, Y, Z).applyMatrix4(k.matrixWorld).project(camera);
    const px = (c.x + 1) / 2 * innerWidth, py = (1 - c.y) / 2 * innerHeight; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  return { k, x0, y0, x1, y1, z: k.position.z }; }
function frame() { const dt = Math.min(clock.getDelta(), 1 / 20); t += dt; fps.tick(dt);
  player.update(dt, t); trails.update(dt); burst.update(dt); life.update(dt, t); drones.update(dt, t);
  leds.forEach(o => o.l.material.emissiveIntensity = 0.4 + 1.4 * (Math.sin(t * o.sp + o.ph) > 0.2 ? 1 : 0));
  pad.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(t * 3);
  cloth.rotation.y = 0.35 * Math.sin(t * 2.2); cloth.material.emissiveIntensity += (0.5 - cloth.material.emissiveIntensity) * dt * 0.8;
  kiosks.forEach(k => { const u = k.userData; const base = u.dead ? 0xe0503c : u.st === 'done' ? 0x6fdc8c : 0x9ad97a;
    if (u.work) u.lampM.emissive.set(Math.sin(t * 22) > 0 ? 0xffb867 : 0x553311), u.lampM.emissiveIntensity = 2.2;
    else if (u.flash > 0.01) { u.lampM.emissive.copy(u.flashCol); u.lampM.emissiveIntensity = 1 + 3 * u.flash; u.flash *= Math.exp(-1.6 * dt); }
    else { u.lampM.emissive.set(base); u.lampM.emissiveIntensity = 0.7; }
    u.head.position.x = u.shake > 0.01 ? Math.sin(t * 60) * 0.04 * u.shake : 0; u.shake *= Math.exp(-5 * dt);
    const sq = u.squash > 0.01 ? Math.sin(u.squash * Math.PI) * 0.08 : 0; u.squash = Math.max(0, u.squash - dt * 5); k.children[0].scale.y = 1 - sq + (u.work ? 0.04 * Math.sin(t * 30) : 0);
    const hinted = hintId === u.t.id && state === 'idle'; u.glowM.opacity += ((hinted ? 0.55 + 0.35 * Math.sin(t * 6) : 0) - u.glowM.opacity) * Math.min(1, dt * 10);
    u.glowM.emissiveIntensity = 1.4; });
  const hk = hintId && state === 'idle' && kioskOf(hintId);
  hand.visible = hintRing.visible = !!hk && !reduce;
  if (hk) { const sc = hk.scale.x; hand.position.copy(hk.position).add(new THREE.Vector3(0.55 * sc, (MH + 0.55 + 0.12 * Math.sin(t * 7)) * sc, 0.25)); hand.scale.setScalar(0.62 * sc);
    hintRing.position.copy(hk.userData.stand).setY(0.03); hintRing.scale.setScalar(0.75 + 0.1 * Math.sin(t * 5)); }
  slotMeshes.forEach(m => { const u = m.userData; if (u.pop > 0.001) { m.scale.setScalar(1 + 0.35 * Math.sin(u.pop * Math.PI) * u.pop); u.pop = Math.max(0, u.pop - dt * 1.8); } else m.scale.setScalar(1); });
  board.scale.setScalar(1 + 0.035 * Math.sin(boardKick * Math.PI)); boardKick = Math.max(0, boardKick - dt * 3.5);
  if (loopRing.visible) { loopRing.rotation.z += dt * 6; loopRing.position.copy(player.pos).setY(0.08); }
  for (let i = sprites.length - 1; i >= 0; i--) { const s = sprites[i]; s.t += dt; const u = Math.min(1, s.t / s.dur);
    if (s.kind === 'fly') { const e = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2; s.sp.position.lerpVectors(s.from, s.to, e); s.sp.position.y += Math.sin(Math.PI * e) * s.arc; s.sp.scale.setScalar(0.62 + 0.25 * Math.sin(Math.PI * u)); }
    else { s.sp.position.set(s.from.x + s.vx * u, s.from.y + 0.9 * Math.sin(Math.min(1, u * 2.2) * Math.PI / 2) - 2.2 * Math.max(0, u - 0.45) ** 2 * 3, s.from.z + 0.3 * u); s.sp.material.opacity = 1 - Math.max(0, (u - 0.6) / 0.4); s.sp.material.rotation = Math.sin(t * 9) * 0.25 * (1 - u); }
    if (u >= 1) { scene.remove(s.sp); s.sp.material.map.dispose(); s.sp.material.dispose(); sprites.splice(i, 1); s.res && s.res(); } }
  // camera: steady wide framing (goal board + agent + all machines in view), leaning toward the action
  if (rig.name !== 'low' && rig.name !== 'win' && rig.name !== 'winP') { rig.frame((state === 'busy' ? 'act' : 'main') + (portrait() ? 'P' : '')); rig.follow(v.copy(player.pos).multiplyScalar(state === 'busy' ? (portrait() ? 0.12 : 0.3) : 0.08).setY(0)); }
  else if (state !== 'card') rig.frame('main' + (portrait() ? 'P' : ''));
  rig.update(dt, t); stage.followSun(v.set(0, 0, -0.5));
  // hit-boxes = each machine's projected bounds; where two overlap, the nearer machine keeps the shared area
  const B = kiosks.map(rectOf);
  for (const a of B) for (const b of B) { if (a === b || a.z >= b.z) continue; // a is farther
    if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
    const cut = [b.y0 - a.y0, a.y1 - b.y1, b.x0 - a.x0, a.x1 - b.x1]; const best = cut.indexOf(Math.max(...cut));
    if (best === 0) a.y1 = b.y0 - 2; else if (best === 1) a.y0 = b.y1 + 2; else if (best === 2) a.x1 = b.x0 - 2; else a.x0 = b.x1 + 2; }
  B.forEach(({ k, x0, y0, x1, y1 }) => { const h = k.userData.hit; h.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`; h.style.width = (x1 - x0).toFixed(1) + 'px'; h.style.height = (y1 - y0).toFixed(1) + 'px'; });
  const hp = player.pos.clone().setY(portrait() ? 1.85 : 2.0).project(camera);
  bubble.style.transform = `translate(-50%,-100%) translate(${Math.max(90, Math.min(innerWidth - 90, (hp.x + 1) / 2 * innerWidth))}px, ${(1 - hp.y) / 2 * innerHeight}px)`;
  post.render(); if (!document.hidden) requestAnimationFrame(frame); else hiddenWait(); }
function hiddenWait() { document.addEventListener('visibilitychange', () => { clock.getDelta(); requestAnimationFrame(frame); }, { once: true }); }

// ---------- test hooks (headless playtest + clip capture)
const events = []; const ev = (type, extra = {}) => events.push({ type, li, t: +(performance.now() / 1000).toFixed(3), ...extra });
window.__gk = { get state() { return state; }, get round() { return li; }, rounds: LEVELS, events, get fps() { return fps.avg; }, quality: () => stage.quality,
  get S() { return S; }, smart: () => S && smartPick(S), tapTool, labelRect: id => { const k = kioskOf(id); return k && k.userData.hit.getBoundingClientRect(); },
  inFrame: (v3, m = 0) => { const p = v3.clone().project(camera); return p.z < 1 && Math.abs(p.x) <= 1 - m && Math.abs(p.y) <= 1 - m; },
  goalInFrame: () => slotMeshes.every(m => window.__gk.inFrame(m.getWorldPosition(new THREE.Vector3()), 0.02)), playerInFrame: () => window.__gk.inFrame(player.pos.clone().setY(1), 0.02),
  kiosksInFrame: () => kiosks.every(k => window.__gk.inFrame(k.position.clone().setY(1.3 * k.scale.x), 0.01)),
  get hint() { return hintId; }, get runLog() { return runLog; }, shareText, card: () => !!(ui.card && ui.card.isConnected) };
document.getElementById('load').remove();
fitCamera(); startLevel(li); rig.snap(); frame();
// hold taps until the UI fonts are in: the goal bar grows when they load, the phone camera re-fits and every machine moves
state = 'boot'; { let done = false; const open = () => { if (done) return; done = true; requestAnimationFrame(() => { fitCamera(); rig.snap(); requestAnimationFrame(() => requestAnimationFrame(() => { if (state === 'boot') state = 'idle'; })); }); };
  Promise.all([document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => 0) : 0, new Promise(r => setTimeout(r, 500))]).then(open); setTimeout(open, 2000); }
