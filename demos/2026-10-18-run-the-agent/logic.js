// Run the Agent: pure game logic (no DOM). Shared by the page (main.js) and the playtest sim (tests/sim.mjs).
// The loop is the real one: THINK (pick a tool) -> ACT (call it, costs 1 step) -> OBSERVE (the tool's result or error
// comes back and stays in context). Tools are toys; the failure modes (missing input, timeout, dead tool, loop,
// useless search, saying "done" too early, step budget) are the real ones from ReAct (arXiv 2210.03629) and
// tau-bench (arXiv 2406.12045).
export const LEVELS = [
  { id: 'loop', title: 'Does Sam need an umbrella?', taskIcon: '☂️', budget: 4, hints: true,
    slots: [{ icon: '📍', what: 'town' }, { icon: '🌧️', what: 'forecast' }, { icon: '💬', what: 'answer' }],
    tools: [
      { id: 'contacts', icon: '👤', name: 'Contacts', gives: 0, ok: 'Sam lives in Denver', color: 0x7fb7a4 },
      { id: 'search', icon: '🔍', name: 'Web search', useless: '1,000 pages. Nothing on Sam.', color: 0xb9a7d6 },
      { id: 'weather', icon: '🌦️', name: 'Weather', needs: 0, gives: 1, ok: 'Rain at 3 PM', color: 0x8fb4e3 },
      { id: 'reply', icon: '💬', name: 'Reply', needs: 1, gives: 2, finish: true, ok: '"Yes, bring one!"', color: 0xf2b36b },
    ] },
  { id: 'errors', title: 'Get a pizza to Sam', taskIcon: '🍕', budget: 5, faults: 'shops',
    slots: [{ icon: '📍', what: 'address' }, { icon: '🍕', what: 'order' }, { icon: '💬', what: 'message' }],
    tools: [
      { id: 'contacts', icon: '👤', name: 'Contacts', gives: 0, ok: '12 Elm St', color: 0x7fb7a4 },
      { id: 'tonys', icon: '🍕', name: "Tony's", needs: 0, gives: 1, ok: 'Order #41 placed', closedText: 'Closed today', shop: true, color: 0xe58a6c },
      { id: 'map', icon: '🗺️', name: 'Map', useless: 'Elm St is 2 km away. Nice, but no pizza.', color: 0xa8c98f },
      { id: 'luigis', icon: '🍕', name: "Luigi's", needs: 0, gives: 1, ok: 'Order #77 placed', closedText: 'Closed today', shop: true, color: 0xd9a35c },
      { id: 'reply', icon: '💬', name: 'Reply', needs: 1, gives: 2, finish: true, ok: '"Pizza at 7!"', color: 0xf2b36b },
    ] },
  { id: 'budget', title: "Book Sam's birthday dinner", taskIcon: '🎂', budget: 7, faults: 'dinner', unchecked: true,
    slots: [{ icon: '🎂', what: 'date' }, { icon: '🕖', what: 'free time' }, { icon: '🎟️', what: 'table' }, { icon: '✉️', what: 'invite' }],
    tools: [
      { id: 'contacts', icon: '👤', name: 'Contacts', gives: 0, ok: 'Birthday: Oct 24', color: 0x7fb7a4 },
      { id: 'calendar', icon: '📅', name: 'Calendar', needs: 0, gives: 1, ok: '7 PM is free', flaky: true, color: 0x8fb4e3 },
      { id: 'search', icon: '🔍', name: 'Web search', useless: 'Ads for cakes. Nothing on Sam.', color: 0xb9a7d6 },
      { id: 'rosa', icon: '🍝', name: "Rosa's", needs: 1, gives: 2, ok: 'Table for 4 at 7', closedText: 'Fully booked', shop: true, color: 0xe58a6c },
      { id: 'kai', icon: '🍣', name: "Kai's", needs: 1, gives: 2, ok: 'Table for 4 at 7', closedText: 'Fully booked', shop: true, color: 0xd9a35c },
      { id: 'send', icon: '✉️', name: 'Send', gives: 3, finish: true, ok: 'Invite sent!', color: 0xf2b36b },
    ] },
];

