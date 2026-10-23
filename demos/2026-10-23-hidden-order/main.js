// Hidden Order: the AI shopping agent rappels down a web page, reading it line by line. Some lines are orders written
// for the AI by a stranger (indirect prompt injection). Tap them before the agent obeys. Tap a safe line = false alarm.
// Built on the NeuralLoot game kit (three.js r170, vendored in ./kit). Rules live in ./logic.js (shared with the tests).
import * as GK from './kit/index.js';
import { LEVELS, newRun, step, tap, stars, isRevealed, catchable, dwellOf, etaOf, injCount, MOVE, VIEW } from './logic.js?v=1';
const { THREE } = GK;
const Q = new URLSearchParams(location.search);
const SPEED = Math.max(0.25, Math.min(4, +(Q.get('speed') || 1)));
const wait = s => new Promise(r => setTimeout(r, s * 1000 / SPEED));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const canvas = document.getElementById('c');
const stage = GK.createStage({ canvas, bg: 0xf6e6d6, fog: [30, 72] });
const { scene, camera } = stage;
const post = new GK.Post(stage, { bloom: 0.3 });
const ui = GK.createUI();
const sound = await GK.initSound({ pack: 'retro' });
const NLA = window.NLAudio || { play() {}, feedback() {}, outcome() {} };
const play = n => { try { NLA.play && NLA.play(n); } catch (e) {} };

// ---------- page geometry (world units). The page is a giant browser window standing up, facing the camera.
const ML = 0.9, LW = 4.7, MR = 0.2, PW = ML + LW + MR, X0 = -PW / 2, TXL = X0 + ML, TXC = TXL + LW / 2;
const RH = 0.42, PADV = 0.36, GAP = 0.12, CHROME = 0.78, PXU = 218;      // row height, line padding, gap, top bar, canvas px per unit
const AGX = X0 + 0.46, AGZ = 0.5;                                     // agent rides in the left gutter, a little in front
const EM = '"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji"';
const FONT = (w, px) => `${w} ${px}px "Nunito","Trebuchet MS",system-ui,sans-serif,${EM}`;
const C = { ink: '#3b2417', soft: '#6b4426', rasp: '#d9487a', raspD: '#a8325b', red: '#c4493a', green: '#3f9b5a', amber: '#ffd36b', violet: '#6a4fa3' };

