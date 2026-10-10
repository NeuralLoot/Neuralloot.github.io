# NeuralLoot sound kit: licenses


_On the site: each sound is served as `/assets/audio/<name>.mp3` (128 kbps copy of the WAV master in `/workspace/neuralloot/audio/`), played by `/assets/audio/nl-audio.js`._
Every file in this kit is **CC0 1.0 (public domain dedication)**: free for commercial use, no attribution required, no share-alike.
License text: https://creativecommons.org/publicdomain/zero/1.0/ . Each source page was checked on Oct 10 2026 and showed CC0 as the only license.
Nothing with an unclear, attribution-required (CC-BY/OGA-BY), share-alike, or non-commercial license is included. Candidates rejected for license reasons: Chillwave Nightdrive (CC-BY 3.0), Thought Processing (OGA-BY), Space Philately (CC-BY-SA), Cybermatic Pulse (CC-BY 4.0), TechnoTronic 2 (CC-BY 3.0), Hesitation (CC-BY 3.0), Whoosh 1/2 by bart (CC-BY-SA/GPL).
Kenney packs ship their own License.txt (CC0), kept in `_src/<pack>/License.txt`. Credit is optional; we credit anyway ("Sounds: Kenney.nl, OpenGameArt CC0 artists").

Processing for every file: trimmed / looped (equal-power crossfade at a musically matched loop point), DC removed, loudness measured with ffmpeg `loudnorm` (EBU R128) and a linear gain applied toward the target (music -20 LUFS, SFX -16 LUFS, textures -24 LUFS) with a -1 dBTP true-peak ceiling, so nothing clips. Very short clicks/ticks (<0.4 s) can't reach -16 LUFS without exceeding the peak ceiling, so they are peak-limited at -1 dBTP instead (marked *peak-ltd*).

