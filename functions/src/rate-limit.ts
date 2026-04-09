import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.count || 0) : 0;
    if (current >= limit) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded");
    }
    tx.set(
      ref,
      {
        key,
        dayKey,
        count: current + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
};

