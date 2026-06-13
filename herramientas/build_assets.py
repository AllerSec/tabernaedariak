# -*- coding: utf-8 -*-
"""Pipeline de assets para la web de Manuel Taberna Edariak."""
import os
import re
import sys
import time
import shutil

import requests
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SCRAPE = os.path.join(ROOT, "contenido-scrapeado")
A = os.path.join(ROOT, "assets")

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"})

DIRS = [
    "css", "js", "js/vendor", "fonts",
    "images/marca", "images/categorias", "images/marcas", "images/stock",
    "videos",
]

# scraped filename -> (carpeta destino, nombre profesional)
CATEGORIAS = {
    "ardoak.jpg": "vinos",
    "garagardoa-1.jpg": "cervezas",
    "whiskia.jpg": "whiskies",
    "likorrak-1.jpg": "licores",
    "Ginebra.jpg": "ginebra-vodka-ron-tequila",
    "Cognac.jpg": "anis-brandy-pacharan",
    "fresxkagarriak.jpg": "refrescos",
    "kaba-1.jpg": "cavas",
    "sagardoa-1.jpg": "sidra-txakoli",
    "aperitiboak.jpg": "aperitivos",
    "kafea-1.jpg": "cafes",
    "esnea-1.jpg": "leche",
    "ura-1.jpg": "aguas",
    "edalontziak-1.jpg": "cristaleria",
    "olioa-1.jpg": "aceite",
    "kontserbak.jpg": "conservas",
    "zukua.jpg": "zumos-jarabes",
    "miniaturak-1.jpg": "miniaturas",
}

MARCAS = {
    "Heineken.jpg": "heineken",
    "Schweppess.jpg": "schweppes",
    "Insalus.jpg": "insalus",
    "Lacturale.jpg": "lacturale",
    "zapiain.jpg": "zapiain",
    "Codorniu-1.jpg": "codorniu",
    "Pago.jpg": "pago",
    "urdaira.jpg": "ur-daira",
}

STOCK_QUERIES = [
    # (slug, query, n)
    ("bera-navarra", "Bera Navarra", 3),
    ("bodega-barricas", "wine cellar barrels", 2),
    ("copa-vino-tinto", "red wine glass bottle", 2),
    ("cerveza-cana", "beer glass pouring", 2),
    ("whisky-vaso", "whisky glass bottle", 2),
    ("licores-botellas", "liquor bottles bar shelf", 2),
    ("gin-tonic", "gin tonic cocktail", 2),
    ("brandy-copa", "brandy cognac glass", 2),
    ("refrescos-botellas", "soda bottles glass", 2),
    ("cava-brindis", "champagne glasses toast", 2),
    ("sidra-vasca", "basque cider pouring", 2),
    ("txakoli", "txakoli", 1),
    ("vermut-aperitivo", "vermouth aperitif glass", 2),
    ("cafe-grano", "coffee beans espresso", 2),
    ("leche-vaso", "milk glass bottle", 2),
    ("agua-mineral", "mineral water bottle glass", 2),
    ("cristaleria-copas", "wine glasses empty glassware", 2),
    ("aceite-oliva", "olive oil bottle", 2),
    ("conservas-latas", "canned fish anchovies tin", 2),
    ("zumo-frutas", "orange juice glass fruit", 2),
    ("botellas-miniatura", "miniature liquor bottles", 1),
    ("furgoneta-reparto", "delivery van street", 2),
    ("almacen-cajas", "warehouse beverage crates", 2),
    ("bar-barra", "bar counter bartender", 2),
    ("pintxos-bar", "pintxos basque bar", 2),
    ("vinedo-rioja", "vineyard rioja navarra", 2),
]

VIDEO_SEARCHES = [
    ("vino-sirviendo", "wine"),
    ("cerveza-tirando", "beer"),
    ("bar-ambiente", "bar"),
    ("brindis", "cheers"),
    ("cafe", "coffee-cup"),
]

GSAP_FILES = [
    ("https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js", "gsap.min.js"),
    ("https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js", "ScrollTrigger.min.js"),
]

FONT_CSS_URL = ("https://fonts.googleapis.com/css2?"
                "family=Fraunces:opsz,wght@9..144,400..700&"
                "family=Fraunces:ital,opsz,wght@1,9..144,400..700&"
                "family=Archivo:wght@400;500;600;700&display=swap")


def log(msg):
    print(msg, flush=True)


def to_webp(src, dest, max_w=2560, quality=82):
    im = Image.open(src)
    if im.mode in ("P", "RGBA") and dest.endswith(".webp"):
        im = im.convert("RGBA") if "A" in im.getbands() or im.mode == "P" else im.convert("RGB")
    else:
        im = im.convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dest, "WEBP", quality=quality, method=6)


def step_structure():
    for d in DIRS:
        os.makedirs(os.path.join(A, d), exist_ok=True)
    log("[1] Estructura creada")


def step_brand_and_categories():
    src_dir = os.path.join(SCRAPE, "inicio", "imagenes")
    # cabecera original (og-image y referencia de marca)
    to_webp(os.path.join(src_dir, "CABEZERA-TABERNA-copia.jpg"),
            os.path.join(A, "images", "marca", "logo-cabecera.webp"), max_w=1920, quality=88)
    shutil.copy2(os.path.join(src_dir, "CABEZERA-TABERNA-copia.jpg"),
                 os.path.join(A, "images", "marca", "og-image.jpg"))
    for fn, slug in CATEGORIAS.items():
        to_webp(os.path.join(src_dir, fn),
                os.path.join(A, "images", "categorias", f"{slug}.webp"), max_w=1600)
    for fn, slug in MARCAS.items():
        to_webp(os.path.join(src_dir, fn),
                os.path.join(A, "images", "marcas", f"{slug}.webp"), max_w=800, quality=86)
    log("[2] Marca + 18 categorias + 8 marcas convertidas a WebP")