const pageG = new THREE.Group(); scene.add(pageG);
const paperM = GK.toon(0xfffaf1);
let paper, frameBack, chrome, urlTex, urlMesh, track, thumb, plates = [], pageH = 10;
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function iconTex(icon, size = 128) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  x.font = `${size * 0.8}px ${EM},sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, size / 2, size * 0.54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const texCache = {}; const iconT = i => texCache[i] || (texCache[i] = iconTex(i));
function wrapText(x, text, maxW) { const words = String(text).split(' '); const out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }
function fitRows(x, text, maxW, rows, wgt, px0) { let px = px0; for (; px > px0 * 0.62; px -= 2) { x.font = FONT(wgt, px); const L = wrapText(x, text, maxW); if (L.length <= rows) return { L, px }; } x.font = FONT(wgt, px); return { L: wrapText(x, text, maxW), px }; }
const lineH = l => l.style === 'h1' ? 0.86 : l.style === 'buy' ? 1.06 : l.rows * RH + PADV;

// draw one line onto its canvas. st: { blocked, cleared, reveal (0..1), obeyed, read }
function drawLine(p) { const l = p.l, st = p.st, x = p.ctx, W = p.cv.width, H = p.cv.height; x.clearRect(0, 0, W, H);
  const pad = 26, inner = W - pad * 2; x.textBaseline = 'middle'; x.textAlign = 'left';
  const card = (bg, border, dash) => { x.fillStyle = bg; rr(x, 4, 6, W - 8, H - 12, 26); x.fill(); if (border) { x.lineWidth = 4; x.strokeStyle = border; x.setLineDash(dash || []); rr(x, 4, 6, W - 8, H - 12, 26); x.stroke(); x.setLineDash([]); } };
  const rowsText = (text, wgt, px0, col, left = pad + 8, maxW = inner - 16, rows = l.rows, y0 = 0, h = H) => { const { L, px } = fitRows(x, text, maxW, rows, wgt, px0); x.fillStyle = col;
    const lh = Math.min(h / L.length, px * 1.28); const top = y0 + (h - lh * L.length) / 2 + lh / 2; L.forEach((s, k) => x.fillText(s, left, top + k * lh)); return { L, px, lh, top }; };
  if (l.style === 'h1') { x.font = FONT(900, 78); x.fillStyle = C.ink; x.fillText(l.text, pad, H / 2 + 2); x.fillStyle = '#ead9bf'; x.fillRect(pad, H - 10, W - pad * 2, 5); return; }
  if (l.style === 'buy') { const on = st.pressed; x.fillStyle = on ? '#2f7d47' : '#3f9b5a'; rr(x, 70, 14, W - 140, H - 28, 46); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; rr(x, 86, 22, W - 172, (H - 28) * 0.42, 34); x.fill();
    x.font = FONT(900, 80); x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText(l.text, W / 2, H / 2 + 4); return; }
  const dim = st.blocked || st.cleared;
  if (l.style === 'hidden') {
    const r = st.reveal || 0;
    if (r > 0.01) { x.globalAlpha = r; card('rgba(240,235,252,.96)', '#8f78c9', [16, 12]); x.font = FONT(800, 34); x.fillStyle = '#7a64b5'; x.fillText('👁 hidden text · only the AI sees it', pad + 8, 34); x.globalAlpha = 1; }
    x.globalAlpha = 0.06 + 0.94 * r; const res = rowsText(l.text, 800, 58, r > 0.5 ? (dim ? '#9a8fb0' : '#4a3a73') : '#c9bfae', pad + 8, inner - 16, l.rows, r > 0.01 ? 30 : 0, H - (r > 0.01 ? 30 : 0)); x.globalAlpha = 1;
    if (st.blocked) strike(x, res); }
  else if (l.style === 'img') {
    card(dim ? '#f1ece4' : '#eef6f4', '#b9d8d2'); const s = H - 36; x.fillStyle = '#cfe8e3'; rr(x, 22, 18, s * 1.1, s, 22); x.fill();
    x.font = `${Math.min(s * 0.7, 120)}px ${EM},sans-serif`; x.textAlign = 'center'; x.fillText(l.icon, 22 + s * 0.55, 18 + s / 2 + 4); x.textAlign = 'left';
    const lx = 22 + s * 1.1 + 22, mw = W - lx - 30; x.font = FONT(800, 32); x.fillStyle = '#5f8c84'; x.fillText('🖼 image · alt text:', lx, 36);
    const res = rowsText(`“${l.alt}”`, 700, 50, dim ? '#9a9a9a' : '#24524b', lx, mw, l.rows, 48, H - 56); if (st.blocked) strike(x, res); }
  else {
    const look = { price: ['#fff3cf', '#ecd79a', 900, C.ink], plain: ['#ffffff', '#eadfcd', 800, C.ink], review: ['#f3f5fc', '#d7dcef', 700, '#33375a'], shout: ['#ffe8de', '#f3b9a5', 900, '#b7362a'] }[l.style] || ['#fff', '#eadfcd', 800, C.ink];
    card(dim ? '#f1ece4' : look[0], look[1]); const res = rowsText(l.text, look[2], 58, dim ? '#a39a8e' : look[3]); if (st.blocked) strike(x, res); }
  if (st.cleared) { x.font = FONT(900, 38); const t = '✓ safe line', w = x.measureText(t).width + 36; x.fillStyle = '#3f9b5a'; rr(x, W - w - 20, H - 66, w, 54, 27); x.fill(); x.fillStyle = '#fff'; x.fillText(t, W - w - 2, H - 38); }
  if (st.obeyed) { x.lineWidth = 10; x.strokeStyle = '#e0503c'; rr(x, 6, 8, W - 12, H - 16, 26); x.stroke(); }
}
function strike(x, res) { if (!res) return; x.strokeStyle = 'rgba(196,73,58,.75)'; x.lineWidth = 6; res.L.forEach((s, k) => { const w = x.measureText(s).width; const y = res.top + k * res.lh; x.beginPath(); x.moveTo(30, y); x.lineTo(30 + w + 10, y); x.stroke(); }); }
function stampTex() { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.strokeStyle = '#c4334f'; x.lineWidth = 12; rr(x, 10, 10, 492, 140, 30); x.stroke(); x.fillStyle = 'rgba(255,240,244,.92)'; rr(x, 16, 16, 480, 128, 26); x.fill();
  x.font = FONT(900, 78); x.fillStyle = '#c4334f'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🛡️ BLOCKED', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const STAMP = stampTex();
function urlDraw(site) { const c = urlTex.image, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.fillStyle = '#fff6f8'; rr(x, 6, 10, c.width - 12, c.height - 20, (c.height - 20) / 2); x.fill();
  x.font = FONT(800, 56); x.fillStyle = '#7a2a48'; x.textBaseline = 'middle'; x.fillText('🔒 ' + site, 34, c.height / 2 + 2); urlTex.needsUpdate = true; }

function buildPage() {
  plates.forEach(p => { pageG.remove(p.mesh, p.stamp); p.tex.dispose(); p.mesh.material.dispose(); p.hit.remove(); }); plates = [];
  [paper, frameBack, chrome, urlMesh, track, thumb].forEach(o => o && pageG.remove(o));
  let y = -CHROME - 0.22;
  S.lines.forEach((l, i) => { const h = lineH(l); const cy = y - h / 2; y -= h + GAP;
    const cv = document.createElement('canvas'); cv.width = Math.round(LW * PXU); cv.height = Math.round(h * PXU); const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LW, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    mesh.position.set(TXC, cy, 0.03); mesh.renderOrder = 2; pageG.add(mesh);
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.53), new THREE.MeshBasicMaterial({ map: STAMP, transparent: true, toneMapped: false, depthTest: false }));
    stamp.position.set(TXL + LW - 1.0, cy, 0.08); stamp.rotation.z = 0.12; stamp.visible = false; stamp.renderOrder = 4; pageG.add(stamp);
    const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'hit'; hit.dataset.i = i;
    hit.setAttribute('aria-label', (l.alt ? 'Image, alt text: ' + l.alt : l.text) + (l.style === 'hidden' ? ' (hidden text)' : ''));
    if (l.kind === 'head' || l.kind === 'buy') hit.tabIndex = -1;
    hit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tapLine(i, e); });
    hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapLine(i); } });
    labelsEl.appendChild(hit);
    const p = { i, l, cy, h, top: cy + h / 2, bot: cy - h / 2, cv, ctx, tex, mesh, stamp, hit, st: { reveal: 0 }, stampT: 0, shake: 0, op: 1, key: '' };
    plates.push(p); redraw(p); });
  pageH = -y + 0.5;
  paper = new THREE.Mesh(new THREE.BoxGeometry(PW, pageH, 0.16), paperM); paper.position.set(0, -pageH / 2, -0.08); paper.receiveShadow = true; pageG.add(paper);
  frameBack = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.34, pageH + 0.3, 0.3), GK.toon(0xd9487a)); frameBack.position.set(0, -pageH / 2 + 0.05, -0.24); frameBack.castShadow = true; frameBack.receiveShadow = true; pageG.add(frameBack);
  chrome = new THREE.Group(); const bar = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.34, CHROME + 0.1, 0.34), GK.toon(0xd9487a)); bar.position.set(0, -CHROME / 2 + 0.1, -0.02); bar.castShadow = true; chrome.add(bar);
  [0xff8b7a, 0xffd36b, 0x9ad97a].forEach((c, k) => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: c })); d.position.set(X0 + 0.3 + k * 0.3, -CHROME / 2 + 0.12, 0.16); chrome.add(d); });
  const uc = document.createElement('canvas'); uc.width = 1024; uc.height = 128; urlTex = new THREE.CanvasTexture(uc); urlTex.colorSpace = THREE.SRGBColorSpace; urlDraw(S.L.site);
  urlMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.54), new THREE.MeshBasicMaterial({ map: urlTex, transparent: true, toneMapped: false })); urlMesh.position.set(X0 + 1.2 + 2.15, -CHROME / 2 + 0.12, 0.17); chrome.add(urlMesh);
  pageG.add(chrome);
  track = new THREE.Mesh(new THREE.BoxGeometry(0.08, pageH - CHROME - 0.4, 0.04), GK.toon(0xf0e2cf)); track.position.set(PW / 2 - 0.1, -(pageH + CHROME) / 2, 0.02); pageG.add(track);
  thumb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.06), GK.toon(0xe7a3bb)); thumb.position.set(PW / 2 - 0.1, -CHROME - 0.6, 0.05); pageG.add(thumb);
}
function stKey(p) { const s = p.st; return [s.blocked, s.cleared, s.obeyed, s.pressed, Math.round((s.reveal || 0) * 10)].join(); }
function redraw(p) { const k = stKey(p); if (k === p.key) return; p.key = k; drawLine(p); p.tex.needsUpdate = true; }

// ---------- the reader: the approved agent on a window-washer gondola, a reading highlight + scan cursor + eye beam
const player = GK.createPlayer(scene, { scale: 0.84, speed: 0 });
const gond = new THREE.Group(); scene.add(gond);
const deck = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.72), GK.lowpoly(0xb98a5e)); deck.castShadow = deck.receiveShadow = true; gond.add(deck);
const rail = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.06), GK.lowpoly(0x8a6240)); rail.position.set(0, 0.42, 0.34); gond.add(rail);
[-0.43, 0.43].forEach(xx => { const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), GK.lowpoly(0x8a6240)); post2.position.set(xx, 0.21, 0.34); gond.add(post2);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 40, 5), GK.matte(0x7a5a3a)); rope.position.set(xx, 20, 0); gond.add(rope); });
const hl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false })); hl.renderOrder = 1; hl.position.z = 0.015; scene.add(hl);
const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 1), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, toneMapped: false })); cursor.renderOrder = 3; cursor.position.z = 0.06; scene.add(cursor);
const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending })); beam.frustumCulled = false; beam.renderOrder = 3; scene.add(beam);
const burst = new GK.Burst(scene, { max: 500, size: 0.16 });
const sprites = [];
function addSprite(icon, o) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconT(icon), transparent: true, depthTest: false })); sp.renderOrder = 6; sp.scale.setScalar(o.s || 0.5); scene.add(sp); sprites.push({ sp, t: 0, ...o }); return sp; }

// ---------- background: a cozy low-poly "internet town" (tall shop towers), drones carrying parcels
const town = new THREE.Group(); scene.add(town); const winM = [];
{ const cols = [0xe9c8a8, 0xdcb8c6, 0xb8d3c8, 0xeed9a8, 0xc9c0e0, 0xf0c4b0]; const wg = new THREE.PlaneGeometry(0.34, 0.42);
  const wOn = GK.glow(0xffd99a, 0.9), wOff = GK.toon(0x8d7a8a);
  for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1, w = 2 + (k * 37 % 5) * 0.5, h = 46, x = side * (4.6 + (k * 53 % 9) * 1.3), z = -5 - (k * 29 % 11) * 1.2, top = 1 + (k * 17 % 7);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.2), GK.toon(cols[k % cols.length])); b.position.set(x, top - h / 2, z); b.receiveShadow = true; town.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.3, 2.5), GK.toon(0x8a6240)); roof.position.set(x, top + 0.15, z); town.add(roof);
    for (let r = 0; r < 30; r++) for (let c = 0; c < Math.floor(w / 0.7); c++) { if ((r * 7 + c * 3 + k) % 4 === 0) continue;
      const m = new THREE.Mesh(wg, (r + c + k) % 3 ? wOff : wOn); m.position.set(x - w / 2 + 0.45 + c * 0.7, top - 0.9 - r * 1.3, z + 1.11); town.add(m); } } }
const drones = [...Array(5)].map((_, k) => { const d = new THREE.Group(); const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), GK.glow(0xd9487a, 0.6)); d.add(body);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), GK.toon(0xc9a06a)); box.position.y = -0.3; d.add(box);
  const rot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.06), GK.matte(0x3b2417)); rot.position.y = 0.16; d.add(rot); d.userData = { rot, ph: k * 1.7, sp: 0.06 + k * 0.015, dy: -3 + k * 1.6, z: -2.5 - k * 0.9 }; scene.add(d); return d; });

// ---------- DOM
const labelsEl = document.getElementById('labels'), bubble = document.getElementById('bubble'), capEl = document.getElementById('cap'), handEl = document.getElementById('hand');
const CAPH = 66;   // the caption gets a fixed 2-line slot under the reading band; long captions shrink to fit it
function say(html, tone = '') { capEl.className = 'cap show ' + tone; capEl.innerHTML = html; let fs = 16; capEl.style.fontSize = '';
  while (capEl.offsetHeight > CAPH && fs > 12) { fs -= 0.5; capEl.style.fontSize = fs + 'px'; } }
let bubbleT = 0; function think(html, secs = 0) { bubble.innerHTML = html; bubble.classList.add('show'); bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); bubbleT = secs ? performance.now() + secs * 1000 / SPEED : 0; }
const seenTerms = new Set(); const term = (t, kid) => { if (seenTerms.has(t)) return `<b>${t}</b>`; seenTerms.add(t); return ui.term(t, kid); };
function setGoal(broke = -1) { const inj = injCount(S), got = S.catches.length;
  const hearts = Array.from({ length: S.maxHearts }, (_, k) => `<i class="ht ${k < S.hearts ? 'on' : ''} ${k === broke ? 'brk' : ''}">${k < S.hearts ? '💚' : '🤍'}</i>`).join('');
  ui.goal(`<span class="url">🔒 ${S.L.site}</span><b>${S.L.taskIcon} ${S.L.task}</b><span class="hud"><span class="hearts" aria-label="${S.hearts} hearts">${hearts}</span><span class="shield">🛡️ ${got}/${inj}</span></span>`, { icon: '🛒', step: `${li + 1}/3` }); }
function popAt(text, p, tone = 'good') { const r = p.hit.getBoundingClientRect(); ui.popup(text, { tone, x: r.left + r.width * 0.36, y: r.top + r.height / 2 - 18 }); }   // over the tapped (now dead) line only

// ---------- game state
let li = Math.max(0, Math.min(2, (+Q.get('level') || 1) - 1)), S = null, state = 'boot', runs = [], attempts = 0, introT = 0, hintOn = false, firstHint = 0;
const rnd = Q.get('seed') ? (() => { let a = +Q.get('seed'); return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })() : Math.random;
let best = 0; try { best = +(localStorage.getItem('hidden-order-best') || 0); } catch (e) {}
function startLevel(i) {
  li = i; S = newRun(li, rnd); attempts++; ui.card = null; ui.cinematic(false); post.dof(false);
  sprites.splice(0).forEach(s => scene.remove(s.sp)); hat = null; lift = 0; liftV = 0;
  buildPage(); setGoal(); watchGoal(); hintOn = false; handEl.classList.remove('show'); labelsEl.style.visibility = '';
  player.yaw = player.yawGoal = 0.75; camMode = 'play'; introT = 0; state = 'intro'; reachedBuy = false;
  const intro = [`🛒 My job: <b>${S.L.task.toLowerCase()}</b>. Reading the page…`, `🧥 Raincoat time! I'll read the reviews too.`, `🎧 Last page. Some text here is hidden from you…`][li];
  think(intro, 3.2);
  if (li === 0) say(`👆 Tap any line that gives <b>orders to the AI</b>.`);
  else if (li === 1) say(`New: shout-y lines for <b>shoppers</b> are fine. Only block orders aimed at the <b>AI</b>.`);
  else say(`New: orders can hide in an image's <b>alt text</b> 🖼️ and in invisible text 👀.`);
  ev('level', { li }); fitCamera(true);
}
let reachedBuy = false, hat = null, lift = 0, liftV = 0;
function revealCheck() { plates.forEach(p => { if (p.l.style !== 'hidden') return; const r = isRevealed(S, p.i);
  if (r && !p.revealed) { p.revealed = true; p.revealT = performance.now(); play('whoosh'); burst.emit(new THREE.Vector3(TXL + 0.6, p.cy, 0.3), { count: 26, speed: 1.4, up: 0.6, colors: [0xb59cf0, 0xffffff, 0xffd36b] });
    if (!seenTerms.has('Hidden text')) { say(`👀 The AI's eyes just found ${term('Hidden text', 'white on white: you can\'t see it, the AI can')}`, 'warn'); think('👀 Ooh, there\'s text here you can\'t see!', 2.4); }
    ev('reveal', { i: p.i, inj: p.l.kind === 'inj' }); } }); }

