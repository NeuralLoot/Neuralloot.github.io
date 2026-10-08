# NeuralLoot

**AI before it's consensus. The method, the mechanism, the take.**

Source for <https://neuralloot.github.io/>: interactive demos of how AI actually works, from [@neuralloot](https://x.com/neuralloot) on X.
Pure static HTML/CSS/JS served by GitHub Pages from `main` at `/`. No build step, no trackers.

## Layout

```
index.html              home page (hero + demo grid rendered from demos/index.json)
og.png                  1200x630 social card for the home page
favicon.svg / favicon-32.png / favicon.ico / apple-touch-icon.png
assets/fonts/           self-hosted Space Grotesk + JetBrains Mono (SIL OFL, licenses alongside)
demos/index.json        list of demos, newest first
demos/_template/        starter for new demos
demos/<yyyy-mm-dd>-<slug>/
tools/                  render.py (og.png/thumb.jpg), shoot.py (screenshots + console check), record.py (mp4 capture)
.nojekyll               serve files as-is (no Jekyll)
```

## Demo convention

- Each demo lives at `demos/<yyyy-mm-dd>-<slug>/index.html` and is **self-contained**: inline CSS + JS, no external scripts.
  Shared `/assets/fonts/*` and `/favicon.svg` are fine (they fall back gracefully).
- Every demo page has its own `<title>`, meta description, Open Graph + Twitter `summary_large_image` tags pointing at its own
  `og.png` (1200x630), a small **NeuralLoot** header link back to `/`, and a footer **View source** link to its folder on GitHub.
- Start from `demos/_template/index.html` (header, footer, OG tags, responsive canvas `.stage`, styled controls panel).
- Any data must be math-correct or clearly labeled as illustrative. No invented benchmark numbers.
- Add an entry at the **top** of `demos/index.json`:

```json
{
  "slug": "2026-10-07-optimizer-race",
  "title": "Optimizer race: SGD vs Momentum vs RMSProp vs Adam",
  "mechanism": "One line: what the mechanism is / what you'll see.",
  "date": "2026-10-07",
  "path": "demos/2026-10-07-optimizer-race/",
  "thumb": "demos/2026-10-07-optimizer-race/thumb.jpg",
  "tags": ["optimization", "training"]
}
```

`thumb` is optional (a generated CSS preview is used without it). `"hidden": true` keeps a demo out of the grid.

Generate the images with `python tools/render.py demo demos/<folder> --title "..." --mech "..."` (needs Playwright).

## License

Code: MIT (see `LICENSE`). Fonts: SIL Open Font License 1.1 (see `assets/fonts/`).
