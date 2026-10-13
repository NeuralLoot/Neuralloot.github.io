# READY: Argon Lab (Gemini 4 Argon launch, Oct 13 2026)

- Demo: https://neuralloot.github.io/demos/2026-10-13-gemini4-argon/
- Template: #1 Beat the model (2-door router, real scores on doors, memory twist rounds 6-7) + #6 Catch the cheater (one cheat at a time, big flashing ⚠️). Reworked 12:05 PM MT after Elliott: "hard to follow", "no scoring listed".
- pack: lab (today: cyber, industrial, retro, arcade already used)
- FK grade (main-flow text via tools/fk_grade.py, numbers stripped): 1.3 (raw 0.9). Target <=6: pass.
- Playtest (rework): 8/10. One idea per screen: job name on top, 2 big doors with bar + real %, pulsing 👇 on round 1, slim toast below the stage (never covers it). 10-year-old test: yes, "tap the bigger number" is readable in ~3 s; L2 "tap the flashing ⚠️" likewise. Weak: L1 is easy until the memory rounds.
- Own playtest observation: a scripted "always pick the shiny new model" run is not possible to win, Argon is the best door on only 4 of 6 jobs (3 wins + 1 tie), and it is LAST on 2.
- Checks: 0 console errors desktop 1280 + mobile 390; no overflow; tools/shoot.py exit 0; audio/tools/test_audio.py OK (music_lab_a). __nlLog: right pick lab:success, wrong pick lab:fail, cleared lab:win, failed router lab:lose.
- Voice check: pass (no banned phrases, 0 em dashes, ends on link, no closing question, 4-item list not triplet).

## Verified facts
- Model card table (deepmind.google/models/model-cards/gemini-4-argon/): DeepSWE v1.1 77.9 / 74.1 / 67.4 / 74.2; FrontierSWE v2 55.0 / 65.5 / 56.3 / 62.3; Terminal-bench 4.0 57.4 / 58.2 / 57.9 / 66.4; GraphWalks 256k-1M 84.2 / 71.8 / 65.0 / 66.8; LVBench 91.7 / 87.5 / 79.7 / 83.7; CWE-bench v1 68.0 / 68.0 / 58.0 / 67.0 (Argon / GPT-6 Astra / Claude Fable 5.1 / Claude Opus 5.5).
- Robotics post (developers.googleblog.com/gemini-4-argon-for-robotics/): "No sim cheating" rule (no external forces/torques, no welds/equality constraints, no qpos/qvel setting, no disabled collisions, no contact forces copied from logged tactile readings); single RGB photo -> MuJoCo twin, 77-task curriculum, 4,500+ episodes; real success 56% -> 75%, time 35 s -> 24 s; ERQA 87%.
- Sundar post (x.com/sundarpichai/status/2110038898009407584, 10:04 AM MT): available in paid Gemini API, Antigravity (Ultra), Gemini app + Search (Ultra, Pro).
- Toy: cheat events + catch-rate -> 56..75% meter mapping (labeled in Nerd notes).

## Post (post.txt) / reply (reply-source.txt): see files. Not posted.
