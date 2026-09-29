import sharp from "sharp";
import { putR2Object, r2PublicUrl } from "./r2";

/**
 * The picture at the top of an order's WhatsApp message.
 *
 * WhatsApp takes one image per template header, as a public JPEG or PNG — not
 * the WebP the store serves — so every header is re-encoded here and put on
 * the CDN. Several products become one collage (two side by side, three or
 * four in a grid, a "+N" corner past four) rather than showing only the first.
 *
 * Keyed by order, so each order's picture overwrites its own file rather than
 * piling up new ones.
 */

const SIZE = 800;
const FALLBACK = "https://goskinly.com/og-default.jpg";
const BG = { r: 255, g: 250, b: 244, alpha: 1 }; // the site's cream

const usable = (u: unknown) => {
  const s = String(u || "");
  return /^https:\/\//.test(s) && !s.includes("res.cloudinary.com") ? s.replace(/ /g, "%20") : "";
};

async function load(url: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).resize(w, h, { fit: "contain", background: BG }).flatten({ background: BG }).png().toBuffer();
  } catch {
    return null;
  }
}

function plusBadge(extra: number, cell: number): Buffer {
  const r = Math.round(cell * 0.16);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2 + 8}" height="${r * 2 + 8}">` +
    `<circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="#ffd166" stroke="#16161a" stroke-width="4"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${Math.round(r * 0.9)}" fill="#16161a">+${extra}</text></svg>`
  );
}

/** A JPEG on the CDN showing up to four of these products, or the brand header. */
export async function whatsappHeaderImage(key: string, items: any[]): Promise<string> {
  const urls = [...new Set((Array.isArray(items) ? items : []).map((i) => usable(i?.productImage)).filter(Boolean))];
  if (!urls.length) return FALLBACK;
  const objectKey = `whatsapp/${key.replace(/[^\w-]/g, "")}.jpg`;
  try {
    const shown = urls.slice(0, 4);
    const layout = shown.length === 1 ? [[0, 0, SIZE, SIZE]]
      : shown.length === 2 ? [[0, 0, SIZE / 2, SIZE], [SIZE / 2, 0, SIZE / 2, SIZE]]
      : [[0, 0, SIZE / 2, SIZE / 2], [SIZE / 2, 0, SIZE / 2, SIZE / 2], [0, SIZE / 2, SIZE / 2, SIZE / 2], [SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2]];
    const pad = shown.length === 1 ? 0 : 6;
    const tiles = await Promise.all(shown.map((u, i) => load(u, layout[i][2] - pad * 2, layout[i][3] - pad * 2)));
    const layers: sharp.OverlayOptions[] = [];
    tiles.forEach((t, i) => { if (t) layers.push({ input: t, left: layout[i][0] + pad, top: layout[i][1] + pad }); });
    if (!layers.length) return FALLBACK;
    const extra = urls.length - shown.length;
    if (extra > 0) layers.push({ input: plusBadge(extra, SIZE / 2), left: SIZE - Math.round(SIZE * 0.2), top: SIZE - Math.round(SIZE * 0.2) });
    const jpeg = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BG } })
      .composite(layers).flatten({ background: BG }).jpeg({ quality: 82 }).toBuffer();
    await putR2Object(objectKey, jpeg, "image/jpeg");
    return r2PublicUrl(objectKey);
  } catch (e: any) {
    console.error("whatsappHeaderImage failed", { key, error: e?.message || e });
    return FALLBACK;
  }
}