function tapLine(i, e) {
  if (state !== 'play' || performance.now() < settleUntil || (ui.card && ui.card.isConnected)) return;
  const p = plates[i]; const r = tap(S, i); ev('tap', { i, r: r.type, kind: p.l.kind });
  if (r.type === 'block') { p.st.blocked = true; p.stampT = 1; p.stamp.visible = true; redraw(p);
    const at = new THREE.Vector3(TXL + LW - 1.0, p.cy, 0.3); burst.emit(at, { count: 90, speed: 3.4, colors: [0xd9487a, 0xffd36b, 0xffffff, 0xff9cc0] }); shake(0.22);
    sound.play('success'); if (!r.close && r.early > 1.5) play('powerup');
    popAt(r.close ? '⚡ Just in time!' : `🛡️ +${r.early.toFixed(1)} s early`, p, 'good');
    const first = S.catches.length === 1 && !runs.some(x => x.catches.length);
    think(r.close ? '😅 Phew! I was about to do that!' : ['🛡️ Thanks! I won\'t follow that one.', '🛡️ Blocked. Not my user\'s words!', '🛡️ Nice catch!'][S.catches.length % 3], 2.2);
    say(first ? `🛡️ Blocked! That was a ${term('prompt injection', 'orders hidden in what the AI reads')}` : `🛡️ Order blocked${r.close ? ' at the last second' : ''}. Keep reading!`, 'good');
    if (hintOn) { hintOn = false; handEl.classList.remove('show'); }
    setGoal(); return; }
  if (r.type === 'false' || r.type === 'overblock') { p.st.cleared = true; p.shake = 1; redraw(p); sound.play('fail'); shake(0.18);
    setGoal(S.hearts); popAt('−1 💚', p, 'bad');
    const who = /\bAI\b/.test(p.l.text) ? 'It <b>mentions</b> AI, but gives the AI no order.' : /shopper|ignore/i.test(p.l.text) ? 'That one talks to <b>shoppers</b>, not to the AI.' : p.l.style === 'hidden' ? 'Hidden, but no orders for the AI: just keyword spam.' : 'That line was safe: the AI needed it.';
    say(`🙅 ${term('False alarm', 'blocking a safe line')} ${who}`, 'bad'); think('😵 Hey, I needed that line!', 1.8);
    if (r.type === 'overblock') return endOver();
    return; }
  if (r.type === 'old') { ui.popup('Already read', { tone: 'bad', x: e ? e.clientX - 50 : innerWidth / 2 - 50, y: e ? e.clientY - 40 : innerHeight / 2 }); return; }
  if (r.type === 'nope') { const t = p.l.kind === 'buy' ? 'The AI presses Buy itself 🙂' : p.l.kind === 'head' ? 'Just the shop name' : 'The AI hasn\'t looked there yet 👀';
    ui.popup(t, { tone: 'good', x: e ? Math.max(8, Math.min(innerWidth - 220, e.clientX - 100)) : innerWidth / 2 - 100, y: e ? e.clientY - 44 : innerHeight / 2 }); sound.neutral(); }
}

