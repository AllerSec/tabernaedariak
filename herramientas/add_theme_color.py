# -*- coding: utf-8 -*-
"""Inserta meta theme-color tras el viewport en todas las paginas."""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP = {"contenido-scrapeado", ".git"}
META = '<meta name="theme-color" content="#022350">'
ANCHOR = '<meta name="viewport" content="width=device-width, initial-scale=1">'

n = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP]
    for fn in filenames:
        if not fn.endswith(".html"):
            continue
        p = os.path.join(dirpath, fn)
        with open(p, encoding="utf-8") as f:
            s = f.read()
        if META in s or ANCHOR not in s:
            continue
        s = s.replace(ANCHOR, ANCHOR + "\n  " + META, 1)
        with open(p, "w", encoding="utf-8") as f:
            f.write(s)
        n += 1
        print("ok", os.path.relpath(p, ROOT))

print(n, "paginas actualizadas")
