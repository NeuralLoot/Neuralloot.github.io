/*! NeuralLoot shared demo audio (nl-audio.js) — WebAudio, no dependencies.
 *  Sounds: CC0 kit (Kenney.nl, OpenGameArt CC0 artists, NeuralLoot originals). See /assets/audio/LICENSES.md
 *
 *  Usage (in a demo, before the demo's own script):
 *    <script src="/assets/audio/nl-audio.js"></script>
 *    <script>NLAudio.init({ music: "music_tense_puzzle" });</script>
 *  Then, inside the demo, on every real decision, pass the OUTCOME the game logic computed:
 *    NLAudio.feedback(ok ? "good" : "bad")  // "good" = fb_correct: bright rising bell, C6 -> G6 (short, high)
 *                                          // "bad"  = fb_wrong:   low falling buzz, Bb3 -> E3 (longer, dark)
 *                                          // "neutral" = ui_tap: soft click (moves, picks, toggles, no verdict)
 *    NLAudio.outcome(won ? "win" : "lose")  // level / round result stinger (win_stinger vs lose_stinger)
 *    NLAudio.sfx("whoosh")  // non-verdict effects: tap click tick toggle drop levelup unlock whoosh swipe swoop
 *                           //  reveal shimmer air (or any kit file name, e.g. "ui_tap")
 *    NLAudio.cue(tone)      // caption echo: NEUTRAL only (soft tap / "ai" shimmer). Captions never decide
 *                           //  right vs wrong; a "good"/"bad" caption tone is silent, call feedback() instead.
 *    NLAudio.music(name)    // crossfade to another loop; NLAudio.music(null) fades music out
 *  Correct and wrong must never share a sound: good/great/correct -> fb_correct, bad/buzz/nope/wrong -> fb_wrong.
 *  Rules baked in: nothing plays before the first user gesture (browser autoplay policy); a ≥44px mute
 *  toggle is injected into the header (or bottom-right) and remembered in localStorage("nl-sound");
 *  music ducks under SFX; buttons / sliders / switches get a soft click / tick / toggle automatically.
 *  URL: ?sound=0 starts muted.  window.NLAudio.state() reports status (used by headless tests).
 *
 *  THEMED PACKS (Oct 12 2026): 6 synthesized CC0 packs in /assets/audio/packs/<pack>/ (see LICENSES.md):
 *    lab · retro · industrial · cyber · nature · arcade
 *    NLAudio.usePack("retro")            // pick the pack (also sets its music bed "a"; {music:"b"} or {music:false})
 *    NLAudio.init({ pack: "retro" })     // same thing at init
 *    NLAudio.play("pickup")              // random variant, no immediate repeat, slight pitch (±4%) + volume (±10%) jitter
 *  Pack events: success fail pickup place win lose alarm whoosh powerup explode tick.
 *  With a pack active, the old names keep working and route into the pack: good->success, bad->fail,
 *  win/lose->win/lose, tap->pickup, drop/click->place, tick->tick, levelup/unlock->powerup,
 *  whoosh/swipe/swoop/reveal/air->whoosh, alarm/warn->alarm, boom/collapse->explode. Without usePack()
 *  nothing changes (legacy kit). NLAudio.pack() returns the active pack name.
 */