| File | Kind | Length | LUFS / dBTP | Source (original file) | Author | License |
|---|---|---|---|---|---|---|
| `sfx/ui_click.wav` (+ `web/ui_click.mp3`) | sfx | 0.069s | -28.8 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/click_001.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/ui_tap.wav` (+ `web/ui_tap.mp3`) | sfx | 0.04s | -22.4 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/select_002.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/ui_toggle.wav` (+ `web/ui_toggle.mp3`) | sfx | 0.13s | -16.1 / -5.8 | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/toggle_002.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/ui_tick.wav` (+ `web/ui_tick.mp3`) | sfx | 0.02s | -26.1 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/tick_002.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/ui_drop.wav` (+ `web/ui_drop.mp3`) | sfx | 0.188s | -20.6 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/drop_002.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/good_blip.wav` (+ `web/good_blip.mp3`) | sfx | 0.29s | -16.0 / -4.5 | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/confirmation_001.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/good_chime.wav` (+ `web/good_chime.mp3`) | sfx | 0.539s | -16.0 / -5.5 | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/confirmation_002.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/bad_blip.wav` (+ `web/bad_blip.mp3`) | sfx | 0.104s | -18.9 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/error_004.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/bad_buzz.wav` (+ `web/bad_buzz.mp3`) | sfx | 0.261s | -18.0 / -1.0 *peak-ltd* | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/error_006.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/soft_nope.wav` (+ `web/soft_nope.mp3`) | sfx | 0.491s | -16.0 / -8.3 | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/question_001.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/level_up.wav` (+ `web/level_up.mp3`) | sfx | 0.677s | -16.0 / -7.5 | [digital-audio](https://kenney.nl/assets/digital-audio) (`digital-audio/Audio/powerUp12.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/unlock.wav` (+ `web/unlock.mp3`) | sfx | 0.52s | -16.0 / -6.3 | [interface-sounds](https://kenney.nl/assets/interface-sounds) (`interface-sounds/Audio/maximize_005.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/win_stinger.wav` (+ `web/win_stinger.mp3`) | sfx | 4.679s | -16.0 / -5.2 | [sci-fi-puzzle-jingle-result](https://opengameart.org/content/sci-fi-puzzle-jingle-result) (`oga/ogg_sci-fi_puzzle_jingle_result/ogg_Sci-fi Puzzle Jingle & Result/Sci-fi Puzzle Clear (Jingle).ogg`) | MintoDog | CC0 1.0 |
| `sfx/lose_stinger.wav` (+ `web/lose_stinger.mp3`) | sfx | 6.169s | -16.0 / -5.3 | [sci-fi-puzzle-jingle-result](https://opengameart.org/content/sci-fi-puzzle-jingle-result) (`oga/ogg_sci-fi_puzzle_jingle_result/ogg_Sci-fi Puzzle Jingle & Result/Sci-fi Puzzle Failure (Jingle).ogg`) | MintoDog | CC0 1.0 |
| `sfx/fb_correct.wav` (+ `web/fb_correct.mp3`) | sfx - bright rising chime (C6 to G6 bell) = CORRECT answer | 0.500s | -16.0 / -7.8 | (original, synthesized by audio/tools/synth_feedback.py) (`synth/fb_correct.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/fb_wrong.wav` (+ `web/fb_wrong.mp3`) | sfx - low descending buzz (Bb3 to E3, falling) = WRONG answer | 0.520s | -16.0 / -8.2 | (original, synthesized by audio/tools/synth_feedback.py) (`synth/fb_wrong.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/whoosh_soft.wav` (+ `web/whoosh_soft.mp3`) | sfx | 0.719s | -16.0 / -1.9 | (original, synthesized from filtered noise by audio/tools/synth_whoosh.py) (`synth/whoosh_soft.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/whoosh_fast.wav` (+ `web/whoosh_fast.mp3`) | sfx | 0.376s | -16.2 / -1.0 *peak-ltd* | (original, synthesized from filtered noise by audio/tools/synth_whoosh.py) (`synth/whoosh_fast.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/whoosh_down.wav` (+ `web/whoosh_down.mp3`) | sfx | 0.655s | -16.0 / -3.1 | (original, synthesized from filtered noise by audio/tools/synth_whoosh.py) (`synth/whoosh_down.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/riser_reveal.wav` (+ `web/riser_reveal.mp3`) | sfx | 1.409s | -16.0 / -3.6 | (original, synthesized from filtered noise by audio/tools/synth_whoosh.py) (`synth/riser_reveal.wav`) | NeuralLoot | CC0 1.0 |
| `sfx/whoosh_air.wav` (+ `web/whoosh_air.mp3`) | sfx | 1.6s | -16.0 / -5.4 | [air-whoosh](https://opengameart.org/content/air-whoosh) (`oga/whoosh2_0.wav`) | pyranostudios | CC0 1.0 |
| `textures/tex_computer.wav` (+ `web/tex_computer.mp3`) | texture loop | 3.565s | -24.0 / -19.6 | [sci-fi-sounds](https://kenney.nl/assets/sci-fi-sounds) (`sci-fi-sounds/Audio/computerNoise_000.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `textures/tex_hum.wav` (+ `web/tex_hum.mp3`) | texture loop | 3.846s | -24.0 / -16.2 | [sci-fi-sounds](https://kenney.nl/assets/sci-fi-sounds) (`sci-fi-sounds/Audio/spaceEngineLow_001.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `sfx/tex_shimmer.wav` (+ `web/tex_shimmer.mp3`) | sfx | 0.789s | -16.0 / -8.6 | [sci-fi-sounds](https://kenney.nl/assets/sci-fi-sounds) (`sci-fi-sounds/Audio/forceField_000.ogg`) | Kenney (kenney.nl) | CC0 1.0 |
| `textures/tex_pad.wav` (+ `web/tex_pad.mp3`) | texture loop | 18.32s | -24.0 / -9.4 | [project-utopia-seamless-loop](https://opengameart.org/content/project-utopia-seamless-loop) (`oga/Project%20Utopia_0.ogg`) | congusbongus | CC0 1.0 |
| `music/music_calm_synth.wav` (+ `web/music_calm_synth.mp3`) | music loop - calm synth / ambient | 96.574s | -20.0 / -2.5 | [calm-ambient-2-synthwave-15k](https://opengameart.org/content/calm-ambient-2-synthwave-15k) (`oga/002_Synthwave_15k.mp3`) | cynicmusic | CC0 1.0 |
| `music/music_calm_ambient.wav` (+ `web/music_calm_ambient.mp3`) | music loop - calm ambient pad | 24.511s | -20.0 / -7.6 | [ambient-relaxing-loop](https://opengameart.org/content/ambient-relaxing-loop) (`oga/Ambient-Loop-isaiah658.wav`) | isaiah658 | CC0 1.0 |
| `music/music_upbeat_electronic.wav` (+ `web/music_upbeat_electronic.mp3`) | music loop - upbeat electronic / driving | 48.005s | -20.0 / -9.2 | [virtual-rush](https://opengameart.org/content/virtual-rush) (`oga/virtual_rush_loop_0.mp3`) | vitalezzz | CC0 1.0 |
| `music/music_upbeat_puzzle.wav` (+ `web/music_upbeat_puzzle.mp3`) | music loop - upbeat sci-fi puzzle, 122 BPM | 62.951s | -20.0 / -9.3 | [sci-fi-puzzle-jingle-result](https://opengameart.org/content/sci-fi-puzzle-jingle-result) (`oga/ogg_sci-fi_puzzle_jingle_result/ogg_Sci-fi Puzzle Jingle & Result/Sci-fi Puzzle Clear (Loop)_BPM122.ogg`) | MintoDog | CC0 1.0 |
| `music/music_tense_puzzle.wav` (+ `web/music_tense_puzzle.mp3`) | music loop - tense / sneaky puzzle, 95 BPM | 45.419s | -20.0 / -4.5 | [covert-operations](https://opengameart.org/content/covert-operations) (`oga/covert_operations.mp3`) | artisticdude | CC0 1.0 |
| `music/music_tense_pulse.wav` (+ `web/music_tense_pulse.mp3`) | music loop - tense sci-fi pulse | 64.865s | -20.0 / -6.9 | [net-infiltration](https://opengameart.org/content/net-infiltration) (`oga/net_infiltration_loop.wav`) | vitalezzz | CC0 1.0 |

## Source pages
- Kenney Interface Sounds: https://kenney.nl/assets/interface-sounds (CC0)
- Kenney Digital Audio: https://kenney.nl/assets/digital-audio (CC0)
- Kenney Sci-fi Sounds: https://kenney.nl/assets/sci-fi-sounds (CC0)
- Also downloaded (not yet used, CC0): Kenney UI Audio https://kenney.nl/assets/ui-audio , Music Jingles https://kenney.nl/assets/music-jingles , Impact Sounds https://kenney.nl/assets/impact-sounds
- OpenGameArt (each page lists CC0): sci-fi-puzzle-jingle-result (MintoDog), air-whoosh (pyranostudios), project-utopia-seamless-loop (congusbongus), calm-ambient-2-synthwave-15k (cynicmusic), ambient-relaxing-loop (isaiah658), virtual-rush and net-infiltration (vitalezzz), covert-operations (artisticdude)
- `whoosh_soft`, `whoosh_fast`, `whoosh_down`, `riser_reveal`: original sounds synthesized by NeuralLoot with `tools/synth_whoosh.py`, released CC0.
- `fb_correct`, `fb_wrong`: original answer-feedback sounds synthesized by NeuralLoot with `tools/synth_feedback.py`, released CC0.
