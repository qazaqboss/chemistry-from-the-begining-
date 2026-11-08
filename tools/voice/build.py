# Собрать озвученные фразы в файлы по страницам + audio/voice/index.json
import json, os, re, sys, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import fnv
D = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]  # .../audio/voice
SR = 24000
GAP = int(0.25 * SR)
items = json.load(open(os.path.join(D, "..", "corpus.json")))
def group(src):
    s = src[0]
    s = s[2:] if s.startswith("x:") else s
    if s == "element-cell": return "cells"
    if s == "pop": return "glossary"
    return s
groups = {}
for x in items:
    f = os.path.join(D, "wav", fnv(x["s"]) + ".wav")
    if os.path.exists(f): groups.setdefault(group(x["src"]), []).append((fnv(x["s"]), f))
def trim(a):
    thr = 0.01
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a
    lo = max(0, idx[0] - int(0.04 * SR)); hi = min(len(a), idx[-1] + int(0.12 * SR))
    return a[lo:hi]
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".mp3"): os.remove(os.path.join(OUT, f))
files, mp = [], {}
for g, lst in sorted(groups.items()):
    # большие группы режем на части по ~3 минуты
    parts, cur, curlen = [], [], 0
    for h, f in lst:
        a, sr = sf.read(f, dtype="float32"); a = trim(a)
        if cur and curlen + len(a) > 180 * SR: parts.append(cur); cur, curlen = [], 0
        cur.append((h, a)); curlen += len(a) + GAP
    if cur: parts.append(cur)
    for pi, part in enumerate(parts):
        name = f"{g}{'' if pi == 0 else '-' + str(pi + 1)}.mp3"
        fi = len(files); files.append(name)
        pcm, pos = [np.zeros(GAP // 2, np.float32)], GAP // 2
        for h, a in part:
            mp[h] = [fi, round(pos * 1000 / SR), round(len(a) * 1000 / SR)]
            pcm += [a, np.zeros(GAP, np.float32)]; pos += len(a) + GAP
        wav = os.path.join(D, "tmp.wav"); sf.write(wav, np.concatenate(pcm), SR)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", os.path.join(OUT, name)], check=True)
json.dump({"v": 1, "files": files, "map": mp}, open(os.path.join(OUT, "index.json"), "w"), separators=(",", ":"))
tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in files)
print("files", len(files), "phrases", len(mp), "MB", round(tot / 1e6, 1))
