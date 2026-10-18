import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";
import { buildStockMap, resolveMaterialCode } from "./materials";

/**
 * Where a design's stock came from and where it went.
 *
 * Stock was one number per design (rollInventory.metersAvailable,
 * cutoutInventory.sheetsAvailable), overwritten by every restock, edit and
 * sale, so "how many L-124 came in, and who bought them" had no answer.
 *
 *  - stockLedger: one row per change of that number, written by a trigger on
 *    both collections whatever made the change (the rolls page, a bulk
 *    import, an order). An order's write carries `_move` (materials.ts) so its
 *    row names the order; any other change is a restock or an adjustment.
 *  - Allocations come from the orders themselves: every confirmed order
 *    records what it took (order.materialConsumed), back to the first one, so
 *    the buyers list is complete even for sales before the ledger existed.
 */

const amountOf = (kind: "roll" | "cutout", d: any) =>
  Number(kind === "cutout" ? d?.sheetsAvailable : d?.metersAvailable) || 0;

function ledgerTrigger(collection: "rollInventory" | "cutoutInventory") {
  const kind = collection === "cutoutInventory" ? "cutout" : "roll";
  return functionsV1.firestore.document(`${collection}/{id}`).onWrite(async (change, context) => {
    const before = change.before.exists ? (change.before.data() as any) : null;
    const after = change.after.exists ? (change.after.data() as any) : null;
    const b = before ? amountOf(kind, before) : 0;
    const a = after ? amountOf(kind, after) : 0;
    const delta = Number((a - b).toFixed(4));
    if (!delta) return null;

    const doc = after || before;
    const move = after?._move && after._move.id !== before?._move?.id ? after._move : null;
    const reason = move?.reason
      || (!before ? "created" : !after ? "deleted" : delta > 0 ? "restock" : "adjust");
    let orderNumber = "";
    if (move?.orderId) {
      orderNumber = String(((await admin.firestore().doc(`orders/${move.orderId}`).get()).data() as any)?.orderNumber || "");
    }
    await admin.firestore().collection("stockLedger").add({
      collection, kind, docId: context.params.id,
      code: String(kind === "cutout" ? doc?.cutoutNumber : doc?.rNumber || "").trim().toUpperCase(),
      designName: String(doc?.designName || ""),
      unit: kind === "cutout" ? "sheets" : "m",
      before: b, after: a, delta, reason,
      ...(move?.orderId ? { orderId: move.orderId, orderNumber } : {}),
      at: Date.now(),
    });
    return null;
  });
}

export const onCutoutStockChange = ledgerTrigger("cutoutInventory");
export const onRollStockChange = ledgerTrigger("rollInventory");

/**
 * A product's stock history for its admin page: the design(s) its variants
 * are cut from, the stock on hand, every restock and adjustment, and every
 * order that took from it with the buyer and the device.
 */
export const productStockHistory = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const productId = String(data?.productId || "");
  if (!productId) throw new HttpsError("invalid-argument", "productId is required");
  return stockHistoryFor(admin.firestore(), productId);
});

export async function stockHistoryFor(db: admin.firestore.Firestore, productId: string) {

  const [variantSnap, rollSnap, cutoutSnap] = await Promise.all([
    db.collection("variants").where("productId", "==", productId).get(),
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
  ]);
  const stock = buildStockMap(rollSnap.docs, cutoutSnap.docs);

  // The stock records this listing draws on, by doc (a cutout answers to several codes).
  const designs = new Map<string, { key: string; kind: "roll" | "cutout"; docId: string; code: string; designName: string; onHand: number; unit: string; aliases: string[] }>();
  for (const v of variantSnap.docs) {
    const e = resolveMaterialCode(v.data() as any, stock);
    if (!e) continue;
    const key = `${e.kind}/${e.id}`;
    if (!designs.has(key)) {
      designs.set(key, {
        key, kind: e.kind, docId: e.id, code: e.code, designName: e.designName,
        onHand: e.amount, unit: e.kind === "cutout" ? "sheets" : "m",
        aliases: e.kind === "cutout" ? [e.data?.cutoutNumber, ...(e.data?.aliases || [])].filter(Boolean).map((x: any) => String(x).toUpperCase()) : [e.code],
      });
    }
  }
  if (!designs.size) return { designs: [], events: [], note: "No stock record matches this product's SKUs." };

  // Restocks and adjustments (the ledger), per stock record.
  const ledger: any[] = [];
  for (const d of designs.values()) {
    const snap = await db.collection("stockLedger").where("docId", "==", d.docId).get();
    for (const r of snap.docs) {
      const x = r.data() as any;
      if (x.collection !== (d.kind === "cutout" ? "cutoutInventory" : "rollInventory")) continue;
      if (x.reason === "order" || x.reason === "order_release") continue; // the orders below say it with the buyer
      ledger.push({ type: x.reason, at: Number(x.at) || 0, design: d.code, delta: x.delta, before: x.before, after: x.after, unit: x.unit });
    }
  }

  // Allocations: every order that took from these records.
  const codes = new Map<string, string>(); // any alias → design key
  for (const d of designs.values()) for (const a of d.aliases) codes.set(a, d.key);
  const orderSnap = await db.collection("orders").where("materialReservedAt", ">", 0).get();
  const allocations: any[] = [];
  for (const o of orderSnap.docs) {
    const x = o.data() as any;
    if (x.isDeleted) continue;
    for (const row of (Array.isArray(x.materialConsumed) ? x.materialConsumed : [])) {
      const key = codes.get(String(row?.code || "").toUpperCase());
      if (!key) continue;
      const d = designs.get(key)!;
      const took = Number((Number(row.before) - Number(row.after)).toFixed(4)) || Number(row.requested) || 0;
      // This listing's lines; failing that (the design sold under another
      // listing, e.g. its laptop view), every line of the order.
      const all = Array.isArray(x.items) ? x.items : [];
      const own = all.filter((i: any) => i?.productId === productId);
      const lines = (own.length ? own : all)
        .map((i: any) => [i?.productTitle, i?.variant && !/^default/i.test(i.variant) ? i.variant : "", [i?.phoneBrand, i?.phoneModel].filter(Boolean).join(" "), i?.lensModel ? `lens ${i.lensModel}` : ""].filter(Boolean).join(" · "));
      allocations.push({
        type: "order", at: Number(x.materialReservedAt) || Number(x.createdAt) || 0, design: d.code,
        delta: -took, unit: d.unit, short: !!row.short,
        orderId: o.id, orderNumber: String(x.orderNumber || ""),
        customer: x.shippingAddress?.fullName || x.customerName || "",
        city: x.shippingAddress?.city || "",
        status: String(x.status || ""),
        released: !!x.materialReleasedAt, releasedAt: Number(x.materialReleasedAt) || 0,
        lines,
      });
    }
  }

  const events = [...ledger, ...allocations].sort((a, b) => b.at - a.at);
  const sold = allocations.filter((a) => !a.released).reduce((s, a) => s - a.delta, 0);
  return {
    designs: [...designs.values()].map((d) => ({ code: d.code, designName: d.designName, kind: d.kind, onHand: d.onHand, unit: d.unit, aliases: d.aliases })),
    events,
    totals: {
      allocated: Number(sold.toFixed(4)),
      orders: allocations.filter((a) => !a.released).length,
      restocked: Number(ledger.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0).toFixed(4)),
      ledgerSince: ledger.length ? Math.min(...ledger.map((l) => l.at)) : 0,
    },
  };
}
