#!/usr/bin/env python3
"""Record a short mp4 of a demo's .stage for an X post (headless Chrome + ffmpeg).

  python tools/record.py <url> <out.mp4> [--size 1080x1080] [--seconds 12] [--query "s=himmel"]
                         [--click 0.3,0.7@4 --click 0.8,0.2@8]   # fractional stage coords @ seconds

The stage is pinned full-frame (capture mode), so the video is just the visualization + its HUD.
Output: H.264, yuv420p, 30 fps, +faststart (what X accepts). Max 2:20 for normal accounts.
"""
import argparse, os, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

CAPTURE_CSS = """
html,body{overflow:hidden!important}
.top,.intro,.panel,.legend,.chartbox,.note,.explain,footer{visibility:hidden!important}
.stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;aspect-ratio:auto!important;
       border:0!important;border-radius:0!important;z-index:9999!important;visibility:visible!important}
.stage *{visibility:visible!important}
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url"); ap.add_argument("out")
    ap.add_argument("--size", default="1080x1080"); ap.add_argument("--seconds", type=float, default=12)
    ap.add_argument("--query", default=""); ap.add_argument("--click", action="append", default=[])
    ap.add_argument("--lead", type=float, default=0.6, help="seconds trimmed from the start (page load)")
    a = ap.parse_args()
    w, h = map(int, a.size.lower().split("x"))
    url = a.url + (("&" if "?" in a.url else "?") + a.query if a.query else "")
    url += ("&" if "?" in url else "?") + "autoplay=0"
    tmp = tempfile.mkdtemp()
    clicks = sorted((float(c.split("@")[1]), *map(float, c.split("@")[0].split(","))) for c in a.click)
    with sync_playwright() as p:
        try: b = p.chromium.launch(channel="chrome")
        except Exception: b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, record_video_dir=tmp, record_video_size={"width": w, "height": h})
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle")
        page.add_style_tag(content=CAPTURE_CSS)
        page.wait_for_timeout(int(a.lead * 1000))
        t0 = time.time()
        page.evaluate("document.getElementById('play') && document.getElementById('play').click()")
        for at, fx, fy in clicks:
            dt = at - (time.time() - t0)
            if dt > 0: page.wait_for_timeout(int(dt * 1000))
            page.mouse.click(fx * w, fy * h)
        rest = a.seconds - (time.time() - t0)
        if rest > 0: page.wait_for_timeout(int(rest * 1000))
        vid = page.video.path(); ctx.close(); b.close()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{a.lead + 0.2:.2f}", "-i", vid, "-t", f"{a.seconds:.2f}",
           "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", "-an", a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print("wrote", a.out)

if __name__ == "__main__":
    main()
