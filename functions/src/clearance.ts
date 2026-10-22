import * as functionsV1 from "firebase-functions/v1";
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
  Number(c?.price) > 0 &&
  (c?.status === "available" ||
    (c?.status === "reserved" && (c?.reservedUntil ? Number(c.reservedUntil) < now : Number(c?.reservedAt || 0) < now - RESERVE_MS)));

/** A direct-UPI order has 10 minutes to pay and send the UTR; once the UTR is in, the
 *  pieces stay held a day while the admin checks the bank. */
export const UPI_HOLD_MS = 10 * 60_000;
export const UPI_VERIFY_HOLD_MS = 24 * 3600_000;

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
        // Clearance is sold by direct UPI (owner's call, 18 Oct 2026), skins included.
        personal: true,
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

  // "+1 more of this": copy the piece itself — same listing id (so it joins
  // the same card), photos, condition, description, Amazon link and owner.
  // Building it from the title gave a photo-made piece a fresh custom- id and
  // only its first photo, so it showed as a second, bare card.
  const sameAs = String(data?.sameAs || "").trim();
  if (sameAs) {
    const src = (await db.collection("clearanceItems").doc(sameAs).get()).data() as any;
    if (!src) throw new HttpsError("not-found", "No such piece");
    const keep = [
      "productId", "productTitle", "productSlug", "productImage", "images", "variant", "sku", "phoneBrand", "phoneModel",
      "coverage", "lensModel", "price", "originalPrice", "condition", "description", "amazonUrl", "note", "personal", "videoUrl", "pinned", "pinRank",
    ];
    const copy: Record<string, unknown> = {};
    for (const k of keep) if (src[k] !== undefined) copy[k] = src[k];
    const batch = db.batch();
    for (let n = 0; n < qty; n++) {
      batch.set(db.collection("clearanceItems").doc(), {
        ...copy, status: "available", source: "manual", copiedFrom: sameAs, createdAt: Date.now(), createdBy: uid,
      });
    }
    await batch.commit();
    return { ok: true, created: qty };
  }

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
      personal: data?.personal !== false,
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
  // A piece added without a price waits as a draft; its first price puts it on sale.
  await ref.update({ price, updatedAt: Date.now(), ...(c.status === "draft" ? { status: "available", publishedAt: Date.now() } : {}) });
  return { ok: true };
});

/*
 * Pieces may also carry, for gadgets put up from photos:
 *   images[]     every photo (the card shows the first, the viewer all)
 *   condition    e.g. "Open box · Unused"
 *   description  the terms shown on the card (no bill or warranty, final sale…)
 *   status "draft" with price 0: not shown until the admin sets a price.
 */

