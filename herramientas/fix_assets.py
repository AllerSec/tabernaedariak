# -*- coding: utf-8 -*-
"""Fotos stock via Wikimedia Commons + compresion de videos + hojas de contacto."""
import os
import re
import subprocess
import sys
import time

import requests
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
STOCK = os.path.join(ROOT, "assets", "images", "stock")
VID = os.path.join(ROOT, "assets", "videos")

S = requests.Session()
S.headers.update({"User-Agent": "TabernaEdariakWeb/1.0 (allerunax@gmail.com) requests"})

QUERIES = [
    ("bera-navarra", "Bera Navarra town", 3),
    ("bodega-barricas", "wine cellar oak barrels", 2),
    ("copa-vino-tinto", "red wine glass", 2),
    ("cerveza-cana", "beer glass tap bar", 2),
    ("whisky-vaso", "whisky glass", 2),
    ("licores-botellas", "liquor bottles shelf bar", 2),
    ("gin-tonic", "gin tonic glass", 2),
    ("brandy-copa", "brandy snifter glass", 2),
    ("refrescos-botellas", "soft drink bottles", 2),
    ("cava-brindis", "champagne glasses toast", 2),
    ("sidra-vasca", "sagardotegia cider basque", 2),
    ("txakoli", "txakoli wine", 1),
    ("vermut-aperitivo", "vermouth glass", 2),
    ("cafe-grano", "coffee beans roasted", 2),
    ("leche-vaso", "milk glass", 2),
    ("agua-mineral", "mineral water bottle", 2),
    ("cristaleria-copas", "wine glasses rows empty", 2),
    ("aceite-oliva", "olive oil bottle glass", 2),
    ("conservas-latas", "anchovies canned tin", 2),
    ("zumo-frutas", "orange juice glass", 2),
    ("botellas-miniatura", "miniature liquor bottles", 1),
    ("furgoneta-reparto", "delivery van", 2),
    ("almacen-cajas", "beverage crates warehouse", 2),
    ("bar-barra", "bar counter beer taps", 2),
    ("pintxos-bar", "pintxos bar basque", 2),
    ("vinedo-rioja", "vineyard Rioja", 2),
]


def log(m):
    print(m, flush=True)


def to_webp(src, dest, max_w=2400, quality=82):
    im = Image.open(src).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dest, "WEBP", quality=quality, method=6)


def commons_search(query, n):
    """Busca en Wikimedia Commons; devuelve URLs escaladas a 2400px."""
    try:
        r = S.get("https://commons.wikimedia.org/w/api.php", params={
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": f"filetype:bitmap {query}", "gsrnamespace": 6,
            "gsrlimit": 25, "prop": "imageinfo",
            "iiprop": "url|size|mime", "iiurlwidth": 2400,
        }, timeout=30)
        pages = r.json().get("query", {}).get("pages", {})
    except Exception as e:
        log(f"    [!] commons {query}: {e}")
        return []
    cands = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii.get("thumburl"):
            continue
        if ii.get("mime") not in ("image/jpeg", "image/png"):
            continue
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w < 1400 or h < 900:
            continue
        # evitar mapas, escudos, diagramas, blanco y negro historicos
        title = p.get("title", "").lower()
        if re.search(r"(map|mapa|escudo|coat|diagram|logo|chart|plan[o ]|scan)", title):
            continue
        cands.append({"w": w, "h": h, "url": ii["thumburl"],
                      "title": p.get("title", ""), "idx": p.get("index", 99)})
    cands.sort(key=lambda x: x["idx"])
    return cands[:n]


