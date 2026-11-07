# Fill Meesho "Skin Stickers" bulk files for phone skins with the v4 images (7 Nov 2026).
#   python3 scripts/meesho/skins_v4_fill.py <template.xlsx> <jobs.json> <names.json> <skus.txt> <out prefix> <brand|nobrand>
# jobs.json: [{sku, finish, name, slug, label, url}] (label = "For Samsung Galaxy A55 5G"); names.json: {sku: Meesho-safe name}
# skus.txt: one SKU per line (which designs to include). Writes <out prefix>-01.xlsx … with 30 designs (Group IDs) per file.
import json, re, sys
import openpyxl

TPL, JOBS, NAMES, SKUS, OUTP, MODE = sys.argv[1:7]
CDN = "https://cdn.goskinly.com/meesho"
COMMON = (f"{CDN}/skins-common/2-how-to-apply.jpg", f"{CDN}/skins-common/3-in-the-box.jpg")
PRICE = {"3D": (99, 94), "Matte": (69, 64)}  # Meesho price, wrong/defective returns price
BRAND_WORDS = re.compile(r"\b(Apple|iPhone|Samsung|Galaxy|Vivo|Oppo|Realme|Motorola|Nothing|CMF|iQOO|Xiaomi|Redmi|Poco|OnePlus|Google|Pixel)\b", re.I)

jobs = json.load(open(JOBS)); names = json.load(open(NAMES))
want = [s.strip() for s in open(SKUS) if s.strip()]
by_sku = {}
for j in jobs:
    by_sku.setdefault(j["sku"], []).append(j)


def model_text(label):
    m = label[4:] if label.startswith("For ") else label
    if MODE == "nobrand":
        m = re.sub(r"\s+", " ", BRAND_WORDS.sub("", m)).strip()
    return m


def row_values(j, group, r):
    fin = "3D" if j["finish"].startswith("3D") else "Matte"
    design = names.get(j["sku"], j["name"])
    model = model_text(j["label"])
    name = f"{'3D ' if fin == '3D' else ''}Mobile Back Skin for {model} – {design} Phone Skin"
    if len(name) > 100: name = name.replace(" Phone Skin", "")
    desc = (f"{design} mobile back skin (phone skin) for {model}, {'3D textured' if fin == '3D' else 'matte'} finish. "
            "Pre-cut for the camera, buttons and ports; bubble-free adhesive for easy fitting; peels off clean without residue. "
            "Free install kit: wet & dry wipes, dust absorber, squeegee and microfiber cloth, plus a QR code for the video tutorial. "
            "This is a skin sticker, not a case or cover.")
    price, ret = PRICE[fin]
    sid = f"GS5-{j['sku']}-{j['slug']}"
    return {"D": name, "E": "Free Size", "G": price, "M": ret, "N": 499, "O": "18", "P": "391990", "Q": 20, "R": 1,
            "S": "India", "T": "Mad House Media (GoSkinly)", "U": "Agra, Uttar Pradesh, India", "V": "282003",
            "W": "Mad House Media (GoSkinly)", "X": "Agra, Uttar Pradesh, India", "Y": "282003",
            "Z": "Not Required", "AA": "Not Required", "AB": "Not Required", "AC": "Skin Stickers", "AD": 1,
            "AE": 1, "AF": 17, "AG": 9,
            "AH": f"{CDN}/skins-v4/{j['sku']}/{j['slug']}.jpg", "AI": f"{CDN}/skins-common/vinyl/{j['sku']}.jpg",
            "AJ": COMMON[0], "AK": COMMON[1], "AL": sid, "AM": sid, "AO": f"Group {group:02d}", "AP": desc, "AQ": "Others",
            "H": f'=IF(ISBLANK(G{r}),"",G{r}+I{r})', "I": f'=IF(AND(NOT(ISBLANK(L{r})),(J{r}=AI{r})),L{r},K{r})',
            "K": f'=IFERROR(IF(G{r}>0,74,""),"")'}


files = 0
for fi in range(0, len(want), 30):
    chunk = want[fi:fi + 30]
    wb = openpyxl.load_workbook(TPL)
    ws = [w for w in wb if "Fill" in w.title][0]
    for r in range(5, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            ws.cell(r, c).value = None
    r = 5
    for g, sku in enumerate(chunk, 1):
        for j in sorted(by_sku.get(sku, []), key=lambda x: x["slug"]):
            for col, v in row_values(j, g, r).items():
                ws[f"{col}{r}"] = v
            r += 1
    files += 1
    out = f"{OUTP}-{files:02d}.xlsx"
    wb.save(out)
    print(out, "designs", len(chunk), "rows", r - 5)
