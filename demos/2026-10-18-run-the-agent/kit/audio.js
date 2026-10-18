// Sound hooks into the site's shared NLAudio packs (/assets/audio/nl-audio.js). Loads it if needed, falls back
// to a silent stub (headless / file://). Kit events -> NLAudio events: verdicts via feedback(), stingers via outcome().
const STUB = { init() {}, play() {}, sfx() {}, feedback() {}, outcome() {}, music() {}, usePack() {}, state: () => ({ stub: true }) };
export async function initSound({ pack, music = 'a', src = '/assets/audio/nl-audio.js' } = {}) {
  if (!window.NLAudio) await new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = res; document.head.appendChild(s); });
  const A = window.NLAudio || STUB; try { A.init({ pack, music }); } catch (e) { console.warn('NLAudio init', e); }
  const call = (f, ...a) => { try { return f && f.apply(A, a); } catch (e) {} };
  return {
    raw: A,
    play: (ev) => ev === 'success' ? call(A.feedback, 'good') : ev === 'fail' ? call(A.feedback, 'bad') : call(A.play, ev),
    outcome: (w) => call(A.outcome, w),
    neutral: () => call(A.play, 'place'),           // taps that are not verdicts
    tell: (s) => call(A.play, s > 0.75 ? 'alarm' : 'tick'),
    step: () => {},                                   // reserved (packs have no footstep event yet)
  };
}
