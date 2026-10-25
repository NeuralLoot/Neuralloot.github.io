# Playtest fix: Fits in the Window (Oct 25, 2026)

A browser playtest found the game hard to play. Same core mechanic (tap a message to pin it to Memory; pins cost window room; oldest message drops out). What changed:

## Must fix
1. **Tutorial freeze on first run.** As soon as you press Play, a gold callout says "👆 Tap a message to pin it in 📌 Memory." When the dog-name message arrives (about 1 s after Play), game time **freezes** ("⏸ Time is frozen…") until you pin it. "Skip tutorial" lets you skip it. Seen once per browser (`localStorage nl-fitw-tut`). Use `?tut=0` to skip it in tests.
   Also new: **⏸ Pause** button in the HUD (all levels). The game auto-pauses when the tab is hidden. All game timing now runs on a game clock that can pause, not on setTimeout.
2. **Taps always register.** One `pointerdown` listener on the window box (an element that is never re-rendered), not `click` on the moving bubbles. `layout()` now moves a node only when it is in the wrong spot. Before, it re-inserted every bubble on each new message, and pinned ones too, which detached the node you were pressing. A tap within 8 px of a bubble snaps to it. Browser test: 46/46 taps registered on bubbles that were still sliding in.
3. **Slower L2/L3.** Message gap went from 2.4 s to 3.0 s on L2 and from 2.2 s to 3.3 s on L3. When a needed fact is next to fall out on L2/L3, you now get at least about 4 s before the next message. The first L3 fact now falls out about 11.7 s after it shows up (it was about 4–8 s).

## Should fix
- Goal text now changes per level. L2 says "📌 Memory costs room: pins count toward the window." The goal text no longer hides on short screens.
- The first messages show up sooner. The first message lands about 0.5 s after Play and the first fact about 1 s after.
- The Share button now shows "Shared ✓" or "Link copied ✓". If neither works, it opens a copy prompt.
- Memory box overflow: a pinned bubble now travels to Memory as a fixed "ghost" copy, so it is never clipped. The Memory box has a max height and scrolls. Pinned bubbles are a bit smaller.

Source lives in `bts-2026-10-25/` (main.js, page.html, content.js and gen_content.py gaps). It is built with `build.py`.