export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** New attempt at a level. Faults are rolled once per attempt (the world), never re-rolled per call. */
export function newRun(li, rnd = Math.random) {
  const L = LEVELS[li]; const fault = {};
  L.tools.forEach(t => fault[t.id] = { closed: false, timeouts: 0 });
  if (L.faults) {
    const shops = L.tools.filter(t => t.shop); const dead = shops[rnd() < 0.5 ? 0 : 1];
    fault[dead.id].closed = true;
    shops.forEach(s => { if (s !== dead && rnd() < 0.5) fault[s.id].timeouts = 1; });
    L.tools.forEach(t => { if (t.flaky && rnd() < 0.5) fault[t.id].timeouts = 1; });
  }
  return { li, L, fault, filled: L.slots.map(() => null), used: 0, budget: L.budget, calls: [], wasted: 0, loops: 0, errors: 0, retries: 0,
    lastObs: {}, done: false, result: null, order: L.tools.map(t => t.id) };
}

/** Act: call a tool. Returns the observation. kinds: ok | missing | have | useless | timeout | closed | blank */
export function callTool(S, id) {
  if (S.done) return null;
  const t = S.L.tools.find(x => x.id === id); const f = S.fault[id];
  S.used++;
  let o;
  const prev = S.lastObs[id];
  if (t.finish && S.L.unchecked) {
    const blanks = S.filled.slice(0, -1).filter(v => v == null).length;
    o = blanks ? { kind: 'blank', text: `Sent with ${blanks} blank${blanks > 1 ? 's' : ''}. It made the rest up!`, bad: true, blanks }
               : { kind: 'ok', text: t.ok, slot: t.gives };
  } else if (t.useless) o = { kind: 'useless', text: t.useless, bad: true };
  else if (t.needs != null && S.filled[t.needs] == null) o = { kind: 'missing', text: `Needs ${S.L.slots[t.needs].icon} first`, need: t.needs, bad: true };
  else if (t.gives != null && S.filled[t.gives] != null) o = { kind: 'have', text: `Already have ${S.L.slots[t.gives].icon}`, bad: true };
  else if (f.closed) o = { kind: 'closed', text: t.closedText || 'Error: tool is down', bad: true };
  else if (f.timeouts > 0) { f.timeouts--; o = { kind: 'timeout', text: 'Timeout. Try again?', bad: true, fair: true }; }
  else o = { kind: 'ok', text: t.ok, slot: t.gives };
  // same call, same result as last time = the agent is looping (it did not use the observation)
  o.repeat = !!(prev && prev.kind === o.kind && o.kind !== 'ok' && o.kind !== 'timeout');
  if (prev && prev.kind === 'timeout' && o.kind === 'ok') S.retries++;
  if (o.repeat) S.loops++;
  if (o.kind === 'timeout' || o.kind === 'closed') S.errors++;
  // wasted = a step the player could have avoided (timeouts are the world's fault, and the first hit on a dead tool is unavoidable)
  if (o.bad && !o.fair && !(o.kind === 'closed' && !o.repeat)) S.wasted++;
  if (o.kind === 'ok') S.filled[o.slot] = { text: o.text };
  S.lastObs[id] = o; S.calls.push({ id, kind: o.kind, repeat: o.repeat });
  if (o.kind === 'blank') { S.done = true; S.result = 'blank'; }
  else if (S.filled.every(v => v)) { S.done = true; S.result = 'win'; }
  else if (S.used >= S.budget) { S.done = true; S.result = 'budget'; }
  o.stepsLeft = S.budget - S.used;
  return o;
}
export const stars = S => S.result !== 'win' ? 0 : S.wasted === 0 ? 3 : S.wasted === 1 ? 2 : 1;

/** What a careful agent would do next, from what is on screen only (filled slots, observations so far). */
export function nextNeeded(S) { return S.filled.findIndex(v => v == null); }
export function smartPick(S) {
  const k = nextNeeded(S); const L = S.L;
  const cands = L.tools.filter(t => t.gives === k);
  const usable = cands.filter(t => !(S.lastObs[t.id] && S.lastObs[t.id].kind === 'closed'));
  return (usable[0] || cands[0]).id;
}
