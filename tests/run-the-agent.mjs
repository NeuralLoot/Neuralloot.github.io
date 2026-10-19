// Plays Run the Agent through REAL mouse clicks / touch taps in 3D and lite mode, desktop + mobile.
// Covers: L1 budget-fail -> retry -> win -> Next, L2 budget-fail -> retry -> win -> Next, L3 blank-fail -> retry -> win -> Play again -> L1 still responds.
// Usage: node tests/run-the-agent.mjs [baseUrl]   (default: live URL). Needs `playwright` + system chrome (set PW_PATH to its node_modules if needed).
import { createRequire } from 'module';
const req = createRequire(process.env.PW_PATH ? process.env.PW_PATH + '/' : import.meta.url);
const { chromium } = req('playwright');
const URL0 = process.argv[2] || 'https://neuralloot.github.io/demos/2026-10-18-run-the-agent/';
const sep = URL0.includes('?') ? '&' : '?';
const MODES = [['3d', 'speed=4'], ['lite', 'lite=1']];
const DEVICES = [['desktop', { viewport: { width: 1280, height: 800 } }], ['mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]];
const fails = []; const log = [];
const ok = (c, m) => { if (!c) { fails.push(m); } log.push((c ? 'PASS ' : 'FAIL ') + m); };

async function run(browser, mode, q, dev, opts) {
  const tag = `${mode}/${dev}`; const ctx = await browser.newContext(opts); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL0 + sep + q + '&seed=7'); const lite = mode === 'lite';
  await p.waitForFunction(() => window.__gk || window.__gkLite, null, { timeout: 30000 });
  ok(await p.evaluate(l => l ? !!window.__gkLite && !window.__gk : !!window.__gk, lite), `${tag}: loaded in ${mode} mode`);
  const S = () => p.evaluate(() => { const s = (window.__gk || window.__gkLite).S; return { li: s.li, done: s.done, result: s.result, used: s.used, filled: s.filled.map(Boolean), tools: s.L.tools.map(t => ({ id: t.id, gives: t.gives, useless: !!t.useless })), dead: Object.keys(s.lastObs).filter(k => s.lastObs[k].kind === 'closed') }; });
  const idle = () => p.waitForFunction(l => l ? true : window.__gk.state === 'idle' || window.__gk.state === 'card', lite, { timeout: 30000 });
  async function realTap(id) { // real input at the button's on-screen center; verifies nothing covers it
    await idle(); const sel = lite ? `#lite button.t[data-id="${id}"]` : `.tool[data-id="${id}"]`;
    const loc = p.locator(sel); await loc.waitFor({ state: 'visible', timeout: 10000 }); if (!lite) await p.waitForFunction(sel => { const e = document.querySelector(sel); return e && /translate/.test(e.style.transform) && e.getBoundingClientRect().top > 40 && !document.querySelector('.gk-card-wrap'); }, sel, { timeout: 10000 }); const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const top = await p.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(sel)); }, [x, y, sel]);
    if (!top) { ok(false, `${tag}: ${id} is covered at (${x | 0},${y | 0})`); }
    if (dev === 'mobile') await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
  }
  async function tapAndExpectStep(id, what) { // the tap must consume exactly one step
    const before = (await S()).used; await realTap(id);
    try { await p.waitForFunction(b => { const s = (window.__gk || window.__gkLite).S; return s.used > b; }, before, { timeout: 8000 }); return true; }
    catch { ok(false, `${tag}: ${what}: tapping ${id} did nothing (used stayed ${before})`); return false; }
  }
  async function settle() { // wait until round over (card or lite end button) or idle
    if (lite) return; await p.waitForFunction(() => window.__gk.state === 'idle' || window.__gk.card(), null, { timeout: 30000 });
  }
  const cardBtn = async (re) => { const loc = lite ? p.locator('#lite .go') : p.locator('.gk-card button.gk-btn'); await loc.first().waitFor({ state: 'visible', timeout: 30000 }); const t = (await loc.first().innerText()); ok(re.test(t), `${tag}: result button "${t}"`); return loc.first(); };
  async function clickBtn(loc) { await p.waitForTimeout(500); const b = await loc.boundingBox(); if (dev === 'mobile') await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
  async function failRun(ids, what, kind) {
    for (const id of ids) { const s = await S(); if (s.done) break; if (!(await tapAndExpectStep(id, what))) return false; await settle(); }
    const s = await S(); ok(s.done && s.result === kind, `${tag}: ${what} ends as ${kind} (got ${s.result})`);
    const b = await cardBtn(/Try again/i); await clickBtn(b); await p.waitForFunction(() => { const s = (window.__gk || window.__gkLite).S; return !s.done && s.used === 0; }, null, { timeout: 10000 }).catch(() => ok(false, `${tag}: ${what}: Try again did not restart`)); return true;
  }
  async function win(what) {
    for (let n = 0; n < 20; n++) { const s = await S(); if (s.done) break;
      const k = s.filled.findIndex(v => !v); const c = s.tools.filter(t => t.gives === k); const t = c.find(t => !s.dead.includes(t.id)) || c[0];
      if (!(await tapAndExpectStep(t.id, what))) return false; await settle(); }
    const s = await S(); ok(s.done && s.result === 'win', `${tag}: ${what} won (used ${s.used})`); return s.result === 'win';
  }
  const lvl = async n => (await S()).li === n;
  // L1: fail via useless search x4, retry, win
  await failRun(['search', 'search', 'search', 'search'], 'L1 fail', 'budget');
  ok(await win('L1'), `${tag}: L1 completed`);
  await clickBtn(await cardBtn(/Next level/i)); await p.waitForFunction(() => (window.__gk || window.__gkLite).S.li === 1 && !(window.__gk || window.__gkLite).S.done, null, { timeout: 10000 });
  ok(await lvl(1), `${tag}: advanced to level 2`);
  // L2: fail via useless map x5, retry, win
  await failRun(['map', 'map', 'map', 'map', 'map'], 'L2 fail', 'budget');
  ok(await win('L2'), `${tag}: L2 completed`);
  await clickBtn(await cardBtn(/Next level/i)); await p.waitForFunction(() => (window.__gk || window.__gkLite).S.li === 2 && !(window.__gk || window.__gkLite).S.done, null, { timeout: 10000 });
  ok(await lvl(2), `${tag}: advanced to level 3`);
  // L3: premature Send -> blank, retry, win
  await failRun(['send'], 'L3 blank', 'blank');
  ok(await win('L3'), `${tag}: L3 completed`);
  await clickBtn(await cardBtn(/Play again/i)); await p.waitForFunction(() => (window.__gk || window.__gkLite).S.li === 0 && !(window.__gk || window.__gkLite).S.done, null, { timeout: 10000 });
  ok(await tapAndExpectStep('contacts', 'after Play again'), `${tag}: Play again -> L1 responds`);
  const real = errs.filter(e => !/favicon|Failed to load resource.*(audio|mp3)|AudioContext|autoplay/i.test(e)); ok(real.length === 0, `${tag}: no console errors ${real.length ? JSON.stringify(real.slice(0, 3)) : ''}`);
  await ctx.close();
}
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [mode, q] of MODES) for (const [dev, o] of DEVICES) { try { await run(browser, mode, q, dev, o); } catch (e) { ok(false, `${mode}/${dev}: exception ${String(e.message).split('\n')[0]}`); } }
await browser.close(); console.log(log.join('\n')); console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED'); process.exit(fails.length ? 1 : 0);
