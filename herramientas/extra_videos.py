# -*- coding: utf-8 -*-
"""Videos tematicos extra de Mixkit para heros de categorias."""
import os
import re
import subprocess
import sys

import requests

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"})

JOBS = [
    ("whisky", "whiskey"),
    ("cava", "champagne"),
    ("gin-tonic", "cocktail-drink"),
    ("zumo", "juice"),
    ("agua", "pouring-water"),
    ("sidra", "apple-cider"),
]

VF = "scale='min(1600,iw)':-2"

for slug, term in JOBS:
    out = os.path.join("assets", "videos", slug + ".web.mp4")
    if os.path.exists(out):
        continue
    try:
        r = S.get(f"https://mixkit.co/free-stock-video/{term}/", timeout=30)
        urls = sorted(set(re.findall(
            r"https://assets\.mixkit\.co/videos/\d+/\d+-1080\.mp4", r.text)))
        if not urls:
            print("sin videos:", term, flush=True)
            continue
        v = S.get(urls[0], timeout=180)
        tmp = out + ".src.mp4"
        with open(tmp, "wb") as f:
            f.write(v.content)
        rc = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp, "-t", "14", "-vf", VF,
             "-c:v", "libx264", "-crf", "27", "-preset", "slow",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out],
            capture_output=True)
        os.remove(tmp)
        if rc.returncode == 0:
            subprocess.run(["ffmpeg", "-y", "-ss", "3", "-i", out, "-frames:v", "1",
                            out.replace(".web.mp4", ".frame.jpg")], capture_output=True)
            print(slug, "%.1f MB" % (os.path.getsize(out) / 1e6), flush=True)
        else:
            if os.path.exists(out):
                os.remove(out)
            print("! ffmpeg fallo:", slug, flush=True)
    except Exception as e:
        print("!", slug, e, flush=True)

print("extra videos listos", flush=True)