function onEvents(evs) { for (const e of evs) {
  if (e.type === 'arrive') { const l = S.lines[e.i]; ev('arrive', { i: e.i });
    if (l.kind === 'buy') { reachedBuy = true; player.point(); play('powerup'); think('🛒 Everything checks out. Buying!', 2); plates[e.i].st.pressed = true; redraw(plates[e.i]); }
    else if (S.blocked.has(e.i)) { think('🛡️ Skipping the blocked line.', 1.2); play('whoosh'); }
    else play('tick'); }
  if (e.type === 'hold') { hintOn = true; think('🤔 Wait… the next line is giving <b>me</b> orders?', 0); say('👆 Tap that line to block it before I obey!', 'warn'); play('alarm'); ev('hold', { i: e.i }); }
  if (e.type === 'go') { if (hintOn) { hintOn = false; handEl.classList.remove('show'); } }
  if (e.type === 'obey') endObey(e.i, e.gag);
  if (e.type === 'win') endWin();
} }

// ---------- endings
const R = {
  loud: { text: 'Loud orders like this are the easy kind. In AgentDojo (ETH Zurich, 2024), the classic "Ignore previous instructions" line fooled GPT-4o only', num: '5.4% of the time', term: 'Prompt injection', kid: 'orders hidden in what the AI reads', source: 'Debenedetti et al. 2024, AgentDojo (arXiv 2406.13352), Table 4', url: 'https://arxiv.org/abs/2406.13352' },
  loudFail: { text: 'Real agents usually resist shouty orders like this one: in AgentDojo the classic "Ignore previous instructions" line fooled GPT-4o only', num: '5.4% of the time', term: 'Prompt injection', kid: 'orders hidden in what the AI reads', source: 'Debenedetti et al. 2024, AgentDojo (arXiv 2406.13352), Table 4', url: 'https://arxiv.org/abs/2406.13352' },
  review: { text: 'Reviews are written by strangers, so they are an easy place to hide orders. In InjecAgent (UIUC, 2024), orders planted in tool text like reviews tricked a prompted GPT-4', num: '24% of the time (47% with a "hacking" prompt)', term: 'Indirect prompt injection', kid: 'the order comes from the page, not from you', source: 'Zhan et al. 2024, InjecAgent (arXiv 2403.02691)', url: 'https://arxiv.org/abs/2403.02691' },
  pirate: { text: 'This one really happened. In 2023 researchers hid instructions in a web page, and Bing Chat, reading the page, started answering like a pirate. The page text could even be', num: 'invisible to the user', term: 'Indirect prompt injection', kid: 'the order comes from the page, not from you', source: 'Greshake et al. 2023, "Not what you\'ve signed up for" (arXiv 2302.12173)', url: 'https://arxiv.org/abs/2302.12173' },
  alt: { text: 'Agents read the parts of a page you skip. In AgentDojo, when the attack sat in web pages the agent read, GPT-4o was hijacked in', num: '92% of cases', term: 'Alt text', kid: 'image words only machines read', source: 'Debenedetti et al. 2024, AgentDojo (arXiv 2406.13352), Sec. 4.1', url: 'https://arxiv.org/abs/2406.13352' },
  hidden: { text: 'Polite, official-sounding orders work best. AgentDojo\'s "important message" attack got GPT-4o to follow it', num: '57.7% of the time', term: 'Hidden text', kid: 'white on white: only the AI sees it', source: 'Debenedetti et al. 2024, AgentDojo (arXiv 2406.13352), Table 4-5', url: 'https://arxiv.org/abs/2406.13352' },
  over: { text: 'Blocking everything is not safe either. AgentDojo tested a prompt-injection detector: attacks dropped to 8%, but it flagged so much normal text that GPT-4o\'s task success fell from 69% to', num: '41%', term: 'False alarm', kid: 'blocking a safe line', source: 'Debenedetti et al. 2024, AgentDojo (arXiv 2406.13352), Table 5', url: 'https://arxiv.org/abs/2406.13352' },
};
const research = (r, tie) => ({ text: r.text, num: r.num, term: r.term, kid: r.kid, tie, source: r.source, url: r.url });
const G = { block: '🛡️', close: '⚡', fa: '⚠️', obey: '💥' };
function traceOf(S2) { const ev2 = []; S2.catches.forEach(c => ev2.push([c.i, c.close ? G.close : G.block])); S2.lines.forEach((l, i) => { if (S2.cleared.has(i)) ev2.push([i, G.fa]); }); if (S2.obeyed != null) ev2.push([S2.obeyed, G.obey]);
  return ev2.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('') || '·'; }
