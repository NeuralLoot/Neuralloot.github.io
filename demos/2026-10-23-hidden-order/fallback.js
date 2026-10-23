// Lite mode: plain DOM version (no WebGL). Same rules and timing as the 3D game (logic.js): the reading light moves down
// the page; tap lines that give the AI orders before it reaches them.
import { LEVELS, newRun, step, tap, stars, isRevealed, catchable, injCount } from './logic.js?v=1';
export function start() {
  const load = document.getElementById('load'); if (load) load.remove();
  const cv = document.getElementById('c'); if (cv) cv.style.display = 'none';
  ['labels', 'bubble', 'cap', 'hand'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
  const root = document.createElement('main'); root.id = 'lite';
  root.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#f6e6d6;color:#3b2417;font:700 16px/1.3 Nunito,"Trebuchet MS",system-ui;padding:60px 10px 16px;box-sizing:border-box';
  document.body.appendChild(root);
  const css = document.createElement('style'); css.textContent = `#lite .box{max-width:520px;margin:0 auto}#lite .bar{padding:8px 12px;border:2.5px solid #d9487a;border-radius:22px;background:#fff7f9;margin-bottom:8px}
#lite .bar small{display:block;font:700 12px ui-monospace,monospace;color:#a8325b}#lite .pg{border:6px solid #d9487a;border-radius:14px;background:#fffaf1;padding:8px}
#lite .ln{display:block;width:100%;text-align:left;min-height:48px;margin:6px 0;padding:8px 10px;border-radius:12px;border:2px solid #eadfcd;background:#fff;font:800 16px/1.25 Nunito,system-ui;color:#3b2417;cursor:pointer}
#lite .ln.shout{background:#ffe8de;color:#b7362a}#lite .ln.review{background:#f3f5fc}#lite .ln.img{background:#eef6f4}#lite .ln.hidden{background:transparent;border:2px dashed transparent;color:rgba(0,0,0,.05)}
#lite .ln.hidden.rv{border-color:#8f78c9;color:#4a3a73;background:#f0ebfc}#lite .ln.cur{box-shadow:0 0 0 4px #ffd36b}#lite .ln.read{opacity:.5}#lite .ln.blk{text-decoration:line-through;color:#a39a8e}
#lite .ln.blk::after{content:" 🛡️ BLOCKED";color:#c4334f;text-decoration:none}#lite .ln.ok::after{content:" ✓ safe";color:#3f9b5a}#lite .ln.buy{background:#3f9b5a;color:#fff;text-align:center}
#lite .msg{min-height:44px;padding:8px 10px;margin-top:8px;border-radius:12px;background:#fff;border:2px solid #ecc6d3}#lite .go{min-height:48px;padding:0 18px;border-radius:24px;border:0;background:#d9487a;color:#fff;font:800 16px system-ui;cursor:pointer;margin-top:10px}`;
  document.head.appendChild(css);
  let li = 0, S, last = 0, msg = '👆 Tap any line that gives <b>orders to the AI</b> before the 🕵️ reading light gets there.', raf;
  function render() {
    const L = S.L;
    root.innerHTML = `<div class="box"><div style="font-size:13px;opacity:.7">Lite mode (your browser has no 3D) · Page ${li + 1}/${LEVELS.length}</div>
<div class="bar"><small>🔒 ${L.site}</small><b>${L.taskIcon} ${L.task}</b> · ${'💚'.repeat(S.hearts)}${'🤍'.repeat(S.maxHearts - S.hearts)} · 🛡️ ${S.catches.length}/${injCount(S)}</div>
<div class="pg">${S.lines.map((l, i) => `<button class="ln ${l.style} ${l.style === 'hidden' && isRevealed(S, i) ? 'rv' : ''} ${i === S.cur ? 'cur' : ''} ${i < S.cur ? 'read' : ''} ${S.blocked.has(i) ? 'blk' : ''} ${S.cleared.has(i) ? 'ok' : ''}" data-i="${i}">${i === S.cur ? '🕵️ ' : ''}${l.alt ? `${l.icon} <small>alt text:</small> “${l.alt}”` : l.text}</button>`).join('')}</div>
<div class="msg" role="status">${msg}</div><div id="end"></div></div>`;
    root.querySelectorAll('button.ln').forEach(b => b.onpointerdown = e => { e.preventDefault(); act(+b.dataset.i); });
  }
  function act(i) { const r = tap(S, i);
    if (r.type === 'block') msg = '🛡️ Blocked! That line was an order for the AI (prompt injection).';
    else if (r.type === 'false' || r.type === 'overblock') msg = '🙅 False alarm: that line was safe. −1 💚';
    render(); if (S.done) end(); }
  function loop(ts) { const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0); last = ts; const prev = S.cur; const ev = step(S, dt);
    if (ev.some(e => e.type === 'hold')) msg = '🤔 The agent stopped: the next line is giving it orders. Tap it!';
    if (prev !== S.cur || ev.length) render();
    if (S.done) return end(); raf = requestAnimationFrame(loop); }
  function end() { cancelAnimationFrame(raf); const win = S.result === 'win'; const box = root.querySelector('#end'); if (!box || box.childElementCount) return;
    const m = win ? `Bought! ${'⭐'.repeat(stars(S))}` : S.result === 'obeyed' ? `💥 The AI obeyed the page: ${S.gag.item}!` : '🚧 Over-blocked: too many safe lines blocked.';
    box.innerHTML = `<p><b>${m}</b></p><p style="font-size:14px;font-weight:600">🔬 Real agents fall for this: in AgentDojo, a polite planted "important message" got GPT-4o to obey it <b>57.7%</b> of the time. Blocking too much hurts too: a strict detector cut task success from 69% to 41%.<br><a href="https://arxiv.org/abs/2406.13352" target="_blank" rel="noopener">AgentDojo</a> · <a href="https://arxiv.org/abs/2403.02691" target="_blank" rel="noopener">InjecAgent</a> · <a href="https://arxiv.org/abs/2302.12173" target="_blank" rel="noopener">Greshake et al.</a></p>`;
    const b = document.createElement('button'); b.className = 'go'; b.textContent = win && li < LEVELS.length - 1 ? 'Next page' : win ? 'Play again' : 'Try again';
    b.onclick = () => { if (win) li = (li + 1) % LEVELS.length; begin(); }; box.appendChild(b); box.scrollIntoView({ block: 'end' }); }
  function begin() { S = newRun(li); last = 0; msg = li ? 'Only block orders aimed at the AI. Lines for shoppers are fine.' : msg; render(); raf = requestAnimationFrame(loop); }
  begin();
  window.__gkLite = { get S() { return S; }, tap: act, get level() { return li; } };
}
