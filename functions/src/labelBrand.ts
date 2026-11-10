import * as path from "path";
import * as fs from "fs";

/**
 * Our logo and the courier's on a Shipmozo label.
 *
 * Shipmozo hands back a plain PNG: no shop logo, no courier mark (owner,
 * 10 Nov 2026). This adds a white header band with the Skinly logo across the
 * top, and the courier's logo (Delhivery, Blue Dart, DTDC: the three Shipmozo
 * uses for us) in the right column's empty space above the "Courier:" line and
 * AWB barcode. The barcode is found in the image itself, so a
 * different label size still works; when it cannot be found the courier logo
 * goes into the header instead. Anything going wrong returns the label as it
 * came: a plain label beats no label.
 */

const ASSETS = path.join(__dirname, "..", "assets");
const COURIERS: Array<[RegExp, string]> = [
  [/delhivery/i, "delhivery.png"],
  [/blue\s*dart/i, "bluedart.png"],
  [/dtdc/i, "dtdc.png"],
];

function courierLogoFile(courierName: string): string | null {
  const hit = COURIERS.find(([re]) => re.test(courierName || ""));
  if (!hit) return null;
  const file = path.join(ASSETS, "couriers", hit[1]);
  return fs.existsSync(file) ? file : null;
}

/**
 * The bottom of the order-id barcode's block in the right half (barcode plus
 * the "Reference ID" line under it), and how much white space follows it
 * before anything else is printed there. Rows are read as dark-pixel counts
 * and dark/light switches: a barcode row switches many times.
 */
function findSlot(gray: Buffer, w: number, h: number) {
  const x0 = Math.floor(w * 0.5), x1 = w - Math.floor(w * 0.03);
  const dark = (x: number, y: number) => gray[y * w + x] < 110;
  const switches: number[] = [], ink: number[] = [];
  for (let y = 0; y < h; y++) {
    let s = 0, n = 0, prev = false;
    for (let x = x0; x < x1; x++) { const d = dark(x, y); if (d) n++; if (d !== prev) s++; prev = d; }
    switches.push(s); ink.push(n);
  }
  // Runs of barcode rows (many switches), at least 1.5% of the height tall.
  const minRun = Math.max(8, Math.round(h * 0.015));
  const bars: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    if (switches[y] < 30) continue;
    let e = y; while (e + 1 < h && switches[e + 1] >= 30) e++;
    if (e - y + 1 >= minRun) bars.push([y, e]);
    y = e;
  }
  if (!bars.length) return null;
  // Above the first barcode (the AWB): its "Courier: …" line, and above that
  // the white space beside the address. The logo sits at the bottom of that
  // space, just over the courier line (owner, 10 Nov 2026).
  const first = bars[0];
  const gap = Math.max(12, Math.round(h * 0.018));
  const blank = (yy: number) => ink[yy] === 0;
  let y = first[0] - 1;
  while (y > 0 && blank(y)) y--;            // white between the courier line and the barcode
  while (y > 0 && !blank(y)) y--;           // the "Courier: …" line
  const bottom = y - gap;
  let topY = bottom; while (topY > 0 && blank(topY)) topY--;
  const room = bottom - topY - gap;
  if (room < h * 0.04) return null;
  const height = Math.min(room, Math.round(h * 0.07));
  // Line the logo up with the barcode's left edge, as the text under it is.
  let edge = x1;
  for (let yy = first[0]; yy <= first[1]; yy++) for (let x = x0; x < edge; x++) if (dark(x, yy)) { edge = x; break; }
  const left = edge < x1 ? edge : x0;
  return { top: bottom - height, room: height, left, width: x1 - left };
}

export async function brandShipmozoLabel(dataUrl: string, courierName: string): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    const src = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const base = sharp(src).flatten({ background: "#ffffff" });
    const meta = await base.metadata();
    const w = meta.width || 0, h = meta.height || 0;
    if (!w || !h) return dataUrl;
    const label = await base.png().toBuffer();
    const layers: any[] = [];

    // Courier logo under the order-id barcode, scaled into the empty slot.
    const courierFile = courierLogoFile(courierName);
    let courierInHeader = false;
    if (courierFile) {
      const gray = await sharp(label).greyscale().raw().toBuffer();
      const slot = findSlot(gray, w, h);
      if (slot) {
        const maxH = slot.room;
        const logo = await sharp(courierFile).resize({ width: Math.round(slot.width * 0.62), height: maxH, fit: "inside" }).png().toBuffer();
        const lm = await sharp(logo).metadata();
        layers.push({ input: logo, top: slot.top + Math.max(0, slot.room - (lm.height || 0)), left: slot.left });
      } else {
        courierInHeader = true;
      }
    }

    // Header band: our logo, wide, across the top.
    const band = Math.round(w * 0.16);
    const ours = await sharp(path.join(ASSETS, "skinly-logo.png"))
      .resize({ width: Math.round(w * (courierInHeader ? 0.4 : 0.5)), height: Math.round(band * 0.82), fit: "inside" }).png().toBuffer();
    const om = await sharp(ours).metadata();
    const headerLayers: any[] = [{
      input: ours,
      top: Math.round((band - (om.height || 0)) / 2),
      left: courierInHeader ? Math.round(w * 0.05) : Math.round((w - (om.width || 0)) / 2),
    }];
    if (courierInHeader && courierFile) {
      const cl = await sharp(courierFile).resize({ width: Math.round(w * 0.35), height: Math.round(band * 0.6), fit: "inside" }).png().toBuffer();
      const cm = await sharp(cl).metadata();
      headerLayers.push({ input: cl, top: Math.round((band - (cm.height || 0)) / 2), left: w - Math.round(w * 0.05) - (cm.width || 0) });
    }
    // A rule under the header so it reads as part of the label.
    const rule = Math.max(2, Math.round(w * 0.003));
    headerLayers.push({ input: { create: { width: Math.round(w * 0.92), height: rule, channels: 3, background: "#111111" } }, top: band - rule, left: Math.round(w * 0.04) });

    const withCourier = layers.length ? await sharp(label).composite(layers).png().toBuffer() : label;
    const out = await sharp({ create: { width: w, height: h + band, channels: 3, background: "#ffffff" } })
      .composite([...headerLayers, { input: withCourier, top: band, left: 0 }])
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString("base64")}`;
  } catch (e: any) {
    console.error("[labelBrand] left the label as it came:", e?.message || e);
    return dataUrl;
  }
}
