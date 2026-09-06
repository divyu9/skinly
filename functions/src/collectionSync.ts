import * as functionsV1 from "firebase-functions/v1";
import { onCall } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";

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

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whole-word, not substring. "red" as a substring matches "3D Textured",
 * which would have dragged 297 unrelated products into a colour collection.
 */
const containsWord = (haystack: string, needle: string): boolean => {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(n)}([^a-z0-9]|$)`, "i").test(haystack);
};

type Product = { id: string; title: string; skus: string[] };

const matchesRule = (p: Product, rule: any): boolean => {
  const value = String(rule?.value || "").toLowerCase();
  if (!value) return false;

  if (rule?.field === "sku") {
    const skus = p.skus.map((s) => s.toLowerCase());
    switch (rule.condition) {
      case "contains":    return skus.some((s) => s.includes(value));
      case "notContains": return skus.every((s) => !s.includes(value));
      case "startsWith":  return skus.some((s) => s.startsWith(value));
      case "equals":      return skus.some((s) => s === value);
      default:            return false;
    }
  }

  const title = p.title.toLowerCase();
  switch (rule?.condition) {
    case "contains":    return title.includes(value);
    case "notContains": return !title.includes(value);
    case "startsWith":  return title.startsWith(value);
    case "equals":      return title === value;
    default:            return false;
  }
};

export const productMatchesCollection = (p: Product, collection: any): boolean => {
  const rules = collection?.rules;
  if (Array.isArray(rules) && rules.length > 0) {
    const fn = (collection.matchLogic || "all") === "all" ? "every" : "some";
    return rules[fn]((r: any) => matchesRule(p, r));
  }

  const keywords: string[] = collection?.keywords || [];
  if (keywords.length === 0) return false;
  return keywords.some((k) => containsWord(p.title, k));
};

const loadProduct = async (productId: string, data: any): Promise<Product> => {
  const vs = await admin.firestore().collection("variants").where("productId", "==", productId).get();
  return {
    id: productId,
    title: String(data?.title || ""),
    skus: vs.docs.map((d) => String(d.data().sku || "")),
  };
};

/** Reconciles one product against every collection. */
const syncProduct = async (productId: string, data: any | null): Promise<{ added: number; removed: number }> => {
  const db = admin.firestore();
  const existing = await db.collection("collectionProducts").where("productId", "==", productId).get();
  const byCollection = new Map(existing.docs.map((d) => [d.data().collectionId as string, d]));

  // Product deleted or archived — drop only what we added.
  if (!data || data.status === "archived") {
    const batch = db.batch();
    let removed = 0;
    existing.docs.forEach((d) => {
      if (d.data().source === AUTO) { batch.delete(d.ref); removed++; }
    });
    if (removed) await batch.commit();
    return { added: 0, removed };
  }

  const product = await loadProduct(productId, data);
  const collections = await db.collection("collections").get();

  const batch = db.batch();
  let added = 0;
  let removed = 0;

  for (const c of collections.docs) {
    const should = productMatchesCollection(product, c.data());
    const link = byCollection.get(c.id);

    if (should && !link) {
      batch.set(db.collection("collectionProducts").doc(`${c.id}_${productId}`), {
        collectionId: c.id,
        productId,
        source: AUTO,
        _creationTime: Date.now(),
      });
      added++;
    } else if (!should && link && link.data().source === AUTO) {
      batch.delete(link.ref);
      removed++;
    }
  }

  if (added || removed) await batch.commit();
  return { added, removed };
};

export const syncProductCollections = functionsV1.firestore
  .document("products/{productId}")
  .onWrite(async (change, context) => {
    const productId = context.params.productId as string;
    const after = change.after.exists ? change.after.data() : null;

    // Only re-evaluate when something matching depends on actually changed.
    if (change.before.exists && after) {
      const b = change.before.data() as any;
      if (b.title === after.title && b.status === after.status) return null;
    }

    const result = await syncProduct(productId, after);
    if (result.added || result.removed) {
      console.log(`collection sync ${productId}:`, result);
    }
    return null;
  });

/** Rebuilds membership for the whole catalogue. */
export const resyncAllCollections = onCall(async (_data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();

  const [productsSnap, collectionsSnap, linksSnap, variantsSnap] = await Promise.all([
    db.collection("products").get(),
    db.collection("collections").get(),
    db.collection("collectionProducts").get(),
    db.collection("variants").get(),
  ]);

  const skusByProduct = new Map<string, string[]>();
  variantsSnap.docs.forEach((d) => {
    const pid = d.data().productId;
    if (!pid) return;
    const list = skusByProduct.get(pid) || [];
    list.push(String(d.data().sku || ""));
    skusByProduct.set(pid, list);
  });

  const linkKey = (c: string, p: string) => `${c}|${p}`;
  const links = new Map(linksSnap.docs.map((d) => [linkKey(d.data().collectionId, d.data().productId), d]));

  let batch = db.batch();
  let pending = 0;
  let added = 0;
  let removed = 0;

  const flush = async () => {
    if (pending) { await batch.commit(); batch = db.batch(); pending = 0; }
  };

  for (const pd of productsSnap.docs) {
    const data = pd.data() as any;
    if (data.status === "archived") continue;
    const product: Product = { id: pd.id, title: String(data.title || ""), skus: skusByProduct.get(pd.id) || [] };

    for (const c of collectionsSnap.docs) {
      const should = productMatchesCollection(product, c.data());
      const link = links.get(linkKey(c.id, pd.id));

      if (should && !link) {
        batch.set(db.collection("collectionProducts").doc(`${c.id}_${pd.id}`), {
          collectionId: c.id, productId: pd.id, source: AUTO, _creationTime: Date.now(),
        });
        added++; pending++;
      } else if (!should && link && link.data().source === AUTO) {
        batch.delete(link.ref);
        removed++; pending++;
      }
      if (pending >= 400) await flush();
    }
  }
  await flush();

  return { products: productsSnap.size, collections: collectionsSnap.size, added, removed };
});