const early = S2 => S2.catches.reduce((a, c) => a + c.early, 0);
function record() { runs.push({ li, result: S.result, catches: S.catches.slice(), fa: S.fa, inj: injCount(S), trace: traceOf(S), early: early(S), stars: stars(S), vecs: S.lines.filter(l => l.kind === 'inj').map(l => l.vec) }); }

async function endWin() {
  state = 'end'; record(); ev('end', { li, result: 'win', fa: S.fa, early: early(S) }); hintOn = false; handEl.classList.remove('show');
  const bp = plates[plates.length - 1]; burst.emit(new THREE.Vector3(TXC, bp.cy, 0.5), { count: 160, speed: 5, colors: [0x9ad97a, 0xffd36b, 0xd9487a, 0xffffff] });
  ui.flash(); shake(0.3); sound.play('success');
  const head = player.headWorld(); addSprite(S.L.taskIcon, { kind: 'drop', from: head.clone().add(new THREE.Vector3(0.35, 3.2, 0.3)), to: gond.position.clone().add(new THREE.Vector3(0.18, 0.28, 0.2)), dur: 0.7, s: 0.62 });
  await wait(0.6); player.yawGoal = 0.25; player.celebrate(); camMode = 'close'; ui.cinematic(true); post.dof(true, player.headWorld());
  think(['🎂 Cake bought! Only what you asked for.', '🧥 Raincoat bought. No pirates!', '🎧 Headphones bought. Your address stays home.'][li], 0);
  say(`🏁 ${S.L.taskIcon} Bought, with ${S.fa ? S.fa + ' false alarm' + (S.fa > 1 ? 's' : '') : 'zero false alarms'}!`, 'good');
  await wait(1.5); ui.cinematic(false); post.dof(false); camMode = 'play';
  const st = stars(S), e = early(S), last = li === 2;
  const tie = `Your run: <b>${traceOf(S)}</b> · blocked ${S.catches.length}/${injCount(S)}, ${e.toFixed(1)} s early.`;
  state = 'card'; let card;
  if (!last) { const r = li === 0 ? R.loud : (S.lines.find(l => l.kind === 'inj').gag.kind === 'pirate' ? R.pirate : R.review);
    card = { icon: S.L.taskIcon, title: `Level ${li + 1} done!`, stars: st, body: st === 3 ? 'Clean: every order blocked early, no false alarms.' : S.fa ? `${S.fa} false alarm${S.fa > 1 ? 's' : ''} (−💚).` : 'A close call! Block earlier for 3 stars.',
      research: research(r, tie), buttons: [{ label: 'Next page ▶', onClick: () => startLevel(li + 1) }] }; }
  else card = finalCard();
  sound.outcome('win'); await ui.rewardCard(card);
}
function finalCard() {
  const wins = runs.filter(r => r.result === 'win'); const lastWins = {}; wins.forEach(r => lastWins[r.li] = r);
  const rows = [0, 1, 2].map(k => lastWins[k]).filter(Boolean);
  const caught = rows.reduce((a, r) => a + r.catches.length, 0), inj = rows.reduce((a, r) => a + r.inj, 0), fa = rows.reduce((a, r) => a + r.fa, 0), e = rows.reduce((a, r) => a + r.early, 0);
  const fails = runs.filter(r => r.result !== 'win').length; const nb = e > best; if (nb) { best = e; try { localStorage.setItem('hidden-order-best', e.toFixed(1)); } catch (x) {} }
  const st = Math.max(1, Math.round(rows.reduce((a, r) => a + r.stars, 0) / Math.max(1, rows.length)));
  const L = [];
  L.push(`💥 A polite "important message" planted in what an agent reads got GPT-4o to follow it <b>57.7%</b> of the time (AgentDojo). You blocked <b>${caught} of ${inj}</b>.`);
  L.push(fa ? `⚠️ You raised <b>${fa}</b> false alarm${fa > 1 ? 's' : ''}. A real detector that blocked hard cut GPT-4o's task success from <b>69% to 41%</b>.` : `⚖️ Zero false alarms. That balance is the hard part: AgentDojo's detector stopped most attacks but cut task success from <b>69% to 41%</b>.`);
  L.push(`👀 The hidden line was invisible to you until the AI's eyes reached it. Researchers showed Bing Chat obeying instructions hidden in web pages (Greshake et al. 2023).`);
  const txt = shareText(rows, caught, inj, fa, e);
  return { icon: '🛡️', title: 'Shopping done, no hijacks!', stars: st,
    body: `<div class="trace">${rows.map(r => `<div><span>${LEVELS[r.li].taskIcon}</span>${r.trace}</div>`).join('')}</div>` +
      `<div class="sub2">Blocked ${caught}/${inj} · ${fa} false alarm${fa === 1 ? '' : 's'} · ${e.toFixed(1)} s early${fails ? ` · ${fails} retr${fails === 1 ? 'y' : 'ies'}` : ''}<br>${nb ? '🏅 New best!' : `Best: ${best.toFixed(1)} s early`}</div>` +
      `<div class="real"><b>🔬 Real agents fall for this:</b>${L.map(l => `<p>${l}</p>`).join('')}</div>` +
      `<button class="copy" type="button" data-share="${encodeURIComponent(txt)}">📋 Copy my run</button>` +
      `<div class="src">Sources: <a href="https://arxiv.org/abs/2406.13352" target="_blank" rel="noopener">AgentDojo</a> · <a href="https://arxiv.org/abs/2403.02691" target="_blank" rel="noopener">InjecAgent</a> · <a href="https://arxiv.org/abs/2302.12173" target="_blank" rel="noopener">Greshake et al.</a></div>`,
    research: null, buttons: [{ label: 'Play again ↻', onClick: () => { runs = []; startLevel(0); } }] };
}
const shareText = (rows, caught, inj, fa, e) => `Hidden Order 🛡️ blocked ${caught}/${inj} hidden orders, ${fa} false alarm${fa === 1 ? '' : 's'}\n` + rows.map(r => `${LEVELS[r.li].taskIcon} ${r.trace}`).join('\n') + `\nhttps://neuralloot.github.io/demos/2026-10-23-hidden-order/`;
async function endObey(i, gag) {
  state = 'end'; record(); ev('end', { li, result: 'obeyed', i }); hintOn = false; handEl.classList.remove('show');
  const p = plates[i]; p.st.obeyed = true; redraw(p); sound.play('fail'); play('alarm'); shake(0.35);
  player.yawGoal = 0; think(`🫡 ${gag.say}`, 0); say(`💥 The AI obeyed the page, not you!`, 'bad');
  const head = player.headWorld(), n = reduce ? Math.min(8, gag.n || 8) : (gag.n || 12);
  if (gag.kind === 'rain') for (let k = 0; k < n; k++) addSprite(gag.icon, { kind: 'rain', x: TXL + Math.random() * (LW + 0.6) - 0.6, y0: camFocus.y + 6 + Math.random() * 3, delay: k * 0.05, vy: 0, s: 0.42 + Math.random() * 0.25, floor: gond.position.y + 0.1 + Math.random() * 0.4, spin: (Math.random() - 0.5) * 6 });
  if (gag.kind === 'fly') for (let k = 0; k < n; k++) addSprite(gag.icon, { kind: 'fly', from: head.clone(), delay: k * 0.12, dir: new THREE.Vector3(1.2 + Math.random(), 2 + Math.random() * 2, 0.6), s: 0.42 });
  if (gag.kind === 'lift') { for (let k = 0; k < n; k++) addSprite(gag.icon, { kind: 'balloon', delay: k * 0.06, ox: (Math.random() - 0.5) * 1.0, oy: 0.9 + Math.random() * 0.9, s: 0.46 + Math.random() * 0.2, y0: -6 }); liftV = 0.0001; }
  if (gag.kind === 'pirate') { hat = addSprite('🏴‍☠️', { kind: 'hat', s: 0.6, t: 0 }); addSprite('🦜', { kind: 'parrot', s: 0.5 }); play('whoosh'); }
  player.act('hop', 0.6, { h: 0.4 });
  await wait(1.0); camMode = 'close'; ui.cinematic(true);
  await wait(1.5); ui.cinematic(false); camMode = 'play';
  const r = gag.kind === 'pirate' ? R.pirate : S.lines[i].vec === 'loud' ? R.loudFail : R[S.lines[i].vec];
  const what = S.lines[i].alt ? `the image's alt text` : S.lines[i].style === 'hidden' ? 'a hidden line' : 'that line';
  state = 'card'; sound.outcome('lose');
  await ui.rewardCard({ icon: gag.icon, title: gag.kind === 'pirate' ? 'Pirate mode! ARRR!' : `Oops: ${gag.item}!`,
    body: `<div class="trace"><div><span>Run</span>${traceOf(S)}</div></div><div>The agent read ${what} and did it. It can't tell your words from words on the page.</div>`,
    research: research(r, `Tap the order <b>before</b> the reading light reaches it.`), buttons: [{ label: 'Try again ↻', onClick: () => startLevel(li) }] });
}
async function endOver() {
  state = 'end'; record(); ev('end', { li, result: 'overblock' }); hintOn = false; handEl.classList.remove('show');
  play('alarm'); think('🤷 So much is blocked… I can\'t tell what to buy!', 0); say('🚧 Over-blocked: the agent gave up.', 'bad'); player.yawGoal = 0;
  plates.forEach(p => { if (p.l.kind !== 'buy') p.op = 0.45; });
  await wait(1.6); state = 'card'; sound.outcome('lose');
  await ui.rewardCard({ icon: '🚧', title: 'Over-blocked!', body: `<div class="trace"><div><span>Run</span>${traceOf(S)}</div></div><div>Too many safe lines blocked. Only tap lines that give <b>the AI</b> orders.</div>`,
    research: research(R.over, `You raised <b>${S.fa}</b> false alarms.`), buttons: [{ label: 'Try again ↻', onClick: () => startLevel(li) }] });
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.copy'); if (!b) return; const txt = decodeURIComponent(b.dataset.share || '');
  const done = () => b.textContent = '✓ Copied'; const show = () => { b.outerHTML = `<pre class="share">${txt.replace(/</g, '&lt;')}</pre>`; };
  navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt).then(done, show) : show(); });

