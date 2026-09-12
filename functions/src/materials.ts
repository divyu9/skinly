import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";

/**
 * Draws down design stock when an order is placed.
 *
 * Stock is held once per design and shared by every product made from it, so a
 * cutout with two sheets is two iPad backs, or two laptop lids, or one laptop
 * lid-plus-keyboard — whichever sells first. Consumption is the variant's
 * materialMultiplier: "Only Top" is 1, "Top + Keyboard Area" is 2.
 *
 * Rolls are stocked by the metre, so a unit costs the area it is cut from,
 * inverted from the same figures the storefront uses to show availability.
 *
 * This never rejects an order. The stock model has not been exercised in anger
 * and a miscount must not cost a sale; it clamps at zero, records what it took
 * on the order, and logs anything it could not resolve.
 */

const ROLL_WIDTH_CM = 29.5;

interface Consumption {
  collection: "rollInventory" | "cutoutInventory";
  docId: string;
  code: string;
  amount: number;
  unit: "m" | "sheets";
}

/**
 * Every code a piece of stock answers to, rolls and cutouts in one map.
 *
 * A cutout answers to every code its views are sold under: LP-3D-05 and
 * L-3D-06 are two views of one design and draw on one pile of sheets.
 */
export interface StockEntry {
  kind: "roll" | "cutout";
  id: string;
  code: string;
  designName: string;
  /** Metres for a roll, sheets for a cutout. */
  amount: number;
  data: any;
}

