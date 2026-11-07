# Meesho image 2 for phone skins: the "This is a vinyl skin, not a case or cover" card with the design's mockup.
# Same pink-dot sticker look as glass_cards.py. Output <out dir>/<SKU>.jpg (2000x2000).
#   python3 scripts/meesho/skin_vinyl_card.py <designs.json> <names.json> <out dir>
# designs.json: [{sku, ...}]; names.json: {sku: display name}; mockup = the site's Samsung Galaxy S24 (5G) mockup.
import json, os, subprocess, sys, urllib.parse
from PIL import Image

DESIGNS, NAMES, OUT = sys.argv[1:4]
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MOCK = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/mockups/Oppo/Reno 13 (5G)/{sku}.webp"
CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:2000px;height:2000px;overflow:hidden}
body{font-family:"Avenir Next","Helvetica Neue",Arial,sans-serif;color:#16161a;
 background:#ffd9e4 radial-gradient(#f6a9c0 3.5px,transparent 4px) 0 0/34px 34px;padding:80px 90px;display:flex;flex-direction:column;gap:40px}
.tag{align-self:flex-start;background:#ffd23f;border:6px solid #16161a;border-radius:999px;padding:14px 40px;font-weight:900;font-size:50px;box-shadow:8px 8px 0 #16161a}
h1{font-size:132px;line-height:1.0;font-weight:900;letter-spacing:-2px}
h1 em{font-style:normal;color:#1b7462}
.hi{font-family:"Kohinoor Devanagari","Devanagari Sangam MN",sans-serif;font-size:58px;font-weight:700;margin-top:10px}
.row{display:flex;gap:70px;align-items:center;margin-top:30px;flex:1}
.card{background:#fff;border:7px solid #16161a;border-radius:44px;box-shadow:16px 16px 0 #16161a;width:760px;height:1180px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.card img{width:720px;height:720px;object-fit:contain;transform:scale(1.28) translateY(30px);transform-origin:center}
.name{position:absolute;z-index:2;left:36px;top:36px;background:#16161a;color:#fff;border-radius:999px;padding:14px 32px;font-size:40px;font-weight:900;max-width:690px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stick{position:absolute;left:36px;bottom:36px;background:#ffd23f;border:6px solid #16161a;border-radius:28px;padding:16px 30px;font-size:44px;font-weight:900;line-height:1.1;box-shadow:8px 8px 0 #16161a}
ul{list-style:none;display:flex;flex-direction:column;gap:46px;flex:1}
li{display:flex;gap:30px;align-items:flex-start}
.ic{flex:none;width:84px;height:84px;border-radius:50%;background:#28a58b;color:#fff;display:grid;place-items:center;font-size:56px;font-weight:900;margin-top:6px}
.ic.no{background:#e84a5f}
li b{display:block;font-size:62px;font-weight:900;line-height:1.05}
li span{display:block;font-size:40px;font-weight:600;color:#555;margin-top:8px}
"""
HTML = """<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>
<div class="tag">PLEASE NOTE</div>
<h1>This is a <em>vinyl skin</em>,<br>not a case or cover</h1>
<div class="hi">यह स्किन (स्टिकर) है — कवर/केस नहीं</div>
<div class="row">
 <div class="card"><div class="name">{name}</div><img src="{img}"><div class="stick">Sticks directly<br>on the phone</div></div>
 <ul>
  <li><div class="ic">✓</div><div><b>Thin vinyl wrap for the back</b><span>Phone stays slim — no bulk</span></div></li>
  <li><div class="ic">✓</div><div><b>Guards against scratches</b><span>and everyday scuffs</span></div></li>
  <li><div class="ic">✓</div><div><b>Works under a clear case</b><span>Skin + case = custom look</span></div></li>
  <li><div class="ic no">✕</div><div><b>Not drop protection</b><span>Use a case if you need that</span></div></li>
 </ul>
</div></body></html>"""

designs = json.load(open(DESIGNS)); names = json.load(open(NAMES))
os.makedirs(OUT, exist_ok=True)
for d in designs:
    sku = d["sku"]; jpg = os.path.join(OUT, f"{sku}.jpg")
    if os.path.exists(jpg): continue
    img = urllib.parse.quote(MOCK.format(sku=sku), safe=":/()")
    hp = os.path.join(OUT, f"{sku}.html"); png = os.path.join(OUT, f"{sku}.png")
    open(hp, "w").write(HTML.format(css=CSS, name=names.get(sku, d.get("name", sku)), img=img))
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=2000,2000", "--virtual-time-budget=8000", f"--screenshot={png}", f"file://{hp}"], capture_output=True)
    Image.open(png).convert("RGB").save(jpg, quality=88)
    os.remove(png); os.remove(hp)
    print(sku, flush=True)
print("done", len(designs))
