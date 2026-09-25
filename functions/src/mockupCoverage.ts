import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Which design codes each phone model has a mockup for.
 *
 * Admin › Advanced Mockups needs this for every model at once, and the only
 * way it had was to download the whole mockups collection — 106k documents,
 * three times per visit and again whenever any model changed. Now one small
 * document per model holds its codes (mockupCoverage/{supportedModelId}),
 * kept current as mockups are added and removed, and rebuildable from
 * scratch should it ever drift.
 *
 * Codes are stored upper-case and without a listing's brand suffix, as the
 * mockups are filed (R-44, not R-44-IPH).
 */

const code = (sku: unknown) => String(sku || "").trim().toUpperCase();

async function stillHas(db: admin.firestore.Firestore, modelId: string, sku: string) {
  const s = await db.collection("mockups").where("supportedModelId", "==", modelId).where("sku", "==", sku).limit(1).get();
  return !s.empty;
}

export const onMockupWrite = functionsV1.firestore
  .document("mockups/{id}")
  .onWrite(async (change) => {
    const db = admin.firestore();
    const before = change.before.exists ? (change.before.data() as any) : null;
    const after = change.after.exists ? (change.after.data() as any) : null;
    const was = before?.supportedModelId && code(before.sku) ? { m: String(before.supportedModelId), s: code(before.sku), raw: String(before.sku) } : null;
    const now = after?.supportedModelId && code(after.sku) ? { m: String(after.supportedModelId), s: code(after.sku) } : null;
    if (was && now && was.m === now.m && was.s === now.s) return null;

    if (now) {
      await db.collection("mockupCoverage").doc(now.m).set({
        skus: admin.firestore.FieldValue.arrayUnion(now.s),
        brand: after.brand || "", model: after.model || "", updatedAt: Date.now(),
      }, { merge: true });
    }
    // A code leaves the model only when its last mockup there has gone.
    if (was && !(await stillHas(db, was.m, was.raw))) {
      await db.collection("mockupCoverage").doc(was.m).set({
        skus: admin.firestore.FieldValue.arrayRemove(was.s), updatedAt: Date.now(),
      }, { merge: true });
    }
    return null;
  });

export async function rebuildCoverage(db: admin.firestore.Firestore) {
  const snap = await db.collection("mockups").select("supportedModelId", "sku", "brand", "model").get();
  const by = new Map<string, { skus: Set<string>; brand: string; model: string }>();
  for (const d of snap.docs) {
    const m = d.data() as any;
    if (!m.supportedModelId || !code(m.sku)) continue;
    const row = by.get(m.supportedModelId) || { skus: new Set<string>(), brand: m.brand || "", model: m.model || "" };
    row.skus.add(code(m.sku));
    by.set(m.supportedModelId, row);
  }
  const existing = await db.collection("mockupCoverage").select().get();
  const writes: Array<(b: admin.firestore.WriteBatch) => void> = [];
  for (const [id, row] of by) {
    writes.push((b) => b.set(db.collection("mockupCoverage").doc(id), {
      skus: [...row.skus].sort(), brand: row.brand, model: row.model, updatedAt: Date.now(),
    }));
  }
  for (const d of existing.docs) if (!by.has(d.id)) writes.push((b) => b.delete(d.ref));
  // Small batches: each document carries ~300 codes, and every one is an index entry.
  for (let i = 0; i < writes.length; i += 50) {
    const batch = db.batch();
    writes.slice(i, i + 50).forEach((w) => w(batch));
    await batch.commit();
  }
  return { mockups: snap.size, models: by.size };
}

export const rebuildMockupCoverage = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
  .https.onCall(async (_data: any, context: any) => {
    await requireAdmin(context);
    return rebuildCoverage(admin.firestore());
  });

/*
 * Deleting a model's mockups, or a design's across every model, runs here:
 * a design can have 300+ rows and the page's single browser batch stopped
 * at 500 writes.
 */
export const deleteMockups = functionsV1
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();
    const modelId = String(data?.modelId || "");
    const sku = code(data?.sku);
    if (!modelId && !sku) throw new functionsV1.https.HttpsError("invalid-argument", "A model or a SKU is needed");
    let q: admin.firestore.Query = db.collection("mockups");
    if (modelId) q = q.where("supportedModelId", "==", modelId);
    if (sku) q = q.where("sku", "==", sku);
    const snap = await q.select().get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return { deleted: snap.size };
  });