export function buildStockMap(
  rollDocs: admin.firestore.QueryDocumentSnapshot[],
  cutoutDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, StockEntry> {
  const map = new Map<string, StockEntry>();
  rollDocs.forEach((d) => {
    const r = d.data() as any;
    if (!r.rNumber) return;
    const code = String(r.rNumber).trim().toUpperCase();
    map.set(code, {
      kind: "roll",
      id: d.id,
      code,
      designName: String(r.designName || ""),
      amount: Number(r.metersAvailable) || 0,
      data: r,
    });
  });
  cutoutDocs.forEach((d) => {
    const c = d.data() as any;
    const primary = String(c.cutoutNumber || "").trim().toUpperCase();
    for (const raw of [c.cutoutNumber, ...(c.aliases || [])]) {
      if (!raw) continue;
      map.set(String(raw).trim().toUpperCase(), {
        kind: "cutout",
        id: d.id,
        code: primary,
        designName: String(c.designName || ""),
        amount: Number(c.sheetsAvailable) || 0,
        data: c,
      });
    }
  });
  return map;
}

/**
 * The one rule that decides which stock a variant is cut from.
 *
 * A manually assigned rNumber wins. Failing that, walk the SKU's leading
 * segments longest-first, so `R-09-DRC` finds roll `R-09` and `LP-3D-05-KB`
 * finds cutout `LP-3D-05` — one design, many device views, which is how the
 * catalogue is actually built. The bare SKU is tried last for the single-view
 * designs that carry no view suffix at all.
 *
 * This used to exist three times: once for drawing stock down on an order,
 * once for pushing availability back out to variants, and a third, weaker
 * version in the admin tab that read only rNumber and so reported hundreds of
 * correctly-mapped variants as unmapped. One copy now, and the admin tab calls
 * it rather than guessing alongside it.
 */
export function resolveMaterialCode(
  variant: { rNumber?: any; sku?: any },
  stock: Map<string, StockEntry>
): StockEntry | null {
  const rn = String(variant?.rNumber || "").trim().toUpperCase();
  if (rn && stock.has(rn)) return stock.get(rn)!;

  const sku = String(variant?.sku || "").trim();
  const parts = sku.split("-");
  for (let k = parts.length - 1; k >= 1; k--) {
    const code = parts.slice(0, k).join("-").toUpperCase();
    if (stock.has(code)) return stock.get(code)!;
  }
  const whole = sku.toUpperCase();
  return whole && stock.has(whole) ? stock.get(whole)! : null;
}

export async function reserveMaterialForOrder(
  db: admin.firestore.Firestore,
  orderRef: admin.firestore.DocumentReference,
  items: Array<{ productId?: string; title?: string; quantity?: number }>
): Promise<void> {
  const productIds = Array.from(
    new Set(items.map((i) => i?.productId).filter((p): p is string => !!p))
  );
  if (!productIds.length) return;

  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));

  const [variantSnaps, productSnaps, rollSnap, cutoutSnap, gadgetSnap] = await Promise.all([
    Promise.all(chunks.map((c) => db.collection("variants").where("productId", "in", c).get())),
    Promise.all(chunks.map((c) => db.getAll(...c.map((id) => db.collection("products").doc(id))))),
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
    db.collection("gadgetConsumption").get(),
  ]);

  const variants = new Map<string, any>();
  for (const snap of variantSnaps) {
    for (const d of snap.docs) {
      const v = d.data() as any;
      variants.set(`${v.productId}::${String(v.title ?? "")}`, v);
    }
  }
  const products = new Map<string, any>();
  for (const group of productSnaps) {
    for (const d of group) if (d.exists) products.set(d.id, d.data());
  }

  const stock = buildStockMap(rollSnap.docs, cutoutSnap.docs);
  const gadgets = new Map<string, any>();
  gadgetSnap.docs.forEach((d) => {
    const g = d.data() as any;
    if (g.gadgetTypeId) gadgets.set(g.gadgetTypeId, g);
  });

  const wanted = new Map<string, Consumption>();
  const unresolved: string[] = [];

  for (const item of items) {
    const qty = Math.max(1, Number(item?.quantity) || 1);
    const variant = variants.get(`${item?.productId}::${String(item?.title ?? "")}`);
    if (!variant) { unresolved.push(`${item?.productId}::${item?.title}`); continue; }

    const design = resolveMaterialCode(variant, stock);
    // Accessories and anything not made from stocked material simply do not
    // draw down; that is not an error.
    if (!design) continue;

    const multiplier = Number(variant.materialMultiplier) || 1;
    let amount: number;
    let collection: Consumption["collection"];
    let unit: Consumption["unit"];

    if (design.kind === "cutout") {
      collection = "cutoutInventory";
      unit = "sheets";
      amount = multiplier * qty;
    } else {
      collection = "rollInventory";
      unit = "m";
      const product = products.get(String(item?.productId));
      const gadget = product ? gadgets.get(product.gadgetTypeId) : null;
      if (!gadget || !(gadget.lengthCm > 0) || !(gadget.widthCm > 0)) {
        unresolved.push(`${design.code} (no consumption row for its gadget)`);
        continue;
      }
      // Inverse of the availability sum: a unit costs its own area out of a
      // roll 29.5 cm wide, expressed in metres of length.
      const cm = (Number(gadget.lengthCm) * Number(gadget.widthCm) * multiplier) / ROLL_WIDTH_CM;
      amount = (cm / 100) * qty;
    }

    const key = `${collection}/${design.id}`;
    const prev = wanted.get(key);
    if (prev) prev.amount += amount;
    else wanted.set(key, { collection, docId: design.id, code: design.code, amount, unit });
  }

  if (!wanted.size) {
    if (unresolved.length) console.warn("reserveMaterial: nothing drawn down", { unresolved });
    return;
  }

  const taken = await db.runTransaction(async (tx) => {
    const entries = [...wanted.values()];
    const refs = entries.map((e) => db.collection(e.collection).doc(e.docId));
    const snaps = await tx.getAll(...refs);
    const applied: any[] = [];

    entries.forEach((e, i) => {
      const snap = snaps[i];
      if (!snap.exists) return;
      const field = e.unit === "sheets" ? "sheetsAvailable" : "metersAvailable";
      const before = Number((snap.data() as any)?.[field]) || 0;
      // Clamped: an oversell is a counting problem to look at later, not a
      // reason to write a negative stock figure.
      const after = Math.max(0, Number((before - e.amount).toFixed(4)));
      tx.update(refs[i], { [field]: after, updatedAt: Date.now() });
      applied.push({ code: e.code, unit: e.unit, requested: e.amount, before, after, short: e.amount > before });
    });
    return applied;
  });

  const short = taken.filter((t) => t.short);
  if (short.length) console.warn("reserveMaterial: stock went short", { order: orderRef.id, short });
  if (unresolved.length) console.warn("reserveMaterial: unresolved lines", { order: orderRef.id, unresolved });

  await orderRef.update({ materialConsumed: taken, materialReservedAt: Date.now() });

  // Selling one view changes what the others can still make, so push the new
  // figures out to every variant sharing the design.
  try {
    const resynced = await syncStockForDesign(db, taken.map((t) => t.code));
    const moved = resynced.filter((r) => r.changed).length;
    if (moved) console.log("reserveMaterial: restocked variants", { order: orderRef.id, count: moved });
  } catch (e: any) {
    console.error("reserveMaterial: stock sync failed", { order: orderRef.id, error: e?.message || e });
  }
}


