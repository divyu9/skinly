import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v1/https";

const toDayKey = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const enforceDailyRateLimit = async ({
  key,
  limit,
}: {
  key: string;
  limit: number;
}) => {
  const db = admin.firestore();
  const now = new Date();
  const dayKey = toDayKey(now);
  const docId = `${key}_${dayKey}`;
  const ref = db.collection("rateLimits").doc(docId);

  // An atomic increment rather than a read-then-write transaction. Several
  // calls at once (approving a row of mockups quickly) contended on this one
  // document; after five retries the transaction gave up with a plain error,
  // which the client saw as "internal". The count may overshoot the limit by
  // the few calls racing at the boundary, which is fine for a daily ceiling.
  let count: number;
  try {
    await ref.set(
      {
        key,
        dayKey,
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    count = Number((await ref.get()).data()?.count || 0);
  } catch (err: any) {
    // The limiter must never be the reason a legitimate call fails.
    console.warn("rate limit check skipped", key, err?.message || err);
    return;
  }
  if (count > limit) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded");
  }
};

