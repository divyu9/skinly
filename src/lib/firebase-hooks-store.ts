import { SHIPPING_DEFAULTS } from "./shipping-config.mjs";
/**
 * Everything that talks to Firestore for the storefront's reads: the query
 * handlers, the paginated listing and the helpers they share. Split out of
 * firebase-hooks.tsx so the Firestore SDK stays out of the first download;
 * firebase-hooks loads this on the first query (loadStore).
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from "./firebase-db";
import { functions } from "./firebase";
import { auth as firebaseAuth } from "./firebase-auth";
import { 
  collection, query, where, getDocs as fsGetDocs, onSnapshot as fsOnSnapshot, doc, getDoc as fsGetDoc,
  limit, orderBy, startAfter, setDoc, addDoc, updateDoc, deleteDoc,
  writeBatch, DocumentSnapshot, QuerySnapshot, documentId, getCountFromServer, deleteField, runTransaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/use-auth';
import { normalizeModelName } from '@/lib/mockups';
import { normalizeImageForUpload, withExtension } from '@/lib/image-processing';
import { normalizeOrder, normalizeOrderStatus, normalizePaymentStatus, ORDER_STATUSES } from "./normalize-order.ts";
import { collectionKey } from "./collection-key";
import { loadCatalogue, loadHomeProducts, loadModelCatalogue } from "./catalogue";
import { searchRows } from "./search-match";
import { calculateGST } from "./gst";
import { laptopBodyKeys, squash } from "./laptop-body";
import { brandInScope } from "./device-fit";
import { getPath, sortVariants } from './firebase-hooks';

export type QueryCtx = { path: string; args: any; setData: (v: any) => void; unsubscribe: () => void; isActive: () => boolean };



/*
 * Firestore read audit — off unless localStorage.skinly_read_audit === "1".
 *
 * Firestore bills per document read, and every storefront read goes through
 * this file, so this is where they can be counted: getDocs and getDoc by the
 * documents they return (an empty result still costs one), listeners by their
 * first result and then only the documents that change, cache hits not at all.
 * Each read is filed under the hook path that started it and the collection it
 * touched. Inspect window.__skinlyReads; reset with window.__skinlyReadsReset().
 */
export const readAuditOn = (() => {
  try { return typeof window !== "undefined" && localStorage.getItem("skinly_read_audit") === "1"; }
  catch { return false; }
})();

export let readLabel = "";

export type ReadRow = { reads: number; calls: number };

export const readAudit: { total: number; byPath: Record<string, ReadRow>; byCollection: Record<string, ReadRow> } =
  { total: 0, byPath: {}, byCollection: {} };

if (readAuditOn) {
  (window as any).__skinlyReads = readAudit;
  (window as any).__skinlyReadsReset = () => { readAudit.total = 0; readAudit.byPath = {}; readAudit.byCollection = {}; };
}

export const refPath = (ref: any): string => {
  try {
    if (typeof ref?.path === "string") return ref.path.split("/").filter((_: string, i: number) => i % 2 === 0).join("/");
    const p = ref?._query?.path;
    const cg = ref?._query?.collectionGroup;
    return cg ? `group:${cg}` : p?.canonicalString?.() || "unknown";
  } catch { return "unknown"; }
};

export const countRead = (label: string, target: string, n: number) => {
  readAudit.total += n;
  const a = (readAudit.byPath[label || "(untracked)"] ||= { reads: 0, calls: 0 });
  a.reads += n; a.calls += 1;
  const b = (readAudit.byCollection[target] ||= { reads: 0, calls: 0 });
  b.reads += n; b.calls += 1;
};

export const getDocs: typeof fsGetDocs = (async (q: any) => {
  const label = readLabel;
  const snap = await fsGetDocs(q);
  if (readAuditOn && !snap.metadata.fromCache) countRead(label, refPath(q), Math.max(1, snap.size));
  return snap;
}) as any;

export const getDoc: typeof fsGetDoc = (async (r: any) => {
  const label = readLabel;
  const snap = await fsGetDoc(r);
  if (readAuditOn && !snap.metadata.fromCache) countRead(label, refPath(r), 1);
  return snap;
}) as any;

export const onSnapshot: typeof fsOnSnapshot = ((ref: any, ...rest: any[]) => {
  if (!readAuditOn) return (fsOnSnapshot as any)(ref, ...rest);
  const label = readLabel;
  const target = refPath(ref);
  let first = true;
  const i = rest.findIndex((x) => typeof x === "function" || (x && typeof x.next === "function"));
  if (i === -1) return (fsOnSnapshot as any)(ref, ...rest);
  const orig = rest[i];
  const next = typeof orig === "function" ? orig : orig.next.bind(orig);
  const wrapped = (snap: any) => {
    if (!snap.metadata?.fromCache) {
      const n = typeof snap.docChanges === "function"
        ? (first ? Math.max(1, snap.size) : snap.docChanges().length)
        : 1;
      if (n) countRead(label, target, n);
      first = false;
    }
    return next(snap);
  };
  rest[i] = typeof orig === "function" ? wrapped : { ...orig, next: wrapped };
  return (fsOnSnapshot as any)(ref, ...rest);
}) as any;


// ─── catalogue-backed product reads ───────────────────────────────────────────
// See src/lib/catalogue.ts. Views pick from the build's catalogue, then read
// live only what they are about to show.

export const chunked = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};


/*
 * A storefront read of one order, through the viewOrder function
 * (functions/src/orderView.ts): the rules keep order documents to their owner
 * and admins, and viewOrder decides between the full order and a limited one
 * (no name, phone, address or tracking). The key a link we sent carries —
 * ?k= on the order link, ?t= on the pay link — is passed along, so a guest's
 * own link still opens their whole order.
 */
export async function viewOrderFor(orderId: string, opts: { withReviews?: boolean } = {}): Promise<any | null> {
  const qs = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  // The owner or an admin may read the document itself, at once; the function
  // (a cold start of several seconds) is for everyone else. The review page
  // asks for the order's own reviews, which only the function returns.
  if (!opts.withReviews) {
    try {
      // A reload restores the sign-in a moment after the page starts.
      await (firebaseAuth as any).authStateReady?.();
      if (firebaseAuth.currentUser) {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) return normalizeOrder({ _id: snap.id, ...snap.data(), access: 'full' });
      }
    } catch { /* not theirs: ask the function */ }
  }
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const res: any = await httpsCallable(getFunctions(), 'viewOrder')({
    orderId, ...(qs.get('k') ? { k: qs.get('k') } : {}), ...(qs.get('t') ? { t: qs.get('t') } : {}),
  });
  return res?.data ? normalizeOrder(res.data) : null;
}


export async function refreshProducts(list: any[], label: string): Promise<any[]> {
  if (!list.length) return [];
  const ids = [...new Set(list.map((p) => p._id))];
  readLabel = label;
  const [pSnaps, vSnaps] = await Promise.all([
    Promise.all(chunked(ids, 30).map((c) => getDocs(query(collection(db, 'products'), where(documentId(), 'in', c))))),
    Promise.all(chunked(ids, 30).map((c) => getDocs(query(collection(db, 'variants'), where('productId', 'in', c))))),
  ]);
  const fresh = new Map<string, any>();
  pSnaps.forEach((snap) => snap.docs.forEach((d) => fresh.set(d.id, { _id: d.id, ...d.data() })));
  const variants = new Map<string, any[]>();
  vSnaps.forEach((snap) => snap.docs.forEach((d) => {
    const v: any = { _id: d.id, ...d.data() };
    if (!variants.has(v.productId)) variants.set(v.productId, []);
    variants.get(v.productId)!.push(v);
  }));
  return list
    .map((p) => {
      const doc = fresh.get(p._id);
      if (!doc || doc.status !== 'active') return null;
      return { ...p, ...doc, variants: variants.get(p._id) || [] };
    })
    .filter(Boolean);
}


export let sinceBuild: Promise<{ touched: Set<string>; active: any[] }> | null = null;

/**
 * The products the catalogue file has wrong, and their variants.
 *
 * Two questions, because a listing starts being sellable at two different
 * moments. It may have been created after the build — that is what
 * `_creationTime` answers. Or it may have been created before the build as a
 * draft and gone live after it: a launch makes its listings as drafts when
 * "Publish new listings now" is off, and each one flips to active when its
 * first picture is approved, which can be an hour or a day later. Asking only
 * the first question left 29 live listings out of search and off the grid
 * after one launch, their pictures approved, their stock counted, and nothing
 * to show for it until the next scheduled rebuild hours later.
 *
 * The answer also carries which products were touched at all, so the stale
 * copy in the file is dropped rather than merged over — including one that
 * has since been drafted or archived, which should disappear, not linger.
 */
export function productsSinceBuild(builtAt: number) {
  if (!sinceBuild) {
    sinceBuild = (async () => {
      readLabel = 'catalogue:sinceBuild';
      // A product written before `updatedAt` existed, or never edited since it
      // was made, is missing from one query or the other — hence both.
      const [made, changed] = await Promise.all([
        getDocs(query(collection(db, 'products'), where('_creationTime', '>', builtAt))),
        getDocs(query(collection(db, 'products'), where('updatedAt', '>', builtAt))),
      ]);
      const rows = new Map<string, any>();
      for (const d of [...made.docs, ...changed.docs]) rows.set(d.id, { _id: d.id, ...d.data() });
      const touched = new Set(rows.keys());
      const active = await refreshProducts([...rows.values()].filter((p) => p.status === 'active'), 'catalogue:sinceBuild');
      return { touched, active };
    })().catch(() => ({ touched: new Set<string>(), active: [] as any[] }));
  }
  return sinceBuild;
}


export let modelsSinceBuild: Promise<any[]> | null = null;

/**
 * Every active supported model — the build's list plus any added since (a
 * model an admin adds must be pickable at once). null without the file.
 */
export async function catalogueModels(): Promise<any[] | null> {
  const cat = await loadModelCatalogue();
  if (!cat) return null;
  if (!modelsSinceBuild) {
    modelsSinceBuild = (async () => {
      readLabel = 'catalogue:modelsSinceBuild';
      const snap = await getDocs(query(collection(db, 'supportedModels'), where('_creationTime', '>', cat.builtAt)));
      return snap.docs.map((d) => ({ _id: d.id, ...d.data() } as any)).filter((m) => m.isActive === true);
    })().catch(() => []);
  }
  const extra = await modelsSinceBuild;
  const known = new Set(cat.models.map((m) => m._id));
  return [...extra.filter((m) => !known.has(m._id)), ...cat.models];
}


/**
 * Every active product with its variants — the build's catalogue plus
 * anything created since. null when there is no catalogue file, in which case
 * callers use their original Firestore reads.
 */
/*
 * The orders a tax export covers: confirmed ones only (paid, or COD), dated
 * by their invoice, with their GST. Unpaid checkouts used to be counted, the
 * date filter read _creationTime (which orders placed since the move to
 * Firebase don't have, so "this month" came back empty), and no order carried
 * GST, so the report said ₹0. Orders confirmed before invoices were issued
 * (functions/src/orderConfirm.ts) get their GST worked out here.
 */
export function exportRows(orders: any[], args: any): any[] {
  const { startDate, endDate, status } = args || {};
  const statusFilter = status && status !== 'all' ? status : null;
  const confirmed = (o: any) => !!o?.invoiceNumber
    || (!o?.isDeleted && (o?.paymentStatus === 'success' || String(o?.paymentMethod || '').toLowerCase() === 'cod'));
  const when = (o: any) => Number(o?.invoiceDate || o?.confirmedAt || o?.createdAt || o?._creationTime || 0);
  return orders
    .filter(confirmed)
    .filter((o) => !(startDate && endDate) || (when(o) >= startDate && when(o) <= endDate))
    .filter((o) => !statusFilter || o?.status === statusFilter)
    .map((o) => {
      if (o.taxableAmount != null && o.totalGstAmount != null) return o;
      const g = calculateGST(Number(o.total ?? o.amountPayable ?? 0) || 0, String(o.shippingAddress?.state || ''));
      return { ...o, taxableAmount: g.taxableAmount, gstRate: 18, totalGstAmount: g.totalGstAmount,
        cgstRate: g.cgstRate ? 9 : 0, sgstRate: g.sgstRate ? 9 : 0, igstRate: g.igstRate ? 18 : 0,
        cgstAmount: g.cgstAmount || 0, sgstAmount: g.sgstAmount || 0, igstAmount: g.igstAmount || 0 };
    })
    .sort((a, b) => (String(a.invoiceFy || '').localeCompare(String(b.invoiceFy || '')))
      || (Number(a.invoiceSeq || 0) - Number(b.invoiceSeq || 0)) || (when(a) - when(b)));
}