/**
 * Pushes material availability into the number the storefront actually reads.
 *
 * Sheets and metres are what the shelf holds; `inventoryQuantity` is what the
 * product page, the cart and the trending rails gate on. They were unrelated —
 * a design could have two sheets while every variant made from it sat at zero,
 * because someone had typed zero months ago.
 *
 * So whenever stock moves, every variant backed by that design is rewritten
 * from it: a two-sheet cutout becomes two lids and one lid-plus-keyboard, and
 * selling either re-runs this and moves the other.
 */
export async function syncStockForDesign(
  db: admin.firestore.Firestore,
  codes: string[]
): Promise<Array<{ sku: string; units: number; changed: boolean }>> {
  const wanted = new Set(codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
  if (!wanted.size) return [];

  const [rollSnap, cutoutSnap, gadgetSnap, variantSnap, productSnap] = await Promise.all([
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
    db.collection("gadgetConsumption").get(),
    db.collection("variants").get(),
    db.collection("products").get(),
  ]);

  const stock = buildStockMap(rollSnap.docs, cutoutSnap.docs);

  /*
   * Match on the stock record, not on the string that named it.
   *
   * A cutout answers to several codes, and the resolver reports whichever one
   * is primary. Comparing the caller's code against that primary would silently
   * skip a sync requested by an alias — ask for LP-04 and nothing moves,
   * because the design calls itself LC-04.
   */
  const wantedIds = new Set<string>();
  for (const code of wanted) {
    const entry = stock.get(code);
    if (entry) wantedIds.add(`${entry.kind}/${entry.id}`);
  }
  if (!wantedIds.size) return [];

  const products = new Map(productSnap.docs.map((d) => [d.id, d.data() as any]));
  const gadgets = new Map<string, any>();
  gadgetSnap.docs.forEach((d) => {
    const g = d.data() as any;
    if (g.gadgetTypeId) gadgets.set(g.gadgetTypeId, g);
  });

  const matched: Array<{
    ref: admin.firestore.DocumentReference;
    units: number;
    sku: string;
    changed: boolean;
  }> = [];
  for (const d of variantSnap.docs) {
    const v = d.data() as any;
    const entry = resolveMaterialCode(v, stock);
    if (!entry || !wantedIds.has(`${entry.kind}/${entry.id}`)) continue;

    const multiplier = Math.max(Number(v.materialMultiplier) || 1, 0.01);
    let units: number;

    if (entry.kind === "cutout") {
      units = Math.floor(entry.amount / multiplier);
    } else {
      const product = products.get(v.productId);
      const gadget = product ? gadgets.get(product.gadgetTypeId) : null;
      if (!gadget || !(gadget.lengthCm > 0) || !(gadget.widthCm > 0)) continue;
      const areaPerUnit = Number(gadget.lengthCm) * Number(gadget.widthCm) * multiplier;
      units = Math.floor((ROLL_WIDTH_CM * entry.amount * 100) / areaPerUnit);
    }

    // Every variant the design backs is reported, changed or not. Reporting
    // only the writes read as "nothing happened" whenever the shelf already
    // agreed with the listing, which is the normal case and not a failure.
    matched.push({
      ref: d.ref,
      units,
      sku: String(v.sku || ""),
      changed: Number(v.inventoryQuantity) !== units,
    });
  }

  const writes = matched.filter((m) => m.changed);
  for (let i = 0; i < writes.length; i += 450) {
    const batch = db.batch();
    writes.slice(i, i + 450).forEach((w) =>
      batch.update(w.ref, { inventoryQuantity: w.units, stockFromMaterialAt: Date.now() })
    );
    await batch.commit();
  }
  return matched.map((m) => ({ sku: m.sku, units: m.units, changed: m.changed }));
}

/** Admin-triggered recalculation, used after editing sheets or metres. */
export const recalcMaterialStock = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const codes: string[] = Array.isArray(data?.codes) ? data.codes : data?.code ? [data.code] : [];
  if (!codes.length) throw new HttpsError("invalid-argument", "A design code is required");
  const matched = await syncStockForDesign(admin.firestore(), codes);
  return {
    success: true,
    matched: matched.length,
    updated: matched.filter((m) => m.changed).length,
    variants: matched.slice(0, 50),
  };
});

