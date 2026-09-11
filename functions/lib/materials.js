"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalcMaterialStock = exports.syncStockForDesign = exports.reserveMaterialForOrder = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v1/https");
const auth_1 = require("./auth");
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
async function reserveMaterialForOrder(db, orderRef, items) {
    var _a, _b;
    const productIds = Array.from(new Set(items.map((i) => i === null || i === void 0 ? void 0 : i.productId).filter((p) => !!p)));
    if (!productIds.length)
        return;
    const chunks = [];
    for (let i = 0; i < productIds.length; i += 30)
        chunks.push(productIds.slice(i, i + 30));
    const [variantSnaps, productSnaps, rollSnap, cutoutSnap, gadgetSnap] = await Promise.all([
        Promise.all(chunks.map((c) => db.collection("variants").where("productId", "in", c).get())),
        Promise.all(chunks.map((c) => db.getAll(...c.map((id) => db.collection("products").doc(id))))),
        db.collection("rollInventory").get(),
        db.collection("cutoutInventory").get(),
        db.collection("gadgetConsumption").get(),
    ]);
    const variants = new Map();
    for (const snap of variantSnaps) {
        for (const d of snap.docs) {
            const v = d.data();
            variants.set(`${v.productId}::${String((_a = v.title) !== null && _a !== void 0 ? _a : "")}`, v);
        }
    }
    const products = new Map();
    for (const group of productSnaps) {
        for (const d of group)
            if (d.exists)
                products.set(d.id, d.data());
    }
    const rolls = new Map();
    rollSnap.docs.forEach((d) => {
        const r = d.data();
        if (r.rNumber)
            rolls.set(String(r.rNumber).trim().toUpperCase(), { id: d.id, data: r });
    });
    // A cutout answers to every code its views are sold under: LP-3D-05 and
    // L-3D-06 are two views of one design and draw on one pile of sheets.
    const cutouts = new Map();
    cutoutSnap.docs.forEach((d) => {
        const c = d.data();
        const entry = { id: d.id, data: c };
        for (const code of [c.cutoutNumber, ...(c.aliases || [])]) {
            if (code)
                cutouts.set(String(code).trim().toUpperCase(), entry);
        }
    });
    const gadgets = new Map();
    gadgetSnap.docs.forEach((d) => {
        const g = d.data();
        if (g.gadgetTypeId)
            gadgets.set(g.gadgetTypeId, g);
    });
    /** rNumber first, then progressively shorter leading segments of the SKU. */
    const designOf = (variant) => {
        const rn = String((variant === null || variant === void 0 ? void 0 : variant.rNumber) || "").trim().toUpperCase();
        if (rn && rolls.has(rn))
            return { kind: "roll", code: rn, entry: rolls.get(rn) };
        if (rn && cutouts.has(rn))
            return { kind: "cutout", code: rn, entry: cutouts.get(rn) };
        const parts = String((variant === null || variant === void 0 ? void 0 : variant.sku) || "").split("-");
        for (let k = parts.length - 1; k >= 1; k--) {
            const code = parts.slice(0, k).join("-").toUpperCase();
            if (rolls.has(code))
                return { kind: "roll", code, entry: rolls.get(code) };
            if (cutouts.has(code))
                return { kind: "cutout", code, entry: cutouts.get(code) };
        }
        return null;
    };
    const wanted = new Map();
    const unresolved = [];
    for (const item of items) {
        const qty = Math.max(1, Number(item === null || item === void 0 ? void 0 : item.quantity) || 1);
        const variant = variants.get(`${item === null || item === void 0 ? void 0 : item.productId}::${String((_b = item === null || item === void 0 ? void 0 : item.title) !== null && _b !== void 0 ? _b : "")}`);
        if (!variant) {
            unresolved.push(`${item === null || item === void 0 ? void 0 : item.productId}::${item === null || item === void 0 ? void 0 : item.title}`);
            continue;
        }
        const design = designOf(variant);
        // Accessories and anything not made from stocked material simply do not
        // draw down; that is not an error.
        if (!design)
            continue;
        const multiplier = Number(variant.materialMultiplier) || 1;
        let amount;
        let collection;
        let unit;
        if (design.kind === "cutout") {
            collection = "cutoutInventory";
            unit = "sheets";
            amount = multiplier * qty;
        }
        else {
            collection = "rollInventory";
            unit = "m";
            const product = products.get(String(item === null || item === void 0 ? void 0 : item.productId));
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
        const key = `${collection}/${design.entry.id}`;
        const prev = wanted.get(key);
        if (prev)
            prev.amount += amount;
        else
            wanted.set(key, { collection, docId: design.entry.id, code: design.code, amount, unit });
    }
    if (!wanted.size) {
        if (unresolved.length)
            console.warn("reserveMaterial: nothing drawn down", { unresolved });
        return;
    }
    const taken = await db.runTransaction(async (tx) => {
        const entries = [...wanted.values()];
        const refs = entries.map((e) => db.collection(e.collection).doc(e.docId));
        const snaps = await tx.getAll(...refs);
        const applied = [];
        entries.forEach((e, i) => {
            var _a;
            const snap = snaps[i];
            if (!snap.exists)
                return;
            const field = e.unit === "sheets" ? "sheetsAvailable" : "metersAvailable";
            const before = Number((_a = snap.data()) === null || _a === void 0 ? void 0 : _a[field]) || 0;
            // Clamped: an oversell is a counting problem to look at later, not a
            // reason to write a negative stock figure.
            const after = Math.max(0, Number((before - e.amount).toFixed(4)));
            tx.update(refs[i], { [field]: after, updatedAt: Date.now() });
            applied.push({ code: e.code, unit: e.unit, requested: e.amount, before, after, short: e.amount > before });
        });
        return applied;
    });
    const short = taken.filter((t) => t.short);
    if (short.length)
        console.warn("reserveMaterial: stock went short", { order: orderRef.id, short });
    if (unresolved.length)
        console.warn("reserveMaterial: unresolved lines", { order: orderRef.id, unresolved });
    await orderRef.update({ materialConsumed: taken, materialReservedAt: Date.now() });
    // Selling one view changes what the others can still make, so push the new
    // figures out to every variant sharing the design.
    try {
        const resynced = await syncStockForDesign(db, taken.map((t) => t.code));
        const moved = resynced.filter((r) => r.changed).length;
        if (moved)
            console.log("reserveMaterial: restocked variants", { order: orderRef.id, count: moved });
    }
    catch (e) {
        console.error("reserveMaterial: stock sync failed", { order: orderRef.id, error: (e === null || e === void 0 ? void 0 : e.message) || e });
    }
}
exports.reserveMaterialForOrder = reserveMaterialForOrder;
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
async function syncStockForDesign(db, codes) {
    const wanted = new Set(codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
    if (!wanted.size)
        return [];
    const [rollSnap, cutoutSnap, gadgetSnap, variantSnap, productSnap] = await Promise.all([
        db.collection("rollInventory").get(),
        db.collection("cutoutInventory").get(),
        db.collection("gadgetConsumption").get(),
        db.collection("variants").get(),
        db.collection("products").get(),
    ]);
    const stock = new Map();
    rollSnap.docs.forEach((d) => {
        const r = d.data();
        if (r.rNumber)
            stock.set(String(r.rNumber).trim().toUpperCase(), { kind: "roll", amount: Number(r.metersAvailable) || 0 });
    });
    cutoutSnap.docs.forEach((d) => {
        const c = d.data();
        for (const code of [c.cutoutNumber, ...(c.aliases || [])]) {
            if (code)
                stock.set(String(code).trim().toUpperCase(), { kind: "cutout", amount: Number(c.sheetsAvailable) || 0 });
        }
    });
    const products = new Map(productSnap.docs.map((d) => [d.id, d.data()]));
    const gadgets = new Map();
    gadgetSnap.docs.forEach((d) => {
        const g = d.data();
        if (g.gadgetTypeId)
            gadgets.set(g.gadgetTypeId, g);
    });
    /** rNumber, else the leading segments of the SKU. */
    const codeOf = (v) => {
        const rn = String((v === null || v === void 0 ? void 0 : v.rNumber) || "").trim().toUpperCase();
        if (rn && stock.has(rn))
            return rn;
        const parts = String((v === null || v === void 0 ? void 0 : v.sku) || "").split("-");
        for (let k = parts.length - 1; k >= 1; k--) {
            const code = parts.slice(0, k).join("-").toUpperCase();
            if (stock.has(code))
                return code;
        }
        const whole = String((v === null || v === void 0 ? void 0 : v.sku) || "").trim().toUpperCase();
        return stock.has(whole) ? whole : null;
    };
    const matched = [];
    for (const d of variantSnap.docs) {
        const v = d.data();
        const code = codeOf(v);
        if (!code || !wanted.has(code))
            continue;
        const entry = stock.get(code);
        const multiplier = Math.max(Number(v.materialMultiplier) || 1, 0.01);
        let units;
        if (entry.kind === "cutout") {
            units = Math.floor(entry.amount / multiplier);
        }
        else {
            const product = products.get(v.productId);
            const gadget = product ? gadgets.get(product.gadgetTypeId) : null;
            if (!gadget || !(gadget.lengthCm > 0) || !(gadget.widthCm > 0))
                continue;
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
        writes.slice(i, i + 450).forEach((w) => batch.update(w.ref, { inventoryQuantity: w.units, stockFromMaterialAt: Date.now() }));
        await batch.commit();
    }
    return matched.map((m) => ({ sku: m.sku, units: m.units, changed: m.changed }));
}
exports.syncStockForDesign = syncStockForDesign;
/** Admin-triggered recalculation, used after editing sheets or metres. */
exports.recalcMaterialStock = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const codes = Array.isArray(data === null || data === void 0 ? void 0 : data.codes) ? data.codes : (data === null || data === void 0 ? void 0 : data.code) ? [data.code] : [];
    if (!codes.length)
        throw new https_1.HttpsError("invalid-argument", "A design code is required");
    const matched = await syncStockForDesign(admin.firestore(), codes);
    return {
        success: true,
        matched: matched.length,
        updated: matched.filter((m) => m.changed).length,
        variants: matched.slice(0, 50),
    };
});
//# sourceMappingURL=materials.js.map