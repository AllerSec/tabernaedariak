# -*- coding: utf-8 -*-
"""Scraper de tabernaedariak.eus: texto + imagenes por pagina/subpagina."""
import os
import re
import sys
import time
import hashlib
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

BASE = "https://tabernaedariak.eus"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contenido-scrapeado")

PAGES = [
    "/",
    "/harremana/",
    "/ardoak/",
    "/garagardoa/",
    "/zukuak-jarabeak/",
    "/aperitiboa/",
    "/freskagarriak/",
    "/kontserbak/",
    "/miniaturak/",
    "/kafekiak/",
    "/esnea/",
    "/ura/",
    "/kaba-txanpaina/",
    "/sagardoa-txakolina/",
    "/olioa/",
    "/likorrak-2/",
    "/whiskia/",
    "/ginebra-vodka-ron-tekila/",
    "/anis-konak-patxarana/",
    "/edalontziak/",
    "/katalogoa/",
]

S = requests.Session()
S.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
})

IMG_EXT = re.compile(r"\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$", re.I)
seen_downloads = {}  # url -> ruta local ya descargada (para log de duplicados)


def fetch(url):
    for attempt in range(3):
        try:
            r = S.get(url, timeout=30)
            if r.status_code == 200:
                return r
            print(f"  [!] HTTP {r.status_code} en {url}")
            return None
        except requests.RequestException as e:
            print(f"  [!] error {e} en {url} (intento {attempt+1})")
            time.sleep(2)
    return None


def slug_to_folder(path):
    path = path.strip("/")
    if not path:
        return "inicio"
    return path.replace("/", os.sep)


def best_from_srcset(srcset):
    """Devuelve la URL de mayor anchura de un srcset."""
    best, best_w = None, -1
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        u = bits[0]
        w = 0
        if len(bits) > 1 and bits[1].endswith("w"):
            try:
                w = int(bits[1][:-1])
            except ValueError:
                w = 0
        if w > best_w:
            best, best_w = u, w
    return best


def full_size_wp(url):
    """Quita el sufijo -300x200 de thumbnails de WordPress para pedir la original."""
    return re.sub(r"-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|gif|webp|avif))", "", url, flags=re.I)


def collect_images(soup, page_url):
    urls = []
    for img in soup.find_all("img"):
        cands = []
        if img.get("srcset"):
            cands.append(best_from_srcset(img["srcset"]))
        for attr in ("data-src", "data-lazy-src", "src"):
            if img.get(attr):
                cands.append(img[attr])
        for c in cands:
            if c and not c.startswith("data:"):
                urls.append(urljoin(page_url, c))
                break
    # enlaces directos a imagenes (lightbox) y PDFs
    for a in soup.find_all("a", href=True):
        href = urljoin(page_url, a["href"])
        if IMG_EXT.search(urlparse(href).path) or href.lower().endswith(".pdf"):
            urls.append(href)
    # imagenes de fondo en style=""
    for tag in soup.find_all(style=True):
        for m in re.findall(r"url\(['\"]?([^'\")]+)['\"]?\)", tag["style"]):
            if not m.startswith("data:"):
                urls.append(urljoin(page_url, m))
    # dedup conservando orden
    out, seen = [], set()
    for u in urls:
        u = full_size_wp(u)
        if u not in seen and urlparse(u).netloc.endswith("tabernaedariak.eus"):
            seen.add(u)
            out.append(u)
    return out


def download_image(url, folder):
    name = unquote(os.path.basename(urlparse(url).path)) or "imagen"
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    dest = os.path.join(folder, name)
    if os.path.exists(dest):
        return dest
    r = fetch(url)
    if r is None:
        # si fallo la version original (sin sufijo), no insistimos
        return None
    os.makedirs(folder, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(r.content)
    seen_downloads.setdefault(url, dest)
    return dest


def extract_text(soup, url):
    title = soup.title.get_text(strip=True) if soup.title else ""
    desc = ""
    md = soup.find("meta", attrs={"name": "description"})
    if md and md.get("content"):
        desc = md["content"]

    main = soup.find("main") or soup.find(id="content") or soup.find(
        class_=re.compile(r"(site-content|entry-content|page-content)")) or soup.body

    lines = [f"# {title}", f"URL: {url}", ""]
    if desc:
        lines += [f"Meta descripcion: {desc}", ""]

    if main:
        for el in main.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li",
                                 "figcaption", "td", "th"]):
            txt = el.get_text(" ", strip=True)
            if not txt:
                continue
            if el.name.startswith("h"):
                lines.append("#" * int(el.name[1]) + " " + txt)
            elif el.name == "li":
                lines.append("- " + txt)
            else:
                lines.append(txt)
        # texto alt de imagenes (nombres de productos muchas veces)
        alts = [i.get("alt", "").strip() for i in main.find_all("img")]
        alts = [a for a in alts if a]
        if alts:
            lines += ["", "## Textos alternativos de imagenes (alt)"]
            lines += ["- " + a for a in dict.fromkeys(alts)]

    # quitar lineas duplicadas consecutivas
    cleaned, prev = [], None
    for ln in lines:
        if ln != prev:
            cleaned.append(ln)
        prev = ln
    return "\n".join(cleaned) + "\n"


