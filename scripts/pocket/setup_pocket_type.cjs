// DJI Osmo Pocket as a gadget type of its own (owner, 10 Nov 2026). Run once:
//   node scripts/pocket/setup_pocket_type.cjs
// Creates gadgetTypes "pocket-camera" and its material estimate (15 x 10 cm, a Pocket 4
// handle wrap; measure a real cut and correct it), and moves the DJI Pocket models
// (Pocket, Pocket 2, Pocket 4) from action-camera to it. Safe to run again: it finds what
// is already there. The values it changes are backed up to docs/ first.
const path = require("path"), fs = require("fs");
const admin = require(path.join(__dirname, "../../functions/node_modules/firebase-admin"));
admin.initializeApp({ projectId: "skinly-3003b" });
const db = admin.firestore();

(async () => {
  const now = Date.now();
  const found = (await db.collection("gadgetTypes").where("name", "==", "pocket-camera").get()).docs[0];
  let gtId;
  if (found) { gtId = found.id; console.log("gadget type already there:", gtId); }
  else {
    const r = await db.collection("gadgetTypes").add({ name: "pocket-camera", displayName: "DJI Osmo Pocket", isActive: true, productCount: 0, _creationTime: now });
    gtId = r.id; console.log("gadget type created:", gtId);
  }

  const cons = (await db.collection("gadgetConsumption").where("gadgetTypeId", "==", gtId).get()).docs[0];
  if (cons) console.log("material estimate already there");
  else {
    await db.collection("gadgetConsumption").add({
      categoryName: "DJI Osmo Pocket", gadgetTypeId: gtId, lengthCm: 15, widthCm: 10,
      notes: "Estimate for a Pocket 4 handle wrap (about 150 sq cm) - measure a real cut and update", _creationTime: now,
    });
    console.log("material estimate added: 15 x 10 cm");
  }

  const backup = { gadgetTypeId: gtId, models: {}, plotter: {} };
  const toMove = (await db.collection("supportedModels").where("brandName", "==", "DJI").get()).docs
    .filter((d) => d.get("category") === "action-camera" && /pocket/i.test(String(d.get("modelName") || "")));
  const plot = (await db.collection("plotterModels").get()).docs
    .filter((d) => /osmo\s*pocket/i.test(JSON.stringify([d.get("model"), d.get("modelName")])) && d.get("approvedAs"));
  toMove.forEach((d) => { backup.models[d.id] = { modelName: d.get("modelName"), category: d.get("category"), gadgetTypeId: d.get("gadgetTypeId") }; });
  plot.forEach((d) => { backup.plotter[d.id] = d.get("approvedAs"); });
  const out = path.join(__dirname, "../../docs/pocket-camera-move-backup-2026-11-10.json");
  if (!fs.existsSync(out)) fs.writeFileSync(out, JSON.stringify(backup, null, 1));

  for (const d of toMove) {
    await d.ref.update({ category: "pocket-camera", gadgetTypeId: gtId, updatedAt: now });
    console.log("moved:", d.get("modelName"));
  }
  for (const d of plot) await d.ref.update({ "approvedAs.category": "pocket-camera" });
  console.log(`done: ${toMove.length} models moved, ${plot.length} plotter entries relabelled; backup in docs/`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