def openverse_fallback(query, n):
    try:
        r = S.get("https://api.openverse.org/v1/images/",
                  params={"q": query, "license": "cc0,by,by-sa", "page_size": 20},
                  headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        res = r.json().get("results", [])
    except Exception:
        return []
    res = [x for x in res if (x.get("width") or 0) >= 1000]
    res.sort(key=lambda x: -(x["width"] * (x.get("height") or 1)))
    return [{"url": x["url"], "title": x.get("title", "")} for x in res[:n]]


def step_stock():
    os.makedirs(STOCK, exist_ok=True)
    manifest = []
    for slug, query, n in QUERIES:
        results = commons_search(query, n) or openverse_fallback(query, n)
        got = 0
        for x in results:
            got += 1
            suffix = f"-{got}" if n > 1 else ""
            dest = os.path.join(STOCK, f"{slug}{suffix}.webp")
            if os.path.exists(dest):
                manifest.append((f"{slug}{suffix}.webp", x.get("title", "")))
                continue
            try:
                r = S.get(x["url"], timeout=90)
                if r.status_code != 200 or len(r.content) < 30000:
                    got -= 1
                    continue
                tmp = dest + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(r.content)
                to_webp(tmp, dest)
                os.remove(tmp)
                manifest.append((f"{slug}{suffix}.webp", x.get("title", "")))
                log(f"    {slug}{suffix}.webp <- {x.get('title','')[:60]}")
            except Exception as e:
                got -= 1
                log(f"    [!] {slug}: {e}")
            time.sleep(0.3)
    with open(os.path.join(STOCK, "_fuentes.txt"), "w", encoding="utf-8") as f:
        for name, title in manifest:
            f.write(f"{name}\t{title}\n")
    log(f"[STOCK] {len(manifest)} fotos")


def step_compress_videos():
    for fn in os.listdir(VID):
        if not fn.endswith(".mp4") or fn.endswith(".web.mp4"):
            continue
        src = os.path.join(VID, fn)
        out = os.path.join(VID, fn.replace(".mp4", ".web.mp4"))
        if os.path.exists(out):
            continue
        cmd = ["ffmpeg", "-y", "-i", src, "-t", "14",
               "-vf", "scale='min(1600,iw)':-2",
               "-c:v", "libx264", "-crf", "27", "-preset", "slow",
               "-profile:v", "high", "-pix_fmt", "yuv420p",
               "-movflags", "+faststart", "-an", out]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            mb = os.path.getsize(out) / 1e6
            log(f"    {fn} -> {os.path.basename(out)} ({mb:.1f} MB)")
            os.remove(src)
        else:
            log(f"    [!] ffmpeg {fn}: {r.stderr[-200:]}")
    # frame de cada video para revision visual
    for fn in os.listdir(VID):
        if fn.endswith(".web.mp4"):
            frame = os.path.join(VID, fn.replace(".web.mp4", ".frame.jpg"))
            if not os.path.exists(frame):
                subprocess.run(["ffmpeg", "-y", "-ss", "3", "-i",
                                os.path.join(VID, fn), "-frames:v", "1", frame],
                               capture_output=True)
    log("[VIDEOS] comprimidos")


def step_contact_sheets():
    """Hojas de contacto para revisar el contenido de cada foto."""
    files = sorted(f for f in os.listdir(STOCK) if f.endswith(".webp"))
    cols, thumb = 4, (380, 285)
    per_sheet = 16
    for s in range(0, len(files), per_sheet):
        batch = files[s:s + per_sheet]
        rows = (len(batch) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (thumb[0] + 10) + 10,
                                  rows * (thumb[1] + 34) + 10), "white")
        d = ImageDraw.Draw(sheet)
        for i, fn in enumerate(batch):
            im = Image.open(os.path.join(STOCK, fn)).convert("RGB")
            im.thumbnail(thumb)
            x = 10 + (i % cols) * (thumb[0] + 10)
            y = 10 + (i // cols) * (thumb[1] + 34)
            sheet.paste(im, (x, y))
            d.text((x, y + thumb[1] + 6), fn, fill="black")
        out = os.path.join(ROOT, f"_revision-fotos-{s // per_sheet + 1}.jpg")
        sheet.save(out, quality=88)
        log(f"    hoja: {os.path.basename(out)}")
    log("[REVISION] hojas de contacto generadas")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    step_stock()
    step_compress_videos()
    step_contact_sheets()
    log("\nFIX COMPLETO")
