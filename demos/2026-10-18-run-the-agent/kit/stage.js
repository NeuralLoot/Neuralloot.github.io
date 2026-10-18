// Scene + renderer + cozy lighting preset (warm hemi + soft directional sun with soft shadows that follow the action).
import * as THREE from 'three';

/** 'high' | 'low'. ?q=low|high forces it. Low = weak phone: no post, smaller shadow map, DPR 1.25. */
export function detectQuality() {
  const q = new URLSearchParams(location.search).get('q'); if (q === 'low' || q === 'high') return q;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia('(pointer:coarse)').matches;
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  return (mobile && (mem <= 4 || cores <= 4)) ? 'low' : 'high';
}

export function createStage({ canvas, quality = detectQuality(), bg = 0xf1e3c8, fog = [18, 46] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  if (fog) scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4); sun.position.set(6, 11, 5);
  sun.castShadow = true; const S = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(S, S);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.radius = 4; sun.shadow.blurSamples = 12; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.35); fill.position.set(-6, 4, -4); scene.add(fill);
  const sunOffset = sun.position.clone();
  /** keep the shadow frustum centred on the action (tight frustum = crisp soft shadows) */
  function followSun(p) { sun.target.position.copy(p); sun.position.copy(p).add(sunOffset); }
  const listeners = [];
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); listeners.forEach(f => f(w, h)); }
  addEventListener('resize', resize); resize();
  return { renderer, scene, camera, sun, hemi, quality, followSun, onResize: f => { listeners.push(f); f(innerWidth, innerHeight); } };
}

/** Rolling FPS meter; calls onLow once if avg fps stays under `min` for `secs` (auto-downgrade hook). */
export function fpsMeter({ min = 32, secs = 3, onLow } = {}) {
  let frames = 0, acc = 0, lowFor = 0, fired = false; const m = { fps: 60, avg: 60, samples: [] };
  m.tick = dt => { frames++; acc += dt; if (acc >= 0.5) { m.fps = frames / acc; m.samples.push(m.fps); if (m.samples.length > 20) m.samples.shift();
    m.avg = m.samples.reduce((a, b) => a + b, 0) / m.samples.length; lowFor = m.fps < min ? lowFor + acc : 0;
    if (lowFor > secs && !fired && onLow) { fired = true; onLow(m); } frames = 0; acc = 0; } };
  return m;
}