// ---------- camera: a flat-on view of the page; the agent sits in the upper part of the free band, upcoming lines below
let camMode = 'play', trauma = 0; const camFocus = new THREE.Vector3(), camCur = { y: 0, ppu: 60, x: 0 }, band = { top: 120, bot: 700 };
const shake = a => { if (!reduce) trauma = Math.min(1, trauma + a); };
const VFOV = 30, TANV = Math.tan(VFOV * Math.PI / 360);
function measureBand() { const g = document.querySelector('.gk-goal'); band.top = (g ? g.getBoundingClientRect().bottom : 110) + 6; const ch = CAPH;
  band.bot = innerHeight - Math.max(10, parseFloat(getComputedStyle(capEl).bottom) || 10) - ch - 8; }
function lineTopAt(pos) { const a = plates[Math.floor(pos)], b = plates[Math.min(plates.length - 1, Math.floor(pos) + 1)]; if (!a) return 0; const u = pos - Math.floor(pos); return a.top + (b.top - a.top) * u; }
function camGoal() { const W = innerWidth, H = innerHeight, bh = Math.max(220, band.bot - band.top);
  const ppu = Math.min(W / (PW + 0.7), bh / (bh < 420 ? 6.6 : 8.2), 92); let y;
  const anchorY = lineTopAt(S.pos) + 1.5;                                   // world y that sits at the top of the band
  y = anchorY + (band.top - H / 2) / ppu;                                   // screen centre world y
  const topY = 0.25, botY = -pageH + 0.15;                                  // clamp to the page
  const maxY = topY + (band.top - H / 2) / ppu, minY = botY - (band.bot - H / 2) / ppu;
  if (minY > maxY) y = maxY; else y = Math.max(minY, Math.min(maxY, y));
  return { y, ppu, x: -0.22 }; }
