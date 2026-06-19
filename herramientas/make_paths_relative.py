#!/usr/bin/env python3
"""Convierte rutas absolutas (/assets, /es, /favicon...) en rutas relativas
según la profundidad de cada HTML, para que el sitio funcione tanto en la raíz
de un dominio (Netlify) como en un subdirectorio (GitHub Pages).

Solo toca atributos de ruta (href/src/content/poster/action/srcset) cuyo valor
empiece por una sola "/". Deja intactas las URLs absolutas (https://, //cdn),
los anclas (#...), tel:, mailto: y data: .

Idempotente: si una ruta ya es relativa, no la vuelve a tocar.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Carpetas que NO forman parte del sitio publicado.
SKIP_DIRS = {".git", ".build-check", "docs", "contenido-scrapeado",
             "__pycache__", "herramientas", "assets", "node_modules", "i18n"}

# Atributos que contienen rutas.
ATTR = r"(?:href|src|poster|action|content|srcset)"
# Captura: attr="  / (no otra barra) resto "
ABS_RE = re.compile(r'(' + ATTR + r'\s*=\s*")/(?!/)([^"]*)"')


def rel_prefix(html_path):
    """Devuelve el prefijo relativo ('', '../', '../../', ...) que lleva desde
    la carpeta del archivo hasta la raíz del sitio."""
    rel = os.path.relpath(html_path, ROOT).replace("\\", "/")
    depth = rel.count("/")  # nº de carpetas por encima del archivo
    return "../" * depth if depth else "./"


def convert(html_path):
    prefix = rel_prefix(html_path)
    with open(html_path, "r", encoding="utf-8") as fh:
        text = fh.read()

    def repl(m):
        attr_eq, path = m.group(1), m.group(2)
        # path es lo que va tras la "/" inicial; "" sería href="/" (raíz del sitio)
        return f'{attr_eq}{prefix}{path}"'

    new_text = ABS_RE.sub(repl, text)
    if new_text != text:
        with open(html_path, "w", encoding="utf-8") as fh:
            fh.write(new_text)
        return True
    return False


def iter_html():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".html"):
                yield os.path.join(dirpath, name)


def main():
    changed = 0
    total = 0
    for path in iter_html():
        total += 1
        if convert(path):
            changed += 1
            rel = os.path.relpath(path, ROOT).replace("\\", "/")
            print(f"  [ok] {rel}  (prefijo: {rel_prefix(path)})")
    print(f"\n{changed}/{total} archivos HTML modificados.")


if __name__ == "__main__":
    main()
