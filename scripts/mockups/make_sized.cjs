// Ready-made sizes, made once for every picture already in R2 (mockups, real photos, reviews, banners …).
//   node scripts/mockups/make_sized.cjs            dry run: how many are missing
//   node scripts/mockups/make_sized.cjs --go       make them (re-runnable: skips ones already made)
//   options: --limit N (first N only, to try it), --jobs N (parallel, default 40)
// For each picture <key> it writes sized/<w>/<key> (WebP, quality 75) at 240/480/720/960, and 1600 for
// non-mockups, which the storefront shows instead of Cloudflare's per-request resizing
// (src/lib/image-cdn.ts). A copy older than its original (the picture was redone) is made again.
// Same rules as functions/src/imageSizes.ts, which makes them for every upload from now on.
// Credentials come from functions/.env (never printed).
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "../../functions");
const env = Object.fromEntries(fs.readFileSync(F + "/.env", "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require(F + "/node_modules/@aws-sdk/client-s3");
const sharp = require(F + "/node_modules/sharp");

const { NodeHttpHandler } = require(F + "/node_modules/@smithy/node-http-handler");
const https = require("https");
// Many uploads at once: the SDK's default of 50 sockets would queue them.
const s3 = new S3Client({ region: "auto", endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 256 }) }) });
const bucket = env.R2_BUCKET_NAME || "skinly";
const SIZES = [240, 480, 720, 960, 1600];
const SKIP = /^(sized|backups|resources|ai-mockups-pending|whatsapp|meesho|design-raw|design-pieces|mockup-templates|shot-references|packing)\//;
const isSizable = (key) => /\.(webp|png|jpe?g|avif)$/i.test(key) && !SKIP.test(key);
const widthsFor = (key) => (key.startsWith("mockups/") ? SIZES.slice(0, 4) : SIZES);
const args = process.argv.slice(2);
const GO = args.includes("--go");
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const LIMIT = opt("--limit", Infinity), JOBS = opt("--jobs", 40);

async function list(prefix) {
  const out = new Map();
  let token;
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents || []) out.set(o.Key, o.LastModified ? o.LastModified.getTime() : 0);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
    if (out.size % 20000 < 1000) process.stdout.write(`\r  listing ${prefix} ${out.size}…`);
  } while (token);
  process.stdout.write(`\r  ${prefix}: ${out.size} objects            \n`);
  return out;
}

(async () => {
  const all = await list("");
  const todo = [];
  let pictures = 0;
  for (const [key, mod] of all) {
    if (!isSizable(key)) continue;
    pictures++;
    const stale = widthsFor(key).some((w) => { const t = all.get(`sized/${w}/${key}`); return t === undefined || t < mod; });
    if (stale) todo.push(key);
  }
  // Mockups last: the few hundred pictures elsewhere (banners, real photos) are done in the first minute.
  todo.sort((a, b) => (a.startsWith("mockups/") ? 1 : 0) - (b.startsWith("mockups/") ? 1 : 0));
  console.log(`${pictures} pictures, ${todo.length} need sizes.`);
  if (!GO) { console.log("Dry run. Add --go to make them."); return; }

  const work = todo.slice(0, LIMIT);
  let done = 0, failed = 0;
  const t0 = Date.now();
  const one = async (key) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const original = Buffer.from(await obj.Body.transformToByteArray());
        // All sizes encoded, then uploaded together: the uploads, not the encoding, were the wait.
        const bodies = await Promise.all(widthsFor(key).map(async (w) => [w, await sharp(original, { failOn: "none" }).rotate()
          .resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer()]));
        const cache = /^media-library\//.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=86400, stale-while-revalidate=604800";
        await Promise.all(bodies.map(([w, body]) => s3.send(new PutObjectCommand({ Bucket: bucket, Key: `sized/${w}/${key}`,
          Body: body, ContentType: "image/webp", CacheControl: cache }))));
        done++; return;
      } catch (e) {
        if (attempt === 3) { failed++; console.error(`\n  fail ${key}: ${e.message}`); }
        else await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };
  let next = 0;
  const timer = setInterval(() => {
    const rate = done / Math.max(1, (Date.now() - t0) / 1000);
    const left = Math.round((work.length - done - failed) / Math.max(rate, 0.01) / 60);
    process.stdout.write(`\r  ${done}/${work.length} made, ${failed} failed, ~${left} min left   `);
  }, 5000);
  await Promise.all(Array.from({ length: JOBS }, async () => { while (next < work.length) await one(work[next++]); }));
  clearInterval(timer);
  console.log(`\nDone: ${done} made, ${failed} failed of ${work.length}. Run again to retry any failures.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
