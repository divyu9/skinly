// OnePlus Nord CE: two fixes (owner, 12 Nov 2026). Run once:
//   node scripts/mockups/fix_nord_ce5.cjs           # dry run
//   node scripts/mockups/fix_nord_ce5.cjs --write
// 1. "Nord CE 5G" (the 2021 phone) shows Nord CE5 (2025) pictures: every mockup of it is
//    byte-for-byte the CE5 5G file. Those mockup docs are removed (only the ones that match
//    the CE5 file), so the shop stops showing a wrong phone until real CE 5G mockups exist.
// 2. "Nord CE 5" is a second entry for the Nord CE5 5G: it is switched off and marked
//    mergedInto the CE5 5G; its page redirects there (public/.htaccess).
// Everything changed is written to docs/ first.
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const admin = require(path.join(__dirname, "../../functions/node_modules/firebase-admin"));
admin.initializeApp({ projectId: "skinly-3003b" });
const db = admin.firestore();
const WRITE = process.argv.includes("--write");
const CE5G = "ks7cb74t76qv6faddh1jjdgc0s7w8fz8";   // Nord CE 5G (2021)
const CE5 = "ks7fdgb2tp598d231jd5kb1gks7w9yv1";    // Nord CE5 5G (2025), the one kept
const DUP = "ks771khkbgm2ajrxmyj923pbpd7x3xjg";    // "Nord CE 5", duplicate of CE5 5G

const hash = async (u) => {
  const r = await fetch(encodeURI(u));
  if (!r.ok) return `http-${r.status}`;
  return crypto.createHash("md5").update(Buffer.from(await r.arrayBuffer())).digest("hex");
};

(async () => {
  const wrong = (await db.collection("mockups").where("supportedModelId", "==", CE5G).get()).docs;
  const ce5 = new Map((await db.collection("mockups").where("supportedModelId", "==", CE5).get()).docs.map((d) => [d.get("sku"), d.get("cloudinaryUrl")]));
  const remove = [], keep = [];
  for (let i = 0; i < wrong.length; i += 12) {
    await Promise.all(wrong.slice(i, i + 12).map(async (d) => {
      const other = ce5.get(d.get("sku"));
      const same = other && (await hash(d.get("cloudinaryUrl"))) === (await hash(other));
      (same ? remove : keep).push(d);
    }));
  }
  console.log(`Nord CE 5G mockups: ${wrong.length}; CE5 copies to remove: ${remove.length}; different (kept): ${keep.length}`);
  keep.slice(0, 5).forEach((d) => console.log("  kept:", d.get("sku")));
  const dup = await db.collection("supportedModels").doc(DUP).get();
  console.log(`"${dup.get("modelName")}" -> off, mergedInto Nord CE5 5G (isActive now ${dup.get("isActive")})`);
  if (!WRITE) { console.log("dry run. Add --write to apply."); return; }

  const out = path.join(__dirname, "../../docs/nord-ce5-fix-backup-2026-11-12.json");
  fs.writeFileSync(out, JSON.stringify({
    removedMockups: remove.map((d) => ({ id: d.id, ...d.data() })),
    duplicateModel: { id: DUP, isActive: dup.get("isActive") ?? null, mergedInto: dup.get("mergedInto") ?? null },
  }));
  for (let i = 0; i < remove.length; i += 400) {
    const b = db.batch();
    remove.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  await dup.ref.update({ isActive: false, mergedInto: CE5, duplicateOf: CE5, updatedAt: Date.now() });
  console.log(`done: ${remove.length} wrong mockups removed, "Nord CE 5" merged; backup ${path.relative(process.cwd(), out)}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
