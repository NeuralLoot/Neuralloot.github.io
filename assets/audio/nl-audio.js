/*! NeuralLoot shared demo audio (nl-audio.js) — WebAudio, no dependencies.
 *  Sounds: CC0 kit (Kenney.nl, OpenGameArt CC0 artists, NeuralLoot originals). See /assets/audio/LICENSES.md
 *
 *  Usage (in a demo, before the demo's own script):
 *    <script src="/assets/audio/nl-audio.js"></script>
 *    <script>NLAudio.init({ music: "music_tense_puzzle" });</script>
 *  Then, inside the demo, on real decisions:
 *    NLAudio.sfx("good")   // also: tap click tick toggle drop good great bad buzz nope levelup unlock win lose
 *                          //       whoosh swipe swoop reveal shimmer   (or any kit file name, e.g. "ui_tap")
 *    NLAudio.cue(tone)     // map a caption tone ("good" | "bad" | "ai" | "") to a soft blip
 *    NLAudio.music(name)   // crossfade to another loop; NLAudio.music(null) fades music out
 *  Rules baked in: nothing plays before the first user gesture (browser autoplay policy); a ≥44px mute
 *  toggle is injected into the header (or bottom-right) and remembered in localStorage("nl-sound");
 *  music ducks under SFX; buttons / sliders / switches get a soft click / tick / toggle automatically.
 *  URL: ?sound=0 starts muted.  window.NLAudio.state() reports status (used by headless tests).
 */
