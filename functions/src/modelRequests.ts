import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

const COUNTER = "counters/modelRequests";

/**
 * Gives every model request what the admin table needs: a date, a status
 * and a request number.
 *
 * Since the move off Convex the storefront's "request a model" forms write
 * through the generic create, which saves only what the form sent — brand,
 * model, category, phone. The requests arrived with no requestedAt, no
 * requestNumber and no status, so the admin page showed a blank date, a dash
 * for the ID, and no Approve or Reject (those only appear on "pending").
 * Doing it here covers all four forms and any old copy of the site still
 * open in someone's tab, and the number comes from a counter in a
 * transaction, which a visitor's browser could not safely hold.
 */
export const onModelRequestCreated = functionsV1.firestore
  .document("modelRequests/{id}")
  .onCreate(async (snap) => {
    const db = admin.firestore();
    const data = snap.data() || {};
    const patch: Record<string, unknown> = {};
    if (!data.requestedAt) patch.requestedAt = Number(data._creationTime) || snap.createTime.toMillis();
    if (!data.status) patch.status = "pending";
    if (!data.requestNumber) {
      patch.requestNumber = await db.runTransaction(async (tx) => {
        const ref = db.doc(COUNTER);
        const cur = await tx.get(ref);
        const next = (Number(cur.data()?.last) || 0) + 1;
        tx.set(ref, { last: next, updatedAt: Date.now() }, { merge: true });
        return `MR-${next}`;
      });
    }
    if (Object.keys(patch).length) await snap.ref.update(patch);
    return null;
  });