/*
 * What a coupon is for, as a test on a product line — the same rule placeOrder
 * bills by (functions/src/placeorder.ts, couponEligibleTotal). Null when the
 * coupon is for everything. MAG300 is "₹300 off Magneto X" and was offered on
 * every phone skin's page, because nothing here read its variants.
 */
export async function couponScope(c: any): Promise<null | ((line: { productId: string; variant?: string; variantId?: string; title?: string }) => boolean)> {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  const variantIds = list(c.applicableVariantIds);
  const collections = list(c.applicableCollectionIds);
  const words = list(c.applicableProductKeywords).map((w) => w.toLowerCase().trim()).filter(Boolean);
  if (!variantIds.length && !collections.length && !words.length) return null;
  const variantKeys = new Set<string>();
  await Promise.all(variantIds.slice(0, 30).map(async (id) => {
    const v = await getDoc(doc(db, 'variants', id));
    if (v.exists()) variantKeys.add(`${v.data().productId}::${String(v.data().title).trim()}`);
  }));
  const inCollection = new Set<string>();
  for (let i = 0; i < collections.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'collectionProducts'), where('collectionId', 'in', collections.slice(i, i + 30))));
    snap.docs.forEach((d) => inCollection.add(String(d.data().productId)));
  }
  return (line) =>
    variantIds.includes(String(line.variantId || '')) ||
    variantKeys.has(`${line.productId}::${String(line.variant || '').trim()}`) ||
    (!line.variant && !line.variantId && [...variantKeys].some((k) => k.startsWith(`${line.productId}::`))) ||
    inCollection.has(line.productId) ||
    words.some((w) => String(line.title || '').toLowerCase().includes(w));
}


/*
 * "Complete Your Setup" for a skin: the same design on the buyer's other
 * devices first, then other designs for the same device.
 *
 * It took the first six skins in the catalogue, whatever they were, so an
 * iPhone skin's page offered a gimbal skin at ₹499, a Tamron lens and three
 * chargers. The design a person has just chosen, on their laptop and their
 * charger, is the one thing on the page most likely to go in the same order.
 * One per device, most-owned devices first, so it is never six lens skins.
 */
export function designOf(p: any): string {
  const up = /\/design-raw\/([A-Z]+-\d+)-/.exec(String(p?.designImageUrl || ''))?.[1];
  if (up) return up;
  if (p?.design) return String(p.design);
  for (const v of p?.variants || []) {
    const m = /^([A-Z]+-\d+)(?:-[A-Z][A-Z0-9]*)?$/.exec(String(v?.sku || '').trim().toUpperCase());
    if (m) return m[1];
  }
  return '';
}

export function setupPicks(product: any, productId: string, candidates: any[], brand?: string): any[] {
  /*
   * Other designs for the same device, one listing per design.
   *
   * A design is listed once per brand (Apple iPhone, Samsung Galaxy, OnePlus,
   * Android…), so the row showed "Adult Drama" four times running. Each design
   * now appears once, as the listing of the same kind as this page's (an
   * iPhone page shows the iPhone listing) where there is one. The same design
   * on the buyer's other gadgets has its own row (SameDesignOtherGadgets).
   */
  // With the shopper's brand known, only listings that fit it (an iPhone
  // shopper was shown OnePlus listings on the older, brand-less pages).
  const withPhoto = candidates.filter((p) => p.productCategory === product.productCategory && p.images?.[0]?.url && (!brand || brandInScope(p, brand)));
  const design = designOf(product);
  const fitsBrand = (p: any) => !!brand && (p.modelBrands || []).length > 0 && brandInScope(p, brand);
  const sameDevice = withPhoto
    .filter((p) => p.gadgetCategory === product.gadgetCategory && p._id !== productId && (!design || designOf(p) !== design))
    .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));
  const byDesign = new Map<string, any>();
  for (const p of sameDevice) {
    const key = designOf(p) || p._id;
    const cur = byDesign.get(key);
    const better = cur && (
      (fitsBrand(p) && !fitsBrand(cur)) ||
      (fitsBrand(p) === fitsBrand(cur) && !!p.listingKind && p.listingKind === product.listingKind && cur.listingKind !== product.listingKind));
    if (!cur || better) byDesign.set(key, p);
  }
  return [...byDesign.values()];
}


export async function catalogueProducts(): Promise<any[] | null> {
  const cat = await loadCatalogue();
  if (!cat) return null;
  const { touched, active } = await productsSinceBuild(cat.builtAt);
  return [...active, ...cat.products.filter((p) => !touched.has(p._id))];
}

export const R2_PUBLIC_DOMAIN = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";


// Mockups for 28 models (every iPhone before the 17, plus Nothing Phone 3/3A and
// CMF Phone 1) were lost with the Cloudinary account, so those rows carry a dead
// cloudinaryUrl and no r2Key. Those models fall back to the hero model's mockup
// for the same design rather than rendering a broken image.
/*
 * Mockup lookups repeat constantly — every device change and every remount
 * asks the same brand/model/sku question. Held for the tab so re-picking a
 * model someone already looked at costs nothing.
 */
export const mockupLookupCache = new Map<string, any>();


export const HERO_MOCKUP_BRAND = "Apple";

export const HERO_MOCKUP_MODEL = "iPhone 17 Pro Max";


// Only r2Key-backed rows are usable; a bare cloudinaryUrl no longer resolves.
export const mockupUrlFrom = (m: any): string | null =>
  m?.r2Key ? `${R2_PUBLIC_DOMAIN}/${m.r2Key.split("/").map(encodeURIComponent).join("/")}` : null;


// SKUs differ by suffix between catalogs, e.g. R-01 vs R-01-PH.
/*
 * The SKUs a mockup may be filed under. Brand listings carry the design code
 * with the brand after it (R-44-IPH, R-73-SAM) while mockups are filed under
 * the design alone (R-44), so asking for the listing's SKU exactly found
 * nothing: 114 live phone listings showed no model picture despite having
 * one. The full SKU is asked for too, and preferred when both exist.
 */
export const mockupSkuCandidates = (sku: string): string[] => {
  const full = String(sku || "").trim();
  const base = full.replace(/^([A-Za-z]+-\d+)-[A-Za-z0-9]+$/, "$1");
  return base && base !== full ? [full, base] : [full];
};


export const skuMatches = (mockupSku: string, target: string): boolean => {
  const a = (mockupSku || "").toUpperCase();
  const b = (target || "").toUpperCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b + "-") || b.startsWith(a + "-");
};


// User documents were imported from the previous backend under its own ids, so
// users/{authUid} does not exist for anyone who predates the move — their
// balance, name and admin flag live on a document keyed by the old id. Resolve
// via the email the account already proves, falling back to the auth uid so new
// signups still get a document.
export const userDocIdCache = new Map<string, string>();

export const resolveUserDocId = async (user: { uid: string; email: string | null }): Promise<string> => {
  const cached = userDocIdCache.get(user.uid);
  if (cached) return cached;

  let resolved = user.uid;
  try {
    const byUid = await getDoc(doc(db, 'users', user.uid));
    if (!byUid.exists() && user.email) {
      // Rules only let a user read their own document, so this collection query
      // is denied for non-admins. Falling back to the auth uid is correct there
      // — never let it take the page down.
      const byEmail = await getDocs(query(collection(db, 'users'), where('email', '==', user.email), limit(1)));
      if (!byEmail.empty) resolved = byEmail.docs[0].id;
    }
  } catch {
    resolved = user.uid;
  }
  userDocIdCache.set(user.uid, resolved);
  return resolved;
};


// Rows created before the move reference the old user id, rows created since
// reference the auth uid, so anything owned by a user has to be looked up under
// both or their history silently starts at the migration date.
export const userIdCandidates = async (user: { uid: string; email: string | null }): Promise<string[]> => {
  const resolved = await resolveUserDocId(user);
  return resolved === user.uid ? [user.uid] : [user.uid, resolved];
};


/**
 * Firestore rejects `undefined` at any depth, not just at the top level.
 *
 * Objects lose the undefined keys; arrays keep every element (dropping one
 * would silently reorder an image gallery) but each element is cleaned.
 */
export function stripUndefinedDeep(value: any): any {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)])
    );
  }
  return value;
}



/** Products re-read live on a listing's first load: about two screens of cards. */
export const LIVE_FIRST_SCREENS = 48;

