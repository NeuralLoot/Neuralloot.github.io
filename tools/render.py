#!/usr/bin/env python3
"""NeuralLoot asset renderer (headless Chrome via Playwright).

  python tools/render.py home                 # og.png, favicon-32.png, apple-touch-icon.png
  python tools/render.py demo <demo-folder> --title "..." --mech "..." [--kicker "..."] [--query "s=rosen"] [--wait 5000]
      -> screenshots the demo's .stage element (it must have class "stage") and writes
         <demo-folder>/og.png (1200x630 social card) and <demo-folder>/thumb.jpg (grid thumbnail)

Run from the repo root. Serves the repo on a local port so absolute /assets paths work.
"""
import argparse, http.server, os, socketserver, sys, threading, urllib.parse
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = partial(Quiet, directory=ROOT)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"

def launch(p):
    try:
        return p.chromium.launch(channel="chrome", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    except Exception:
        return p.chromium.launch()

def card(page, base, params, out):
    page.set_viewport_size({"width": 1200, "height": 630})
    page.goto(f"{base}/tools/og-card.html?{urllib.parse.urlencode(params)}")
    page.wait_for_selector("body[data-ready='1']")
    page.wait_for_timeout(400)
    page.screenshot(path=out)
    print("wrote", os.path.relpath(out, ROOT))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["home", "demo"])
    ap.add_argument("folder", nargs="?")
    ap.add_argument("--title"); ap.add_argument("--mech"); ap.add_argument("--kicker", default="Interactive demo")
    ap.add_argument("--query", default=""); ap.add_argument("--wait", type=int, default=5000)
    a = ap.parse_args()
    httpd, base = serve()
    with sync_playwright() as p:
        b = launch(p); page = b.new_page(device_scale_factor=1)
        if a.what == "home":
            card(page, base, {"mode": "home"}, os.path.join(ROOT, "og.png"))
            from PIL import Image
            for size, name, bgc in [(32, "favicon-32.png", "transparent"), (180, "apple-touch-icon.png", "#0b0a12")]:
                page.set_viewport_size({"width": size, "height": size})
                page.set_content(f"<html><body style='margin:0;background:{bgc}'><img src='{base}/favicon.svg' style='width:{size}px;height:{size}px;display:block'></body></html>")
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(ROOT, name), omit_background=(bgc == "transparent"))
                print("wrote", name)
            Image.open(os.path.join(ROOT, "favicon-32.png")).save(os.path.join(ROOT, "favicon.ico"), sizes=[(32, 32), (16, 16)])
            print("wrote favicon.ico")
        else:
            folder = a.folder.strip("/")
            # narrow viewport -> square stage (matches the square frame in og-card.html)
            page = b.new_page(viewport={"width": 600, "height": 1000}, device_scale_factor=2)
            page.goto(f"{base}/{folder}/?{a.query}")
            page.add_style_tag(content=".hud,.hudb{display:none!important}.stage{border:0!important;border-radius:0!important}")
            page.wait_for_timeout(a.wait)
            stage = page.locator(".stage").first
            shot = os.path.join(ROOT, folder, "_stage.png")
            stage.screenshot(path=shot)
            page2 = b.new_page(device_scale_factor=1)
            card(page2, base, {"mode": "demo", "title": a.title, "mech": a.mech, "kicker": a.kicker, "img": f"../{folder}/_stage.png"}, os.path.join(ROOT, folder, "og.png"))
            os.remove(shot)
            # wide thumbnail for the home grid (no text; the card shows the title)
            page3 = b.new_page(viewport={"width": 1240, "height": 1000}, device_scale_factor=1.5)
            page3.goto(f"{base}/{folder}/?{a.query}")
            page3.add_style_tag(content=".hud,.hudb{display:none!important}.stage{border:0!important;border-radius:0!important}")
            page3.wait_for_timeout(a.wait)
            page3.locator(".stage").first.screenshot(path=shot)
            from PIL import Image
            im = Image.open(shot).convert("RGB"); w = 1200; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            im.save(os.path.join(ROOT, folder, "thumb.jpg"), quality=86, optimize=True, progressive=True)
            os.remove(shot); print("wrote", folder + "/thumb.jpg")
        b.close()
    httpd.shutdown()

if __name__ == "__main__":
    main()
