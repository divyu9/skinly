# Meesho phone-skin main images, v4 (7 Nov 2026): 900x1200 (3:4, Meesho's display ratio) so the whole phone
# stays visible, site mockup at 66% height, "For <Brand> <Model>" label on top, one line of product text below.
#   python3 scripts/meesho/skins_v4.py <jobs.json> <out dir>
# jobs.json: [{sku, slug, label, url}], written by the Firestore step; output <out dir>/<SKU>/<slug>.jpg
import io, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFont

JOBS, OUT = sys.argv[1:3]
W, H = 900, 1200
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
F1, F2 = ImageFont.truetype(FONT, 56), ImageFont.truetype(FONT, 40)
SUB = "Precut Back Skin  •  Fits camera & buttons"


def render(job):
    out = os.path.join(OUT, job["sku"], job["slug"] + ".jpg")
    if os.path.exists(out):
        return "skip"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    req = urllib.request.Request(urllib.request.quote(job["url"], safe=":/()"), headers={"User-Agent": "Mozilla/5.0 goskinly-meesho-v4"})
    data = urllib.request.urlopen(req, timeout=60).read()
    src = Image.open(io.BytesIO(data)).convert("RGB")
    a = np.array(src.convert("L"))
    rows = np.where((a < 245).any(axis=1))[0]
    cols = np.where((a < 245).any(axis=0))[0]
    phone = src.crop((max(cols.min() - 10, 0), max(rows.min() - 10, 0), min(cols.max() + 10, src.width), min(rows.max() + 10, src.height)))
    canvas = Image.new("RGB", (W, H), "white")
    ph = int(H * 0.66)
    pw = int(phone.width * ph / phone.height)
    if pw > W - 80:  # very wide crop (landscape mockup) — fit by width instead
        pw = W - 80
        ph = int(phone.height * pw / phone.width)
    phone = phone.resize((pw, ph), Image.LANCZOS)
    canvas.paste(phone, ((W - pw) // 2, 250 + (int(H * 0.66) - ph) // 2))
    d = ImageDraw.Draw(canvas)
    f1 = F1
    while d.textlength(job["label"], font=f1) > W - 120:
        f1 = ImageFont.truetype(FONT, f1.size - 4)
    w = d.textlength(job["label"], font=f1)
    x, y = (W - w) / 2, 90 + (56 - f1.size) // 2
    d.rounded_rectangle((x - 36, y - 16, x + w + 36, y + f1.size + 18), radius=26, fill="#FFD400", outline="#111", width=5)
    d.text((x, y), job["label"], font=f1, fill="#111")
    w2 = d.textlength(SUB, font=F2)
    d.text(((W - w2) / 2, 1100), SUB, font=F2, fill="#333")
    canvas.save(out, quality=90, optimize=True)
    return "ok"


jobs = json.load(open(JOBS))
done = fail = 0
with ThreadPoolExecutor(8) as ex:
    futs = {ex.submit(render, j): j for j in jobs}
    from concurrent.futures import as_completed
    for n, f in enumerate(as_completed(futs), 1):
        j = futs[f]
        try:
            f.result(); done += 1
        except Exception as e:
            fail += 1
            print("FAIL", j["sku"], j["slug"], e, flush=True)
        if n % 500 == 0:
            print(f"{n}/{len(jobs)} done, {fail} failed", flush=True)
print(f"finished: {done} ok, {fail} failed", flush=True)
