// Bulk mockup upload without the browser: does what /backend-skinly/mockups-advanced does, for many models at once.
//   node scripts/mockups/bulk_upload.cjs <parent dir> [--go] [--skip-existing]
// <parent dir> holds one folder per phone model. Folder name = "Brand - Model" (e.g. "Apple - iPhone 16 Pro") or just
// the model name when it is unique across brands. Each file name must contain the design code (L-128, R-44 …).
// Without --go it only reports which folders matched which site model. With --go it converts to WebP (quality 85,
// original size), uploads to R2 at mockups/<Brand>/<Model>/<SKU>.webp and creates/updates the mockups doc
// (brand, model, sku, supportedModelId, r2Key, r2Bucket, cloudinaryUrl) — one doc per model and design.
// Credentials come from functions/.env (never printed); Firestore via ADC.
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "../../functions");
const env = Object.fromEntries(fs.readFileSync(F + "/.env", "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const { S3Client, PutObjectCommand } = require(F + "/node_modules/@aws-sdk/client-s3");
const sharp = require(F + "/node_modules/sharp");
const admin = require(F + "/node_modules/firebase-admin");
admin.initializeApp({ projectId: "skinly-3003b" });
const db = admin.firestore();
const s3 = new S3Client({ region: "auto", endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
const bucket = env.R2_BUCKET_NAME || "skinly";
const publicUrl = (env.R2_PUBLIC_URL || "https://cdn.goskinly.com").replace(/\/$/, "");

const [dir, ...flags] = process.argv.slice(2);
const GO = flags.includes("--go"), SKIP = flags.includes("--skip-existing"), STOCK = flags.includes("--in-stock-only");
// --in-stock-only: precut designs (L/M/A/T…) whose cutoutInventory sheetsAvailable is 0 are never restocked (owner rule),
// so their files are not uploaded. Rolls (R-…) are always uploaded; designs with no inventory row are uploaded too.
if (!dir) { console.error("usage: node scripts/mockups/bulk_upload.cjs <parent dir> [--go] [--skip-existing]"); process.exit(1); }

const norm = (s) => String(s || "").toLowerCase().replace(/\(5g\)|\b5g\b/g, "").replace(/[^a-z0-9]/g, "");
// Same rule as the admin page: the last design code in the file name, _B/_B1 part suffixes dropped.
function skuOf(name) {
  const clean = name.replace(/\.[a-z0-9]+$/i, "").replace(/_B\d*(?=_|$| )/gi, "_");
  const all = [...clean.matchAll(/(?:^|[^A-Za-z0-9])([LMSBFART]-\d+)(?!\d)/gi)];
  return all.length ? all[all.length - 1][1].toUpperCase() : null;
}
const isImg = (f) => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith(".");

(async () => {
  const models = [];
  (await db.collection("supportedModels").where("category", "==", "phone").get()).forEach((d) => {
    const x = d.data(); if (x.isActive === false) return;
    models.push({ id: d.id, brand: x.brandName, model: x.modelName, key: norm(x.brandName) + "|" + norm(x.modelName), mkey: norm(x.modelName) });
  });
  const dead = new Set();
  if (STOCK) {
    (await db.collection("cutoutInventory").get()).forEach((d) => {
      const x = d.data(); const code = String(x.cutoutNumber || "").toUpperCase();
      if (code && !code.startsWith("R-") && Number(x.sheetsAvailable || 0) <= 0) dead.add(code);
    });
    console.log(`--in-stock-only: ${dead.size} precut designs at 0 sheets will be skipped: ${[...dead].sort().join(", ")}\n`);
  }
  const folders = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory() && !f.startsWith("."));
  const plan = [], bad = [];
  // Mockup-software folder names: "SAMSUNG S23 ULTRA 5G - B", "VIVO IQOO 13 5G - B3", "NOTHING CMF PHONE 1 - B".
  const SUBBRAND = { "vivo iqoo": "iQOO", "nothing cmf": "CMF", "xiaomi poco": "Poco", "xiaomi redmi": "Xiaomi" };
  const findModel = (brand, model) => {
    const b = norm(brand), m = norm(model);
    // Exact first (Samsung with the "Galaxy" prefix preferred over duplicate short names), then "+" ↔ "PLUS",
    // then Moto/Phone prefixes and 4G suffix. "Plus" is never dropped (S26 PLUS must not become S26).
    const exact = (c) => models.find((x) => x.key === b + "|" + c);
    const cands = ["galaxy" + m, m, b + m, "moto" + m, m.replace(/^moto/, ""), "phone" + m, m.replace(/^phone/, ""), m + "4g", "galaxy" + m + "4g", m.replace(/4g$/, ""), "galaxy" + m.replace(/4g$/, "")];
    for (const c of cands) { const hit = exact(c); if (hit) return hit; }
    if (/plus$/.test(m)) {
      const p = m.replace(/plus$/, "");  // site stores "+" which norm() strips: Galaxy S26+ -> galaxys26
      const hit = models.find((x) => /\+\s*$/.test(x.model) && (x.key === b + "|galaxy" + p || x.key === b + "|" + p));
      if (hit) return hit;
    }
    return null;
  };
  for (const f of folders) {
    let hit = null;
    const soft = f.match(/^([A-Z]+)\s+(.+?)\s*-\s*[A-Z]*B\d*$/i);  // "<BRAND> <MODEL> - B" (also "- B1", "- LB")
    if (soft) {
      const brand = soft[1], model = soft[2];
      const two = (brand + " " + model.split(" ")[0]).toLowerCase();
      // "VIVO IQOO 13" -> iQOO / 13; "XIAOMI REDMI NOTE 17 PRO" -> Xiaomi / Redmi Note 17 Pro (sub-brand kept in the model name too)
      if (SUBBRAND[two]) hit = findModel(SUBBRAND[two], model.split(" ").slice(1).join(" ")) || findModel(SUBBRAND[two], model);
      if (!hit) hit = findModel(brand, model);
      // No brand in the folder name ("IPHONE 12 MINI - LB"): the whole name as a model, if it is unique across brands.
      if (!hit) { const c = models.filter((x) => x.mkey === norm(brand + " " + model)); if (c.length === 1) hit = c[0]; }
    }
    const m = f.match(/^(.+?)\s*[-_–]\s+(.+)$/);
    if (!hit && m) hit = findModel(m[1], m[2]);
    if (!hit) { const c = models.filter((x) => x.mkey === norm(f)); if (c.length === 1) hit = c[0]; else if (c.length > 1) { bad.push(`${f}: ambiguous (${c.map((x) => x.brand).join(", ")}) — name the folder "Brand - Model"`); continue; } }
    if (!hit) { bad.push(`${f}: no such phone model on the site (add it at /backend-skinly/models or rename the folder)`); continue; }
    const all = fs.readdirSync(path.join(dir, f)).filter(isImg);
    const noCode = all.filter((x) => !skuOf(x));
    const files = all.filter((x) => { const s = skuOf(x); return s && !dead.has(s); });
    plan.push({ folder: f, ...hit, files, noCode, outOfStock: all.length - noCode.length - files.length });
  }
  for (const p of plan) console.log(`${p.folder}  ->  ${p.brand} / ${p.model}  (${p.files.length} files to upload${p.outOfStock ? `, ${p.outOfStock} out-of-stock skipped` : ""}${p.noCode.length ? `, ${p.noCode.length} without a design code: ${p.noCode.slice(0, 3).join(", ")}…` : ""})`);
  for (const b of bad) console.log("SKIP  " + b);
  if (!GO) { console.log(`\nDry run: ${plan.length} models matched, ${bad.length} skipped. Add --go to upload.`); process.exit(0); }

  let total = 0, done = 0, failed = 0, skipped = 0;
  for (const p of plan) {
    const existing = new Map();
    (await db.collection("mockups").where("supportedModelId", "==", p.id).get()).forEach((d) => existing.set(d.get("sku"), d.ref));
    let n = 0, f = 0, s = 0;
    const one = async (file) => {
      const sku = skuOf(file); if (!sku) { f++; return; }
      if (SKIP && existing.has(sku)) { s++; return; }
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const body = await sharp(path.join(dir, p.folder, file)).webp({ quality: 85 }).toBuffer();
          const key = `mockups/${p.brand}/${p.model}/${sku}.webp`;
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp" }));
          const data = { brand: p.brand, model: p.model, sku, supportedModelId: p.id, r2Key: key, r2Bucket: bucket,
            cloudinaryUrl: `${publicUrl}/${key}`, updatedAt: Date.now() };
          if (existing.has(sku)) await existing.get(sku).update(data);
          else { const ref = await db.collection("mockups").add({ ...data, createdAt: Date.now(), _creationTime: Date.now() }); existing.set(sku, ref); }
          n++; return;
        } catch (e) { if (attempt === 3) { f++; console.error(`  fail ${p.folder}/${file}: ${e.message}`); } else await new Promise((r) => setTimeout(r, 1000 * attempt)); }
      }
    };
    for (let i = 0; i < p.files.length; i += 8) await Promise.all(p.files.slice(i, i + 8).map(one));
    total += p.files.length; done += n; failed += f; skipped += s;
    console.log(`${p.brand} / ${p.model}: ${n} uploaded${s ? `, ${s} skipped` : ""}${f ? `, ${f} FAILED` : ""}  (model now has ${existing.size} designs)`);
  }
  console.log(`\nDone: ${done} uploaded, ${skipped} skipped, ${failed} failed of ${total} files in ${plan.length} models.`);
  process.exit(failed ? 1 : 0);
})();
