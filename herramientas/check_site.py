# -*- coding: utf-8 -*-
"""Verificacion de la web: enlaces internos, assets, imagenes por pagina, SEO basico."""
import os
import re
import sys
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP_DIRS = {"contenido-scrapeado", ".git", "node_modules", "__pycache__"}

pages = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        if fn.endswith(".html"):
            pages.append(os.path.join(dirpath, fn))

errors, warns = [], []

for page in sorted(pages):
    rel = os.path.relpath(page, ROOT)
    with open(page, encoding="utf-8") as f:
        html = f.read()

    # referencias locales: href/src/poster
    refs = re.findall(r'(?:href|src|poster)="([^"#]+)"', html)
    for r in refs:
        if r.startswith(("http", "mailto:", "tel:", "data:", "//")):
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(page), unquote(r)))
        if os.path.isdir(target):
            target_index = os.path.join(target, "index.html")
            if not os.path.exists(target_index):
                errors.append(f"{rel}: carpeta sin index -> {r}")
        elif not os.path.exists(target):
            errors.append(f"{rel}: ROTO -> {r}")

    # SEO basico
    if rel != "404.html":
        for tag, pat in [
            ("title", r"<title>[^<]{10,}</title>"),
            ("description", r'name="description" content="[^"]{50,}"'),
            ("canonical", r'rel="canonical"'),
            ("og:title", r'property="og:title"'),
            ("lang", r'<html lang="es"'),
            ("viewport", r'name="viewport"'),
            ("h1", r"<h1[\s>]"),
        ]:
            if not re.search(pat, html):
                errors.append(f"{rel}: SEO falta {tag}")
        n_h1 = len(re.findall(r"<h1[\s>]", html))
        if n_h1 != 1:
            errors.append(f"{rel}: {n_h1} etiquetas h1")

    # imagenes: minimo 6 por pagina de contenido, todas con alt
    if rel != "404.html":
        imgs = re.findall(r"<img\b[^>]*>", html)
        if len(imgs) < 6 and "aviso" not in rel and "politica" not in rel:
            warns.append(f"{rel}: solo {len(imgs)} <img>")
        for im in imgs:
            if 'alt="' not in im:
                errors.append(f"{rel}: img sin alt -> {im[:80]}")

    # emojis prohibidos
    if re.search(r"[\U0001F300-\U0001FAFF☀-➿]", html):
        errors.append(f"{rel}: contiene emoji")

print(f"Paginas analizadas: {len(pages)}")
print(f"\nERRORES ({len(errors)}):")
for e in errors:
    print(" -", e)
print(f"\nAVISOS ({len(warns)}):")
for w in warns:
    print(" -", w)
