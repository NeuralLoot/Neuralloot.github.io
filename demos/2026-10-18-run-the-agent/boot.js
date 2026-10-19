// Boot guard: the game must never sit on "Booting the agent…". Try the 3D game; on ANY failure (no WebGL, module/CDN error,
// init exception) or if it has not started within 10 s, fall back to the lite 2D mode (same rules, from logic.js).
const V = '3';
const q = new URLSearchParams(location.search);
function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
let lite = false;
async function goLite(why) {
  if (lite) return; lite = true; window.__bootWhy = String(why && why.message || why);
  console.warn('Run the Agent: lite mode because', window.__bootWhy);
  try { const m = await import('./fallback.js?v=' + V); m.start(); }
  catch (e) { const l = document.getElementById('load'); if (l) l.innerHTML = 'Could not start. <button onclick="location.reload()" style="min-height:44px;margin-top:10px;font:800 16px system-ui">Tap to retry</button>'; }
}
window.__goLite = goLite;
if (q.get('lite') === '1' || !webglOK()) goLite('no WebGL');
else {
  const t = setTimeout(() => { if (!window.__gk && !lite) {
    const l = document.getElementById('load'); if (l) l.innerHTML = 'Still loading… <button id="tapgo" style="min-height:48px;margin:10px;padding:0 16px;font:800 16px system-ui;border-radius:12px">Tap to start</button>';
    const b = document.getElementById('tapgo'); if (b) b.onclick = () => goLite('slow boot'); } }, 8000);
  import('./main.js?v=' + V).then(() => clearTimeout(t)).catch(e => { clearTimeout(t); goLite(e); });
}
addEventListener('unhandledrejection', e => { if (!window.__gk) goLite(e.reason); });