/** A video file on our own storage (Media Library → R2): an mp4 / webm / mov link. */
const VIDEO_URL = /^https:\/\/[^\s"'<>]+\.(mp4|webm|mov)(\?[^\s"'<>]*)?$/i;

/**
 * A video for a clearance card (a UGC clip of it in use). Shown as the card's
 * main picture and the first slide of its product sheet. Set on every piece
 * of the kind at once; an empty link takes it off.
 */
export const setClearanceVideo = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const ids: string[] = Array.isArray(data?.ids) ? data.ids.map(String).filter(Boolean).slice(0, 200) : [];
  const videoUrl = String(data?.videoUrl || "").trim();
  if (!ids.length) throw new HttpsError("invalid-argument", "No pieces given");
  if (videoUrl && !VIDEO_URL.test(videoUrl)) {
    throw new HttpsError("invalid-argument", "Paste a link to a video file (.mp4) — upload it in Media Library first. An Instagram link won't play here.");
  }
  const db = admin.firestore();
  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection("clearanceItems").doc(id), {
      videoUrl: videoUrl || admin.firestore.FieldValue.delete(), updatedAt: Date.now(),
    });
  }
  await batch.commit();
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
  // The shop shows what is on sale and, greyed out at the bottom, what has sold
  // (owner's call: sold pieces stay, marked sold out). A piece held by an
  // order still waiting for its money is hidden until it sells or comes back.
  const snap = await db.collection("clearanceItems").where("status", "in", ["draft", "available", "reserved", "sold"]).get();
  const now = Date.now();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((c) => forAdmin || isBuyable(c, now) || c.status === "sold")
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .map((c) => ({
      id: c.id, productId: c.productId, productTitle: c.productTitle, productSlug: c.productSlug,
      productImage: c.productImage, images: Array.isArray(c.images) ? c.images : (c.productImage ? [c.productImage] : []),
      condition: c.condition || "", description: c.description || "",
      sold: c.status === "sold",
      // The owner's own stock (gadgets): paid by direct UPI, no invoice. Skins are the shop's and go through checkout.
      personal: c.personal === true,
      // Amazon.in search for the same model with the owner's associate tag: "compare the price".
      amazonUrl: /^https:\/\/www\.amazon\.in\//.test(String(c.amazonUrl || "")) ? c.amazonUrl : "",
      videoUrl: VIDEO_URL.test(String(c.videoUrl || "")) ? c.videoUrl : "",
      // Shown first on the clearance page, in pinRank order (1 = Mystery Box, 2 = Magneto X).
      pinned: c.pinned === true || Number(c.pinRank) > 0,
      pinRank: Number(c.pinRank) || (c.pinned === true ? 1 : 0),
      variant: c.variant, phoneBrand: c.phoneBrand, phoneModel: c.phoneModel,
      coverage: c.coverage || null, lensModel: c.lensModel || null, price: c.price, originalPrice: c.originalPrice,
      createdAt: c.createdAt,
      ...(forAdmin ? {
        status: c.status, buyable: isBuyable(c, now), source: c.source || "rto", note: c.note || "", sku: c.sku || "",
        sourceOrderId: c.sourceOrderId || null, sourceOrderNumber: c.sourceOrderNumber || "",
        reservedOrderId: c.reservedOrderId || null, soldOrderId: c.soldOrderId || null, soldAt: c.soldAt || null,
      } : {}),
    }));
  // Designs on sale (product.designSale): slow precut designs, cut for any model,
  // listed on the clearance page above the one-off pieces.
  let designs: any[] = [];
  try {
    const ds = await db.collection("products").where("designSale.price", ">", 0).get();
    designs = ds.docs.map((d) => d.data() as any).filter((p) => p.status === "active").map((p) => ({
      title: String(p.title || ""), slug: String(p.slug || ""), price: Number(p.designSale?.price) || 0,
      image: String((p.images || []).find((i: any) => i?.url)?.url || ""), code: String(p.designSale?.code || ""),
    })).filter((p) => p.slug);
  } catch (e: any) { console.warn("listClearance designs:", e?.message || e); }
  return { items, designs };
});

/**
 * placeOrder: the price of each clearance line, after holding its piece for
 * this order. Throws when a piece is gone, before anything is charged.
 */
/**
 * A cart line names one exact piece, picked when it was added. Alike pieces
 * are one card (Magneto X had 40), so when that piece has since sold or is
 * held by someone else's checkout, the shopper was told it "was just bought
 * by someone else" with 39 more on the shelf. Swap in a free piece of the
 * same kind (listing, variant, device, price) instead; only when none is left
 * does reserveClearance refuse. Two lines never get the same piece.
 */
export async function swapTakenPieces(db: admin.firestore.Firestore, orderId: string, orderItems: any[]): Promise<any[]> {
  const used = new Set<string>();
  const out: any[] = [];
  const now = Date.now();
  for (const it of orderItems) {
    if (!it?.clearanceItemId) { out.push(it); continue; }
    const id = String(it.clearanceItemId);
    const c = (await db.collection("clearanceItems").doc(id).get()).data() as any;
    const mine = c?.status === "reserved" && c?.reservedOrderId === orderId;
    if (c && !used.has(id) && (mine || isBuyable(c, now))) { used.add(id); out.push(it); continue; }
    const pid = String(c?.productId || it.productId || "");
    const same = (x: any) => String(x.variant || "") === String(c?.variant ?? it.variant ?? "")
      && String(x.phoneModel || "") === String(c?.phoneModel ?? it.phoneModel ?? "")
      // The same price or less: never charge more than the piece the shopper saw.
      && Number(x.price) <= Number(c?.price ?? x.price);
    const sib = pid ? (await db.collection("clearanceItems").where("productId", "==", pid).get()).docs
      .find((d) => !used.has(d.id) && same(d.data()) && isBuyable(d.data(), now)) : undefined;
    if (sib) {
      console.log("clearance piece swapped", { orderId, from: id, to: sib.id });
      used.add(sib.id);
      out.push({ ...it, clearanceItemId: sib.id });
    } else {
      used.add(id);
      out.push(it);
    }
  }
  return out;
}