(function () {
  "use strict";
  if (window.NLAudio) return;
  var BASE = "/assets/audio/";
  var ALIAS = {
    tap: "ui_tap", click: "ui_click", tick: "ui_tick", toggle: "ui_toggle", drop: "ui_drop",
    good: "good_blip", great: "good_chime", bad: "bad_blip", buzz: "bad_buzz", nope: "soft_nope",
    levelup: "level_up", unlock: "unlock", win: "win_stinger", lose: "lose_stinger",
    whoosh: "whoosh_soft", swipe: "whoosh_fast", swoop: "whoosh_down", reveal: "riser_reveal", air: "whoosh_air",
    shimmer: "tex_shimmer"
  };
  // per-sound gain (0..1, on top of sfx bus) and how far music ducks while it plays (1 = no duck)
  var VOL = { ui_tap: .55, ui_click: .5, ui_tick: .28, ui_toggle: .5, ui_drop: .6, good_blip: .6, good_chime: .62, bad_blip: .55,
    bad_buzz: .5, soft_nope: .45, level_up: .6, unlock: .55, win_stinger: .75, lose_stinger: .7, whoosh_soft: .45,
    whoosh_fast: .4, whoosh_down: .45, riser_reveal: .5, whoosh_air: .4, tex_shimmer: .35 };
  var DUCK = { win_stinger: .25, lose_stinger: .25, level_up: .55, unlock: .6, riser_reveal: .5, good_chime: .7, bad_buzz: .7 };
  var PRELOAD = ["ui_tap", "ui_click", "ui_tick", "ui_toggle", "good_blip", "bad_blip"];
  var KEY = "nl-sound";
  var cfg = { music: null, musicVolume: .34, sfxVolume: .8, autoUI: true, button: true };
  var ctx = null, master, musicBus, duckBus, sfxBus, comp;
  var bufs = {}, loading = {}, raw = {};
  var muted = false, unlocked = false, inited = false;
  var cur = null; // { name, src, gain }
  var lastAt = {}, lastInput = 0, lastAny = 0, lastDecision = 0, lastBig = 0, BIG = { win_stinger: 1, lose_stinger: 1, level_up: 1, unlock: 1, riser_reveal: 1 }, duckUntil = 0, played = [], btn = null, wantMusic = null;

  try { muted = localStorage.getItem(KEY) === "off"; } catch (e) {}
  try { if (/[?&]sound=0\b/.test(location.search)) muted = true; } catch (e) {}

  function fetchRaw(name) {
    if (!raw[name]) raw[name] = fetch(BASE + name + ".mp3").then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    return raw[name];
  }
  function load(name) {
    if (bufs[name]) return Promise.resolve(bufs[name]);
    if (!loading[name]) loading[name] = fetchRaw(name).then(function (ab) {
      return new Promise(function (res, rej) { ctx.decodeAudioData(ab.slice(0), res, rej); });
    }).then(function (b) { bufs[name] = b; return b; }).catch(function (e) { delete loading[name]; delete raw[name]; console.warn("[nl-audio] could not load " + name, e); });
    return loading[name];
  }
  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC({ latencyHint: "interactive" });
    comp = ctx.createDynamicsCompressor(); // gentle safety glue, never audible pumping at these levels
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    musicBus = ctx.createGain(); musicBus.gain.value = cfg.musicVolume;
    duckBus = ctx.createGain(); duckBus.gain.value = 1;
    sfxBus = ctx.createGain(); sfxBus.gain.value = cfg.sfxVolume;
    musicBus.connect(duckBus); duckBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    return true;
  }
  function unlock() {
    if (unlocked) { if (ctx && ctx.state !== "running" && !muted && !document.hidden) ctx.resume(); return; }
    if (!ctx && !build()) return;
    unlocked = true;
    if (ctx.state !== "running") ctx.resume();
    PRELOAD.forEach(load);
    if (wantMusic && !muted) startMusic(wantMusic);
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (t) { window.removeEventListener(t, unlock, true); });
  }
  function resolve(n) { return ALIAS[n] || n; }
  function sfx(n, o) {
    o = o || {};
    var name = resolve(n);
    if (!unlocked || muted || !ctx) return false;
    var now = performance.now(), gap = o.gap != null ? o.gap : (name === "ui_tick" ? 55 : 45);
    if (lastAt[name] && now - lastAt[name] < gap) return false;
    lastAt[name] = now; lastAny = now;
    if (name.indexOf("ui_") !== 0) lastDecision = now;
    if (BIG[name]) lastBig = now;
    var t0 = now;
    load(name).then(function (b) {
      if (!b || performance.now() - t0 > 350) return; // too late to still feel tied to the action
      var s = ctx.createBufferSource(); s.buffer = b;
      var rate = o.rate || 1; if (o.vary) rate *= 1 + (Math.random() * 2 - 1) * o.vary;
      s.playbackRate.value = rate;
      var g = ctx.createGain(); g.gain.value = (VOL[name] != null ? VOL[name] : .55) * (o.vol != null ? o.vol : 1);
      var node = s;
      if (o.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); s.connect(p); node = p; }
      node.connect(g); g.connect(sfxBus); s.start();
      var d = DUCK[name] != null ? DUCK[name] : .8; if (o.duck != null) d = o.duck;
      if (d < 1) duck(d, b.duration / rate);
      played.push({ name: name, t: +(ctx.currentTime.toFixed(2)) }); if (played.length > 50) played.shift();
    });
    return true;
  }
  function duck(level, dur) {
    var t = ctx.currentTime, g = duckBus.gain, until = t + Math.min(dur, 6) + .12;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.min(level, g.value), t + .04);
    duckUntil = Math.max(duckUntil, until);
    g.setValueAtTime(Math.min(level, g.value), duckUntil); g.linearRampToValueAtTime(1, duckUntil + .5);
  }
  function startMusic(name) {
    wantMusic = name;
    if (!unlocked || !ctx) return;
    if (cur && cur.name === name) return;
    var old = cur; cur = null;
    if (old) { var t = ctx.currentTime; old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t); old.gain.gain.linearRampToValueAtTime(0, t + 1.2); old.src.stop(t + 1.3); }
    if (!name || muted) return;
    var mine = { name: name };
    cur = mine;
    load(name).then(function (b) {
      if (!b || cur !== mine) return;
      var s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
      var g = ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(musicBus);
      var t = ctx.currentTime; s.start(t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 2.5);
      mine.src = s; mine.gain = g;
    });
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch (e) {}
    if (ctx) {
      var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + .15);
      if (!muted) { if (ctx.state !== "running") ctx.resume(); if (wantMusic && (!cur || cur.name !== wantMusic)) { cur = null; startMusic(wantMusic); } }
    }
    paintBtn();
  }
  var ICON_ON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/></svg>';
  function paintBtn() {
    if (!btn) return;
    btn.innerHTML = muted ? ICON_OFF : ICON_ON;
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    btn.setAttribute("aria-label", muted ? "Sound off. Turn sound on" : "Sound on. Turn sound off");
    btn.title = muted ? "Sound off (tap to turn on)" : "Sound on (tap to mute)";
    btn.classList.toggle("off", muted);
  }
  function mountButton() {
    if (btn || cfg.button === false) return;
    var css = document.createElement("style");
    css.textContent = ".nl-snd{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;flex:none;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#f5f2ea;cursor:pointer;padding:0;margin:0;-webkit-tap-highlight-color:transparent;transition:border-color .2s,background .2s}" +
      ".nl-snd:hover{border-color:rgba(255,255,255,.3)}.nl-snd.off{color:#8d8a9b}.nl-snd:focus-visible{outline:2px solid #ffc94a;outline-offset:2px}" +
      ".nl-snd.float{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:50;background:rgba(7,7,12,.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}" +
      ".top .wrap .nl-snd-row{display:flex;align-items:center;gap:10px;min-width:0}";
    document.head.appendChild(css);
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "nl-snd"; btn.id = "nl-sound";
    btn.addEventListener("click", function (e) { e.stopPropagation(); unlock(); setMuted(!muted); if (!muted) sfx("toggle"); });
    var host = cfg.mount || document.querySelector(".top .wrap");
    if (host && host.querySelector) {
      // keep the header's right-hand item (e.g. the date tag) and put the button after it
      var right = host.lastElementChild;
      if (right && right !== host.firstElementChild) {
        var row = document.createElement("div"); row.className = "nl-snd-row";
        host.insertBefore(row, right); row.appendChild(right); row.appendChild(btn);
      } else host.appendChild(btn);
    } else { btn.classList.add("float"); document.body.appendChild(btn); }
    paintBtn();
  }
  function autoUI() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button, [role=button], a.btn");
      if (!b || b === btn || b.disabled || b.hasAttribute("data-nosnd")) return;
      sfx("click");
    }, true);
    var lastV = new WeakMap();
    document.addEventListener("input", function (e) {
      var el = e.target; if (!el || el.type !== "range" || el.hasAttribute("data-nosnd")) return;
      var span = (+el.max - +el.min) || 1, f = (+el.value - +el.min) / span;
      var pv = lastV.get(el); lastV.set(el, f); if (pv != null && Math.abs(pv - f) < .02) return;
      sfx("tick", { rate: .85 + f * .5 });
    }, true);
    document.addEventListener("change", function (e) {
      var el = e.target; if (!el || (el.type !== "checkbox" && el.type !== "radio") || el.hasAttribute("data-nosnd")) return;
      sfx("toggle", { rate: el.checked ? 1.06 : .94 });
    }, true);
  }
  function init(o) {
    o = o || {};
    for (var k in o) cfg[k] = o[k];
    if (o.base) BASE = o.base;
    if (inited) { if (o.music !== undefined) startMusic(o.music); return api; }
    inited = true;
    wantMusic = cfg.music;
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (t) { window.addEventListener(t, unlock, true); });
    ["pointerdown", "pointerup", "keydown", "input", "change"].forEach(function (t) { window.addEventListener(t, function () { lastInput = performance.now(); }, true); });
    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
    });
    var go = function () {
      mountButton(); if (cfg.autoUI) autoUI();
      // warm the HTTP cache for the tiny UI sounds and the music after the page has settled (no decoding, no playback)
      setTimeout(function () { PRELOAD.forEach(function (n) { fetchRaw(n).catch(function () {}); }); if (wantMusic) fetchRaw(wantMusic).catch(function () {}); }, 1500);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
    return api;
  }
  // one decision -> one sound: a caption's blip yields to a sound the demo just played for the same moment
  function cue(tone, o) {
    var now = performance.now();
    if (now - lastBig < 700) return false;
    if (tone === "good" || tone === "bad") { if (now - lastDecision < 160) return false; }
    else if (now - lastAny < 160 || now - lastInput > 450) return false; // neutral captions only echo a real input
    if (tone === "good") return sfx("good", o);
    if (tone === "bad") return sfx("bad", o);
    if (tone === "ai") return sfx("shimmer", o);
    return sfx("tap", o);
  }
  var api = {
    init: init, sfx: sfx, play: sfx, cue: cue, music: startMusic, mute: setMuted,
    get muted() { return muted; },
    state: function () { return { unlocked: unlocked, ctx: ctx ? ctx.state : "none", muted: muted, music: cur && cur.src ? cur.name : null, wantMusic: wantMusic, played: played.slice(), loaded: Object.keys(bufs).reduce(function (o, k) { o[k] = +bufs[k].duration.toFixed(3); return o; }, {}) }; }
  };
  window.NLAudio = api;
})();