(function () {
  "use strict";
  if (window.NLAudio) return;
  var BASE = "/assets/audio/";
  var ALIAS = {
    tap: "ui_tap", click: "ui_click", tick: "ui_tick", toggle: "ui_toggle", drop: "ui_drop",
    good: "fb_correct", great: "fb_correct", correct: "fb_correct", bad: "fb_wrong", buzz: "fb_wrong", nope: "fb_wrong", wrong: "fb_wrong",
    neutral: "ui_tap",
    levelup: "level_up", unlock: "unlock", win: "win_stinger", lose: "lose_stinger",
    whoosh: "whoosh_soft", swipe: "whoosh_fast", swoop: "whoosh_down", reveal: "riser_reveal", air: "whoosh_air",
    shimmer: "tex_shimmer"
  };
  // per-sound gain (0..1, on top of sfx bus) and how far music ducks while it plays (1 = no duck)
  var VOL = { fb_correct: .6, fb_wrong: .62, ui_tap: .55, ui_click: .5, ui_tick: .28, ui_toggle: .5, ui_drop: .6, good_blip: .6, good_chime: .62, bad_blip: .55,
    bad_buzz: .5, soft_nope: .45, level_up: .6, unlock: .55, win_stinger: .75, lose_stinger: .7, whoosh_soft: .45,
    whoosh_fast: .4, whoosh_down: .45, riser_reveal: .5, whoosh_air: .4, tex_shimmer: .35 };
  var DUCK = { fb_correct: .65, fb_wrong: .65, win_stinger: .25, lose_stinger: .25, level_up: .55, unlock: .6, riser_reveal: .5, good_chime: .7, bad_buzz: .7 };
  // every effect is tiny (~340 KB in total): fetch all after load, decode all on the first gesture, so the
  // first right / wrong answer is never silent on a slow network
  var PRELOAD = ["ui_tap", "ui_click", "ui_tick", "ui_toggle", "ui_drop", "fb_correct", "fb_wrong", "win_stinger", "lose_stinger",
    "level_up", "unlock", "whoosh_soft", "whoosh_fast", "whoosh_down", "riser_reveal", "whoosh_air", "tex_shimmer"];   // (older good_blip / bad_blip / soft_nope etc. still load on demand by file name)
  var VERDICT = { fb_correct: "good", fb_wrong: "bad", win_stinger: "win", lose_stinger: "lose" };
  var KEY = "nl-sound";
  var cfg = { music: null, musicVolume: .34, sfxVolume: .8, autoUI: true, button: true };
  var ctx = null, master, musicBus, duckBus, sfxBus, comp;
  var bufs = {}, loading = {}, raw = {};
  var muted = false, unlocked = false, inited = false;
  var cur = null; // { name, src, gain }
  var lastAt = {}, lastInput = 0, lastAny = 0, lastDecision = 0, lastBig = 0, BIG = { win_stinger: 1, lose_stinger: 1, level_up: 1, unlock: 1, riser_reveal: 1 }, duckUntil = 0, played = [], btn = null, wantMusic = null;
  var log = window.__nlLog = []; // every feedback()/outcome() call: { t, kind, id, sent } (headless tests read this)

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
    (pack ? ["ui_toggle"] : PRELOAD).forEach(load); if (pack) packFiles(pack).forEach(load);
    if (wantMusic && !muted) startMusic(wantMusic);
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (t) { window.removeEventListener(t, unlock, true); });
  }

  // ---- themed packs ----
  var PACKS = {"lab":{"music":["music_lab_a","music_lab_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}},"retro":{"music":["music_retro_a","music_retro_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}},"industrial":{"music":["music_industrial_a","music_industrial_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}},"cyber":{"music":["music_cyber_a","music_cyber_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}},"nature":{"music":["music_nature_a","music_nature_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}},"arcade":{"music":["music_arcade_a","music_arcade_b"],"n":{"success":3,"fail":3,"pickup":3,"place":3,"win":3,"lose":3,"alarm":3,"whoosh":3,"powerup":3,"explode":3,"tick":3}}};
  var PEV = { success: 1, fail: 1, pickup: 1, place: 1, win: 1, lose: 1, alarm: 1, whoosh: 1, powerup: 1, explode: 1, tick: 1 };
  var PMAP = { good: "success", great: "success", correct: "success", bad: "fail", buzz: "fail", nope: "fail", wrong: "fail",
    fb_correct: "success", fb_wrong: "fail", win_stinger: "win", lose_stinger: "lose",
    tap: "pickup", ui_tap: "pickup", neutral: "pickup", drop: "place", ui_drop: "place", click: "place", ui_click: "place", tick: "tick", ui_tick: "tick",
    levelup: "powerup", level_up: "powerup", unlock: "powerup", whoosh: "whoosh", swipe: "whoosh", swoop: "whoosh", reveal: "whoosh", air: "whoosh",
    whoosh_soft: "whoosh", whoosh_fast: "whoosh", whoosh_down: "whoosh", riser_reveal: "whoosh", whoosh_air: "whoosh",
    alarm: "alarm", warn: "alarm", warning: "alarm", boom: "explode", collapse: "explode", powerup: "powerup", collect: "pickup", coin: "pickup" };
  var PVOL = { success: .6, fail: .6, pickup: .5, place: .5, win: .72, lose: .68, alarm: .45, whoosh: .42, powerup: .58, explode: .62, tick: .3 };
  var PDUCK = { success: .65, fail: .65, win: .25, lose: .25, powerup: .55, explode: .4, alarm: .6 };
  var PRATE = { whoosh: [.92, 1.06, .97] };   // whoosh variants already differ; others jitter around 1
  var pack = null, lastVar = {};
  function packEvent(n) { if (!pack) return null; if (PEV[n]) return n; return PMAP[n] || null; }
  function pickVariant(ev) {
    var k = PACKS[pack].n[ev] || 1, last = lastVar[pack + ev], v;
    do { v = 1 + Math.floor(Math.random() * k); } while (k > 1 && v === last);
    lastVar[pack + ev] = v; return "packs/" + pack + "/" + ev + "_" + v;
  }
  function packFiles(p) { var out = []; for (var e in PACKS[p].n) for (var i = 1; i <= PACKS[p].n[e]; i++) out.push("packs/" + p + "/" + e + "_" + i); return out; }
  function usePack(p, o) {
    o = o || {};
    if (!PACKS[p]) { console.warn("[nl-audio] unknown pack " + p); return api; }
    pack = p;
    var m = o.music === false || o.music === null ? null
      : (typeof o.music === "string" && o.music !== "a" && o.music !== "b") ? o.music
      : "packs/" + p + "/" + PACKS[p].music[o.music === "b" ? 1 : 0];
    startMusic(m);
    if (unlocked) packFiles(p).forEach(load);
    else setTimeout(function () { packFiles(p).forEach(function (n) { fetchRaw(n).catch(function () {}); }); }, 1500);
    return api;
  }
  // random-variant play: an event name (pack event or legacy alias); falls back to the legacy kit with no pack
  function playVar(n, o) {
    o = o || {};
    var ev = packEvent(n);
    if (!ev) return sfx(n, o);
    var id = pickVariant(ev), q = {};
    for (var k in o) q[k] = o[k];
    if (q.vary == null) q.vary = .04;
    var vj = 1 + (Math.random() * 2 - 1) * .1;
    q.vol = (q.vol != null ? q.vol : 1) * vj * PVOL[ev] / .55;
    if (q.duck == null && PDUCK[ev] != null) q.duck = PDUCK[ev];
    if (q.gap == null) q.gap = ev === "tick" ? 55 : 45;
    q._ev = ev;
    return sfx(id, q);
  }
  function resolve(n) { return ALIAS[n] || n; }
  function sfx(n, o) {
    o = o || {};
    if (!o._ev && pack && packEvent(n)) return playVar(n, o);
    var name = o._ev ? n : resolve(n), key = o._ev || name;
    if (!unlocked || muted || !ctx) return false;
    var small = o._ev ? (o._ev === "pickup" || o._ev === "place" || o._ev === "tick") : name.indexOf("ui_") === 0;
    var now = performance.now(), gap = o.gap != null ? o.gap : (name === "ui_tick" ? 55 : 45);
    if (lastAt[key] && now - lastAt[key] < gap) return false;
    lastAt[key] = now; lastAny = now;
    if (!small) lastDecision = now;
    if (BIG[name] || o._ev === "win" || o._ev === "lose" || o._ev === "powerup" || o._ev === "explode") lastBig = now;
    var t0 = now, late = o.late || (small ? 250 : 1500);
    load(name).then(function (b) {
      if (!b || performance.now() - t0 > late) return; // too late to still feel tied to the action
      var s = ctx.createBufferSource(); s.buffer = b;
      var rate = o.rate || 1; if (o.vary) rate *= 1 + (Math.random() * 2 - 1) * o.vary;
      s.playbackRate.value = rate;
      var g = ctx.createGain(); g.gain.value = (VOL[name] != null ? VOL[name] : .55) * (o.vol != null ? o.vol : 1);
      var node = s;
      if (o.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); s.connect(p); node = p; }
      node.connect(g); g.connect(sfxBus); s.start();
      var d = DUCK[name] != null ? DUCK[name] : .8; if (o.duck != null) d = o.duck;
      if (d < 1) duck(d, b.duration / rate);
      played.push({ name: name, kind: VERDICT[name] || ({ success: "good", fail: "bad", win: "win", lose: "lose" })[o._ev] || null, t: +(ctx.currentTime.toFixed(2)) }); if (played.length > 50) played.shift();
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
  // one tap -> one sound: run fn after the demo's own handlers, skip it if they played a verdict / big sound
  function later(fn) { var t = performance.now(); setTimeout(function () { if (lastDecision < t && lastBig < t) fn(); }, 0); }
  function autoUI() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button, [role=button], a.btn");
      if (!b || b === btn || b.disabled || b.hasAttribute("data-nosnd")) return;
      later(function () { sfx("click"); });
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
      var r = el.checked ? 1.06 : .94; later(function () { sfx("toggle", { rate: r }); });
    }, true);
  }
  function init(o) {
    o = o || {};
    for (var k in o) cfg[k] = o[k];
    if (o.base) BASE = o.base;
    if (inited) { if (o.pack) usePack(o.pack, o.music !== undefined ? { music: o.music } : {}); else if (o.music !== undefined) startMusic(o.music); return api; }
    inited = true;
    wantMusic = cfg.music || wantMusic;
    if (o.pack) usePack(o.pack, { music: o.music });
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (t) { window.addEventListener(t, unlock, true); });
    ["pointerdown", "pointerup", "keydown", "input", "change"].forEach(function (t) { window.addEventListener(t, function () { lastInput = performance.now(); }, true); });
    document.addEventListener("visibilitychange", function () {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume();
    });
    var go = function () {
      mountButton(); if (cfg.autoUI) autoUI();
      // warm the HTTP cache for the tiny UI sounds and the music after the page has settled (no decoding, no playback)
      setTimeout(function () { (pack ? ["ui_toggle"] : PRELOAD).forEach(function (n) { fetchRaw(n).catch(function () {}); }); if (wantMusic) fetchRaw(wantMusic).catch(function () {}); }, 1200);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
    return api;
  }
  // THE verdict API. kind comes from game logic: "good" | "bad" | "neutral" (true / false also accepted)
  function feedback(kind, o) {
    var k = kind === true || kind === "good" || kind === "correct" || kind === "right" ? "good"
      : kind === false || kind === "bad" || kind === "wrong" ? "bad" : "neutral";
    var id = k === "good" ? "fb_correct" : k === "bad" ? "fb_wrong" : "ui_tap";
    var sent = sfx(id, o); if (pack) id = pack + ":" + packEvent(id);
    log.push({ t: Math.round(performance.now()), kind: k, id: id, sent: sent }); if (log.length > 100) log.shift();
    return sent;
  }
  function outcome(kind, o) {
    var k = kind === true || kind === "win" || kind === "pass" ? "win" : "lose";
    var id = k === "win" ? "win_stinger" : "lose_stinger";
    var sent = sfx(id, o); if (pack) id = pack + ":" + packEvent(id);
    log.push({ t: Math.round(performance.now()), kind: k, id: id, sent: sent }); if (log.length > 100) log.shift();
    return sent;
  }
  // caption echo, neutral only: a caption's tone describes what happened on screen, not whether the player was
  // right, so it never plays a verdict sound. Runs after the demo's handlers and yields to any sound they played.
  function cue(tone, o) {
    if (tone === "good" || tone === "bad") return false;
    var t = performance.now();
    if (t - lastBig < 700 || t - lastAny < 160 || t - lastInput > 450) return false; // only echo a real input
    setTimeout(function () { if (lastDecision < t - 160 && lastAny < t) sfx(tone === "ai" ? "shimmer" : "tap", o); }, 30);
    return true;
  }
  var api = {
    init: init, sfx: sfx, play: function (n, o) { return playVar(n, o); }, playVariant: function (n, o) { return playVar(n, o); }, usePack: usePack, pack: function () { return pack; }, packs: function () { return Object.keys(PACKS); }, feedback: feedback, outcome: outcome, cue: cue, music: startMusic, mute: setMuted,
    get muted() { return muted; },
    state: function () { return { pack: pack, unlocked: unlocked, ctx: ctx ? ctx.state : "none", muted: muted, music: cur && cur.src ? cur.name : null, wantMusic: wantMusic, played: played.slice(), log: log.slice(), loaded: Object.keys(bufs).reduce(function (o, k) { o[k] = +bufs[k].duration.toFixed(3); return o; }, {}) }; }
  };
  window.NLAudio = api;
})();
