#!/usr/bin/env python3
"""Screenshot pages at desktop 1280x800 and mobile 390x844 and report console errors.

  python tools/shoot.py <base-url> <out-dir> <path> [<path> ...]
  e.g. python tools/shoot.py https://neuralloot.github.io /workspace/neuralloot/site-shots / /demos/2026-10-07-optimizer-race/

Writes <name>-desktop.png, <name>-mobile.png (viewport) and <name>-*-full.png (full page).
Exit code 1 if any console error / page error / failed request / horizontal overflow is found.
"""
import os, re, sys
from playwright.sync_api import sync_playwright

VIEWS = {"desktop": dict(viewport={"width": 1280, "height": 800}, device_scale_factor=1),
         "mobile": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.60")}

def main():
    base, out, paths = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3:]
    os.makedirs(out, exist_ok=True)
    bad = 0
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel="chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        except Exception:
            b = p.chromium.launch()
        for path in paths:
            name = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-") or "home"
            for vname, opts in VIEWS.items():
                ctx = b.new_context(**opts); page = ctx.new_page()
                errs = []
                page.on("console", lambda m: m.type == "error" and errs.append("console: " + m.text))
                page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
                page.on("requestfailed", lambda r: errs.append(f"requestfailed: {r.url} {r.failure}"))
                page.on("response", lambda r: r.status >= 400 and errs.append(f"HTTP {r.status}: {r.url}"))
                resp = page.goto(base + path, wait_until="networkidle")
                page.wait_for_timeout(3500)
                ov = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if ov > 0: errs.append(f"horizontal overflow: {ov}px")
                page.screenshot(path=f"{out}/{name}-{vname}.png")
                page.screenshot(path=f"{out}/{name}-{vname}-full.png", full_page=True)
                print(f"{path} [{vname}] HTTP {resp.status if resp else '?'} title={page.title()!r} errors={len(errs)}")
                for e in errs: print("   ", e)
                bad += len(errs)
                ctx.close()
        b.close()
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
