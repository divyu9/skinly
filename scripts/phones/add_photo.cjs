// Add a phone's official back photo for its model page hero.
//   node scripts/phones/add_photo.cjs "<image url or local file>" "<Brand>" "<Model>"
// Brand and Model must be exactly as on the site (supportedModels brandName / modelName,
// the same text the page's data uses). Downloads the image, puts it on white, trims the
// margins, scales to 900px tall with a little air, writes public/phones/<slug>.webp and
// adds "Brand|Model" to public/phones/manifest.json. Prints the output path so the
// result can be looked at before it ships.
// Any public source the owner accepts (9 Nov 2026): exact model, back view, no watermark, case or other shop's logo.
const fs = require("fs"), path = require("path");
const sharp = require(path.join(__dirname, "../../functions/node_modules/sharp"));

const [url, brand, model] = process.argv.slice(2);
if (!url || !brand || !model) {
  console.error('usage: node scripts/phones/add_photo.cjs "<image url>" "<Brand>" "<Model>"');
  process.exit(1);
}
const DIR = path.join(__dirname, "../../public/phones");
const slug = `${brand} ${model}`.toLowerCase().replace(/\(.*?\)/g, (m) => m.replace(/[()]/g, "")).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

(async () => {
  // A URL, or a local file (a back cropped out of a front+back image first).
  let buf;
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh) GoSkinly phone photo" } });
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    buf = fs.readFileSync(url.replace(/^file:\/\//, ""));
  }
  const trimmed = await sharp(buf).flatten({ background: "#ffffff" }).trim({ threshold: 12 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  if (!meta.width || !meta.height || meta.height < 300) throw new Error(`image too small after trim: ${meta.width}x${meta.height}`);
  const body = await sharp(trimmed).resize({ height: Math.min(900, meta.height) }).toBuffer();
  const bm = await sharp(body).metadata();
  const H = Math.round(bm.height * 1.08), W = Math.max(Math.round(bm.height * 0.62), bm.width + 40);
  fs.mkdirSync(DIR, { recursive: true });
  const out = path.join(DIR, `${slug}.webp`);
  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite([{ input: body, gravity: "centre" }])
    .webp({ quality: 82 })
    .toFile(out);
  // Several runs at once (one per brand) share the manifest: take a lock around the read-modify-write.
  const mf = path.join(DIR, "manifest.json"), lock = mf + ".lock";
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(lock); break; } catch {
      if (i > 200) { try { fs.rmdirSync(lock); } catch {} continue; }  // a stale lock (crashed run)
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  try {
    const manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : {};
    manifest[`${brand}|${model}`] = `/phones/${slug}.webp`;
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(mf + ".tmp", JSON.stringify(sorted, null, 2) + "\n");
    fs.renameSync(mf + ".tmp", mf);
  } finally {
    fs.rmdirSync(lock);
  }
  console.log(`${out}  (${Math.round(fs.statSync(out).size / 1024)} KB, ${W}x${H})`);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