def openverse(query, n):
    try:
        r = S.get("https://api.openverse.org/v1/images/",
                  params={"q": query, "license": "cc0,by,by-sa", "page_size": 20}, timeout=30)
        if r.status_code != 200:
            return []
        res = r.json().get("results", [])
    except Exception as e:
        log(f"    [!] openverse {query}: {e}")
        return []
    # preferir fuentes fiables y resolucion alta
    res = [x for x in res if x.get("width") and x["width"] >= 1200
           and re.search(r"(wikimedia|staticflickr)", x.get("url", ""))]
    res.sort(key=lambda x: -(x["width"] * x.get("height", 1)))
    return res[:n]


def step_stock():
    ok = 0
    for slug, query, n in STOCK_QUERIES:
        results = openverse(query, n)
        for i, x in enumerate(results, 1):
            suffix = f"-{i}" if n > 1 else ""
            dest = os.path.join(A, "images", "stock", f"{slug}{suffix}.webp")
            if os.path.exists(dest):
                ok += 1
                continue
            try:
                r = S.get(x["url"], timeout=60)
                if r.status_code != 200 or len(r.content) < 30000:
                    continue
                tmp = dest + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(r.content)
                to_webp(tmp, dest)
                os.remove(tmp)
                ok += 1
                log(f"    {slug}{suffix}.webp <- {x['url'][:80]}")
            except Exception as e:
                log(f"    [!] {slug}: {e}")
            time.sleep(0.4)
    log(f"[3] Stock: {ok} fotos descargadas")


def step_videos():
    ok = 0
    for slug, term in VIDEO_SEARCHES:
        dest = os.path.join(A, "videos", f"{slug}.mp4")
        if os.path.exists(dest):
            ok += 1
            continue
        try:
            r = S.get(f"https://mixkit.co/free-stock-video/{term}/", timeout=30)
            urls = sorted(set(re.findall(
                r"https://assets\.mixkit\.co/videos/\d+/\d+-1080\.mp4", r.text)))
            if not urls:
                urls = sorted(set(re.findall(
                    r"https://assets\.mixkit\.co/videos/\d+/\d+-720\.mp4", r.text)))
            if not urls:
                log(f"    [!] sin videos para {term}")
                continue
            v = S.get(urls[0], timeout=120)
            if v.status_code == 200 and len(v.content) > 200000:
                with open(dest, "wb") as f:
                    f.write(v.content)
                ok += 1
                log(f"    {slug}.mp4 ({len(v.content)//1024//1024} MB) <- {urls[0]}")
        except Exception as e:
            log(f"    [!] video {slug}: {e}")
        time.sleep(0.5)
    log(f"[4] Videos: {ok} descargados")


def step_gsap():
    for url, name in GSAP_FILES:
        dest = os.path.join(A, "js", "vendor", name)
        if os.path.exists(dest):
            continue
        r = S.get(url, timeout=30)
        with open(dest, "wb") as f:
            f.write(r.content)
    log("[5] GSAP vendorizado")


def step_fonts():
    css = S.get(FONT_CSS_URL, timeout=30).text
    faces = re.findall(
        r"/\* (latin(?:-ext)?) \*/\s*@font-face \{(.*?)\}", css, re.S)
    out_css = []
    seen = set()
    for subset, body in faces:
        if subset != "latin":
            continue
        fam = re.search(r"font-family: '([^']+)'", body).group(1)
        style = re.search(r"font-style: (\w+)", body).group(1)
        weight = re.search(r"font-weight: ([\d ]+)", body).group(1).strip()
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1)
        key = (fam, style, weight)
        if key in seen:
            continue
        seen.add(key)
        wtag = weight.replace(" ", "-")
        fname = f"{fam.lower().replace(' ', '-')}-{wtag}-{style}.woff2"
        dest = os.path.join(A, "fonts", fname)
        if not os.path.exists(dest):
            r = S.get(url, timeout=30)
            with open(dest, "wb") as f:
                f.write(r.content)
        extra = ""
        m = re.search(r"font-stretch: ([^;]+);", body)
        if m:
            extra += f"  font-stretch: {m.group(1)};\n"
        out_css.append(
            "@font-face {\n"
            f"  font-family: '{fam}';\n"
            f"  font-style: {style};\n"
            f"  font-weight: {weight};\n{extra}"
            f"  font-display: swap;\n"
            f"  src: url('../fonts/{fname}') format('woff2');\n"
            "}\n")
    with open(os.path.join(A, "css", "fonts.css"), "w", encoding="utf-8") as f:
        f.write("/* Fuentes self-hosted: Fraunces (display) + Archivo (texto) */\n"
                + "\n".join(out_css))
    log(f"[6] Fuentes: {len(out_css)} caras descargadas -> fonts.css")


def main():
    step_structure()
    step_brand_and_categories()
    step_gsap()
    step_fonts()
    step_stock()
    step_videos()
    log("\nASSETS COMPLETOS")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
