# Meesho inventory sheet: set stock 0 for out-of-stock designs.
#   python3 scripts/meesho/inventory_zero.py <latest.xlsx> <out.xlsx> M-16 [L-358 ...]
# Column F = SKU id (GS5-M-16-<model>), column K = "Edit this" (new stock). Rows from row 3.
import openpyxl, re, sys
src, dst, codes = sys.argv[1], sys.argv[2], sys.argv[3:]
wb = openpyxl.load_workbook(src)
ws = wb["Inventory-Update-Data-Fill This"] if "Inventory-Update-Data-Fill This" in wb.sheetnames else wb.worksheets[0]
for code in codes:
    p, n = re.match(r"([A-Z]+)-?0*(\d+)", code.upper()).groups()
    rx = re.compile(rf"(?<![A-Z0-9]){p}-?0*{n}(?![0-9])", re.I)
    hits = []
    for row in ws.iter_rows(min_row=3):
        sid = str(row[5].value or "")
        if rx.search(sid):
            hits.append(sid); row[10].value = 0
    print(f"{code}: {len(hits)} rows", hits[:3])
print("rows at 0 in sheet:", sum(1 for r in ws.iter_rows(min_row=3, values_only=True) if r[10] == 0))
wb.save(dst); print("saved", dst)
