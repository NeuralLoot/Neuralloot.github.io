// Cream paper UI components: goal line (top), popups (bounce/fade), term + kid-meaning chips/tooltips,
// reward card with the "What the research found" line + real source link, flash, cinematic letterbox.
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI({ css = new URL('./ui.css', import.meta.url).href } = {}) {
  if (!document.querySelector('link[data-gk]')) { const l = h('link'); l.rel = 'stylesheet'; l.href = css; l.dataset.gk = 1; document.head.appendChild(l); }
  const root = h('div', 'gk-ui'); document.body.appendChild(root);
  const flashEl = h('div', 'gk-flash'); root.appendChild(flashEl);
  let goalEl = null, tipEl = null;
  const ui = {
    root,
    /** always-visible goal line at the top: icon + ≤1 short sentence (+ optional round counter) */
    goal(text, { icon = '🎯', step = '' } = {}) { if (!goalEl) { goalEl = h('div', 'gk-goal gk-paper'); root.appendChild(goalEl); }
      goalEl.innerHTML = `<span class="ico">${icon}</span><span class="txt">${text}</span>${step ? `<span class="step">${esc(step)}</span>` : ''}`; return goalEl; },
    /** inline chip: real term + kid meaning, e.g. term('Latency','how long it waits') */
    term: (term, kid) => `<span class="gk-term" title="${esc(kid)}">${esc(term)}<small>(${esc(kid)})</small></span>`,
    /** floating tooltip above the bottom controls; auto-hides */
    tip(html, secs = 3.5) { tipEl && tipEl.remove(); tipEl = h('div', 'gk-tip gk-paper', html); root.appendChild(tipEl); const me = tipEl;
      if (secs) setTimeout(() => me.remove(), secs * 1000); return me; },
    popup(text, { tone = 'good', x, y } = {}) { const p = h('div', `gk-popup gk-paper ${tone}`, esc(text)); if (x != null) { p.style.left = x + 'px'; p.style.top = y + 'px'; }
      root.appendChild(p); setTimeout(() => p.remove(), 1400); return p; },
    flash() { flashEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => flashEl.classList.remove('on'))); },
    cinematic(on) { root.classList.toggle('cine', on); },
    /** reward/result card. research = { text, num, term, kid, source, url, tie } ; buttons = [{label, onClick}] */
    rewardCard({ icon = '🏆', title, body = '', stars, research, buttons = [{ label: 'Next' }] } = {}) {
      return new Promise(res => { const wrap = h('div', 'gk-card-wrap'), c = h('div', 'gk-card gk-paper');
        let html = `<div class="big">${icon}</div><h2>${esc(title)}</h2>`;
        if (stars != null) html += `<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`;
        if (body) html += `<div>${body}</div>`;
        if (research) html += `<div class="research">🔬 <b>What the research found:</b> ${research.text}${research.num ? ` <b>${esc(research.num)}</b>` : ''}` +
          (research.term ? ` · ${ui.term(research.term, research.kid || '')}` : '') + (research.tie ? `<br>${research.tie}` : '') +
          (research.source ? `<br><a href="${esc(research.url || '#')}" target="_blank" rel="noopener">${esc(research.source)}</a>` : '') + `</div>`;
        c.innerHTML = html; const row = h('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap';
        buttons.forEach((b, i) => { const btn = h('button', 'gk-btn', esc(b.label)); if (i) btn.style.background = '#c9a77a';
          btn.onclick = (e) => { e.stopPropagation(); wrap.remove(); if (ui.card === wrap) ui.card = null; b.onClick && b.onClick(); res(b.label); }; row.appendChild(btn); });
        c.appendChild(row); wrap.appendChild(c); root.appendChild(wrap); ui.card = wrap; });
    },
  };
  return ui;
}
