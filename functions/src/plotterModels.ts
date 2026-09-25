import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Models the cutting software can cut and the website does not list yet.
 *
 * plotterModels holds one row per model found in the plotter's library
 * (Mobicare's Models folder: every -A/-B/-B1/Sides/(Top) part file of a model
 * folded into one), named as the software names it. An admin approves a row
 * from Admin › Models › From plotter — optionally correcting the brand, name
 * or category first — and it becomes a supportedModels row, in the picker at
 * once (the storefront reads models created since its last build).
 *
 * The rows are written by the server only; the rules let admins read them.
 */

const FALLBACK_CATEGORIES = ["phone", "tablet", "laptop", "camera", "lens", "drone", "gimbals", "controller", "console", "charger", "mac-mini", "accessory"];
const tidy = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
/* A row left "approving" this long belongs to a call that died (a timeout): take it again. */
const STALE_CLAIM_MS = 2 * 60_000;

/*
 * Five minutes, not the default one. Each row is a transaction, a brand
 * lookup and two writes; a bulk approval of 60+ rows ran past 60 seconds and
 * the admin saw INTERNAL, with the row in hand left stuck at "approving".
 * The page also sends rows in small batches now, so no call comes near this.
 */
export const approvePlotterModels = functionsV1.runWith({ timeoutSeconds: 300, memory: "512MB" }).https.onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const items: any[] = Array.isArray(data?.items) ? data.items.slice(0, 200) : [];
  if (!items.length) throw new HttpsError("invalid-argument", "Nothing to approve");

  const db = admin.firestore();
  // Whatever gadget types the site has, not a list kept here.
  const gt = await db.collection("gadgetTypes").get();
  const CATEGORIES = new Set(gt.docs.map((d) => String((d.data() as any).name || "")).filter(Boolean));
  if (!CATEGORIES.size) FALLBACK_CATEGORIES.forEach((c) => CATEGORIES.add(c));
  const gadgetIds = new Map<string, string | null>();
  const gadgetIdFor = async (category: string) => {
    if (!gadgetIds.has(category)) {
      const g = await db.collection("gadgetTypes").where("name", "==", category).limit(1).get();
      gadgetIds.set(category, g.empty ? null : g.docs[0].id);
    }
    return gadgetIds.get(category) || null;
  };

  // One lookup per brand per call, kept up to date with what this call adds.
  const brandModels = new Map<string, { id: string; ref: admin.firestore.DocumentReference; data: any }[]>();
  const modelsOf = async (brandName: string) => {
    if (!brandModels.has(brandName)) {
      const snap = await db.collection("supportedModels").where("brandName", "==", brandName).get();
      brandModels.set(brandName, snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() })));
    }
    return brandModels.get(brandName)!;
  };

  const out = { added: 0, alreadyListed: 0, errors: [] as string[] };
  for (const it of items) {
    const id = String(it?.id || "");
    try {
      const ref = db.collection("plotterModels").doc(id);
      if (!id) throw new Error("not found");
      /*
       * Claimed first, in a transaction. Two approvals of one row landing in
       * the same second (a double click, a second tab) both saw "pending" and
       * each created the model: seven were listed twice on 25 Sep.
       */
      const row = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("not found");
        const r = snap.data() as any;
        if (r.status === "approved") return null;
        if (r.status === "approving" && Date.now() - Number(r.approvingAt || 0) < STALE_CLAIM_MS) return null;
        tx.update(ref, { status: "approving", approvingAt: Date.now() });
        return r;
      });
      if (!row) { out.alreadyListed++; continue; }
      try {
        const brandName = tidy(it.brandName ?? row.brand);
        const modelName = tidy(it.modelName ?? row.model);
        const category = tidy(it.category ?? row.category).toLowerCase();
        if (!brandName || !modelName) throw new Error("brand and model are needed");
        if (!CATEGORIES.has(category)) throw new Error(`unknown category "${category}"`);

        // Already on the site under this brand, spaced or cased differently?
        // (A row taken back from a dead call may have got this far: it finds its own model here.)
        const sameBrand = await modelsOf(brandName);
        const existing = sameBrand.find((d) =>
          tidy(d.data.modelName).toLowerCase() === modelName.toLowerCase() && !d.data.mergedInto);

        let supportedModelId: string;
        if (existing) {
          if (existing.data.isActive === false) { await existing.ref.update({ isActive: true }); existing.data.isActive = true; }
          supportedModelId = existing.id;
          out.alreadyListed++;
        } else {
          const gadgetTypeId = await gadgetIdFor(category);
          const now = Date.now();
          const doc = {
            brandName, modelName, category, isActive: true, source: "plotter",
            createdAt: now, _creationTime: now,
            ...(gadgetTypeId ? { gadgetTypeId } : {}),
          };
          const created = await db.collection("supportedModels").add(doc);
          sameBrand.push({ id: created.id, ref: created, data: doc });
          supportedModelId = created.id;
          out.added++;
        }
        await ref.update({
          status: "approved", approvedAt: Date.now(), approvedBy: uid, supportedModelId,
          approvingAt: admin.firestore.FieldValue.delete(),
          approvedAs: { brandName, modelName, category },
        });
      } catch (e) {
        await ref.update({ status: "pending", approvingAt: admin.firestore.FieldValue.delete() });   // let it be tried again
        throw e;
      }
    } catch (e: any) {
      out.errors.push(`${id}: ${e?.message || "failed"}`);
    }
  }
  console.log("approvePlotterModels", out);
  return out;
});

export const rejectPlotterModels = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const ids: string[] = Array.isArray(data?.ids) ? data.ids.map(String).slice(0, 500) : [];
  const status = data?.undo ? "pending" : "rejected";
  const db = admin.firestore();
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + 400)) {
      batch.update(db.collection("plotterModels").doc(id), status === "rejected"
        ? { status, rejectedAt: Date.now(), rejectedBy: uid }
        : { status, rejectedAt: admin.firestore.FieldValue.delete(), rejectedBy: admin.firestore.FieldValue.delete() });
    }
    await batch.commit();
  }
  return { updated: ids.length };
});