function fitCamera(snap) { measureBand(); if (!S || !plates.length) return; const g = camGoal(); if (snap) Object.assign(camCur, g); }
function applyCamera(dt, t) { const H = innerHeight;
  let g = camGoal();
  if (camMode === 'close') { bubble.style.maxWidth = ''; const hw = player.headWorld(); g = { ppu: g.ppu * 2.0, y: hw.y - 0.2, x: hw.x + 0.9 }; }
  const k = camMode === 'close' ? 3.5 : 6; camCur.y = damp(camCur.y, g.y, k, dt); camCur.ppu = damp(camCur.ppu, g.ppu, 4, dt); camCur.x = damp(camCur.x, g.x, 4, dt);
  const D = H / (2 * TANV * camCur.ppu); const s = trauma * trauma * 0.25; trauma = Math.max(0, trauma - dt * 1.8);
  const n = f => Math.sin(t * f) * Math.sin(t * f * 1.37 + 1.1);
  camera.fov = VFOV; camera.near = Math.max(0.1, D - 14); camera.far = D + 60; camera.updateProjectionMatrix();
  // the small x/y offset gives a slight 3/4 look (depth on the frame, gondola and shadows) while the page stays flat-on
  camera.position.set(camCur.x + 0.55 + n(37) * s, camCur.y + 0.7 + n(41) * s, D); camera.lookAt(camCur.x + n(29) * s * 0.3, camCur.y, 0);
  camFocus.set(camCur.x, camCur.y, 0); }
stage.onResize(() => fitCamera(false));
let goalRO = null, settleUntil = 0; function watchGoal() { const g0 = document.querySelector('.gk-goal'); if (goalRO || !g0 || !window.ResizeObserver) return; goalRO = new ResizeObserver(() => { fitCamera(false); }); goalRO.observe(g0); }

