// Anticipation -> payoff. Build-up "tells" (nibbles) that start obvious and get subtler/faker each round,
// a short catch window, then the payoff: particle burst + camera cut (low angle, DOF) + celebrate + reward card.
const wait = s => new Promise(r => setTimeout(r, s * 1000));

export class Anticipation {
  /** tells: array of strengths 0..1 (fake:true = a tease that is NOT followed by the window)
   *  gap: [min,max] s between tells; window: s the catch window stays open. */
  constructor({ tells = [0.4, 0.7, 1], gap = [0.8, 1.5], window = 1.0, onTell, onReady, onMiss } = {}) {
    Object.assign(this, { tells, gap, win: window, onTell, onReady, onMiss }); this.state = 'idle'; }
  start() { this.state = 'build'; this.i = 0; this.t = 0; this.next = this._gap(); return this; }
  _gap() { return this.gap[0] + Math.random() * (this.gap[1] - this.gap[0]); }
  update(dt) { if (this.state === 'idle' || this.state === 'done') return; this.t += dt;
    if (this.state === 'build' && this.t >= this.next) { this.t = 0;
      if (this.i < this.tells.length) { const tl = this.tells[this.i++]; const o = typeof tl === 'number' ? { s: tl } : tl; this.onTell && this.onTell(o, this.i - 1); this.next = this._gap(); }
      else { this.state = 'ready'; this.onReady && this.onReady(); } }
    else if (this.state === 'ready' && this.t >= this.win) { this.state = 'done'; this.onMiss && this.onMiss('late'); } }
  /** the single button. Returns 'early' | 'hit' | 'none' */
  press() { if (this.state === 'build') { this.state = 'done'; this.onMiss && this.onMiss('early'); return 'early'; }
    if (this.state === 'ready') { this.state = 'done'; this.reaction = this.t; return 'hit'; } return 'none'; }
}

/** Big payoff moment. ctx = { rig, post, burst, trails, player, sound, ui }. Returns after the card is shown. */
export async function payoff(ctx, { at, card, hold = 1.7, framing = 'low' } = {}) {
  const { rig, post, burst, trails, player, sound, ui } = ctx;
  sound && sound.play('success'); sound && sound.play('whoosh');
  burst && burst.emit(at, { count: 140, speed: 5 }); trails && trails.ring(at, { r1: 2.4, life: 1.2 });
  rig.shake(0.55); if (player) { rig.yaw = player.yaw; rig.follow(player.pos); } rig.cut(framing); post && post.dof(true, at); player && player.celebrate();
  ui && ui.flash();
  await wait(hold);
  post && post.dof(false); rig.yaw = 0; rig.frame('follow');
  await wait(0.45);
  if (card && ui) { sound && sound.outcome('win'); return ui.rewardCard(card); }
}
export async function fail(ctx, { at, card, why } = {}) {
  const { rig, sound, ui, trails } = ctx; sound && sound.play('fail'); rig.shake(0.3); trails && at && trails.ring(at, { r1: 1, life: 0.8 });
  ui && why && ui.popup(why, { tone: 'bad' }); await wait(1.1); if (card && ui) { sound && sound.outcome('lose'); return ui.rewardCard(card); }
}