/**
 * What the mapping actually resolves to, for the admin tab to display.
 *
 * The tab used to compute its own answer from the `rNumber` field alone and
 * disagreed with the order pipeline by nearly three hundred variants, all of
 * them reported as unmapped when they were fine. It now asks this, so what an
 * admin sees is by construction what happens when someone checks out.
 *
 * Unmatched variants are grouped by SKU prefix rather than listed flat,
 * because the useful question is never "which variant" but "which family of
 * codes has no stock behind it" — L- and M- are phone cutouts that are simply
 * not stocked by sheet yet, and that reads very differently from a roll that
 * has gone missing under everything that references it.
 */
export const materialMapping = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();

  const [rollSnap, cutoutSnap, variantSnap, productSnap] = await Promise.all([
    db.collection("rollInventory").get(),
    db.collection("cutoutInventory").get(),
    db.collection("variants").get(),
    db.collection("products").get(),
  ]);

  const stock = buildStockMap(rollSnap.docs, cutoutSnap.docs);
  const products = new Map(productSnap.docs.map((d) => [d.id, d.data() as any]));

  const groups: Record<string, any> = {};
  /*
   * Unmatched variants in full, and how many of their SKU siblings do match.
   *
   * The coverage figure is what separates a job from a fact. `R-` sits at 97%
   * — 968 of its SKUs find a roll and 26 do not — so those 26 are an anomaly
   * worth chasing. `TRIPOD-` and `GOLF-` are at 0%, which is not a gap in the
   * mapping, it is a tripod. Sending both to the same list buries the first
   * under the second.
   */
  const unmatchedByPrefix: Record<
    string,
    { count: number; matched: number; items: Array<{ variantId: string; sku: string; productTitle: string; variantTitle: string }> }
  > = {};
  const matchedByPrefix: Record<string, number> = {};
  let matchedCount = 0;

  for (const d of variantSnap.docs) {
    const v = d.data() as any;
    const product = products.get(v.productId);
    const entry = resolveMaterialCode(v, stock);

    const sku = String(v.sku || "").trim();
    const prefix = (sku.split("-")[0] || "(no sku)").toUpperCase();

    if (!entry) {
      const bucket = (unmatchedByPrefix[prefix] ||= { count: 0, matched: 0, items: [] });
      bucket.count += 1;
      bucket.items.push({
        variantId: d.id,
        sku,
        productTitle: product?.title || "",
        variantTitle: String(v.title || ""),
      });
      continue;
    }

    matchedByPrefix[prefix] = (matchedByPrefix[prefix] || 0) + 1;
    matchedCount += 1;
    const g = (groups[entry.code] ||= {
      code: entry.code,
      kind: entry.kind,
      designName: entry.designName,
      amount: entry.amount,
      unit: entry.kind === "cutout" ? "sheets" : "m",
      items: [],
    });
    g.items.push({
      variantId: d.id,
      productId: v.productId,
      productTitle: product?.title || "",
      sku: String(v.sku || ""),
      variantTitle: String(v.title || ""),
      materialMultiplier: Number(v.materialMultiplier) || 1,
      // True only when a hand-set rNumber is doing the work — that is, the SKU
      // alone would not have found this. Previously every grouped row claimed
      // to be manual, because the field was the only way in.
      isManual:
        !!v.rNumber &&
        resolveMaterialCode({ sku: v.sku }, stock)?.id !== entry.id,
    });
  }

  // Stock nobody is selling: a roll or cutout on the shelf that no variant
  // resolves to. The other half of the coverage question, and invisible until
  // you ask it from this side.
  const orphanStock = Object.values(
    [...stock.values()].reduce((acc: Record<string, any>, e) => {
      const key = `${e.kind}/${e.id}`;
      if (!acc[key] && !groups[e.code]) {
        acc[key] = { code: e.code, kind: e.kind, designName: e.designName, amount: e.amount };
      }
      return acc;
    }, {})
  );

  for (const [prefix, bucket] of Object.entries(unmatchedByPrefix)) {
    bucket.matched = matchedByPrefix[prefix] || 0;
    // Longest SKUs last: within a prefix the plain codes are the interesting
    // ones and the long view-suffixed variants are repetition.
    bucket.items.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));
  }

  return {
    totals: {
      variants: variantSnap.size,
      matched: matchedCount,
      unmatched: variantSnap.size - matchedCount,
      rollCodes: rollSnap.size,
      cutoutRecords: cutoutSnap.size,
    },
    groups,
    unmatchedByPrefix,
    orphanStock,
  };
});
