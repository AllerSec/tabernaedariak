# -*- coding: utf-8 -*-
"""Capturas de la web servida en local para revision visual."""
import os
import sys
import threading
import http.server
import socketserver

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8743

PAGES = [
    ("inicio", "/", 2400),
    ("inicio-movil", "/", 0),
    ("catalogo", "/catalogo/", 1400),
    ("vinos", "/catalogo/vinos/", 1500),
    ("cervezas", "/catalogo/cervezas/", 800),
    ("empresa", "/empresa/", 1600),
    ("contacto", "/contacto/", 900),
    ("404", "/404.html", 0),
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def serve():
    with socketserver.TCPServer(("127.0.0.1", PORT), Quiet) as httpd:
        httpd.serve_forever()


threading.Thread(target=serve, daemon=True).start()

out = os.path.join(ROOT, "_capturas")
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, path, scroll in PAGES:
        mobile = name.endswith("movil")
        ctx = browser.new_context(
            viewport={"width": 390 if mobile else 1440,
                      "height": 844 if mobile else 900},
            reduced_motion="reduce",
            device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}{path}", wait_until="networkidle")
        page.wait_for_timeout(2600)  # loader + animaciones de entrada
        if scroll:
            page.mouse.wheel(0, scroll)
            page.wait_for_timeout(1200)
        page.screenshot(path=os.path.join(out, f"{name}.png"))
        # captura de pagina completa para inicio
        if name == "inicio":
            page.screenshot(path=os.path.join(out, "inicio-completa.png"),
                            full_page=True)
        ctx.close()
        print("captura:", name, flush=True)
    browser.close()

print("capturas listas en _capturas/", flush=True)
