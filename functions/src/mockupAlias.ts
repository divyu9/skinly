import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * "Same as": one phone model shows another model's mockups.
 *
 * Many phones look identical from the back and differ only in size (Edge 70
 * Fusion and Fusion+, S25 and S25 Plus). The admin links the look-alike to
 * the model that has the pictures; every mockup of the source is written as
 * the alias's own mockups doc pointing at the same file on R2 (nothing is
 * copied), marked aliasOf. The shop cannot tell the difference: it looks up
 * mockups by brand + model as always, so the badge names the alias. Coverage
 * follows through the usual trigger. Uploading real mockups for the alias
 * later overwrites these docs; "unlink" deletes only the aliased ones.
 */
export const aliasMockups = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();
    const aliasId = String(data?.aliasId || "");
    const sourceId = String(data?.sourceId || "");
    const remove = !!data?.remove;
    if (!aliasId || (!remove && !sourceId)) throw new functionsV1.https.HttpsError("invalid-argument", "aliasId and sourceId are needed");
    if (aliasId === sourceId) throw new functionsV1.https.HttpsError("invalid-argument", "A model cannot be an alias of itself");

    const alias = await db.collection("supportedModels").doc(aliasId).get();
    if (!alias.exists) throw new functionsV1.https.HttpsError("not-found", "Alias model not found");
    const existing = new Map<string, { ref: admin.firestore.DocumentReference; aliasOf: string | null }>();
    (await db.collection("mockups").where("supportedModelId", "==", aliasId).get()).forEach((d) =>
      existing.set(String(d.get("sku") || "").toUpperCase(), { ref: d.ref, aliasOf: d.get("aliasOf") || null }));

    if (remove) {
      const gone = [...existing.values()].filter((e) => e.aliasOf);
      for (let i = 0; i < gone.length; i += 400) {
        const batch = db.batch();
        gone.slice(i, i + 400).forEach((e) => batch.delete(e.ref));
        await batch.commit();
      }
      await db.collection("mockupCoverage").doc(aliasId).set({ aliasOf: admin.firestore.FieldValue.delete(), aliasOfModel: admin.firestore.FieldValue.delete(), updatedAt: Date.now() }, { merge: true });
      return { removed: gone.length };
    }

    const source = await db.collection("supportedModels").doc(sourceId).get();
    if (!source.exists) throw new functionsV1.https.HttpsError("not-found", "Source model not found");
    if (source.get("brandName") !== alias.get("brandName")) throw new functionsV1.https.HttpsError("failed-precondition", "Only a model of the same brand can be the source");
    const srcDocs = (await db.collection("mockups").where("supportedModelId", "==", sourceId).get()).docs.map((d) => d.data() as any);
    if (!srcDocs.length) throw new functionsV1.https.HttpsError("failed-precondition", "The source model has no mockups");
    if (srcDocs.some((m) => m.aliasOf)) throw new functionsV1.https.HttpsError("failed-precondition", "The source is itself an alias — link to the original model instead");

    let written = 0, kept = 0;
    const brand = alias.get("brandName"), model = alias.get("modelName");
    for (let i = 0; i < srcDocs.length; i += 400) {
      const batch = db.batch();
      for (const m of srcDocs.slice(i, i + 400)) {
        const sku = String(m.sku || "").toUpperCase();
        const cur = existing.get(sku);
        if (cur && !cur.aliasOf) { kept++; continue; }  // the alias has a real mockup of this design: keep it
        const doc = { brand, model, sku: m.sku, supportedModelId: aliasId, r2Key: m.r2Key || null, r2Bucket: m.r2Bucket || null,
          cloudinaryUrl: m.cloudinaryUrl || m.r2Url || null, aliasOf: sourceId, aliasOfModel: `${source.get("brandName")} ${source.get("modelName")}`, updatedAt: Date.now() };
        if (cur) batch.update(cur.ref, doc); else batch.set(db.collection("mockups").doc(), { ...doc, createdAt: Date.now(), _creationTime: Date.now() });
        written++;
      }
      await batch.commit();
    }
    await db.collection("mockupCoverage").doc(aliasId).set({ aliasOf: sourceId, aliasOfModel: `${source.get("brandName")} ${source.get("modelName")}`, brand, model, updatedAt: Date.now() }, { merge: true });
    return { written, kept };
  });
