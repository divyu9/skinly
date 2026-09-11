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
exports.resyncAllCollections = exports.syncProductCollections = exports.productMatchesCollection = void 0;
const functionsV1 = __importStar(require("firebase-functions/v1"));
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
/**
 * Keeps collectionProducts in step with each collection's own conditions.
 *
 * Membership used to be materialised by hand and drifted as the catalogue
 * grew — 206 products matched a collection they were never linked to. A
 * product write now re-evaluates that one product against every collection.
 *
 * Links this function creates carry source:"auto" and are the only ones it
 * will ever remove, so anything curated by hand survives.
 */
const AUTO = "auto";
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Whole-word, not substring. "red" as a substring matches "3D Textured",
 * which would have dragged 297 unrelated products into a colour collection.
 */
const containsWord = (haystack, needle) => {
    const n = needle.trim().toLowerCase();
    if (!n)
        return false;
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(n)}([^a-z0-9]|$)`, "i").test(haystack);
};
const matchesRule = (p, rule) => {
    const value = String((rule === null || rule === void 0 ? void 0 : rule.value) || "").toLowerCase();
    if (!value)
        return false;
    if ((rule === null || rule === void 0 ? void 0 : rule.field) === "sku") {
        const skus = p.skus.map((s) => s.toLowerCase());
        switch (rule.condition) {
            case "contains": return skus.some((s) => s.includes(value));
            case "notContains": return skus.every((s) => !s.includes(value));
            case "startsWith": return skus.some((s) => s.startsWith(value));
            case "equals": return skus.some((s) => s === value);
            default: return false;
        }
    }
    const title = p.title.toLowerCase();
    switch (rule === null || rule === void 0 ? void 0 : rule.condition) {
        case "contains": return title.includes(value);
        case "notContains": return !title.includes(value);
        case "startsWith": return title.startsWith(value);
        case "equals": return title === value;
        default: return false;
    }
};
const productMatchesCollection = (p, collection) => {
    const rules = collection === null || collection === void 0 ? void 0 : collection.rules;
    if (Array.isArray(rules) && rules.length > 0) {
        const fn = (collection.matchLogic || "all") === "all" ? "every" : "some";
        return rules[fn]((r) => matchesRule(p, r));
    }
    const keywords = (collection === null || collection === void 0 ? void 0 : collection.keywords) || [];
    if (keywords.length === 0)
        return false;
    return keywords.some((k) => containsWord(p.title, k));
};
exports.productMatchesCollection = productMatchesCollection;
const loadProduct = async (productId, data) => {
    const vs = await admin.firestore().collection("variants").where("productId", "==", productId).get();
    return {
        id: productId,
        title: String((data === null || data === void 0 ? void 0 : data.title) || ""),
        skus: vs.docs.map((d) => String(d.data().sku || "")),
    };
};
/** Reconciles one product against every collection. */
const syncProduct = async (productId, data) => {
    const db = admin.firestore();
    const existing = await db.collection("collectionProducts").where("productId", "==", productId).get();
    const byCollection = new Map(existing.docs.map((d) => [d.data().collectionId, d]));
    // Product deleted or archived — drop only what we added.
    if (!data || data.status === "archived") {
        const batch = db.batch();
        let removed = 0;
        existing.docs.forEach((d) => {
            if (d.data().source === AUTO) {
                batch.delete(d.ref);
                removed++;
            }
        });
        if (removed)
            await batch.commit();
        return { added: 0, removed };
    }
    const product = await loadProduct(productId, data);
    const collections = await db.collection("collections").get();
    const batch = db.batch();
    let added = 0;
    let removed = 0;
    for (const c of collections.docs) {
        const should = (0, exports.productMatchesCollection)(product, c.data());
        const link = byCollection.get(c.id);
        if (should && !link) {
            batch.set(db.collection("collectionProducts").doc(`${c.id}_${productId}`), {
                collectionId: c.id,
                productId,
                source: AUTO,
                _creationTime: Date.now(),
            });
            added++;
        }
        else if (!should && link && link.data().source === AUTO) {
            batch.delete(link.ref);
            removed++;
        }
    }
    if (added || removed)
        await batch.commit();
    return { added, removed };
};
exports.syncProductCollections = functionsV1.firestore
    .document("products/{productId}")
    .onWrite(async (change, context) => {
    const productId = context.params.productId;
    const after = change.after.exists ? change.after.data() : null;
    // Only re-evaluate when something matching depends on actually changed.
    if (change.before.exists && after) {
        const b = change.before.data();
        if (b.title === after.title && b.status === after.status)
            return null;
    }
    const result = await syncProduct(productId, after);
    if (result.added || result.removed) {
        console.log(`collection sync ${productId}:`, result);
    }
    return null;
});
/** Rebuilds membership for the whole catalogue. */
exports.resyncAllCollections = (0, https_1.onCall)(async (_data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const db = admin.firestore();
    const [productsSnap, collectionsSnap, linksSnap, variantsSnap] = await Promise.all([
        db.collection("products").get(),
        db.collection("collections").get(),
        db.collection("collectionProducts").get(),
        db.collection("variants").get(),
    ]);
    const skusByProduct = new Map();
    variantsSnap.docs.forEach((d) => {
        const pid = d.data().productId;
        if (!pid)
            return;
        const list = skusByProduct.get(pid) || [];
        list.push(String(d.data().sku || ""));
        skusByProduct.set(pid, list);
    });
    const linkKey = (c, p) => `${c}|${p}`;
    const links = new Map(linksSnap.docs.map((d) => [linkKey(d.data().collectionId, d.data().productId), d]));
    let batch = db.batch();
    let pending = 0;
    let added = 0;
    let removed = 0;
    const flush = async () => {
        if (pending) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
        }
    };
    for (const pd of productsSnap.docs) {
        const data = pd.data();
        if (data.status === "archived")
            continue;
        const product = { id: pd.id, title: String(data.title || ""), skus: skusByProduct.get(pd.id) || [] };
        for (const c of collectionsSnap.docs) {
            const should = (0, exports.productMatchesCollection)(product, c.data());
            const link = links.get(linkKey(c.id, pd.id));
            if (should && !link) {
                batch.set(db.collection("collectionProducts").doc(`${c.id}_${pd.id}`), {
                    collectionId: c.id, productId: pd.id, source: AUTO, _creationTime: Date.now(),
                });
                added++;
                pending++;
            }
            else if (!should && link && link.data().source === AUTO) {
                batch.delete(link.ref);
                removed++;
                pending++;
            }
            if (pending >= 400)
                await flush();
        }
    }
    await flush();
    return { products: productsSnap.size, collections: collectionsSnap.size, added, removed };
});
//# sourceMappingURL=collectionSync.js.map