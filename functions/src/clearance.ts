import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";

/**
 * Clearance: skins that came back from the courier (RTO).
 *
 * A returned skin is already printed and cut for one device, so it cannot go
 * back to the rolls or the precut sheets (orderStatus.ts no longer releases
 * material on RTO). When the parcel is back, the admin puts its pieces up on
 * the clearance page, one `clearanceItems` document per piece, at a price of
 * their choosing; the shopper buys that exact piece, device fixed.
 *
 * A piece is reserved by the order that takes it (placeOrder) and sold when
 * that order is confirmed (orderConfirm.ts). A reservation whose order never
 * paid lapses after RESERVE_MS and the piece is on sale again.
 *
 *   clearanceItems/{id}: status available | reserved | sold | removed,
 *     productId, productTitle, productSlug, productImage, variant, sku,
 *     phoneBrand, phoneModel, coverage, lensModel, price, originalPrice,
 *     sourceOrderId, sourceOrderNumber, createdAt,
 *     reservedOrderId, reservedAt, soldOrderId, soldAt
 */

export const RESERVE_MS = 30 * 60_000;

/** On sale now: available, or held by an order that never paid. */
export const isBuyable = (c: any, now = Date.now()) =>
  c?.status === "available" || (c?.status === "reserved" && Number(c?.reservedAt || 0) < now - RESERVE_MS);

/** The admin puts an RTO order's pieces on the clearance page. */
export const addRtoToClearance = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const lines: Array<{ index: number; price: number }> = Array.isArray(data?.lines) ? data.lines : [];
  if (!orderId || !lines.length) throw new HttpsError("invalid-argument", "orderId and at least one line are required");
  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const order = (await ref.get()).data() as any;
  if (!order) throw new HttpsError("not-found", "No such order");
  if (!["rto", "undelivered", "cancelled"].includes(String(order.status))) {
    throw new HttpsError("failed-precondition", "Only a returned (RTO) order's pieces can go on clearance");
  }
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const done: number[] = Array.isArray(order.clearanceLines) ? order.clearanceLines : [];

  const batch = db.batch();
  const created: string[] = [];
  const newly: number[] = [];
  for (const l of lines) {
    const i = Math.floor(Number(l?.index));
    const it = items[i];
    const price = Math.round(Number(l?.price) || 0);
    if (!it || done.includes(i) || newly.includes(i)) continue;
    if (!(price > 0)) throw new HttpsError("invalid-argument", `Set a price for ${it.productTitle || "line " + (i + 1)}`);
    let slug = String(it.productSlug || "");
    if (!slug && it.productId) slug = String(((await db.doc(`products/${it.productId}`).get()).data() as any)?.slug || "");
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    for (let n = 0; n < qty; n++) {
      const doc = db.collection("clearanceItems").doc();
      batch.set(doc, {
        status: "available",
        productId: String(it.productId || ""),
        productTitle: String(it.productTitle || ""),
        productSlug: slug,
        productImage: String(it.productImage || ""),
        variant: String(it.variant || ""),
        sku: String(it.sku || ""),
        phoneBrand: String(it.phoneBrand || ""),
        phoneModel: String(it.phoneModel || ""),
        ...(it.coverage ? { coverage: String(it.coverage) } : {}),
        ...(it.lensModel ? { lensModel: String(it.lensModel) } : {}),
        price,
        originalPrice: Number(it.price) || 0,
        sourceOrderId: orderId,
        sourceOrderNumber: String(order.orderNumber || ""),
        createdAt: Date.now(),
        createdBy: uid,
      });
      created.push(doc.id);
    }
    newly.push(i);
  }
  if (!created.length) throw new HttpsError("failed-precondition", "Those lines are already on clearance");
  batch.update(ref, {
    clearanceLines: admin.firestore.FieldValue.arrayUnion(...newly),
    clearanceAddedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await batch.commit();
  return { ok: true, created: created.length };
});

/**
 * Stock put on clearance by hand — pieces already cut that never sold, or
 * that were never listed — from Admin › Clearance. Either an existing
 * listing (draft or unlisted included: its picture and title) or a piece
 * described from scratch (title + picture), which gets a "custom-" product
 * id of its own. One document per piece.
 */
export const addClearanceStock = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const db = admin.firestore();
  const qty = Math.max(1, Math.min(200, Math.floor(Number(data?.quantity) || 1)));
  const price = Math.round(Number(data?.price) || 0);
  if (!(price > 0)) throw new HttpsError("invalid-argument", "Set a clearance price");
  // A skin is cut for one device; a gadget or accessory is not, and leaves it empty.
  const phoneModel = String(data?.phoneModel || "").trim();

  let productId = String(data?.productId || "").trim();
  let productTitle = String(data?.productTitle || "").trim();
  let productSlug = "";
  let productImage = String(data?.productImage || "").trim();
  let originalPrice = Math.round(Number(data?.originalPrice) || 0);
  let sku = String(data?.sku || "").trim();
  const variant = String(data?.variant || "").trim() || "Default";
  if (productId) {
    const p = (await db.doc(`products/${productId}`).get()).data() as any;
    if (!p) throw new HttpsError("not-found", "No such product");
    productTitle = productTitle || String(p.title || "");
    productSlug = String(p.slug || "");
    productImage = productImage || String((p.images || []).find((i: any) => i?.url)?.url || "");
    const v = (await db.collection("variants").where("productId", "==", productId).where("title", "==", variant).limit(1).get()).docs[0]?.data() as any;
    if (v) { originalPrice = originalPrice || Math.round(Number(v.compareAtPrice) || Number(v.price) || 0); sku = sku || String(v.sku || ""); }
  } else {
    if (!productTitle) throw new HttpsError("invalid-argument", "Give the piece a title");
    productId = `custom-${db.collection("clearanceItems").doc().id}`;
  }

  const batch = db.batch();
  for (let n = 0; n < qty; n++) {
    batch.set(db.collection("clearanceItems").doc(), {
      status: "available",
      productId, productTitle, productSlug, productImage, variant, sku,
      phoneBrand: String(data?.phoneBrand || "").trim(),
      phoneModel,
      ...(data?.coverage === "only_back" || data?.coverage === "full_body_wrap" ? { coverage: data.coverage } : {}),
      ...(String(data?.lensModel || "").trim() ? { lensModel: String(data.lensModel).trim() } : {}),
      price, originalPrice,
      ...(String(data?.note || "").trim() ? { note: String(data.note).trim().slice(0, 200) } : {}),
      source: "manual",
      createdAt: Date.now(),
      createdBy: uid,
    });
  }
  await batch.commit();
  return { ok: true, created: qty };
});

