import { onCall, HttpsError } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

/**
 * Admin › Models › Requests: does the site already list what a customer asked
 * for, and approving a request without making a duplicate.
 *
 * Approving matched names exactly, so a request typed the customer's way —
 * "iQOO | IQOO Z7", "Samsung | Samsung galaxy A35", "Motorola | Edge 60 pro" —
 * missed the listed "iQOO | Z7", "Galaxy A35 (5G)", "EDGE 60 PRO 5G" and made
 * a second copy of the phone (30 of 100 pending requests on 3 Oct 2026).
 *
 * Two levels:
 *  - exact: the same model once the brand repeated at the front, spaces and
 *    punctuation are set aside. Approving links the request to that model.
 *  - possible: the same except for a network suffix (4G / 5G). Those can be
 *    different phones (Oppo K10 4G and K10 5G are), so the admin picks:
 *    use the listed one, or add a new model.
 * Approving marks the request approved, which tells the customer
 * (modelRequests.ts, model_added).
 */

const squash = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z0-9+]/g, "");
// Brands whose models customers write with a family word the site leaves in or out.
const BRAND_WORDS: Record<string, string[]> = { samsung: ["samsung"], oneplus: ["oneplus", "one plus"], google: ["google"], apple: ["apple"] };

function modelPart(brand: unknown, model: unknown): string {
  const b = squash(brand);
  let m = String(model || "").toLowerCase().replace(/\s+/g, " ").trim();
  for (const w of [String(brand || "").toLowerCase().trim(), ...(BRAND_WORDS[b] || [])]) {
    if (w && m.startsWith(w + " ")) m = m.slice(w.length + 1);
  }
  return squash(m.replace(/[()]/g, " "));
}
export const exactKey = (brand: unknown, model: unknown) => `${squash(brand)}|${modelPart(brand, model)}`;
export const looseKey = (brand: unknown, model: unknown) =>
  `${squash(brand)}|${modelPart(brand, String(model || "").replace(/\(?\b[45]g\b\)?/gi, " "))}`;

type Live = { id: string; brandName: string; modelName: string; category?: string };
async function liveModels(db: admin.firestore.Firestore): Promise<Live[]> {
  const snap = await db.collection("supportedModels").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((m: any) => m.isActive !== false && !m.mergedInto && m.brandName && m.modelName);
}
function matcher(models: Live[]) {
  const exact = new Map<string, Live>(), loose = new Map<string, Live>();
  for (const m of models) {
    const e = exactKey(m.brandName, m.modelName), l = looseKey(m.brandName, m.modelName);
    if (!exact.has(e)) exact.set(e, m);
    if (!loose.has(l)) loose.set(l, m);
  }
  return (brand: unknown, model: unknown) => {
    const e = exact.get(exactKey(brand, model));
    if (e) return { level: "exact" as const, model: e };
    const l = loose.get(looseKey(brand, model));
    return l ? { level: "possible" as const, model: l } : null;
  };
}

/** For the tags: each pending request that matches a listed model, and how surely. */
export const modelRequestMatches = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();
  const find = matcher(await liveModels(db));
  const pending = await db.collection("modelRequests").where("status", "==", "pending").get();
  const out: Record<string, { level: "exact" | "possible"; modelId: string; label: string }> = {};
  for (const d of pending.docs) {
    const r = d.data() as any;
    const hit = find(r.brandName, r.modelName);
    if (hit) out[d.id] = { level: hit.level, modelId: hit.model.id, label: `${hit.model.brandName} ${hit.model.modelName}` };
  }
  return { matches: out };
});

/**
 * Approve requests. `choices[requestId]` is a supportedModels id to link to,
 * or "new" to add the model; without one, an exact match links and no match
 * adds — a possible match waits for the admin's choice.
 */
export const approveModelRequests = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const ids: string[] = Array.isArray(data?.requestIds) ? data.requestIds.map(String).slice(0, 200) : [];
  const choices: Record<string, string> = data?.choices && typeof data.choices === "object" ? data.choices : {};
  if (!ids.length) throw new HttpsError("invalid-argument", "Pick at least one request");
  const db = admin.firestore();
  const models = await liveModels(db);
  const find = matcher(models);
  let linked = 0, added = 0;
  const errors: string[] = [], needsChoice: string[] = [];

  for (const id of ids) {
    try {
      const ref = db.collection("modelRequests").doc(id);
      const r = (await ref.get()).data() as any;
      if (!r) throw new Error("request not found");
      if (r.status === "approved") continue;
      const brandName = String(r.brandName || r.brand || "").replace(/\s+/g, " ").trim();
      const modelName = String(r.modelName || r.model || "").replace(/\s+/g, " ").trim();
      if (!brandName || !modelName) throw new Error("request has no brand or model");

      const choice = choices[id];
      let modelId = "";
      if (choice && choice !== "new") {
        const m = await db.collection("supportedModels").doc(choice).get();
        if (!m.exists) throw new Error("chosen model not found");
        modelId = m.id;
        if ((m.data() as any).isActive === false) await m.ref.update({ isActive: true });
      } else if (!choice) {
        const hit = find(brandName, modelName);
        if (hit?.level === "possible") { needsChoice.push(`${r.requestNumber || id}: possibly ${hit.model.brandName} ${hit.model.modelName}`); continue; }
        if (hit) modelId = hit.model.id;
      }
      if (modelId) {
        linked++;
      } else {
        // A new model: with its category (the picker filters by it) and gadget type.
        const category = String(r.category || "").trim() || undefined;
        let gadgetTypeId: string | undefined;
        if (category) {
          const g = await db.collection("gadgetTypes").where("name", "==", category).limit(1).get();
          gadgetTypeId = g.empty ? undefined : g.docs[0].id;
        }
        const created = await db.collection("supportedModels").add({
          brandName, modelName, isActive: true, createdAt: Date.now(), _creationTime: Date.now(),
          ...(category ? { category } : {}), ...(gadgetTypeId ? { gadgetTypeId } : {}), source: `request-${r.requestNumber || id}`,
        });
        modelId = created.id;
        models.push({ id: modelId, brandName, modelName, category });
        added++;
      }
      // Approved → the customer is told (modelRequests.ts onUpdate).
      await ref.update({ status: "approved", approvedAt: Date.now(), approvedBy: uid, supportedModelId: modelId });
    } catch (e: any) {
      errors.push(`${id}: ${e?.message || "failed"}`);
    }
  }
  return { successCount: linked + added, linked, added, needsChoice, errors, success: !errors.length && !needsChoice.length };
});