export async function reserveClearance(
  db: admin.firestore.Firestore,
  orderId: string,
  orderItems: any[],
  holdMs = RESERVE_MS
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
      tx.update(ref, { status: "reserved", reservedOrderId: orderId, reservedAt: Date.now(), reservedUntil: Date.now() + holdMs });
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


/*
 * Direct UPI for clearance-only orders.
 *
 * Clearance gadgets are the owner's own stock (bought personally or sent for
 * review), sold the way one would on OLX: paid straight to their UPI rather
 * than through the gateway, and kept apart from the shop's orders — a
 * `personalSale` order is numbered in its own series (CL-1001, CL-1002…) and
 * gets no GST invoice (orderConfirm.ts). The customer pays from the order
 * page (QR or UPI app) and submits the UTR; the admin checks the bank and
 * marks it received, which confirms the order.
 *
 *   settings/clearanceUpi: { enabled, vpa, payeeName }
 */
const VPA_RE = /^[\w.\-]{2,}@[a-zA-Z]{2,}$/;

export async function clearanceUpiSettings(db: admin.firestore.Firestore) {
  const s = (await db.doc("settings/clearanceUpi").get()).data() as any;
  const vpa = String(s?.vpa || "").trim();
  return { enabled: s?.enabled === true && VPA_RE.test(vpa), vpa, payeeName: String(s?.payeeName || "").trim() };
}

/** Checkout: whether direct UPI is on for clearance-only carts. */
export const getClearanceUpi = onCall(async (data: any, context: any) => {
  const s = await clearanceUpiSettings(admin.firestore());
  if (data?.admin === true) {
    await requireAdmin(context);
    const raw = (await admin.firestore().doc("settings/clearanceUpi").get()).data() as any;
    return { enabled: raw?.enabled === true, vpa: String(raw?.vpa || ""), payeeName: String(raw?.payeeName || "") };
  }
  return { enabled: s.enabled };
});

export const saveClearanceUpi = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const vpa = String(data?.vpa || "").trim();
  if (data?.enabled === true && !VPA_RE.test(vpa)) throw new HttpsError("invalid-argument", "That does not look like a UPI ID (name@bank)");
  await admin.firestore().doc("settings/clearanceUpi").set({
    enabled: data?.enabled === true, vpa, payeeName: String(data?.payeeName || "").trim().slice(0, 60), updatedAt: Date.now(),
  }, { merge: true });
  return { ok: true };
});

/** The customer says they paid: the UTR / reference from their UPI app. The admin checks it. */
export const submitUpiPayment = onCall(async (data: any) => {
  const orderId = String(data?.orderId || "");
  const utr = String(data?.utr || "").replace(/\s+/g, "").slice(0, 40);
  if (!orderId || !/^[A-Za-z0-9]{6,40}$/.test(utr)) throw new HttpsError("invalid-argument", "Enter the UPI reference / UTR number from your payment app");
  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const o = (await ref.get()).data() as any;
  if (!o || o.paymentMethod !== "upi_direct") throw new HttpsError("not-found", "No such UPI order");
  if (o.paymentStatus === "success") return { ok: true, already: true };
  if (o.status === "cancelled") throw new HttpsError("failed-precondition", "This order was cancelled");
  // Keep this order's pieces while the admin checks; past the 10 minutes a piece
  // someone else has since taken cannot be held — the admin sees that and refunds.
  let lost = 0;
  for (const it of o.items || []) {
    if (!it?.clearanceItemId) continue;
    const cref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
    await db.runTransaction(async (tx) => {
      const c = (await tx.get(cref)).data() as any;
      const mine = c?.status === "reserved" && c.reservedOrderId === orderId;
      if (mine || (c && isBuyable(c))) {
        tx.update(cref, { status: "reserved", reservedOrderId: orderId, reservedAt: Date.now(), reservedUntil: Date.now() + UPI_VERIFY_HOLD_MS });
      } else lost++;
    });
  }
  await ref.update({
    upiUtr: utr, upiSubmittedAt: Date.now(), updatedAt: Date.now(),
    // The admin's queue: nothing goes to the customer until they confirm (confirmUpiPayment).
    status: "payment_verification", statusChangedAt: Date.now(),
    ...(lost ? { upiLostPieces: lost } : {}),
  });
  return { ok: true, lost };
});