/** Change a piece's clearance price. */
export const updateClearanceItem = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const id = String(data?.id || "");
  const price = Math.round(Number(data?.price) || 0);
  if (!id || !(price > 0)) throw new HttpsError("invalid-argument", "id and a price are required");
  const ref = admin.firestore().collection("clearanceItems").doc(id);
  const c = (await ref.get()).data() as any;
  if (!c) throw new HttpsError("not-found", "No such piece");
  if (c.status === "sold") throw new HttpsError("failed-precondition", "That piece is already sold");
  await ref.update({ price, updatedAt: Date.now() });
  return { ok: true };
});

/** Take a piece off the clearance page (sold elsewhere, damaged…). */
export const removeClearanceItem = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const id = String(data?.id || "");
  if (!id) throw new HttpsError("invalid-argument", "id is required");
  const ref = admin.firestore().collection("clearanceItems").doc(id);
  const c = (await ref.get()).data() as any;
  if (!c) throw new HttpsError("not-found", "No such piece");
  if (c.status === "sold") throw new HttpsError("failed-precondition", "That piece is already sold");
  await ref.update({ status: "removed", removedAt: Date.now() });
  return { ok: true };
});

/** The clearance page: every piece on sale, newest first. Public, and carries no customer data. */
export const listClearance = onCall(async (data: any, context: any) => {
  const db = admin.firestore();
  const forAdmin = data?.admin === true && !!context?.auth;
  if (forAdmin) await requireAdmin(context);
  // The admin page sees sold pieces too (what sold, to whom); the shop only what is on sale.
  const snap = await db.collection("clearanceItems").where("status", "in", forAdmin ? ["available", "reserved", "sold"] : ["available", "reserved"]).get();
  const now = Date.now();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((c) => forAdmin || isBuyable(c, now))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .map((c) => ({
      id: c.id, productId: c.productId, productTitle: c.productTitle, productSlug: c.productSlug,
      productImage: c.productImage, variant: c.variant, phoneBrand: c.phoneBrand, phoneModel: c.phoneModel,
      coverage: c.coverage || null, lensModel: c.lensModel || null, price: c.price, originalPrice: c.originalPrice,
      createdAt: c.createdAt,
      ...(forAdmin ? {
        status: c.status, buyable: isBuyable(c, now), source: c.source || "rto", note: c.note || "", sku: c.sku || "",
        sourceOrderId: c.sourceOrderId || null, sourceOrderNumber: c.sourceOrderNumber || "",
        reservedOrderId: c.reservedOrderId || null, soldOrderId: c.soldOrderId || null, soldAt: c.soldAt || null,
      } : {}),
    }));
  return { items };
});

/**
 * placeOrder: the price of each clearance line, after holding its piece for
 * this order. Throws when a piece is gone, before anything is charged.
 */
export async function reserveClearance(
  db: admin.firestore.Firestore,
  orderId: string,
  orderItems: any[]
): Promise<Map<number, number>> {
  const prices = new Map<number, number>();
  const lines = orderItems.map((it, i) => ({ it, i })).filter(({ it }) => it?.clearanceItemId);
  for (const { it, i } of lines) {
    const ref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
    const price = await db.runTransaction(async (tx) => {
      const c = (await tx.get(ref)).data() as any;
      if (!c || String(c.productId) !== String(it.productId)) throw new HttpsError("failed-precondition", "That clearance piece is not on sale");
      const mine = c.status === "reserved" && c.reservedOrderId === orderId;
      if (!mine && !isBuyable(c)) throw new HttpsError("failed-precondition", `Sorry — the clearance ${c.productTitle || "piece"} for ${c.phoneModel || "that device"} was just bought by someone else`);
      tx.update(ref, { status: "reserved", reservedOrderId: orderId, reservedAt: Date.now() });
      return Number(c.price) || 0;
    });
    if (!(price > 0)) throw new HttpsError("failed-precondition", "That clearance piece has no price");
    prices.set(i, price);
  }
  return prices;
}

/** orderConfirm: the pieces a confirmed order holds are sold. */
export async function markClearanceSold(db: admin.firestore.Firestore, orderId: string, items: any[]) {
  for (const it of items || []) {
    if (!it?.clearanceItemId) continue;
    const ref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
    await db.runTransaction(async (tx) => {
      const c = (await tx.get(ref)).data() as any;
      if (!c || c.status === "sold") {
        if (c?.soldOrderId && c.soldOrderId !== orderId) console.warn("clearance piece sold twice", { piece: ref.id, orderId, first: c.soldOrderId });
        return;
      }
      tx.update(ref, { status: "sold", soldOrderId: orderId, soldAt: Date.now() });
    });
  }
}
