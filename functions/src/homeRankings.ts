import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { isConfirmedOrder } from "./materials";

/**
 * What actually sells, for the homepage's Bestsellers row.
 *
 * That row was a hand-kept "bestseller" tag on eight products, mostly cases
 * and glass. The build (scripts/prerender.mjs) cannot read orders — it reads
 * Firestore without credentials — so this writes the ranking where it can:
 * settings/homeRankings, public like every settings document, holding only
 * product ids and piece counts. Confirmed, non-test orders from the last 60
 * days; refreshed nightly before the morning rebuild.
 */

export async function writeHomeRankings(db: admin.firestore.Firestore) {
  const since = Date.now() - 60 * 86_400_000;
  const snap = await db.collection("orders").where("createdAt", ">=", since).get();
  const qty = new Map<string, number>();
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (!isConfirmedOrder(o) || o.status === "cancelled" || o.testOrder) continue;
    for (const it of o.items || []) {
      if (!it?.productId || String(it.upsellRuleId || "").startsWith("smart:")) continue;
      qty.set(String(it.productId), (qty.get(String(it.productId)) || 0) + (Number(it.quantity) || 1));
    }
  }
  const bestsellers = [...qty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([productId, n]) => ({ productId, qty: n }));
  await db.collection("settings").doc("homeRankings").set({ bestsellers, orders: snap.size, updatedAt: Date.now() });
  return bestsellers.length;
}

/** 02:30 IST, ahead of the builds that read it. */
export const homeRankings = functionsV1
  .runWith({ memory: "256MB", timeoutSeconds: 120 })
  .pubsub.schedule("0 21 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    console.log("homeRankings", await writeHomeRankings(admin.firestore()));
    return null;
  });