export async function runQuery(c: QueryCtx) {
  const { path, args, setData } = c;
  readLabel = path;
  if (path === 'homepage.getActiveHomepageSections') {
          const q = query(collection(db, 'homepageSections'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            /*
             * This one decides which sections exist and in what order, so an
             * empty cache read unmounts the entire homepage for a frame and
             * remounts it when the server answers. The tallest section paid
             * for it: the customer videos went 426px → 0 → 706px, a single
             * 0.65 layout shift and most of the page's CLS.
             */
            if (snap.empty && snap.metadata.fromCache) return;
            /*
             * A section's config, as an object, whichever way it was saved.
             *
             * Some sections store config as an object and some as a JSON
             * string — Most Trendy's is `"{\"title\":\"Most Trendy\",...,
             * \"cardWidth\":280}"` — and every component reads it as an
             * object. On a string, `config.cardWidth` is undefined, so each
             * card took its image's natural size: 1360px tall on a 335px
             * phone, one of them 1204px wide, under a heading with no text.
             * It surfaced once "trendy" products existed for it to show.
             */
            const asObject = (c: unknown) => {
              if (typeof c !== 'string') return c;
              try { return JSON.parse(c); } catch { return {}; }
            };
            let data = snap.docs.map(d => { const x: any = d.data(); return { _id: d.id, ...x, config: asObject(x.config) }; });
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveCategoryDisplaySettings') {
          const q = query(collection(db, 'categoryDisplaySettings'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveHeroSlides') {
          const q = query(collection(db, 'heroSlides'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            /*
             * An empty answer from the local cache is not an answer.
             *
             * onSnapshot fires immediately from cache, which on a first visit
             * is empty. The slider read that as "no slides", returned null, and
             * a 425px-tall element vanished from the middle of the homepage
             * until the server replied — a single 0.65 layout shift, most of
             * the page's entire CLS. Staying undefined keeps the skeleton up,
             * which is already exactly the right height.
             */
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveFeatureBanners') {
          const q = query(collection(db, 'featureBanners'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveUgcVideos') {
          const q = query(collection(db, 'ugcVideos'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepageSectionCards.getActiveSectionCards') {
          const q = query(collection(db, 'homepageSectionCards'), where('sectionId', '==', args?.sectionId));
          c.unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getHomepageSettings') {
          c.unsubscribe = onSnapshot(doc(db, 'homepageSettings', 'default'), (snap) => {
            setData(snap.exists() ? snap.data() : null);
          });
        }
        else if (path === 'homepage.getProductsByTags' || path === 'products.getProductsByTag') {
          const limitNum = args?.maxProducts || args?.limit || 10;
          const tagsArg = args?.tags || (args?.tag ? [args.tag] : []);
          const pickTagged = (list: any[]) => tagsArg.length
            ? list.filter((d: any) => tagsArg.some((t: string) => (d.tags || []).includes(t)))
            : list;

          /*
           * The homepage's rows come from the build's small home.json when
           * it covers every tag asked for: its cards show at once, then the
           * live read below corrects price and stock (and adds anything tagged
           * since the build). Waiting on the whole catalogue first took ~3 s
           * on a phone before a single card appeared.
           */
          const home = tagsArg.length ? await loadHomeProducts() : null;
          if (home && tagsArg.every((t: string) => home.tags.includes(t))) {
            const quick = pickTagged(home.products);
            if (c.isActive() && quick.length) setData(quick.slice(0, limitNum));
            const { touched, active: changed } = await productsSinceBuild(home.builtAt);
            const tagged = pickTagged([...changed, ...home.products.filter((p) => !touched.has(p._id))]);
            const shown = await refreshProducts(tagged.slice(0, limitNum + 4), path);
            if (c.isActive()) setData(shown.slice(0, limitNum));
            return;
          }

          const fromCatalogue = await catalogueProducts();
          if (fromCatalogue) {
            const tagged = tagsArg.length
              ? fromCatalogue.filter((d: any) => tagsArg.some((t: string) => (d.tags || []).includes(t)))
              : fromCatalogue;
            // A few spare in case some have gone inactive since the build.
            const shown = await refreshProducts(tagged.slice(0, limitNum + 4), path);
            if (c.isActive()) setData(shown.slice(0, limitNum));
            return;
          }
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          c.unsubscribe = onSnapshot(q, async (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (tagsArg.length) {
              docs = docs.filter((d: any) => {
                if (!d.tags) return false;
                const dTags = Array.isArray(d.tags) ? d.tags : d.tags.split(',').map((t: string) => t.trim());
                return tagsArg.some((t: string) => dTags.includes(t));
              });
            }
            docs = docs.slice(0, limitNum);
            
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData(finalProducts);
          });
        }
        else if (path === 'homepage.getMarqueeModels') {
          const q = query(collection(db, 'supportedModels'), limit(args?.maxModels || 20));
          c.unsubscribe = onSnapshot(q, (snap) => {
            // `brand`/`model` are not what these rows are called — every doc
            // stores brandName/modelName, so the strip scrolled the words
            // "undefined undefined" once for each model it supports.
            const models = snap.docs
              .map((d) => {
                const data = d.data() as any;
                if (data.isActive === false) return "";
                return [data.brandName ?? data.brand, data.modelName ?? data.model]
                  .filter(Boolean)
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
              })
              .filter(Boolean);
            setData(models);
          });
        }
        else if (path === 'cart.getCartCount') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          // Helper to subscribe to auth changes
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData(0);
              return;
            }
            const q = query(collection(db, 'cart'), where('userId', 'in', await userIdCandidates(user)));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              const count = snap.docs.reduce((acc, doc) => acc + (doc.data().quantity || 1), 0);
              setData(count);
            });
          });
          
          c.unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'cart.getCart') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData([]);
              return;
            }
            // Removed orderBy('addedAt', 'desc') from the query to avoid requiring a composite index.
            // Sorting will be done in-memory.
            const q = query(collection(db, 'cart'), where('userId', 'in', await userIdCandidates(user)));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => (b.addedAt || 0) - (a.addedAt || 0));
              setData(docs);
            });
          });
          
          c.unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'orders.getOrders') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            // Clear existing listener when user changes
            innerUnsubscribe();
            
            if (!user) {
              setData([]);
              return;
            }
            
            // Orders placed as a guest with this account's verified email are
            // moved into it first (once per sign-in per tab); the listener
            // below then picks them up as their userId changes.
            const claimKey = `skinly_claimed_${user.uid}`;
            try {
              if (!sessionStorage.getItem(claimKey)) {
                sessionStorage.setItem(claimKey, '1');
                void httpsCallable(functions, 'claimGuestOrders')({}).catch((e) => {
                  sessionStorage.removeItem(claimKey);
                  console.warn('claimGuestOrders failed', e);
                });
              }
            } catch { /* storage blocked: skip the claim */ }

            // Removed orderBy('createdAt', 'desc') to avoid requiring a composite index.
            // Sorting is done in-memory.
            // By ownerUid, the one field the rules let a customer list on:
            // userId is a mix of sign-in ids, old user-document ids and guest
            // sessions (see functions/src/ownership.ts).
            const q = query(collection(db, 'orders'), where('ownerUid', '==', user.uid));
            
            innerUnsubscribe = onSnapshot(q, (snap) => {
              // Normalised like the admin reads are. The customer pages print
              // order.total.toFixed(2) and order.items.length straight out, and
              // five live orders carry no items at all — raw, those took the
              // whole account page down, and there is no error boundary on the
              // storefront to soften it.
              let docs = snap.docs.map(d => normalizeOrder({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => {
                const aTime = a.createdAt || a._creationTime || 0;
                const bTime = b.createdAt || b._creationTime || 0;
                return bTime - aTime;
              });
              if (args?.limit) {
                docs = docs.slice(0, args.limit);
              }
              setData(docs);
            }, (error) => {
              console.error("orders.getOrders error:", error);
            });
          });
          
          c.unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'orders.getOrderPublic') {
          if (!args?.orderId) { setData(null); return; }
          /*
           * A customer back from PhonePe usually lands before PhonePe's
           * confirmation reaches us, while the order still reads
           * pending_payment. It used to be read once, so the page never saw it
           * paid — and the purchase was never reported (lib/analytics.ts). Until
           * it settles, it is read again every 4 s, for about a minute.
           */
          let tries = 0;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const load = () => viewOrderFor(String(args.orderId), { withReviews: !!args.withReviews })
            .then((o) => {
              if (!c.isActive()) return;
              setData(o);
              const waiting = o && o.status === 'pending_payment' && o.paymentStatus !== 'failed';
              if (waiting && ++tries < 15) timer = setTimeout(load, 4000);
            })
            .catch((e) => { console.error('viewOrder failed', e); if (c.isActive()) setData(null); });
          void load();
          c.unsubscribe = () => { if (timer) clearTimeout(timer); };
        }
        else if (path === 'orders.getLastOrderedDevice') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData(null);
              return;
            }
            const q = query(collection(db, 'orders'), where('ownerUid', '==', user.uid), limit(1));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              if (snap.empty) {
                setData(null);
                return;
              }
              const orderData = snap.docs[0].data();
              const firstItem = orderData.items?.[0];
              if (firstItem && firstItem.phoneModel) {
                setData({ brand: firstItem.phoneBrand, model: firstItem.phoneModel });
              } else {
                setData(null);
              }
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'orders.getOrderByMerchantTransaction') {
          if (!args?.merchantTransactionId) {
            setData(null);
            return;
          }
          // The order stores PhonePe's id as paymentTransactionId; this asked
          // for paymentId, which no order has, so it never found one.
          // Only a signed-in customer may search orders, and only their own.
          const me = firebaseAuth.currentUser;
          if (!me) { setData(null); return; }
          const q = query(collection(db, 'orders'), where('ownerUid', '==', me.uid),
            where('paymentTransactionId', '==', args.merchantTransactionId), limit(1));
          c.unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.empty ? null : { _id: snap.docs[0].id, ...snap.docs[0].data() });
          });
        }
        else if (path === 'orders.checkOrderInventory') {
          if (!args?.orderId) {
            setData(null);
          } else {
            (async () => {
              const viewed = await viewOrderFor(String(args.orderId)).catch(() => null);
              if (!viewed) {
                setData({ available: false, unavailableItems: [] });
                return;
              }
              const items: any[] = viewed.items || [];
              const unavailableItems: any[] = [];
              for (const item of items) {
                const vsnap = await getDocs(query(
                  collection(db, 'variants'),
                  where('productId', '==', item.productId),
                  where('title', '==', item.variant),
                  limit(1)
                ));
                const available = vsnap.empty ? 0 : (vsnap.docs[0].data().inventoryQuantity || 0);
                if (available < item.quantity) {
                  unavailableItems.push({
                    productTitle: item.productTitle,
                    variant: item.variant,
                    requested: item.quantity,
                    available,
                  });
                }
              }
              setData({ available: unavailableItems.length === 0, unavailableItems });
            })();
          }
        }
        else if (path === 'coupons.getActiveCoupons' || path === 'coupons.getAllCoupons') {
          let q = query(collection(db, 'coupons'));
          if (path === 'coupons.getActiveCoupons') {
            q = query(collection(db, 'coupons'), where('isActive', '==', true));
          }
          c.unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            /*
             * Checkout's "available coupons" list — only the store's own
             * promotions. It listed every active coupon, the personal ones
             * too (abandoned-cart codes, isPublic: false), newest first, so
             * each code emailed to one customer headed everyone's checkout
             * and was spent by a stranger before its owner came back.
             */
            if (path === 'coupons.getActiveCoupons') {
              const now = Date.now();
              data = data.filter((c: any) =>
                c.isPublic !== false &&
                c.source !== 'abandoned_cart' &&
                !(Array.isArray(c.allowedCustomerEmails) && c.allowedCustomerEmails.length) &&
                (!c.startDate || Number(c.startDate) <= now) &&
                (!c.endDate || Number(c.endDate) >= now) &&
                (!c.expiresAt || Number(c.expiresAt) > now) &&
                (!c.usageLimit || (Number(c.usageCount) || 0) < Number(c.usageLimit)));
            }
            data = data.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(data);
          });
        }
        else if (path === 'checkoutUpsells.getUpsellsForCart') {
          // The rule schema and this reader had nothing in common.
          //
          // A rule is written as { upsellProducts: [{productId, variantId,
          // discountedPrice}], containsGadgetCategories, cartValueMin,
          // cartValueOperator, matchLogic }. This read rule.offerProductId,
          // rule.title, rule.discountType and rule.discountValue — none of
          // which any rule has — so the `if (rule.offerProductId)` guard was
          // never true and the list came back empty every time. The one
          // configured rule has never shown, in the cart or at checkout.
          const cartLines: any[] = Array.isArray(args?.cartItems) ? args.cartItems : [];
          if (!cartLines.length) { setData([]); return; }

          c.unsubscribe = onSnapshot(
            query(collection(db, 'checkoutUpsells'), where('isActive', '==', true)),
            async (snap) => {
              try {
                const rules = snap.docs
                  .map((d) => ({ _id: d.id, ...(d.data() as any) }))
                  .sort((a, b) => (b.priority || 0) - (a.priority || 0));
                if (!rules.length) { setData([]); return; }

                const cartValue = cartLines.reduce(
                  (sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);
                const inCart = new Set(cartLines.map((i) => String(i?.productId)));

                // What is already in the basket decides which rules fire, so
                // the cart's own products have to be read first.
                const cartProductIds = [...inCart].filter(Boolean);
                const cartProductSnaps = await Promise.all(
                  cartProductIds.map((id) => getDoc(doc(db, 'products', id)))
                );
                const cartCategories = new Set(
                  cartProductSnaps
                    .filter((d) => d.exists())
                    .map((d) => String((d.data() as any).gadgetCategory || '').toLowerCase())
                    .filter(Boolean)
                );

                const passes = (rule: any): boolean => {
                  const checks: boolean[] = [];
                  if (rule.cartValueMin != null) {
                    const min = Number(rule.cartValueMin) || 0;
                    checks.push(rule.cartValueOperator === '<=' ? cartValue <= min : cartValue >= min);
                  }
                  const cats: string[] = Array.isArray(rule.containsGadgetCategories) ? rule.containsGadgetCategories : [];
                  if (cats.length) {
                    checks.push(cats.some((c) => cartCategories.has(String(c).toLowerCase())));
                  }
                  if (!checks.length) return true;
                  return rule.matchLogic === 'any' ? checks.some(Boolean) : checks.every(Boolean);
                };

                // One entry per product: a rule lists each variant separately,
                // and the card offers a variant picker rather than a row each.
                const byProduct = new Map<string, { ruleId: string; variants: any[] }>();
                for (const rule of rules) {
                  if (!passes(rule)) continue;
                  for (const entry of (rule.upsellProducts || [])) {
                    const pid = String(entry?.productId || '');
                    if (!pid || inCart.has(pid)) continue;   // never upsell what they already have
                    if (!byProduct.has(pid)) byProduct.set(pid, { ruleId: rule._id, variants: [] });
                    byProduct.get(pid)!.variants.push(entry);
                  }
                }
                if (!byProduct.size) { setData([]); return; }

                const ids = [...byProduct.keys()].slice(0, 6);
                const [productDocs, variantSnaps] = await Promise.all([
                  Promise.all(ids.map((id) => getDoc(doc(db, 'products', id)))),
                  Promise.all(ids.map((id) =>
                    getDocs(query(collection(db, 'variants'), where('productId', '==', id))))),
                ]);

                const out: any[] = [];
                ids.forEach((pid, idx) => {
                  const pdoc = productDocs[idx];
                  if (!pdoc.exists()) return;
                  const product: any = pdoc.data();
                  const known = new Map(variantSnaps[idx].docs.map((v) => [v.id, v.data() as any]));
                  const listed = byProduct.get(pid)!;

                  const allVariants = listed.variants
                    .map((entry) => {
                      const v = known.get(String(entry.variantId));
                      if (!v) return null;
                      return {
                        variantId: String(entry.variantId),
                        variantTitle: String(v.title || 'Default'),
                        price: Number(v.price) || 0,
                        // An offer above today's price is no offer (the glass was repriced from ₹449 to ₹299).
                        discountedPrice: Math.min(Number(entry.discountedPrice) || Number(v.price) || 0, Number(v.price) || 0),
                      };
                    })
                    .filter(Boolean) as any[];
                  if (!allVariants.length) return;

                  const first = allVariants[0];
                  const image = Array.isArray(product.images)
                    ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url)
                    : undefined;
                  out.push({
                    ruleId: listed.ruleId,
                    productId: pid,
                    productTitle: product.title,
                    productImage: image,
                    variantId: first.variantId,
                    variantTitle: first.variantTitle,
                    originalPrice: first.price,
                    discountedPrice: first.discountedPrice,
                    hasMultipleVariants: allVariants.length > 1,
                    allVariants,
                  });
                });
                setData(out);
              } catch (err) {
                console.error('getUpsellsForCart failed:', err);
                setData([]);
              }
            }
          );
        }
        else if (path === 'shipping.getShippingSettings') {
          c.unsubscribe = onSnapshot(doc(db, 'settings', 'shipping'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({
                baseRate: 0,
                freeShippingThreshold: SHIPPING_DEFAULTS.freeShippingThreshold,
                flatShippingFee: SHIPPING_DEFAULTS.flatShippingFee,
                codFee: 50,
                expressShippingFee: 100,
                expressShippingEnabled: true,
                shippingIncludesTax: false
              });
            }
          });
        }
        else if (path === 'wallet.getWalletStats') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData({ 
                currentBalance: 0, 
                lifetimeEarned: 0, 
                lifetimeSpent: 0, 
                totalCredit: 0, 
                totalDebit: 0, 
                pendingWithdrawals: 0, 
                activeWallets: 0 
              });
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), async (snap) => {
              const userData = snap.exists() ? snap.data() : {};
              
              // Now fetch transactions to calculate stats
              const q = query(collection(db, 'walletTransactions'), where('ownerUid', '==', user.uid));
              const txSnap = await getDocs(q);
              
              let currentBalance = userData.walletBalance || 0;
              let lifetimeEarned = 0;
              let lifetimeSpent = 0;
              let totalCredit = 0;
              let totalDebit = 0;
              
              txSnap.docs.forEach(d => {
                const tx = d.data();
                if (tx.transactionType === 'credit') {
                  lifetimeEarned += tx.amount || 0;
                  totalCredit += tx.amount || 0;
                } else if (tx.transactionType === 'debit') {
                  lifetimeSpent += tx.amount || 0;
                  totalDebit += tx.amount || 0;
                }
              });

              setData({ 
                currentBalance, 
                lifetimeEarned, 
                lifetimeSpent, 
                totalCredit, 
                totalDebit, 
                pendingWithdrawals: 0, 
                activeWallets: 0 
              });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'wallet.getWalletTransactions') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData([]);
              return;
            }

            const q = query(collection(db, 'walletTransactions'), where('ownerUid', '==', user.uid));
            innerUnsubscribe = onSnapshot(q, (snap) => {
              const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0));
              setData(docs);
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'wallet.getWalletBalance') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData({ balance: 0 });
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              setData(snap.exists() ? { balance: snap.data().walletBalance || 0, userId: user.uid } : { balance: 0, userId: user.uid });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'whatsappConsent.getMyConsent') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            innerUnsubscribe();
            if (!user) {
              setData({ consentType: "none", hasConsent: false, consented: false, optInDate: null, phoneNumber: "" });
              return;
            }
            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              const u: any = snap.exists() ? snap.data() : {};
              const consentType = u.whatsappConsentType || "none";
              setData({
                consentType,
                hasConsent: consentType !== "none",
                consented: consentType !== "none",
                optInDate: u.whatsappConsentAt ?? null,
                phoneNumber: u.phoneNumber || user.phoneNumber || "",
              });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'loginOtp.checkPhoneVerified') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            innerUnsubscribe();
            if (!user) {
              setData({ verified: false, phoneNumber: null });
              return;
            }
            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              const u: any = snap.exists() ? snap.data() : {};
              // Firebase Auth owns phone verification; the user doc only mirrors it.
              const phoneNumber = user.phoneNumber || u.phoneNumber || null;
              setData({ verified: Boolean(user.phoneNumber || u.phoneVerified), phoneNumber });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'cod.isCodAvailable') {
          (async () => {
            const cartItems: any[] = Array.isArray(args?.cartItems) ? args.cartItems : [];
            const totalAmount: number = args?.totalAmount ?? 0;

            const ssnap = await getDocs(query(collection(db, 'codSettings'), limit(1)));
            const s: any = ssnap.empty ? null : ssnap.docs[0].data();
            const deny = (reason: string, isMixedCart = false) => setData({
              available: false, codFee: 0, prepaidAmount: 0, codAmount: 0,
              reason, isMixedCart, showOption: s?.showCodOnPaymentPage ?? true,
            });

            if (!s || !s.enabled) {
              deny("COD is not enabled");
              return;
            }

            const productIdsOn = s.productIdsEnabled && (s.productIds?.length ?? 0) > 0;
            const collectionIdsOn = s.collectionIdsEnabled && (s.collectionIds?.length ?? 0) > 0;
            const variantIdsOn = s.variantIdsEnabled && (s.variantIds?.length ?? 0) > 0;
            const hasItemLevelConditions = productIdsOn || collectionIdsOn || variantIdsOn;

            const eligibility = await Promise.all(cartItems.map(async (item) => {
              const checks: boolean[] = [];
              if (productIdsOn) checks.push(s.productIds.includes(item.productId));
              if (collectionIdsOn) {
                const p = await getDoc(doc(db, 'products', item.productId));
                const pdata: any = p.exists() ? p.data() : null;
                if (!pdata) {
                  checks.push(false);
                } else if (pdata.collectionId && s.collectionIds.includes(pdata.collectionId)) {
                  checks.push(true);
                } else {
                  const cp = await getDocs(query(collection(db, 'collectionProducts'),
                    where('productId', '==', item.productId)));
                  checks.push(cp.docs.some(d => s.collectionIds.includes(d.data().collectionId)));
                }
              }
              if (variantIdsOn) {
                const v = await getDocs(query(collection(db, 'variants'),
                  where('productId', '==', item.productId), where('title', '==', item.variant), limit(1)));
                checks.push(!v.empty && s.variantIds.includes(v.docs[0].id));
              }
              if (checks.length === 0) return true;
              return s.matchMode === "ALL" ? checks.every(Boolean) : checks.some(Boolean);
            }));

            const eligibleCount = eligibility.filter(Boolean).length;
            const isMixedCart = eligibleCount > 0 && eligibleCount < cartItems.length;
            if (isMixedCart && !s.allowMixedCartCod) {
              deny("COD not available for mixed product orders", true);
              return;
            }

            const totalProductCount = cartItems.reduce((n, i) => n + (i.quantity || 0), 0);
            const conditions: boolean[] = [];
            if (s.minOrderAmountEnabled) conditions.push(totalAmount >= s.minOrderAmount);
            if (s.maxOrderAmountEnabled) conditions.push(totalAmount <= s.maxOrderAmount);
            if (s.minProductCountEnabled) conditions.push(totalProductCount >= s.minProductCount);
            if (s.maxProductCountEnabled) conditions.push(totalProductCount <= s.maxProductCount);

            let passed: boolean;
            if (conditions.length === 0 && eligibleCount === 0 && !hasItemLevelConditions) passed = true;
            else if (hasItemLevelConditions && eligibleCount === 0) passed = false;
            else if (eligibleCount === 0) passed = conditions.every(Boolean);
            else passed = conditions.length === 0 ? true : conditions.every(Boolean);

            if (!passed) {
              let reason = "Order does not meet COD eligibility criteria";
              if (hasItemLevelConditions && eligibleCount === 0) reason = "COD not available for the selected products";
              else if (s.minOrderAmountEnabled && totalAmount < s.minOrderAmount) reason = `Minimum order amount ₹${s.minOrderAmount} required for COD`;
              else if (s.maxOrderAmountEnabled && totalAmount > s.maxOrderAmount) reason = `Maximum order amount ₹${s.maxOrderAmount} exceeded for COD`;
              deny(reason, isMixedCart);
              return;
            }

            const codFee = s.codFeeType === "fixed" ? (s.codFeeValue || 0) : (totalAmount * (s.codFeeValue || 0)) / 100;
            let prepaidAmount = 0;
            let codAmount = totalAmount + codFee;
            if (s.partialCodEnabled) {
              prepaidAmount = s.prepaidType === "fixed" ? (s.prepaidValue || 0) : (totalAmount * (s.prepaidValue || 0)) / 100;
              codAmount = totalAmount + codFee - prepaidAmount;
            }

            setData({ available: true, codFee, prepaidAmount, codAmount, reason: "", isMixedCart, showOption: true, otpRequired: s.otpRequired === true });
          })();
        }
        else if (path === 'wallet.calculateMaxWalletUsage') {
          const orderTotal: number = args?.orderTotal ?? 0;
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();

          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            innerUnsubscribe();
            if (!user) {
              setData({ maxUsage: 0, currentBalance: 0, canUseWallet: false });
              return;
            }
            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), async (snap) => {
              const currentBalance = snap.exists() ? (snap.data().walletBalance || 0) : 0;
              const ssnap = await getDocs(query(collection(db, 'walletSettings'), limit(1)));
              const s: any = ssnap.empty ? null : ssnap.docs[0].data();

              if (s && s.walletEnabled === false) {
                setData({ maxUsage: 0, currentBalance, canUseWallet: false });
                return;
              }

              let maxUsage: number;
              if (!s || s.maxUsageType === "unlimited") {
                maxUsage = Math.min(currentBalance, orderTotal);
              } else if (s.maxUsageType === "percentage") {
                maxUsage = Math.min(currentBalance, (orderTotal * s.maxUsageValue) / 100, orderTotal);
              } else {
                maxUsage = Math.min(currentBalance, s.maxUsageValue, orderTotal);
              }

              setData({
                maxUsage: Math.max(0, maxUsage),
                currentBalance,
                canUseWallet: s?.walletEnabled !== false && currentBalance > 0,
              });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'cashbackHelpers.calculateCartCashback') {
          const items: any[] = Array.isArray(args?.items) ? args.items : [];
          if (items.length === 0) {
            setData({ totalCashback: 0, itemCashbacks: [] });
          } else {
            (async () => {
              const cartTotal = items.reduce((sum, i) => sum + i.finalPrice * i.quantity, 0);
              const rsnap = await getDocs(query(collection(db, 'cashbackRules'), where('isActive', '==', true)));
              const rules = rsnap.docs.map(d => ({ _id: d.id, ...d.data() } as any));

              const itemCashbacks = await Promise.all(items.map(async (item) => {
                // A cart line names its variant; a variant rule names an id.
                let variantId = item.variantId;
                if (!variantId && item.variantTitle && rules.some(r => r.targetType === "variant")) {
                  const vs = await getDocs(query(collection(db, 'variants'), where('productId', '==', item.productId)));
                  variantId = vs.docs.find(d => d.data().title === item.variantTitle)?.id;
                }
                let collectionIds: string[] = [];
                if (rules.some(r => r.targetType === "collection")) {
                  const cp = await getDocs(query(collection(db, 'collectionProducts'),
                    where('productId', '==', item.productId)));
                  collectionIds = cp.docs.map(d => d.data().collectionId);
                }

                const applicable = rules.filter(r =>
                  (r.targetType === "variant" && !!variantId && r.targetId === variantId) ||
                  (r.targetType === "product" && r.targetId === item.productId) ||
                  (r.targetType === "collection" && collectionIds.includes(r.targetId))
                ).filter(r =>
                  (r.minCartValue === undefined || r.minCartValue === null || cartTotal >= Number(r.minCartValue)) &&
                  (r.maxCartValue === undefined || r.maxCartValue === null || cartTotal <= Number(r.maxCartValue))
                );

                const perUnit = applicable.reduce((best, r) => {
                  const amount = Math.round(r.cashbackType === "fixed"
                    ? Number(r.cashbackValue) || 0
                    : (item.finalPrice * (Number(r.cashbackValue) || 0)) / 100);
                  return amount > best ? amount : best;
                }, 0);

                return {
                  productId: item.productId,
                  variantId,
                  cashbackPerUnit: perUnit,
                  totalCashback: perUnit * item.quantity,
                  quantity: item.quantity,
                };
              }));

              setData({
                totalCashback: itemCashbacks.reduce((s, i) => s + i.totalCashback, 0),
                itemCashbacks,
              });
            })();
          }
        }
        else if (path === 'cart.checkCartItemsStock') {
          const cartItems: any[] = Array.isArray(args?.cartItems) ? args.cartItems : [];
          if (cartItems.length === 0) {
            setData([]);
          } else {
            (async () => {
              const status = await Promise.all(cartItems.map(async (item) => {
                try {
                  const vsnap = await getDocs(query(
                    collection(db, 'variants'),
                    where('productId', '==', item.productId),
                    where('title', '==', item.variant),
                    limit(1)
                  ));
                  if (vsnap.empty) {
                    return { productId: item.productId, variant: item.variant, isOutOfStock: true, availableQuantity: 0 };
                  }
                  const available = vsnap.docs[0].data().inventoryQuantity || 0;
                  return {
                    productId: item.productId,
                    variant: item.variant,
                    isOutOfStock: available <= 0 || available < item.quantity,
                    availableQuantity: available,
                    requestedQuantity: item.quantity,
                  };
                } catch (e) {
                  console.error(`stock check failed for ${item.productId}:`, e);
                  // Never block checkout because the lookup itself failed
                  return { productId: item.productId, variant: item.variant, isOutOfStock: false, availableQuantity: 999 };
                }
              }));
              setData(status);
            })();
          }
        }
        else if (path === 'mockups.getMockupFileId') {
          /*
           * Returns { url, model, exact } — which phone the picture is actually
           * of, not just a URL.
           *
           * It used to return a bare string, so the caller could not tell an
           * exact match from the fallback and captioned every one of them
           * "Preview on <your model>". Choosing iPhone 12 on L-56, which has
           * no iPhone 12 shot, put an iPhone 17 Pro Max on screen under a
           * label promising an iPhone 12.
           *
           * The fallback is also better now. Straight to the global hero
           * skipped over iPhone 12 Pro and iPhone 12 Pro Max, which are the
           * same slab of glass at the same size, in favour of a phone four
           * generations later. Siblings come first, and they cost nothing
           * extra: they are in the brand+sku result already fetched.
           */
          if (!args?.brand || !args?.model || !args?.sku) {
            setData(null);
          } else {
            const cacheKey = `${args.brand}|${args.model}|${args.sku}|${args.gadget || ''}`;
            const cached = mockupLookupCache.get(cacheKey);
            if (cached !== undefined) {
              setData(cached);
            } else {
            (async () => {
              const finish = (value: any) => {
                mockupLookupCache.set(cacheKey, value);
                setData(value);
              };

              const skus = mockupSkuCandidates(args.sku);
              // The full SKU's row first, then the design's.
              const firstUsable = (docs: any[]) =>
                docs.filter(d => mockupUrlFrom(d.data()))
                  .sort((a, b) => Number(b.data().sku === args.sku) - Number(a.data().sku === args.sku))[0];
              const exact = await getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', args.brand),
                where('model', '==', args.model),
                where('sku', 'in', skus),
                limit(2)
              ));
              const exactHit = firstUsable(exact.docs);
              const exactUrl = exactHit ? mockupUrlFrom(exactHit.data()) : null;
              if (exactUrl) {
                finish({ url: exactUrl, model: args.model, exact: true });
                return;
              }

              // Model names vary in spacing/punctuation between catalogs, so
              // retry on brand+sku and compare normalized model names. Narrowed
              // by brand, so this is a handful of documents, not the catalogue.
              const wanted = normalizeModelName(args.model).toLowerCase();
              const bySku = await getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', args.brand),
                where('sku', 'in', skus),
                limit(500)
              ));
              const usable = bySku.docs.filter(d => mockupUrlFrom(d.data()));

              const hit = usable.find(d =>
                normalizeModelName(d.data().model || "").toLowerCase() === wanted
              );
              if (hit) {
                finish({ url: mockupUrlFrom(hit.data()), model: hit.data().model, exact: true });
                return;
              }

              /*
               * Nearest sibling: the candidate sharing the longest leading run
               * of characters with the wanted name. "iPhone 12" picks "iPhone
               * 12 Pro" over "iPhone 16 Pro", because they agree for nine
               * characters rather than seven. Required to share a real prefix,
               * so a Samsung never stands in for a Pixel.
               */
              let best: { doc: any; score: number } | null = null;
              for (const d of usable) {
                const candidate = normalizeModelName(d.data().model || "").toLowerCase();
                let i = 0;
                while (i < wanted.length && i < candidate.length && wanted[i] === candidate[i]) i++;
                // Ties to the alphabetically first model, as the listing does, so both show the same phone.
                const name = String(d.data().model || '');
                if (i >= 6 && (!best || i > best.score || (i === best.score && name < String(best.doc.data().model || '')))) best = { doc: d, score: i };
              }
              if (best) {
                finish({ url: mockupUrlFrom(best.doc.data()), model: best.doc.data().model, exact: false });
                return;
              }

              // The hero is a phone: a Mac mini, laptop or camera listing shows its own picture instead.
              if (args.gadget && args.gadget !== 'phone') { finish(null); return; }
              const hero = await getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', HERO_MOCKUP_BRAND),
                where('model', '==', HERO_MOCKUP_MODEL),
                where('sku', 'in', skus),
                limit(2)
              ));
              const heroHit = firstUsable(hero.docs);
              finish(heroHit
                ? { url: mockupUrlFrom(heroHit.data()), model: HERO_MOCKUP_MODEL, exact: false }
                : null);
            })();
            }
          }
        }
        else if (path === 'supportedModels.getMetadata') {
          const q = query(collection(db, 'modelMetadata'), where('key', '==', 'current'), limit(1));
          c.unsubscribe = onSnapshot(q, (snap) => {
            if (snap.empty) {
              setData({
                brands: [],
                totalModels: 0,
                byCategory: {
                  phone: { brands: [], count: 0 },
                  laptop: { brands: [], count: 0 },
                  tablet: { brands: [], count: 0 },
                  camera: { brands: [], count: 0 },
                  lens: { brands: [], count: 0 },
                  drone: { brands: [], count: 0 },
                  charger: { brands: [], count: 0 },
                }
              });
            } else {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            }
          });
        }
        else if (path === 'supportedModels.getBrandModels') {
          if (!args?.brand || !args?.category) {
            setData([]);
            return;
          }
          try {
            const q = query(
              collection(db, 'supportedModels'), 
              where('brandName', '==', args.brand),
              where('category', '==', args.category),
              where('isActive', '==', true)
            );
            c.unsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              // Client-side sorting
              docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
              setData(docs);
            }, (error) => {
              console.error("Index error, falling back to client-side filter", error);
              const fallbackQ = query(
                collection(db, 'supportedModels'), 
                where('brandName', '==', args.brand)
              );
              c.unsubscribe = onSnapshot(fallbackQ, (snap) => {
                let docs = snap.docs
                  .map(d => ({ _id: d.id, ...d.data() }))
                  .filter((d: any) => d.category === args.category && d.isActive === true);
                docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
                setData(docs);
              });
            });
          } catch (e) {
            console.error("Error in getBrandModels", e);
          }
        }
        else if (path === 'supportedModels.searchModels') {
          const searchParam = args?.searchTerm || args?.query;
          if (!searchParam || searchParam.length < 2) {
            setData([]);
            return;
          }
          const modelRows = await catalogueModels();
          if (modelRows) {
            const hits = searchRows(modelRows, searchParam, (d: any) => String(d.modelName || ''), (d: any) => `${d.brandName} ${d.modelName}`);
            if (c.isActive()) setData(hits.slice(0, args?.limit || 10));
            return;
          }
          // Fetch all active models to search in-memory
          const q = query(collection(db, 'supportedModels'), where('isActive', '==', true));
          c.unsubscribe = onSnapshot(q, (snap) => {
            const filtered = searchRows(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any)), searchParam,
              (d: any) => String(d.modelName || ''), (d: any) => `${d.brandName} ${d.modelName}`);
            setData(filtered.slice(0, args?.limit || 10));
          });
        }
        else if (path === 'supportedModels.listAll') {
          const shape = (list: any[]) => {
            let models = list;
            if (args?.category !== undefined) models = models.filter(m => m.category === args.category);
            if (args?.brandName !== undefined) models = models.filter(m => m.brandName === args.brandName);
            if (args?.isActive !== undefined) models = models.filter(m => m.isActive === args.isActive);
            return [...models].sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
          };
          // Storefront pickers ask for active models only; admin pages, which
          // must see their own edits at once, do not and keep the live read.
          if (args?.isActive === true) {
            const modelRows = await catalogueModels();
            if (modelRows) {
              if (c.isActive()) setData(shape(modelRows));
              return;
            }
          }
          const q = query(collection(db, 'supportedModels'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            let models = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            if (args?.category !== undefined) {
              models = models.filter(m => m.category === args.category);
            }
            if (args?.brandName !== undefined) {
              models = models.filter(m => m.brandName === args.brandName);
            }
            if (args?.isActive !== undefined) {
              models = models.filter(m => m.isActive === args.isActive);
            }
            models.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
            setData(models);
          });
        }
        else if (path === 'products.getModelsByBrand') {
          if (!args?.brand) {
            setData([]);
            return;
          }
          
          // Fallback to client-side filtering if composite index doesn't exist
          try {
            const q = query(
              collection(db, 'supportedModels'), 
              where('brandName', '==', args.brand),
              where('isActive', '==', true)
            );
            c.unsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
              setData(docs);
            }, (error) => {
              console.error("Index error, falling back to client-side filter", error);
              const fallbackQ = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand));
              c.unsubscribe = onSnapshot(fallbackQ, (snap) => {
                let docs = snap.docs
                  .map(d => ({ _id: d.id, ...d.data() }))
                  .filter((d: any) => d.isActive === true);
                docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
                setData(docs);
              });
            });
          } catch (e) {
            console.error("Error in getModelsByBrand", e);
          }
        }
        else if (path === 'supportedModels.getModelsByCategory') {
          let q = query(collection(db, 'supportedModels'));
          if (args && args.category) {
            q = query(collection(db, 'supportedModels'), where('category', '==', args.category));
          }
          c.unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (args && args.isActive !== undefined) {
              data = data.filter((d: any) => d.isActive === args.isActive);
            }
            setData(data);
          });
        }
        else if (path === 'supportedModels.getLatest') {
          const q = query(collection(db, 'supportedModels'), limit(args?.count || 20));
          c.unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'collections.getAllCollections' || path === 'collections.getAllCollectionsWithCounts') {
          const q = query(collection(db, 'collections'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            /*
             * The order the admin chose, not the order Firestore happened to
             * return them in.
             *
             * Nothing sorted these, so the row of collection chips on the shop
             * was in document order — which is arbitrary, and put "Camera
             * Skins" and "Drone Skins" in front of Anime and Marvel. Only the
             * first seven show before "N more", so that order decides what
             * anybody sees. A collection with no order yet sorts after the
             * ones that have one, alphabetically, so adding a collection puts
             * it at the end rather than somewhere random.
             */
            docs.sort((a: any, b: any) => {
              const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : Infinity;
              const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : Infinity;
              return ao - bo || String(a.name || '').localeCompare(String(b.name || ''));
            });
            setData(docs);
          });
        }
        else if (path === 'collections.getCollectionsByCategory') {
          const q = query(collection(db, 'collections'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            let cols = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (args?.category) {
              cols = cols.filter((c: any) => c.category === args.category);
            }
            // Same order the chips use, so the two never disagree.
            cols.sort((a: any, b: any) => {
              const ao = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : Infinity;
              const bo = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : Infinity;
              return ao - bo || String(a.name || '').localeCompare(String(b.name || ''));
            });
            setData(cols);
          });
        }
        else if (path === 'collections.getCollectionByName') {
          // The `name` argument arrives in two spellings. The collection chips
          // on /products send the display name ("Cars & Bikes"); the sitemap,
          // and every link built from it, sends the slug ("cars-bikes"). This
          // matched the slug only, so a chip click looked up nothing, got null,
          // and `useProductsData` quietly fell back to the unfiltered grid —
          // the URL gained `?collection=Marvel` and the products never moved.
          const wanted = collectionKey(args?.name);
          const q = query(collection(db, 'collections'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            if (!wanted) {
              setData(null);
              return;
            }
            const hit = snap.docs.find((d) => {
              const c: any = d.data();
              return collectionKey(c.slug) === wanted || collectionKey(c.name) === wanted;
            });
            setData(hit ? { _id: hit.id, ...hit.data() } : null);
          });
        }
        else if (path === 'collections.getCollectionProductsPaginated') {
          if (!args?.collectionId) {
            setData({ products: [], hasMore: false });
            return;
          }
          const limitNum = args?.limit || 30;
          const offsetNum = args?.offset || 0;
          
          const q = query(
            collection(db, 'collectionProducts'),
            where('collectionId', '==', args.collectionId)
          );
          
          c.unsubscribe = onSnapshot(q, async (snap) => {
            let cpDocs = snap.docs.map(d => d.data());
            // Sort by order
            cpDocs.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            
            const hasMore = cpDocs.length > offsetNum + limitNum;
            cpDocs = cpDocs.slice(offsetNum, offsetNum + limitNum);
            
            if (cpDocs.length === 0) {
              setData({ products: [], hasMore: false });
              return;
            }
            
            const productIds = cpDocs.map(cp => cp.productId);
            
            // Chunk product fetches because Firestore 'in' queries are limited to 10
            const productsData: any[] = [];
            for (let i = 0; i < productIds.length; i += 10) {
              const chunk = productIds.slice(i, i + 10);
              const pq = query(collection(db, 'products'), where('__name__', 'in', chunk));
              const psnap = await getDocs(pq);
              productsData.push(...psnap.docs.map(d => ({ _id: d.id, ...d.data() })));
            }
            
            // Order products matching the cpDocs order
            const orderedProducts = [];
            for (const cp of cpDocs) {
              const p = productsData.find(pd => pd._id === cp.productId);
              if (p) orderedProducts.push(p);
            }
            
            // Attach variants
            const finalProducts = await Promise.all(orderedProducts.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            
            setData({ products: finalProducts, hasMore });
          });
        }
        else if (path === 'products.getAllProducts' || path === 'products.getAllProductsBasic') {
          // Products and variants each get their own listener, recombined on
          // every tick. Watching products alone left the table stale after an
          // inline SKU/price/inventory edit — those writes land in `variants`,
          // which the products listener never hears about.
          let productDocs: any[] | null = null;
          let variantDocs: any[] | null = null;
          let collectionIdsMap: Record<string, string[]> = {};

          const emit = () => {
            if (!productDocs || !variantDocs) return;

            const variantSkusMap: Record<string, string[]> = {};
            const variantsMap: Record<string, any[]> = {};
            for (const v of variantDocs) {
              if (!v.productId) continue;
              if (v.sku) (variantSkusMap[v.productId] ||= []).push(v.sku);
              (variantsMap[v.productId] ||= []).push(v);
            }

            const docs = productDocs.map(data => {
              const normalizedTags = Array.isArray(data.tags)
                ? data.tags
                : typeof data.tags === "string"
                  ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                  : [];
              const variants = variantsMap[data._id] || [];
              const collectionIds = collectionIdsMap[data._id] || [];
              return {
                ...data,
                title: data.title || "",
                description: data.description || "",
                slug: data.slug || "",
                status: data.status || "draft",
                images: Array.isArray(data.images) ? data.images : [],
                tags: normalizedTags,
                variantSkus: data.variantSkus || variantSkusMap[data._id] || [],
                variants,
                variantCount: variants.length,
                firstVariant: variants[0] || null,
                totalInventory: variants.reduce(
                  (sum: number, v: any) => sum + (Number(v.inventoryQuantity) || 0), 0),
                collectionIds,
                collectionId: data.collectionId || collectionIds[0] || null,
              };
            });

            const sortBy = args?.sortBy || 'latest';
            docs.sort((a: any, b: any) => {
              switch (sortBy) {
                case 'oldest': return (a._creationTime || 0) - (b._creationTime || 0);
                case 'title_asc': return a.title.localeCompare(b.title);
                case 'title_desc': return b.title.localeCompare(a.title);
                default: return (b._creationTime || 0) - (a._creationTime || 0);
              }
            });
            setData(docs);
          };

          // Products carry no collectionId of their own — membership lives in
          // the collectionProducts join, so resolve it once up front.
          const loadCollectionLinks = getDocs(collection(db, 'collectionProducts'))
            .then(linksSnap => {
              const map: Record<string, string[]> = {};
              linksSnap.docs.forEach(l => {
                const { productId, collectionId } = l.data() as any;
                if (productId && collectionId) (map[productId] ||= []).push(collectionId);
              });
              collectionIdsMap = map;
              emit();
            })
            .catch(err => console.error('[firebase-hooks] could not read collectionProducts:', err));
          void loadCollectionLinks;

          const unsubProducts = onSnapshot(collection(db, 'products'), snap => {
            productDocs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            emit();
          });
          const unsubVariants = onSnapshot(collection(db, 'variants'), snap => {
            variantDocs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            emit();
          });
          c.unsubscribe = () => { unsubProducts(); unsubVariants(); };
        }
        else if (path === 'products.getFilterFacets') {
          // How many active products exist per gadget, and per gadget+finish.
          // The category bar used to offer every finish for every gadget, but
          // most pairs have nothing behind them — picking Console then
          // Transparent led to a guaranteed empty grid.
          const countFacets = (rows: any[]) => {
            const byGadget: Record<string, number> = {};
            const byCategory: Record<string, number> = {};
            const finishByGadget: Record<string, Record<string, number>> = {};
            rows.forEach((p: any) => {
              if (args?.productCategory && p.productCategory !== args.productCategory) return;
              const g = p.gadgetTypeId;
              const f = p.finishTypeId;
              if (p.productCategory) byCategory[p.productCategory] = (byCategory[p.productCategory] || 0) + 1;
              if (!g) return;
              byGadget[g] = (byGadget[g] || 0) + 1;
              if (!f) return;
              (finishByGadget[g] ||= {})[f] = (finishByGadget[g][f] || 0) + 1;
            });
            return { byGadget, byCategory, finishByGadget };
          };
          // Counts only: the build's catalogue is plenty fresh for these.
          const fromCatalogue = await catalogueProducts();
          if (fromCatalogue) {
            if (c.isActive()) setData(countFacets(fromCatalogue));
            return;
          }
          c.unsubscribe = onSnapshot(query(collection(db, 'products'), where('status', '==', 'active')), (snap) => {
            const byGadget: Record<string, number> = {};
            const byCategory: Record<string, number> = {};
            const finishByGadget: Record<string, Record<string, number>> = {};

            snap.docs.forEach(d => {
              const p = d.data() as any;
              if (args?.productCategory && p.productCategory !== args.productCategory) return;
              const g = p.gadgetTypeId;
              const f = p.finishTypeId;
              if (p.productCategory) byCategory[p.productCategory] = (byCategory[p.productCategory] || 0) + 1;
              if (!g) return;
              byGadget[g] = (byGadget[g] || 0) + 1;
              if (!f) return;
              (finishByGadget[g] ||= {})[f] = (finishByGadget[g][f] || 0) + 1;
            });

            setData({ byGadget, byCategory, finishByGadget });
          });
        }
        else if (path === 'products.getAllProductsPaginated') {
          const q = query(collection(db, 'products'), limit(args?.paginationOpts?.numItems || 50));
          c.unsubscribe = onSnapshot(q, async (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            
            // Attach variants
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData({ page: finalProducts, isDone: true, continueCursor: null });
          });
        }
        else if (path === 'products.searchProducts') {
          if (!args?.query || args.query.length < 2) {
            setData([]);
            return;
          }
          const fromCatalogue = await catalogueProducts();
          if (fromCatalogue) {
            const hits = searchRows(fromCatalogue, args.query, (d: any) => String(d.title || ''),
              (d: any) => `${d.title} ${(d.tags || []).join(' ')}`);
            const shown = await refreshProducts(hits.slice(0, (args?.limit || 15) + 3), path);
            if (c.isActive()) setData(shown.slice(0, args?.limit || 15));
            return;
          }
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          c.unsubscribe = onSnapshot(q, async (snap) => {
            let docs = searchRows(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any)), args.query,
              (d: any) => String(d.title || ''),
              (d: any) => `${d.title} ${d.tags?.join(' ') || ''} ${d.description || ''}`);
            docs = docs.slice(0, args?.limit || 15);
            
            // Fetch variants for these products
            const finalProducts = await Promise.all(docs.map(async (product: any) => {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              return {
                ...product,
                variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
              };
            }));
            setData(finalProducts);
          });
        }
        else if (path === 'products.getProduct' || path === 'products.getProductBySlug') {
          const fetchProduct = async (attempt = 0): Promise<void> => {
            try {
              const targetId = args?.productId || args?.id;
              let productData = null;

              if (targetId) {
                const snap = await getDoc(doc(db, 'products', targetId));
                if (!snap.exists() && snap.metadata.fromCache) throw new Error("products: server not reached");
                if (snap.exists()) {
                  productData = { _id: snap.id, ...snap.data() };
                }
              } else if (args?.slug) {
                const q = query(collection(db, 'products'), where('slug', '==', args.slug), limit(1));
                const snap = await getDocs(q);
                // Offline, getDocs answers from the (empty) cache instead of
                // failing: that is "couldn't ask", not "no such product".
                if (snap.empty && snap.metadata.fromCache) throw new Error("products: server not reached");
                if (!snap.empty) {
                  productData = { _id: snap.docs[0].id, ...snap.docs[0].data() };
                }
              }

              if (!productData) {
                setData(null);
                return;
              }

              const vq = query(collection(db, 'variants'), where('productId', '==', productData._id));
              const vsnap = await getDocs(vq);
              productData.variants = sortVariants(vsnap.docs.map(d => ({ _id: d.id, ...d.data() }) as any));
              
              setData(productData);
            } catch (error) {
              /*
               * A failed request is not "no such product". Saying null here
               * drew "Product not found" over real products whenever Firestore
               * was unreachable (Soft 404s in Search Console). Keep what the
               * page already has — the build's seed — and try again; only a
               * query that succeeded and came back empty is a missing product.
               */
              console.error("Error fetching product and variants:", error);
              if (!c.isActive()) return;
              if (attempt < 2) { setTimeout(() => { if (c.isActive()) void fetchProduct(attempt + 1); }, 1500 * (attempt + 1)); return; }
              setData((cur: any) => (cur === undefined ? null : cur));
            }
          };

          fetchProduct();
          c.unsubscribe = () => {};
        }
        else if (path === 'productCategories.listAllWithCounts' || path === 'productCategories.listAll' || path === 'productCategories.listActive') {
          const q = query(collection(db, 'productCategoriesConfig'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => {
              const docData = d.data();
              return { 
                _id: d.id, 
                id: docData.slug,
                displayName: docData.name,
                ...docData 
              };
            });
            if (path === 'productCategories.listActive') {
              data = data.filter(c => c.isActive);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'modelRequests.findSimilarModels') {
          const search = (args?.modelName || "").toLowerCase().trim();
          if (search.length < 2) {
            setData([]);
          } else {
            const brandSearch = args?.brandName?.toLowerCase().trim();
            const keywords = search.split(/\s+/).filter((k: string) => k.length > 1);
            // Spacing-blind, and for laptops also by body: a request for
            // "15s-fq5111TU" suggests the 15S FQ models already listed, which
            // take the same skin (src/lib/laptop-body.ts).
            const squashed = squash(search);
            const wantBody = args?.category === "laptop" && brandSearch ? new Set(laptopBodyKeys(brandSearch, search)) : new Set<string>();
            const similar = (rows: any[]) => {
              const inScope = rows.filter(m => (!args?.category || m.category === args.category)
                && (!brandSearch || (m.brandName || "").toLowerCase() === brandSearch));
              const byName = inScope.filter(m => {
                const name = (m.modelName || "").toLowerCase();
                return keywords.every((k: string) => name.includes(k)) || (squashed.length >= 3 && squash(name).includes(squashed));
              });
              const byBody = wantBody.size
                ? inScope.filter(m => !byName.includes(m) && laptopBodyKeys(brandSearch, m.modelName || "").some((k) => wantBody.has(k)))
                : [];
              return [...byName, ...byBody].slice(0, 5)
                .map(m => ({ _id: m._id, brandName: m.brandName, modelName: m.modelName, category: m.category }));
            };
            const modelRows = await catalogueModels();
            if (modelRows) {
              if (c.isActive()) setData(similar(modelRows));
              return;
            }
            c.unsubscribe = onSnapshot(
              query(collection(db, 'supportedModels'), where('isActive', '==', true)),
              (snap) => {
                setData(similar(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any))));
              }
            );
          }
        }
        else if (path === 'cashbackHelpers.getProductCashbackInfo') {
          if (!args?.productId) {
            setData({ hasCashback: false, displayText: null });
          } else {
            (async () => {
              const rsnap = await getDocs(query(collection(db, 'cashbackRules'), where('isActive', '==', true)));
              const rules = rsnap.docs.map(d => ({ _id: d.id, ...d.data() } as any));

              const best = (list: any[]) =>
                list.reduce((b, c) => (c.cashbackValue > b.cashbackValue ? c : b));

              const productRules = rules.filter(r => r.targetType === "product" && r.targetId === args.productId);
              if (productRules.length > 0) {
                const r = best(productRules);
                setData({
                  hasCashback: true,
                  cashbackType: r.cashbackType,
                  cashbackValue: r.cashbackValue,
                  displayText: r.cashbackType === "fixed" ? `₹${r.cashbackValue}` : `${r.cashbackValue}%`,
                });
                return;
              }

              const cp = await getDocs(query(collection(db, 'collectionProducts'), where('productId', '==', args.productId)));
              const collectionIds = cp.docs.map(d => d.data().collectionId);
              // Only this product's variants: any variant rule anywhere used to put "cashback" on every product.
              const ownVariants = rules.some(r => r.targetType === "variant")
                ? new Set((await getDocs(query(collection(db, 'variants'), where('productId', '==', args.productId)))).docs.map(d => d.id))
                : new Set<string>();
              const other = rules.filter(r =>
                (r.targetType === "variant" && ownVariants.has(r.targetId)) ||
                (r.targetType === "collection" && collectionIds.includes(r.targetId))
              );
              if (other.length === 0) { setData({ hasCashback: false, displayText: null }); return; }

              const r = best(other);
              setData({
                hasCashback: true,
                cashbackType: r.cashbackType,
                cashbackValue: r.cashbackValue,
                displayText: r.cashbackType === "fixed" ? `up to ₹${r.cashbackValue}` : `up to ${r.cashbackValue}%`,
              });
            })();
          }
        }
        else if (path === 'coupons.getCouponsForProduct') {
          c.unsubscribe = onSnapshot(
            query(collection(db, 'coupons'), where('isActive', '==', true)),
            async (snap) => {
              const now = Date.now();
              const open = snap.docs
                .map(d => ({ _id: d.id, ...d.data() } as any))
                .filter(c => (!c.expiresAt || c.expiresAt > now) &&
                             (!c.startDate || Number(c.startDate) <= now) &&
                             (!c.endDate || Number(c.endDate) >= now) &&
                             (!c.usageLimit || (c.usageCount || 0) < c.usageLimit) &&
                             !(Array.isArray(c.allowedCustomerEmails) && c.allowedCustomerEmails.length) &&
                             c.isPublic !== false);
              // Only offers this product can use.
              const title = args?.productId ? String((await getDoc(doc(db, 'products', args.productId))).data()?.title || '') : '';
              const fits = await Promise.all(open.map(async (c) => {
                const test = await couponScope(c);
                return !test || test({ productId: String(args?.productId || ''), title });
              }));
              if (c.isActive()) setData(open.filter((_, i) => fits[i]));
            }
          );
        }
        else if (path === 'productSections.getProductSectionContent') {
          if (!args?.productId) {
            setData([]);
          } else {
            (async () => {
              const p = await getDoc(doc(db, 'products', args.productId));
              if (!p.exists()) { setData([]); return; }

              const active = (docs: any[]) => docs
                .map(d => ({ _id: d.id, ...d.data() } as any))
                .filter(s => s.isActive)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

              const byProduct = await getDocs(query(collection(db, 'productSectionContent'),
                where('productId', '==', args.productId)));
              const own = active(byProduct.docs);
              if (own.length > 0) { setData(own); return; }

              const category = p.data().productCategory;
              if (!category) { setData([]); return; }
              const byCategory = await getDocs(query(collection(db, 'productSectionContent'),
                where('productCategorySlug', '==', category)));
              setData(active(byCategory.docs));
            })();
          }
        }
        else if (path === 'productSections.getSuggestedProducts' || path === 'productSections.getTrendingProducts') {
          const configCollection = path.endsWith('getSuggestedProducts')
            ? 'suggestedProductsConfig'
            : 'trendingProductsConfig';
          if (!args?.productId) {
            setData({ config: null, products: [] });
          } else {
            (async () => {
              const psnap = await getDoc(doc(db, 'products', args.productId));
              if (!psnap.exists()) { setData({ config: null, products: [] }); return; }
              const product: any = psnap.data();

              // Product-specific config wins, otherwise the category default.
              const pick = async (field: string, value: string) => {
                const s = await getDocs(query(collection(db, configCollection), where(field, '==', value), limit(1)));
                return s.empty ? null : ({ _id: s.docs[0].id, ...s.docs[0].data() } as any);
              };
              let config = await pick('productId', args.productId);
              if ((!config || !config.isActive) && product.productCategory) {
                config = await pick('productCategorySlug', product.productCategory);
              }
              if (!config || !config.isActive) { setData({ config: null, products: [] }); return; }

              const fromCatalogue = await catalogueProducts();
              const all = fromCatalogue
                ? fromCatalogue
                : (await getDocs(query(collection(db, 'products'), where('status', '==', 'active'))))
                    .docs.map(d => ({ _id: d.id, ...d.data() } as any));
              const candidates = all.filter((p: any) => p._id !== args.productId);
              // The product document has no design field; the catalogue row does.
              const self = all.find((p: any) => p._id === args.productId);
              if (self?.design && !product.design) product.design = self.design;
              if (self?.listingKind && !product.listingKind) product.listingKind = self.listingKind;

              let picked: any[] = [];
              if (config.sourceType === 'manual' && config.manualProductIds?.length) {
                const wanted = new Set(config.manualProductIds);
                picked = candidates.filter(p => wanted.has(p._id));
              } else if (config.sourceType === 'same-category' && product.productCategory) {
                picked = setupPicks(product, args.productId, candidates, args.brand || undefined);
              } else if (config.sourceType === 'tag-based' && config.filterTags?.length) {
                picked = candidates.filter(p => p.tags?.some((t: string) => config.filterTags.includes(t)));
              }
              if (config.sourceType === 'same-category' && product.productCategory) {
                // Up to the row's size of each finish, so the section's Matte /
                // 3D Textured / Tranzy tabs each have a full row to show.
                const per = config.maxProducts || 8;
                const seen = new Map<string, number>();
                picked = picked.filter((p) => {
                  const f = String(p.finishType || '').toLowerCase();
                  const n = seen.get(f) || 0;
                  seen.set(f, n + 1);
                  return n < per;
                }).slice(0, per * 3);
              } else {
                picked = picked.slice(0, config.maxProducts || 8);
              }

              // The cards read product.variants for price and stock — live.
              const withVariants = await refreshProducts(picked, path);

              if (c.isActive()) setData({ config, products: withVariants });
            })();
          }
        }
        else if (path === 'supportedModels.getModelInfo') {
          const q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand), where('modelName', '==', args.model), limit(1));
          c.unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'gadgetTypes.getByCategory') {
          // No gadgetType document has a `category` field — they carry `name`
          // ("phone", "laptop"), which is exactly what a model's `category`
          // holds. Querying `category` always came back empty, so a device
          // picked from the gadget sheet never resolved to a gadget, the smart
          // filters never ran, and /products opened with no productType or
          // gadget: no device banner, no collection row. Match either field.
          const q = query(collection(db, 'gadgetTypes'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            const hit = snap.docs.find((d) => {
              const g: any = d.data();
              return g.category === args.category || g.name === args.category;
            });
            setData(hit ? { _id: hit.id, ...hit.data() } : null);
          });
        }
        else if (path === 'gadgetTypes.getActive' || path === 'gadgetTypes.listAllActive' || path === 'gadgetTypes.listActive' || path === 'gadgetTypes.list') {
          const q = query(collection(db, 'gadgetTypes'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'gadgetTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            // No gadgetType document carries an `order`, so sorting by
            // `(a.order || 0)` left every one of them at 0 and the list came out
            // in Firestore id order — which is why the picker opened on
            // Controller. Fall back to the order customers actually shop in.
            const RANK: Record<string, number> = {
              phone: 1, laptop: 2, 'mac-mini': 3, camera: 4, 'action-camera': 4.5, tablet: 5,
              console: 6, lens: 7, drone: 8, controller: 9, charger: 10,
              gimbals: 11, accessory: 12,
            };
            data = data.sort((a: any, b: any) => {
              const ao = Number.isFinite(a.order) ? a.order : (RANK[a.name] ?? 99);
              const bo = Number.isFinite(b.order) ? b.order : (RANK[b.name] ?? 99);
              if (ao !== bo) return ao - bo;
              return String(a.displayName || '').localeCompare(String(b.displayName || ''));
            });
            setData(data);
          });
        }
        else if (path === 'finishTypes.getActive' || path === 'finishTypes.listAllActive' || path === 'finishTypes.listActive' || path === 'finishTypes.list') {
          const q = query(collection(db, 'finishTypes'));
          c.unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'finishTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'seoPages.getPageBySlug') {
          const q = query(collection(db, 'seoPages'), where('slug', '==', args.slug), limit(1));
          c.unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else if (!snap.metadata.fromCache) {
              // Only the server can say a page does not exist. An empty cache
              // read (offline, or Googlebot's renderer with Firestore out of
              // reach) drew NotFound over a real landing page — Soft 404s.
              setData(null);
            }
          }, (err) => console.error("seoPages.getPageBySlug failed", err));
        }
        else if (path === 'seoTemplates.getTemplateByType') {
          const q = query(collection(db, 'seoPageTemplates'), where('pageType', '==', args.pageType), limit(1));
          c.unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'settings.getSetting') {
          c.unsubscribe = onSnapshot(doc(db, 'settings', args?.key || 'default'), (snap) => {
            setData(snap.exists() ? snap.data() : null);
          });
        }
        else if (path === 'mockups.getBatchMockups') {
          const requestedSkus: string[] = Array.isArray(args?.skus) ? args.skus : [];
          if (!args?.brand || !args?.model || requestedSkus.length === 0) {
            setData({ mockups: {}, cursor: "", isDone: true });
          } else {
            // Only the SKUs asked for. Every mockup row for a model is ~333
            // reads, and a screen shows a couple of dozen designs; SKUs match
            // exactly for 99.6% of rows.
            // Each listing SKU and its design code (see mockupSkuCandidates).
            const bySku = (brand: string, model: string, skus: string[]) =>
              Promise.all(chunked([...new Set(skus.flatMap(mockupSkuCandidates))], 30).map((c) => getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', brand),
                where('model', '==', model),
                where('sku', 'in', c),
              )))).then((snaps) => snaps.flatMap((sn) => sn.docs));
            (async () => {
              /*
               * Which phone each picture shows, and how close it is. Where the
               * chosen model had no mockup this went straight to the hero phone
               * — a Galaxy A51 shopper saw iPhone 17 Pro Max photos under a
               * "Galaxy A51" badge, while the product page showed the nearest
               * Samsung (the A54) and said so. Now: the model, then its nearest
               * sibling in the same brand (the product page's rule), then the hero.
               */
              const result: Record<string, string> = {};
              const models: Record<string, string> = {};
              const match: Record<string, 'exact' | 'sibling' | 'hero'> = {};
              const collectRows = (docs: any[], kind: 'exact' | 'sibling' | 'hero') => {
                docs.forEach(d => {
                  const m: any = d.data();
                  const url = mockupUrlFrom(m);
                  if (!url) return;
                  for (const target of requestedSkus) {
                    if (!result[target] && skuMatches(m.sku, target)) {
                      result[target] = url; models[target] = m.model; match[target] = kind;
                    }
                  }
                });
              };
              collectRows(await bySku(args.brand, args.model, requestedSkus), 'exact');
              let missing = requestedSkus.filter(sku => !result[sku]);
              if (missing.length > 0) {
                // The nearest sibling, found from a few designs' rows in this brand
                // (one alone may be a new design no model has a photo of yet).
                const probeSkus = [...new Set(missing.slice(0, 10).flatMap(mockupSkuCandidates))].slice(0, 30);
                const probe = await getDocs(query(collection(db, 'mockups'),
                  where('brand', '==', args.brand), where('sku', 'in', probeSkus), limit(1500)));
                const wanted = normalizeModelName(args.model).toLowerCase();
                let best: { model: string; score: number } | null = null;
                for (const name of new Set(probe.docs.map(d => String(d.data().model || '')))) {
                  const c = normalizeModelName(name).toLowerCase();
                  let i = 0;
                  while (i < wanted.length && i < c.length && wanted[i] === c[i]) i++;
                  // Ties go to the alphabetically first name — the product page breaks them the same way.
                  if (i >= 6 && name !== args.model && (!best || i > best.score || (i === best.score && name < best.model))) best = { model: name, score: i };
                }
                if (best) {
                  collectRows(await bySku(args.brand, best.model, missing), 'sibling');
                  missing = requestedSkus.filter(sku => !result[sku]);
                }
              }
              // The hero is a phone, so it stands in for phones only.
              const phoneOnly = !args.gadget || args.gadget === 'phone';
              if (phoneOnly && missing.length > 0 && !(args.brand === HERO_MOCKUP_BRAND && args.model === HERO_MOCKUP_MODEL)) {
                collectRows(await bySku(HERO_MOCKUP_BRAND, HERO_MOCKUP_MODEL, missing), 'hero');
              }
              if (c.isActive()) setData({ mockups: result, mockupModels: models, mockupMatch: match, cursor: "", isDone: true });
            })().catch((err) => console.error('[firebase-hooks] mockup lookup failed:', err));
          }
        }
        else if (path === 'users.getCurrentUser' || path === 'users.getProfileData') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData(null);
              return;
            }

            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              const userData = snap.exists() ? snap.data() : {};
              const isAdmin = user.email === 'chandan1992@gmail.com' || userData.isAdmin;
              setData({
                _id: user.uid,
                email: user.email,
                name: user.displayName || userData.name || 'User',
                isAdmin: isAdmin,
                ...userData
              });
            });
          });
          c.unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (args?.id) {
          const collectionName = path.split('.')[0];
          c.unsubscribe = onSnapshot(doc(db, collectionName, args.id), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else {
          const collectionName = path.split('.')[0];
          if (path.toLowerCase().includes('stats') || path.toLowerCase().includes('settings') || path.toLowerCase().includes('count')) {
            // Return a dummy object for stats/settings to prevent "Cannot read properties of undefined"
            setData({
              total: 0, count: 0, active: 0, inactive: 0, revenue: 0,
              pending: 0, processing: 0, completed: 0, failed: 0,
              enabled: false, byBrand: {}, byCategory: {}
            });
          } else {
            // Guessing a collection from the namespace answers with an array
            // whatever the caller expected, which reads as data rather than as a
            // gap — say so, so the next missing handler is obvious.
            console.warn(`[firebase-hooks] no handler for "${path}" — falling back to a raw ${collectionName} read`);
            const q = query(collection(db, collectionName), limit(50));
            c.unsubscribe = onSnapshot(q, (snap) => {
              setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
            });
          }
        }
}

export type PagedCtx = { path: string; args: any; options: { initialNumItems: number }; isCancelled: () => boolean; setAllMatches: (v: any[]) => void; setResults: (v: any[]) => void; setStatus: (v: any) => void };

export async function paginatedInitial(c: PagedCtx) {
  const { path, args, options, setAllMatches, setResults, setStatus } = c;
  const collectionName = path.includes('products') ? 'products' : path.split('.')[0];
  {
      readLabel = `paginated:${path}`;
      setStatus("LoadingFirstPage");
      /*
       * WhatsApp debug logs are not products: the path below filtered every
       * collection by status == "active", a field logs don't have, so the
       * debug page always showed none of its 215 logs.
       */
      if (path === 'whatsappDebugLogs.getDebugLogs') {
        try {
          const snap = await getDocs(query(collection(db, 'whatsappDebugLogs'), orderBy('createdAt', 'desc'), limit(500)));
          if (c.isCancelled()) return;
          let logs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
          if (args?.usecaseKey) logs = logs.filter(l => l.usecaseKey === args.usecaseKey);
          if (args?.success !== undefined) logs = logs.filter(l => (l.success === true) === args.success);
          if (args?.errorType) logs = logs.filter(l => l.errorType === args.errorType);
          setAllMatches(logs);
          setResults(logs.slice(0, options.initialNumItems));
          setStatus(logs.length > options.initialNumItems ? "CanLoadMore" : "Exhausted");
        } catch (e) {
          console.error('[firebase-hooks] debug logs failed:', e);
          if (!c.isCancelled()) { setResults([]); setStatus("Exhausted"); }
        }
        return;
      }
      try {
        // Products come from the build's catalogue when there is one (the
        // whole collection was 959 reads per visit); otherwise all active
        // documents, filtered here to avoid composite indexes.
        const fromCatalogue = collectionName === 'products' ? await catalogueProducts() : null;
        if (c.isCancelled()) return;
        let filtered = (fromCatalogue
          ? fromCatalogue.map((p) => ({ ...p }))
          : (await getDocs(query(collection(db, collectionName), where('status', '==', 'active'))))
              .docs.map(d => ({ _id: d.id, ...d.data() }))) as any[];
        
        // In-memory filtering for multiple constraints
        if (args && typeof args === 'object') {
          if (args.productCategory) {
            filtered = filtered.filter(p => p.productCategory === args.productCategory);
          }
          if (args.gadgetTypeId) {
            filtered = filtered.filter(p => p.gadgetTypeId === args.gadgetTypeId);
          }
          if (args.finishTypeId) {
            filtered = filtered.filter(p => p.finishTypeId === args.finishTypeId);
          }
          if (args.gadgetCategory) {
            filtered = filtered.filter(p => p.gadgetCategory === args.gadgetCategory);
          }
        }
        
        // Sort by creation time descending
        filtered.sort((a, b) => {
          const aTime = a.createdAt || a._creationTime || 0;
          const bTime = b.createdAt || b._creationTime || 0;
          return bTime - aTime;
        });
        
        if (c.isCancelled()) return;
        setAllMatches(filtered);
        
        // Load first page
        const firstPage = filtered.slice(0, options.initialNumItems);
        
        // Let's attach variants if this is products
        let data = firstPage;
        if (fromCatalogue) {
          // Live price and stock for what the first screens show; the rest of
          // the page keeps the catalogue's values until it is scrolled to.
          const live = await refreshProducts(firstPage.slice(0, LIVE_FIRST_SCREENS), `paginated:${path}`);
          data = [...live, ...firstPage.slice(LIVE_FIRST_SCREENS)];
        } else if (collectionName === 'products') {
          data = await Promise.all(data.map(async (product: any) => {
            const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
            const vsnap = await getDocs(vq);
            return {
              ...product,
              variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
            };
          }));
        }
        
        if (c.isCancelled()) return;
        setResults(data);
        setStatus(filtered.length <= options.initialNumItems ? "Exhausted" : "CanLoadMore");
      } catch (err) {
        console.error(`Error in paginated query ${path}:`, err);
        if (!c.isCancelled()) setStatus("Exhausted");
      }
    }
}

export async function paginatedMore(c: { path: string; numItems: number; results: any[]; allMatches: any[]; setStatus: (v: any) => void; setResults: (fn: (prev: any[]) => any[]) => void }) {
  const { path, numItems, results, allMatches, setStatus, setResults } = c;

    try {
      const collectionName = path.includes('products') ? 'products' : path.split('.')[0];
      const nextStartIndex = results.length;
      const nextEndIndex = nextStartIndex + numItems;
      const nextPage = allMatches.slice(nextStartIndex, nextEndIndex);
      
      if (nextPage.length === 0) {
        setStatus("Exhausted");
        return;
      }
      
      let newData = nextPage;
      if (collectionName === 'products' && Array.isArray(nextPage[0]?.variants)) {
        // Catalogue rows: re-read what is about to be shown.
        newData = await refreshProducts(nextPage, `paginated:${path}`);
      } else if (collectionName === 'products') {
        newData = await Promise.all(newData.map(async (product: any) => {
          const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
          const vsnap = await getDocs(vq);
          return {
            ...product,
            variants: vsnap.docs.map(v => ({ _id: v.id, ...v.data() }))
          };
        }));
      }
      
      setResults(prev => [...prev, ...newData]);
      setStatus(nextEndIndex >= allMatches.length ? "Exhausted" : "CanLoadMore");
    } catch (err) {
      console.error(`Error in loadMore for ${path}:`, err);
      setStatus("Exhausted");
    }
  
}

export async function convexQuery(apiRef: any, args?: any) {
      const path = getPath(apiRef);
      
      if (path === 'coupons.validateCoupon') {
        const { code, cartTotal } = args;
        const q = query(collection(db, 'coupons'), where('code', '==', code.toUpperCase()), where('isActive', '==', true));
        const snap = await getDocs(q);
        if (snap.empty) {
          throw new Error("Invalid or inactive coupon code");
        }
        
        const coupon = snap.docs[0].data();
        
        // The minimum a coupon carries has three spellings and this checked a
        // fourth. The admin form writes `minPurchase` (and `minCartValue` for
        // the cart-value rule); nothing has ever written `minPurchaseAmount`,
        // so every minimum an admin set was silently ignored at apply time —
        // the live 5OFF is set to ₹250 and applied on a ₹1 cart.
        // Both minimums the form offers count; the larger wins (placeOrder agrees).
        const minPurchase = Math.max(
          Number(coupon.minPurchase ?? coupon.minPurchaseAmount ?? 0) || 0,
          Number(coupon.minCartValue ?? 0) || 0,
        );
        if (minPurchase > 0 && cartTotal < minPurchase) {
          throw new Error(`Minimum purchase of ₹${minPurchase} required`);
        }

        /*
         * The same rules placeOrder enforces, checked here too.
         *
         * Not for safety — the server is what decides — but so a shopper is
         * told at the moment they type the code rather than at the moment
         * they try to pay. An expired or used-up coupon used to apply
         * cleanly here and then be refused at the till.
         */
        const now = Date.now();
        if (coupon.startDate && now < Number(coupon.startDate)) {
          throw new Error("This coupon is not valid yet");
        }
        if (coupon.endDate && now > Number(coupon.endDate)) {
          throw new Error("This coupon has expired");
        }
        const usageLimit = Number(coupon.usageLimit) || 0;
        if (usageLimit > 0 && (Number(coupon.usageCount) || 0) >= usageLimit) {
          throw new Error("This coupon has been fully used");
        }
        // A personal code: said now, not at payment (placeOrder decides).
        const allowed: string[] = Array.isArray(coupon.allowedCustomerEmails)
          ? coupon.allowedCustomerEmails.map((e: any) => String(e).trim().toLowerCase()) : [];
        if (allowed.length && !allowed.includes(String(args.userEmail || '').trim().toLowerCase())) {
          throw new Error(args.userEmail
            ? "This coupon was sent to a different email address"
            : "Enter the email this coupon was sent to, then apply it");
        }

        // Same story for the cap: the form writes `maxDiscount`.
        const maxDiscount = Number(coupon.maxDiscount ?? coupon.maxDiscountAmount ?? 0);

        // On the lines the coupon is for, as placeOrder bills it.
        let base = cartTotal;
        const test = await couponScope(coupon);
        if (test) {
          base = (args.cartItems || [])
            .filter((i: any) => test({ productId: String(i.productId), variant: i.variant, title: i.productTitle }))
            .reduce((sum: number, i: any) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
          if (base <= 0) throw new Error("This coupon doesn't apply to anything in your cart");
        }
        const minProduct = Number(coupon.minProductValue) || 0;
        if (minProduct > 0 && base < minProduct) {
          throw new Error(`The products this coupon is for need to add up to ₹${minProduct}`);
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === "percentage") {
          discountAmount = Math.floor(base * (coupon.discountValue / 100));
          if (maxDiscount > 0) {
            discountAmount = Math.min(discountAmount, maxDiscount);
          }
        } else {
          discountAmount = Math.min(base, coupon.discountValue);
        }
        
        /*
         * A wallet-credit coupon takes nothing off now; it pays after delivery.
         * The form marks it effectType "wallet_credit" and this read only
         * isWalletCredit — so checkout took the amount off the total while
         * placeOrder didn't, and the customer was charged more than shown.
         */
        const isWalletCredit = coupon.isWalletCredit === true || coupon.effectType === "wallet_credit";
        return {
          coupon: { _id: snap.docs[0].id, ...coupon },
          discountAmount: isWalletCredit ? 0 : discountAmount,
          isWalletCredit,
          walletCreditAmount: isWalletCredit ? discountAmount : 0
        };
      }
      
      // One-off order reads for the payment return page. Without these every
      // query here returned null, so its "check our own database" fallback
      // always concluded the order did not exist.
      if (path === 'orders.getOrderPublic') {
        if (!args?.orderId) return null;
        return viewOrderFor(String(args.orderId)).catch(() => null);
      }
      if (path === 'orders.getOrderByMerchantTransaction') {
        if (!args?.merchantTransactionId) return null;
        const me = firebaseAuth.currentUser;
        if (!me) return null;
        const snap = await getDocs(query(collection(db, 'orders'), where('ownerUid', '==', me.uid),
          where('paymentTransactionId', '==', String(args.merchantTransactionId)), limit(1)));
        return snap.empty ? null : normalizeOrder({ _id: snap.docs[0].id, ...snap.docs[0].data() });
      }

      console.log(`Manual query called for ${path} with args:`, args);
      return null;
    }

/**
 * One product and its variants, by slug — what products.getProductBySlug
 * answers first — for warmProduct (firebase-hooks.tsx), which reads it when a
 * shopper points at or touches a product link so the page opens filled in.
 */
export async function fetchProductBySlug(slug: string): Promise<any | null> {
  const snap = await getDocs(query(collection(db, 'products'), where('slug', '==', slug), limit(1)));
  if (snap.empty) return null;
  const product: any = { _id: snap.docs[0].id, ...snap.docs[0].data() };
  const vsnap = await getDocs(query(collection(db, 'variants'), where('productId', '==', product._id)));
  product.variants = sortVariants(vsnap.docs.map(d => ({ _id: d.id, ...d.data() }) as any));
  return product;
}