def child_links(soup, page_url, known_paths):
    """Enlaces internos que son hijos directos de la pagina actual."""
    parent = urlparse(page_url).path
    if parent == "/":
        return []  # la home enlaza a todo; sus 'hijos' ya son las paginas top
    kids = set()
    for a in soup.find_all("a", href=True):
        u = urljoin(page_url, a["href"])
        p = urlparse(u)
        if not p.netloc.endswith("tabernaedariak.eus"):
            continue
        path = p.path
        if not path.endswith("/"):
            path += "/"
        if (path.startswith(parent) and path != parent
                and path not in known_paths
                and not IMG_EXT.search(path)
                and "/page/" not in path
                and not path.endswith(".pdf/")):
            kids.add(path)
    return sorted(kids)


def pagination_links(soup, page_url):
    pags = set()
    for a in soup.find_all("a", href=True):
        u = urljoin(page_url, a["href"])
        p = urlparse(u)
        if p.netloc.endswith("tabernaedariak.eus") and re.search(r"/page/\d+/?$", p.path):
            if p.path.startswith(urlparse(page_url).path):
                pags.add(urljoin(BASE, p.path))
    return sorted(pags)


def process_page(url, folder, known_paths, depth=0):
    rel = os.path.relpath(folder, OUT)
    print(f"[{'>'*(depth+1)}] {url} -> {rel}")
    r = fetch(url)
    if r is None:
        return
    soup = BeautifulSoup(r.text, "html.parser")
    os.makedirs(folder, exist_ok=True)

    # texto
    with open(os.path.join(folder, "texto.md"), "w", encoding="utf-8") as f:
        f.write(extract_text(soup, url))

    # imagenes
    imgs = collect_images(soup, url)
    img_dir = os.path.join(folder, "imagenes")
    n_ok = 0
    for u in imgs:
        dest = download_image(u, img_dir)
        if dest is None:
            # reintenta con la URL tal cual venia si la "original" fallo
            continue
        n_ok += 1
        time.sleep(0.15)
    print(f"    texto.md + {n_ok}/{len(imgs)} imagenes")

    # paginacion de la misma seccion -> mismo folder
    if depth == 0:
        for purl in pagination_links(soup, url):
            print(f"    paginacion: {purl}")
            pr = fetch(purl)
            if pr is None:
                continue
            psoup = BeautifulSoup(pr.text, "html.parser")
            with open(os.path.join(folder, f"texto-pagina-{purl.rstrip('/').rsplit('/',1)[-1]}.md"),
                      "w", encoding="utf-8") as f:
                f.write(extract_text(psoup, purl))
            for u in collect_images(psoup, purl):
                download_image(u, img_dir)
                time.sleep(0.15)
            # subpaginas tambien desde paginas de paginacion
            if depth == 0:
                for kid in child_links(psoup, url, known_paths):
                    known_paths.add(kid)
                    process_page(urljoin(BASE, kid),
                                 os.path.join(folder, slug_to_folder(kid[len(urlparse(url).path):])),
                                 known_paths, depth + 1)

    # subpaginas -> subcarpetas (solo 1 nivel extra de profundidad)
    if depth < 2:
        for kid in child_links(soup, url, known_paths):
            known_paths.add(kid)
            sub = kid[len(urlparse(url).path):]
            process_page(urljoin(BASE, kid), os.path.join(folder, slug_to_folder(sub)),
                         known_paths, depth + 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    known = set(PAGES)
    for path in PAGES:
        folder = os.path.join(OUT, slug_to_folder(path))
        process_page(urljoin(BASE, path), folder, known)
    print("\nHecho. Salida en:", OUT)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
