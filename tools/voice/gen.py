# Озвучка фраз гида через OmniVoice (навык VoiceStudio), клон одного эталонного голоса
import json, os, re, sys, time, torch, numpy as np, soundfile as sf
from num2words import num2words
D = os.path.dirname(os.path.abspath(__file__))
REF_TEXT = "Привет! Я твой гид по химии. Сейчас я покажу, что где находится на сайте, и объясню, что всё это означает."

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode("utf-8"):
        h ^= b; h = (h * 0x01000193) & 0xffffffff
    return format(h, "08x")

FR = {1: ("десятая", "десятых"), 2: ("сотая", "сотых"), 3: ("тысячная", "тысячных"), 4: ("десятитысячная", "десятитысячных")}
def fem_int(n):
    w = num2words(n, lang="ru")
    w = re.sub(r"один$", "одна", w); w = re.sub(r"два$", "две", w)
    return w
def plural_idx(n):
    a = n % 100; b = n % 10
    return 2 if 10 < a < 20 else 0 if b == 1 else 1 if 2 <= b <= 4 else 2
def dec(m):
    i, f = m.group(1), m.group(2)
    if len(f) > 4: f = f[:4]
    ip = int(i); fp = int(f)
    cel = ["целая", "целых", "целых"][plural_idx(ip)]
    fr = FR[len(f)][0 if plural_idx(fp) == 0 else 1]
    return f"{fem_int(ip)} {cel} {fem_int(fp)} {fr}"
def norm(s):
    s = re.sub(r"(\d)[\s  ](?=\d{3}\b)", r"\1", s)
    s = re.sub(r"(\d+),(\d+)", dec, s)
    s = re.sub(r"(\d+)\s*[–-]\s*(\d+)", r"\1 — \2", s)
    s = re.sub(r"(\d+)\s*%", lambda m: m.group(1) + " процентов", s)
    return s

def prio(x):
    src = x["src"]
    best = 9
    for s in src:
        e = "element" in s
        if s.startswith("x:home") and not e: p = 0
        elif s in ("home", "course", "lab", "glossary", "pop") or s.startswith("x:") and not e and not s.startswith("x:home"): p = 0
        elif s.startswith("lesson"): p = 1
        elif s.startswith("element"): p = 2
        else: p = 3
        best = min(best, p)
    z = 0
    for s in src:
        m = re.search(r"element-(\d+)", s)
        if m: z = int(m.group(1)); break
    return (best, z)

def main():
    items = json.load(open(os.path.join(D, "corpus.json")))
    items.sort(key=prio)
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 9
    from omnivoice import OmniVoice
    m = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cpu", dtype=torch.bfloat16)
    p = m.create_voice_clone_prompt(ref_audio=os.path.join(D, "ref.wav"), ref_text=REF_TEXT)
    done = 0; t0 = time.time(); chars = 0
    todo = [x for x in items if prio(x)[0] <= limit and not os.path.exists(os.path.join(D, "wav", fnv(x["s"]) + ".wav"))]
    print("todo", len(todo), "chars", sum(len(x["s"]) for x in todo), flush=True)
    for x in todo:
        h = fnv(x["s"]); out = os.path.join(D, "wav", h + ".wav")
        torch.manual_seed(int(h, 16) % 100000)
        a = m.generate(text=norm(x["s"]), language="ru", voice_clone_prompt=p, num_step=16)
        arr = np.asarray(a[0].float().numpy() if hasattr(a[0], "float") else a[0]).squeeze()
        sf.write(out + ".tmp.wav", arr, 24000); os.replace(out + ".tmp.wav", out)
        done += 1; chars += len(x["s"])
        if done % 20 == 0:
            el = time.time() - t0
            print(f"{done}/{len(todo)} {el/60:.1f}min {chars/el:.1f} chars/s", flush=True)
    print("ALL DONE", flush=True)

if __name__ == "__main__":
    main()
