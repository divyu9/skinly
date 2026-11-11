// Free shipping moved from ₹500 to ₹299 (owner, 10 Nov 2026). The page copy the SEO writer
// and the listing writer saved in Firestore still says "free shipping on orders of ₹500 and
// above" (about 2,800 seoPages, 38 products). This rewrites only that amount, and only in a
// sentence about shipping or delivery where it follows "over / above / of / from"; a design's
// price in the same text is left alone.
//
//   node scripts/shipping/free_shipping_299_copy.cjs          # dry run: counts and examples
//   node scripts/shipping/free_shipping_299_copy.cjs --write  # backs up to docs/, then writes
const path = require("path"), fs = require("fs");
const admin = require(path.join(__dirname, "../../functions/node_modules/firebase-admin"));
admin.initializeApp({ projectId: "skinly-3003b" });
const db = admin.firestore();
const WRITE = process.argv.includes("--write");

const AMOUNT = /\b(over|above|of|from)(\s+)(₹|Rs\.?\s?)\s?(499|500)\b/gi;
function fix(s) {
  // Sentences (and HTML text runs) one at a time, so "ship" must be in the same one.
  return s.split(/(?<=[.!?>])/).map((seg) =>
    /ship|deliver/i.test(seg) ? seg.replace(AMOUNT, (_m, w, sp) => `${w}${sp}₹299`) : seg).join("");
}
function walk(v) {
  if (typeof v === "string") return fix(v);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === "object" && v.constructor === Object) {
    const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o;
  }
  return v;
}

(async () => {
  const backup = {}; const changes = []; const examples = [];
  for (const col of ["seoPages", "products"]) {
    const snap = await db.collection(col).get();
    let n = 0;
    for (const d of snap.docs) {
      const data = d.data(); const upd = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith("_") || /At$/.test(k)) continue;
        const nv = walk(v);
        if (JSON.stringify(nv) !== JSON.stringify(v)) upd[k] = nv;
      }
      if (!Object.keys(upd).length) continue;
      n++; changes.push([d.ref, upd]);
      backup[`${col}/${d.id}`] = Object.fromEntries(Object.keys(upd).map((k) => [k, data[k]]));
      if (examples.length < 4) {
        const k = Object.keys(upd)[0]; const after = JSON.stringify(upd[k]); const i = after.indexOf("₹299");
        examples.push(`${col}/${d.id} ${k}: …${after.slice(Math.max(0, i - 70), i + 20)}…`);
      }
    }
    console.log(`${col}: ${n} documents to update`);
  }
  examples.forEach((e) => console.log("  e.g.", e));
  if (!changes.length) { console.log("nothing to change: the copy already says ₹299"); return; }
  if (!WRITE) { console.log(`dry run: ${changes.length} documents would change. Add --write to apply.`); return; }
  // Old text first, so nothing is written without a way back.
  fs.writeFileSync(path.join(__dirname, "../../docs/free-shipping-299-copy-backup-${Date.now()}.json"), JSON.stringify(backup));
  for (let i = 0; i < changes.length; i += 400) {
    const b = db.batch();
    changes.slice(i, i + 400).forEach(([ref, upd]) => b.update(ref, upd));
    await b.commit();
  }
  console.log(`done: ${changes.length} documents updated; old text backed up in docs/`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