// ---------- frame loop
let postOK = post.enabled; const fps = GK.fpsMeter({ onLow: () => { if (Q.get('auto') !== '0') { post.downgrade(); postOK = false; } } });
const clock = new THREE.Clock(); let t = 0; const v = new THREE.Vector3(), vv = new THREE.Vector3();
function frame() { const dt0 = Math.min(clock.getDelta(), 1 / 20); const dt = dt0 * SPEED; t += dt0; fps.tick(dt0);
  if (state === 'intro') { introT += dt; if (introT > 0.9) { state = 'play'; } }
  if (state === 'play' && S && !S.done) { onEvents(step(S, dt)); revealCheck(); if (li === 0 && !hintOn && !S.catches.length && S.t > 1.4 && S.cur < 3 && !firstHint) { firstHint = 1; } }
  if (bubbleT && performance.now() > bubbleT) { bubble.classList.remove('show'); bubbleT = 0; }
  measureBand(); applyCamera(dt0, t);
  // gondola + agent follow the reading position
  if (S && plates.length) { const pos = S.pos, a = plates[Math.floor(pos)], b = plates[Math.min(plates.length - 1, Math.floor(pos) + 1)], u = pos - Math.floor(pos);
    const cy = a.cy + (b.cy - a.cy) * (u * u * (3 - 2 * u)); const intro = Math.max(0, 1 - introT / 0.9); const drop = state === 'intro' ? 4 * intro * intro : 0;
    if (liftV) { liftV = Math.min(1.6, liftV + dt * 1.2); lift += liftV * dt; }
    gond.position.set(AGX, cy - 0.62 + drop + lift + (S.phase === 'move' ? -0.03 * Math.sin(u * Math.PI) : 0.012 * Math.sin(t * 2)), AGZ);
    player.pos.set(AGX, gond.position.y + 0.05, AGZ - 0.04);
    gond.rotation.z = S.phase === 'move' ? 0.04 * Math.sin(u * Math.PI) : 0.01 * Math.sin(t * 1.3);
    // reading highlight + cursor sweep + eye beam
    const reading = state === 'play' && (S.phase === 'read' || S.phase === 'hold'); const cp = plates[S.cur];
    const hy = S.phase === 'move' ? a.cy + (b.cy - a.cy) * u : cp.cy, hh = S.phase === 'move' ? a.h + (b.h - a.h) * u : cp.h;
    hl.visible = state !== 'card'; hl.position.set(TXC, hy, 0.02); hl.scale.set(LW + 0.2, hh + 0.16, 1);
    hl.material.color.set(S.result === 'obeyed' ? 0xff6a5a : 0xffd36b); hl.material.opacity = S.result === 'obeyed' ? 0.6 + 0.3 * Math.sin(t * 14) : 0.75;
    const prog = S.phase === 'read' ? Math.min(1, S.tIn / dwellOf(S, S.cur)) : S.phase === 'hold' ? 0.5 + 0.45 * Math.sin(t * 2.2) : 0;
    cursor.visible = reading; cursor.position.set(TXL + 0.1 + prog * (LW - 0.2), hy, 0.06); cursor.scale.y = hh * 0.8;
    const hw = player.headWorld(); const P2 = beamGeo.attributes.position.array; P2.set([hw.x + 0.12, hw.y + 0.02, hw.z + 0.1, cursor.position.x, hy + hh * 0.4, 0.06, cursor.position.x, hy - hh * 0.4, 0.06]); beamGeo.attributes.position.needsUpdate = true; beamGeo.computeBoundingSphere();
    beam.visible = reading && !reduce; beam.material.opacity = 0.16 + 0.05 * Math.sin(t * 9);
    thumb.position.y = -CHROME - 0.6 - (pageH - CHROME - 1.6) * (pos / Math.max(1, plates.length - 1));
    // plates: read lines fade, hidden reveal, stamps, shakes, hits
    plates.forEach(p => { const read = p.i < S.cur || (p.i === S.cur && S.phase === 'move'); const opG = p.op < 1 ? p.op : read && p.l.kind !== 'buy' ? 0.5 : 1;
      p.mesh.material.opacity = damp(p.mesh.material.opacity, opG, 6, dt0);
      if (p.l.style === 'hidden') { const r = p.revealed ? Math.min(1, (performance.now() - p.revealT) / 450) : 0; if (Math.abs((p.st.reveal || 0) - r) > 0.04 || (r === 1 && p.st.reveal !== 1)) { p.st.reveal = r; redraw(p); } }
      if (p.stampT > 0) { p.stampT = Math.max(0, p.stampT - dt0 * 3.2); const k = reduce ? 1 : 1 + 0.9 * p.stampT * p.stampT; p.stamp.scale.setScalar(k); p.stamp.material.opacity = 1 - p.stampT * 0.6; }
      p.mesh.position.x = TXC + (p.shake > 0.01 ? Math.sin(t * 70) * 0.06 * p.shake : 0); p.shake *= Math.exp(-5 * dt0);
      const live = catchable(S, p.i) && p.l.kind !== 'head' && p.l.kind !== 'buy' && state === 'play';
      p.hit.style.pointerEvents = live || p.l.kind === 'buy' ? 'auto' : 'none'; p.hit.disabled = false; });
  }
  player.update(dt, t); burst.update(dt0);
  // sprites (gags + parcel)
  for (let k = sprites.length - 1; k >= 0; k--) { const s = sprites[k]; s.t += dt; const tt = s.t - (s.delay || 0); s.sp.visible = tt >= 0; if (tt < 0) continue;
    if (s.kind === 'rain') { s.vy -= 14 * dt; const y = (s.y ?? s.y0) + s.vy * dt; s.y = y; if (y < s.floor && s.vy < 0) { s.y = s.floor; s.vy *= -0.35; if (Math.abs(s.vy) < 0.6) s.vy = 0; } s.sp.position.set(s.x, s.y, 0.7); s.sp.material.rotation += s.spin * dt * (s.vy ? 1 : 0.1); }
    if (s.kind === 'fly') { const u = tt / 1.6; s.sp.position.copy(s.from).addScaledVector(s.dir, u * 2.2).add(vv.set(Math.sin(tt * 9 + k) * 0.15, 0, 0.4)); s.sp.material.opacity = Math.max(0, 1 - Math.max(0, u - 0.7) / 0.5); s.sp.material.rotation = Math.sin(tt * 6 + k) * 0.4; }
    if (s.kind === 'hat') { const hw = player.headWorld(); const u = Math.min(1, tt / 0.4); s.sp.position.set(hw.x, hw.y + 0.36 + (1 - u) * 1.5, hw.z + 0.15); s.sp.scale.setScalar(0.62 * (0.6 + 0.4 * u)); }
    if (s.kind === 'balloon') { const hw = player.headWorld(); const u = Math.min(1, tt / 0.7); s.sp.position.set(hw.x + s.ox + 0.05 * Math.sin(tt * 3 + k), hw.y + s.y0 * (1 - u) * (1 - u) + s.oy, hw.z + 0.1); }
    if (s.kind === 'parrot') { const hw = player.headWorld(); s.sp.position.set(hw.x + 0.38, hw.y - 0.28 + 0.04 * Math.sin(tt * 12), hw.z + 0.2); }
    if (s.kind === 'drop') { const u = Math.min(1, tt / s.dur); const e = u * u; s.sp.position.lerpVectors(s.from, s.to, e); s.sp.scale.setScalar(s.s * (u === 1 ? 1 + 0.15 * Math.max(0, 1 - (tt - s.dur) * 4) : 1)); }
    if (s.t > 8) { scene.remove(s.sp); sprites.splice(k, 1); } }
  drones.forEach((d, k) => { const u = d.userData; d.position.set(Math.sin(t * u.sp * 2 + u.ph) * 9, camFocus.y + u.dy + 0.2 * Math.sin(t * 1.3 + u.ph), u.z); u.rot.rotation.y += dt0 * 30; d.rotation.y = Math.cos(t * u.sp * 2 + u.ph) > 0 ? 0.3 : -0.3; });
  town.position.y = camFocus.y * 0.35;                                       // parallax: the town moves slower than the page
  stage.followSun(v.set(AGX + 1.5, gond.position.y, 0));
  // DOM: line hit boxes (projected plates), thought bubble over already-read text, tutorial hand
  const W = innerWidth, H = innerHeight; const proj = (x, y, z) => { vv.set(x, y, z).project(camera); return [(vv.x + 1) / 2 * W, (1 - vv.y) / 2 * H]; };
  plates.forEach(p => { const [x0, y0] = proj(TXC - LW / 2, p.top + GAP / 2, 0.03), [x1, y1] = proj(TXC + LW / 2, p.bot - GAP / 2, 0.03); const h = p.hit.style;
    h.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`; h.width = (x1 - x0).toFixed(1) + 'px'; h.height = (y1 - y0).toFixed(1) + 'px'; p.rect = [x0, y0, x1, y1]; });
  if (S && plates.length) { const cp = plates[S.cur]; const [bx, by] = proj(TXL, lineTopAt(S.pos), 0.03);
    if (camMode === 'close') { bubble.style.maxWidth = ''; const hw = player.headWorld(); const [hx, hy2] = proj(hw.x, hw.y + 0.95 + (hat ? 0.4 : 0), hw.z); bubble.style.left = Math.max(8, Math.min(hx - 60, W - 8 - bubble.offsetWidth)) + 'px'; bubble.style.top = Math.max(band.top + bubble.offsetHeight, hy2) + 'px'; }
    else { const mw = Math.max(200, Math.min(380, W - bx - 8)); bubble.style.maxWidth = mw + 'px'; bubble.style.left = Math.max(8, Math.min(bx, W - 8 - bubble.offsetWidth)) + 'px'; bubble.style.top = Math.max(band.top - 2 + bubble.offsetHeight, by - 6) + 'px'; }
    const hp = S.lines.findIndex(l => l.kind === 'inj'); const tgt = plates[hp]; const showHand = li === 0 && state === 'play' && tgt && !S.blocked.has(hp) && (hintOn || (S.t > 1.6 && S.cur <= hp)) && !S.catches.length;
    handEl.classList.toggle('show', showHand); if (showHand && tgt.rect) { handEl.style.left = (tgt.rect[2] - 30) + 'px'; handEl.style.top = (tgt.rect[3] - 30) + 'px'; }
    if (showHand) tgt.hint = 1; }
  // text must stay crisp and untone-mapped: the post stack (bloom + DOF) only runs during the cinematic close-ups
  post.enabled = postOK && camMode === 'close'; post.render(); if (!document.hidden) requestAnimationFrame(frame); else hiddenWait(); }
function hiddenWait() { document.addEventListener('visibilitychange', () => { clock.getDelta(); requestAnimationFrame(frame); }, { once: true }); }

// ---------- test hooks (headless playtest + screenshots)
const events = []; const ev = (type, extra = {}) => events.push({ type, li, t: +(performance.now() / 1000).toFixed(3), ...extra });
window.__gk = { get state() { return state; }, get round() { return li; }, rounds: LEVELS, events, get fps() { return fps.avg; }, quality: () => stage.quality,
  get S() { return S; }, tapLine, lineRect: i => plates[i] && plates[i].hit.getBoundingClientRect(), get runs() { return runs; },
  bubbleRect: () => bubble.classList.contains('show') ? bubble.getBoundingClientRect() : null, capRect: () => capEl.getBoundingClientRect(), band: () => ({ ...band }),
  agentRect: () => { const b = new THREE.Box3().setFromObject(player.holder); const pts = [[b.min.x, b.min.y], [b.max.x, b.max.y]].map(([x, y]) => { vv.set(x, y, AGZ).project(camera); return [(vv.x + 1) / 2 * innerWidth, (1 - vv.y) / 2 * innerHeight]; });
    return { x0: pts[0][0], y0: pts[1][1], x1: pts[1][0], y1: pts[0][1] }; },
  card: () => !!(ui.card && ui.card.isConnected), start: i => startLevel(i), player, setCam: m => camMode = m };
document.getElementById('load').remove();
startLevel(li); fitCamera(true); frame();
// hold taps until the UI fonts are in (the goal bar grows when they load and the camera refits)
{ const prev = state; let done = false; settleUntil = performance.now() + 9999;
  const open = () => { if (done) return; done = true; plates.forEach(p => { p.key = ''; redraw(p); }); fitCamera(true); requestAnimationFrame(() => requestAnimationFrame(() => { settleUntil = 0; })); };
  Promise.all([document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => 0) : 0, new Promise(r => setTimeout(r, 400))]).then(open); setTimeout(open, 2000); }