/** Admin: the UPI money arrived (confirm the order) or did not (cancel it, pieces back on sale). */
export const confirmUpiPayment = onCall(async (data: any, context: any) => {
  const { uid } = await requireAdmin(context);
  const orderId = String(data?.orderId || "");
  const received = data?.received === true;
  const db = admin.firestore();
  const ref = db.collection("orders").doc(orderId);
  const o = (await ref.get()).data() as any;
  if (!o || o.paymentMethod !== "upi_direct") throw new HttpsError("not-found", "No such UPI order");
  if (o.paymentStatus === "success") throw new HttpsError("failed-precondition", "Already marked as paid");
  if (received) {
    await ref.update({ paymentStatus: "success", status: "processing", statusChangedAt: Date.now(), paidAt: Date.now(), upiVerifiedBy: uid, updatedAt: Date.now() });
    const { confirmOrder } = await import("./orderConfirm");
    await confirmOrder(db, orderId);
    await markClearanceSold(db, orderId, o.items || []);
    const { notifyOrderPlaced } = await import("./orderNotifications");
    await notifyOrderPlaced(db, orderId).catch((e: any) => console.error("upi notify failed", orderId, e?.message || e));
  } else {
    await ref.update({ paymentStatus: "failed", status: "cancelled", statusChangedAt: Date.now(), upiRejectedBy: uid, updatedAt: Date.now() });
    for (const it of o.items || []) {
      if (!it?.clearanceItemId) continue;
      const cref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
      await db.runTransaction(async (tx) => {
        const c = (await tx.get(cref)).data() as any;
        if (c?.status === "reserved" && c.reservedOrderId === orderId) {
          tx.update(cref, {
            status: "available",
            reservedOrderId: admin.firestore.FieldValue.delete(),
            reservedAt: admin.firestore.FieldValue.delete(),
            reservedUntil: admin.firestore.FieldValue.delete(),
          });
        }
      });
    }
  }
  return { ok: true };
});

/**
 * Every 5 minutes: a direct-UPI order with no UTR once its 10-minute hold is
 * over is cancelled and its pieces go back on sale (owner's call: 5–10 minutes,
 * not 30). An order whose UTR is in waits for the admin instead.
 */
export const upiOrderSweep = functionsV1.pubsub.schedule("every 5 minutes").onRun(async () => {
  const db = admin.firestore();
  const snap = await db.collection("orders").where("paymentMethod", "==", "upi_direct").where("status", "==", "pending_payment").get();
  const now = Date.now();
  let cancelled = 0;
  for (const d of snap.docs) {
    const o = d.data() as any;
    if (o.upiUtr || o.paymentStatus === "success" || o.isDeleted) continue;
    const until = Number(o.upiPay?.holdUntil) || Number(o.createdAt) + UPI_HOLD_MS;
    if (until > now) continue;
    await d.ref.update({ status: "cancelled", paymentStatus: "failed", statusChangedAt: now, cancelReason: "upi_timeout", updatedAt: now });
    for (const it of o.items || []) {
      if (!it?.clearanceItemId) continue;
      const cref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
      await db.runTransaction(async (tx) => {
        const c = (await tx.get(cref)).data() as any;
        if (c?.status === "reserved" && c.reservedOrderId === d.id) {
          tx.update(cref, {
            status: "available",
            reservedOrderId: admin.firestore.FieldValue.delete(),
            reservedAt: admin.firestore.FieldValue.delete(),
            reservedUntil: admin.firestore.FieldValue.delete(),
          });
        }
      });
    }
    cancelled++;
  }
  if (cancelled) console.log("upiOrderSweep cancelled", cancelled);
  return null;
});


/** Puts back on sale the pieces still held for this order (failed / cancelled / timed out). */
export async function releaseClearanceFor(db: admin.firestore.Firestore, orderId: string, items: any[]): Promise<number> {
  let n = 0;
  for (const it of items || []) {
    if (!it?.clearanceItemId) continue;
    const cref = db.collection("clearanceItems").doc(String(it.clearanceItemId));
    await db.runTransaction(async (tx) => {
      const c = (await tx.get(cref)).data() as any;
      if (c?.status === "reserved" && c.reservedOrderId === orderId) {
        tx.update(cref, {
          status: "available",
          reservedOrderId: admin.firestore.FieldValue.delete(),
          reservedAt: admin.firestore.FieldValue.delete(),
          reservedUntil: admin.firestore.FieldValue.delete(),
          releasedAt: Date.now(),
        });
        n++;
      }
    });
  }
  return n;
}

/*
 * A clearance order that will not be paid lets its pieces go at once: its
 * payment failed (PhonePe declined, UPI timed out) or it was cancelled, by
 * whatever path. Pieces used to stay "reserved" until the hold ran out, and
 * the admin could not take them off sale or count them down meanwhile.
 * Only pieces still reserved for this very order are touched.
 */
export const onOrderReleaseClearance = functionsV1.firestore
  .document("orders/{id}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? (change.after.data() as any) : null;
    if (!after || !Array.isArray(after.items) || !after.items.some((i: any) => i?.clearanceItemId)) return null;
    const before = change.before.exists ? (change.before.data() as any) : {};
    const dead = (o: any) => o?.status === "cancelled" || (o?.paymentStatus === "failed" && o?.status !== "processing");
    if (!dead(after) || dead(before)) return null;
    const n = await releaseClearanceFor(admin.firestore(), context.params.id, after.items);
    if (n) console.log("clearance released", { order: context.params.id, pieces: n, status: after.status, payment: after.paymentStatus });
    return null;
  });
