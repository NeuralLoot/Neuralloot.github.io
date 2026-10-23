// Lite mode: plain DOM version of the game (no WebGL, no audio needed). Same rules as the 3D game (logic.js).
import { LEVELS, newRun, callTool, stars } from './logic.js?v=4';
export function start() {
  const load = document.getElementById('load'); if (load) load.remove();
  const cv = document.getElementById('c'); if (cv) cv.style.display = 'none';
  ['labels', 'bubble', 'cap'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
  const root = document.createElement('main'); root.id = 'lite';
  root.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#f3e7d3;color:#3b2417;font:700 16px/1.3 Nunito,"Trebuchet MS",system-ui;padding:64px 12px 16px;box-sizing:border-box';
  document.body.appendChild(root);
  const css = document.createElement('style'); css.textContent = `#lite .box{max-width:560px;margin:0 auto}#lite h2{margin:4px 0;font-size:20px}
#lite .slots,#lite .tools{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}#lite .slot{min-width:84px;padding:8px;border:2px dashed #cdb38c;border-radius:12px;text-align:center;font-size:13px;background:#fbf3e2}
#lite .slot.f{border-style:solid;border-color:#3f9b5a;background:#e8f6e6}#lite button.t{flex:1 1 120px;min-height:64px;border-radius:14px;border:2px solid #d9c3a0;background:#fbf3e2;box-shadow:0 3px 0 #cfb48a;font:800 15px Nunito,system-ui;color:#3b2417;cursor:pointer}
#lite button.t.dead{background:#ffe3dd;border-color:#c4493a}#lite button.t span{display:block;font-size:24px}#lite .log{min-height:52px;padding:10px;border-radius:12px;background:#fff;border:2px solid #2b2633}
#lite .log.good{border-color:#3f9b5a}#lite .log.bad{border-color:#c4493a;background:#fff0ec}#lite .go{min-height:48px;padding:0 18px;border-radius:12px;border:0;background:#52c7b8;color:#102;font:800 16px system-ui;cursor:pointer;margin-top:10px}`;
  document.head.appendChild(css);
  let li = 0, S;
  const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
  function render(msg = 'Tap a tool to run the agent.', cls = '') {
    const L = S.L; const left = S.budget - S.used;
    root.innerHTML = `<div class="box"><div style="font-size:13px;opacity:.7">Lite mode (your browser has no 3D) · Level ${li + 1}/${LEVELS.length}</div>
<h2>${L.taskIcon} ${L.title}</h2><div>Steps left: ${'■'.repeat(left)}${'□'.repeat(S.used)}</div>
<div class="slots">${L.slots.map((s, i) => `<div class="slot ${S.filled[i] ? 'f' : ''}">${s.icon}<br>${S.filled[i] ? S.filled[i].text : s.what + '?'}</div>`).join('')}</div>
<div class="tools">${L.tools.map(t => `<button class="t ${S.lastObs[t.id] && S.lastObs[t.id].kind === 'closed' ? 'dead' : ''}" data-id="${t.id}" ${S.done ? 'disabled' : ''}><span>${t.icon}</span>${t.name}</button>`).join('')}</div>
<div class="log ${cls}" role="status">${msg}</div><div id="end"></div></div>`;
    root.querySelectorAll('button.t').forEach(b => b.onclick = () => act(b.dataset.id));
    if (S.done) end();
  }
  function act(id) {
    const o = callTool(S, id); if (!o) return;
    const t = S.L.tools.find(x => x.id === id);
    render(`${t.icon} ${t.name}: ${o.text}`, o.bad ? 'bad' : 'good');
  }
  function end() {
    const win = S.result === 'win'; const box = root.querySelector('#end');
    const msg = win ? `Done! ${'⭐'.repeat(stars(S))} (${S.used} steps)` : S.result === 'blank' ? 'It sent with blanks and made the rest up.' : 'Out of steps.';
    box.innerHTML = `<p><b>${msg}</b></p>`;
    const b = $(`<button class="go">${win && li < LEVELS.length - 1 ? 'Next level' : win ? 'Play again' : 'Try again'}</button>`);
    b.onclick = () => { if (win) li = (li + 1) % LEVELS.length; S = newRun(li); render(); }; box.appendChild(b);
  }
  S = newRun(li); render();
  window.__gkLite = { get S() { return S; }, tap: act, get level() { return li; } };
}
