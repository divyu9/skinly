import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";

/**
 * Whose order (or wallet row) this is, as a sign-in id the rules can check.
 *
 * `userId` cannot be that: on live data it is an auth uid for new orders, a
 * users-document id carried over from the old backend for older ones, a
 * guest session id, or nothing. Rules can only compare a field against the
 * caller, so listing orders was left open to anyone signed in — any Google
 * account could read every customer's name, phone and address. `ownerUid`
 * is the one field that always means "this sign-in", and the rules now let a
 * customer list only the rows carrying their own.
 *
 * Set when the order is placed, when a guest order is claimed, and here for
 * anything written without it (admin-made rows, the older code paths).
 */
export async function resolveOwnerUid(
  db: admin.firestore.Firestore,
  userId: unknown
): Promise<string | null> {
  const id = String(userId || "").trim();
  if (!id || id === "guest" || id.startsWith("guest-")) return null;

  // A users document keyed by the old backend's id names its sign-in in
  // clerkId, or at least its email.
  const userDoc = await db.collection("users").doc(id).get();
  if (userDoc.exists) {
    const u = userDoc.data() as any;
    if (u?.clerkId) {
      try {
        return (await admin.auth().getUser(String(u.clerkId))).uid;
      } catch { /* stale clerkId: fall through to the email */ }
    }
    if (u?.email) {
      try {
        return (await admin.auth().getUserByEmail(String(u.email))).uid;
      } catch { /* no account with that email */ }
    }
  }
  // Otherwise the id may already be the sign-in itself.
  try {
    return (await admin.auth().getUser(id)).uid;
  } catch {
    return null;
  }
}

async function fillOwner(snap: functionsV1.firestore.QueryDocumentSnapshot) {
  const data = snap.data() || {};
  if (data.ownerUid) return;
  const owner = await resolveOwnerUid(admin.firestore(), data.userId);
  if (owner) await snap.ref.update({ ownerUid: owner });
}

export const onOrderOwner = functionsV1.firestore
  .document("orders/{id}")
  .onCreate(fillOwner);

export const onWalletTransactionOwner = functionsV1.firestore
  .document("walletTransactions/{id}")
  .onCreate(fillOwner);
