// Reuse one phone model's mockups for look-alike models (same back, only the size differs: Edge 70 Fusion -> Fusion+).
//   node scripts/mockups/alias_model.cjs "Brand|Source model" "Brand|Alias model" ["Brand|Another alias" ...] [--go]
// Names match the site's supportedModels loosely (case, spaces, "(5G)" ignored). Without --go it only reports.
// For every mockup of the source it writes the alias's mockups doc with the SAME file (no copy on R2), marked
// aliasOf = source model id. Uploading real mockups for the alias later simply overwrites these docs.
const path = require("path");
const F = path.join(__dirname, "../../functions");
const admin = require(F + "/node_modules/firebase-admin");
admin.initializeApp({ projectId: "skinly-3003b" });
const db = admin.firestore();

const args = process.argv.slice(2);
const GO = args.includes("--go");
const names = args.filter((a) => a !== "--go");
if (names.length < 2) { console.error('usage: node scripts/mockups/alias_model.cjs "Brand|Source" "Brand|Alias" [...] [--go]'); process.exit(1); }
const norm = (s) => String(s || "").toLowerCase().replace(/\+/g, "plus").replace(/\(5g\)|\b5g\b/g, "").replace(/[^a-z0-9]/g, "");

(async () => {
  const models = [];
  (await db.collection("supportedModels").where("category", "==", "phone").get()).forEach((d) => {
    const x = d.data(); if (x.isActive === false) return;
    models.push({ id: d.id, brand: x.brandName, model: x.modelName, key: norm(x.brandName) + "|" + norm(x.modelName) });
  });
  const resolve = (name) => {
    const [b, m] = name.split("|"); if (!m) return null;
    return models.find((x) => x.key === norm(b) + "|" + norm(m)) || models.find((x) => x.key === norm(b) + "|" + norm(b) + norm(m)) || null;
  };
  const src = resolve(names[0]);
  if (!src) { console.error("source model not found on the site:", names[0]); process.exit(1); }
  const srcDocs = (await db.collection("mockups").where("supportedModelId", "==", src.id).get()).docs.map((d) => d.data());
  console.log(`source ${src.brand} / ${src.model}: ${srcDocs.length} mockups`);
  if (!srcDocs.length) process.exit(1);

  for (const name of names.slice(1)) {
    const alias = resolve(name);
    if (!alias) { console.log(`SKIP ${name}: not found on the site (add it at /backend-skinly/models)`); continue; }
    if (alias.id === src.id) { console.log(`SKIP ${name}: same model as the source`); continue; }
    const existing = new Map();
    (await db.collection("mockups").where("supportedModelId", "==", alias.id).get()).forEach((d) => existing.set(String(d.get("sku")).toUpperCase(), { ref: d.ref, aliasOf: d.get("aliasOf") }));
    const own = [...existing.values()].filter((e) => !e.aliasOf).length;
    console.log(`alias  ${alias.brand} / ${alias.model}: has ${existing.size} mockups (${own} of its own) -> will write ${srcDocs.length} from the source${own ? ", keeping its own" : ""}`);
    if (!GO) continue;
    let written = 0;
    for (let i = 0; i < srcDocs.length; i += 400) {
      const batch = db.batch();
      for (const m of srcDocs.slice(i, i + 400)) {
        const sku = String(m.sku).toUpperCase();
        const cur = existing.get(sku);
        if (cur && !cur.aliasOf) continue;  // the alias has a real mockup of this design: leave it
        const data = { brand: alias.brand, model: alias.model, sku: m.sku, supportedModelId: alias.id, r2Key: m.r2Key || null, r2Bucket: m.r2Bucket || null,
          cloudinaryUrl: m.cloudinaryUrl || m.r2Url || null, aliasOf: src.id, aliasOfModel: `${src.brand} ${src.model}`, updatedAt: Date.now() };
        if (cur) batch.update(cur.ref, data); else batch.set(db.collection("mockups").doc(), { ...data, createdAt: Date.now(), _creationTime: Date.now() });
        written++;
      }
      await batch.commit();
    }
    console.log(`  wrote ${written} docs for ${alias.brand} / ${alias.model}`);
  }
  if (!GO) console.log("\nDry run. Add --go to write.");
  process.exit(0);
})();
