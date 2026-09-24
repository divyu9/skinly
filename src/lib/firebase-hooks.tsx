import { useState, useEffect, useCallback } from 'react';
import { db, functions, auth as firebaseAuth } from './firebase';
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
const readAuditOn = (() => {
  try { return typeof window !== "undefined" && localStorage.getItem("skinly_read_audit") === "1"; }
  catch { return false; }
})();
let readLabel = "";
type ReadRow = { reads: number; calls: number };
const readAudit: { total: number; byPath: Record<string, ReadRow>; byCollection: Record<string, ReadRow> } =
  { total: 0, byPath: {}, byCollection: {} };
if (readAuditOn) {
  (window as any).__skinlyReads = readAudit;
  (window as any).__skinlyReadsReset = () => { readAudit.total = 0; readAudit.byPath = {}; readAudit.byCollection = {}; };
}
const refPath = (ref: any): string => {
  try {
    if (typeof ref?.path === "string") return ref.path.split("/").filter((_: string, i: number) => i % 2 === 0).join("/");
    const p = ref?._query?.path;
    const cg = ref?._query?.collectionGroup;
    return cg ? `group:${cg}` : p?.canonicalString?.() || "unknown";
  } catch { return "unknown"; }
};
const countRead = (label: string, target: string, n: number) => {
  readAudit.total += n;
  const a = (readAudit.byPath[label || "(untracked)"] ||= { reads: 0, calls: 0 });
  a.reads += n; a.calls += 1;
  const b = (readAudit.byCollection[target] ||= { reads: 0, calls: 0 });
  b.reads += n; b.calls += 1;
};
const getDocs: typeof fsGetDocs = (async (q: any) => {
  const label = readLabel;
  const snap = await fsGetDocs(q);
  if (readAuditOn && !snap.metadata.fromCache) countRead(label, refPath(q), Math.max(1, snap.size));
  return snap;
}) as any;
const getDoc: typeof fsGetDoc = (async (r: any) => {
  const label = readLabel;
  const snap = await fsGetDoc(r);
  if (readAuditOn && !snap.metadata.fromCache) countRead(label, refPath(r), 1);
  return snap;
}) as any;
const onSnapshot: typeof fsOnSnapshot = ((ref: any, ...rest: any[]) => {
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

const chunked = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * The products about to be shown, re-read: their documents and variants, so
 * price and stock on screen are live. Products no longer active drop out.
 */
/**
 * The order a product's variants are offered in.
 *
 * Firestore returns them in document-id order, which is random: a laptop
 * listing could open on "Top + Keyboard Area" with "Only Top" to its right.
 * The keyboard view spends two sheets, so a design with one sheet left opened
 * on a variant it cannot make and read as sold out. Smallest material first,
 * then cheapest, then oldest — which puts "Only Top" first on every laptop and
 * leaves same-priced lists (phone models) in the order they were added.
 */
export function sortVariants<T extends { materialMultiplier?: any; price?: any; _creationTime?: any }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    (Number(a.materialMultiplier) || 1) - (Number(b.materialMultiplier) || 1) ||
    (Number(a.price) || 0) - (Number(b.price) || 0) ||
    (Number(a._creationTime) || 0) - (Number(b._creationTime) || 0)
  );
}

async function refreshProducts(list: any[], label: string): Promise<any[]> {
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

let sinceBuild: Promise<{ touched: Set<string>; active: any[] }> | null = null;
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
function productsSinceBuild(builtAt: number) {
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

let modelsSinceBuild: Promise<any[]> | null = null;
/**
 * Every active supported model — the build's list plus any added since (a
 * model an admin adds must be pickable at once). null without the file.
 */
async function catalogueModels(): Promise<any[] | null> {
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
async function catalogueProducts(): Promise<any[] | null> {
  const cat = await loadCatalogue();
  if (!cat) return null;
  const { touched, active } = await productsSinceBuild(cat.builtAt);
  return [...active, ...cat.products.filter((p) => !touched.has(p._id))];
}
import { collectionKey } from "./collection-key";
import { loadCatalogue, loadModelCatalogue } from "./catalogue";
import { listingOf, presetFor } from "./ai-mockup-shots";
import { searchRows } from "./search-match";
const R2_PUBLIC_DOMAIN = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";

const TOTAL_PHONE_SKIN_SKUS = 359;

// Mockups for 28 models (every iPhone before the 17, plus Nothing Phone 3/3A and
// CMF Phone 1) were lost with the Cloudinary account, so those rows carry a dead
// cloudinaryUrl and no r2Key. Those models fall back to the hero model's mockup
// for the same design rather than rendering a broken image.
/*
 * Mockup lookups repeat constantly — every device change and every remount
 * asks the same brand/model/sku question. Held for the tab so re-picking a
 * model someone already looked at costs nothing.
 */
const mockupLookupCache = new Map<string, any>();

const HERO_MOCKUP_BRAND = "Apple";
const HERO_MOCKUP_MODEL = "iPhone 17 Pro Max";

// Only r2Key-backed rows are usable; a bare cloudinaryUrl no longer resolves.
const mockupUrlFrom = (m: any): string | null =>
  m?.r2Key ? `${R2_PUBLIC_DOMAIN}/${m.r2Key.split("/").map(encodeURIComponent).join("/")}` : null;

// SKUs differ by suffix between catalogs, e.g. R-01 vs R-01-PH.
const skuMatches = (mockupSku: string, target: string): boolean => {
  const a = (mockupSku || "").toUpperCase();
  const b = (target || "").toUpperCase();
  if (!a || !b) return false;
  return a === b || a.startsWith(b + "-") || b.startsWith(a + "-");
};

// The mockups collection holds ~100k docs, so unique-SKU counting reads a
// bounded sample rather than the whole collection (mirrors the Convex original).
const MOCKUP_SAMPLE_LIMIT = 15000;

// User documents were imported from the previous backend under its own ids, so
// users/{authUid} does not exist for anyone who predates the move — their
// balance, name and admin flag live on a document keyed by the old id. Resolve
// via the email the account already proves, falling back to the auth uid so new
// signups still get a document.
const userDocIdCache = new Map<string, string>();
const resolveUserDocId = async (user: { uid: string; email: string | null }): Promise<string> => {
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
const userIdCandidates = async (user: { uid: string; email: string | null }): Promise<string[]> => {
  const resolved = await resolveUserDocId(user);
  return resolved === user.uid ? [user.uid] : [user.uid, resolved];
};

// Helper to resolve the string path from the proxy
const getPath = (apiRef: any) => String(apiRef);

/**
 * Firestore rejects `undefined` at any depth, not just at the top level.
 *
 * Objects lose the undefined keys; arrays keep every element (dropping one
 * would silently reorder an image gallery) but each element is cleaned.
 */
function stripUndefinedDeep(value: any): any {
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


/*
 * First answers the build already knew, handed over in the homepage's HTML.
 *
 * The hero waited for a 1.2 MB bundle, then for Firestore to say which
 * sections exist, then for Firestore to say which slides — and showed
 * skeletons all that while, although the build had read exactly those rows a
 * few minutes earlier to write the page. A query listed here starts from what
 * the build saw and is replaced by the live answer the moment it arrives, so
 * the first render can draw the real hero. Argument-free queries only: there
 * is nothing to match against otherwise.
 */
let homeSeed: Record<string, unknown> | null | undefined;
const SEEDABLE = new Set(['homepage.getActiveHeroSlides', 'homepage.getActiveHomepageSections']);
function seededValue(path: string, args: any): any {
  if (!SEEDABLE.has(path) || (args && args !== 'skip' && Object.keys(args).length)) return undefined;
  if (homeSeed === undefined) {
    try {
      const el = typeof document !== 'undefined' ? document.getElementById('__homeSeed') : null;
      homeSeed = el?.textContent ? JSON.parse(el.textContent) : null;
    } catch {
      homeSeed = null;
    }
  }
  return homeSeed?.[path];
}

/**
 * The site's own copy of a picture the build saved next to the page, or the
 * URL unchanged. The homepage's first hero slide is copied so its largest
 * paint needs no second connection; the slider asks here so it shows that
 * same file instead of fetching the original as well.
 */
export function localCopyOf(url: string | undefined): string | undefined {
  if (!url) return url;
  seededValue('homepage.getActiveHeroSlides', undefined);
  return (homeSeed?.heroLocal as Record<string, string> | undefined)?.[url] || url;
}

export function useQuery(apiRef: any, args?: any) {
  const [data, setData] = useState<any>(() => seededValue(getPath(apiRef), args));
  const [error, setError] = useState<Error | null>(null);
  const path = getPath(apiRef);

  useEffect(() => {
    if (args === 'skip') {
      setData(undefined);
      return;
    }

    let unsubscribe = () => {};
    let active = true;

    const fetchData = async () => {
        readLabel = path;
        try {
          if (path === 'homepage.getActiveHomepageSections') {
          const q = query(collection(db, 'homepageSections'));
          unsubscribe = onSnapshot(q, (snap) => {
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
        else if (path === 'homepage.getAllHomepageSections') {
          const q = query(collection(db, 'homepageSections'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveCategoryDisplaySettings') {
          const q = query(collection(db, 'categoryDisplaySettings'));
          unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'aiMockups.getPrompts') {
          // The shot list itself. Gadgets and angles both grow over time, so
          // this collection is the source of truth rather than a set of
          // overrides on top of something fixed in code.
          unsubscribe = onSnapshot(collection(db, 'gadgetMockupPrompts'), (snap) => {
            const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() })) as any[];
            rows.sort((a, b) =>
              String(a.gadget || '').localeCompare(String(b.gadget || '')) ||
              (a.order || 0) - (b.order || 0) ||
              String(a.label || '').localeCompare(String(b.label || ''))
            );
            setData(rows);
          });
        }
        else if (path === 'aiMockups.getLinkTargets') {
          // Everything a design's SKUs point at, so the studio can say where an
          // image will land before any money is spent on generating it.
          const design = String(args?.rNumber || '').trim();
          if (!design) { setData([]); return; }
          (async () => {
            const [snap, wholeSnap] = await Promise.all([
              getDocs(query(
                collection(db, 'variants'),
                where('sku', '>=', `${design}-`),
                where('sku', '<', `${design}-\uf8ff`)
              )),
              // Phones, lenses and chargers are sold as one thing, and their SKU
              // is the bare design code with no view suffix — invisible to the
              // range query, which is why the studio used to claim a design had
              // no phone listing while one sat right there. The linker has
              // always looked here; the preview has to agree with it.
              getDocs(query(collection(db, 'variants'), where('sku', '==', design))),
            ]);
            const gts = await getDocs(collection(db, 'gadgetTypes'));
            const gadgetById: Record<string, string> = {};
            gts.docs.forEach((g) => { gadgetById[g.id] = String((g.data() as any).name || '').toLowerCase(); });

            const rows: any[] = [];
            for (const d of [...snap.docs, ...wholeSnap.docs]) {
              const v: any = d.data();
              if (!v.productId) continue;
              const psnap = await getDoc(doc(db, 'products', v.productId));
              if (!psnap.exists()) continue;
              const pd: any = psnap.data();
              const tail = String(v.sku || '').slice(design.length + 1).toUpperCase();
              rows.push({
                sku: String(v.sku || ''),
                code: tail,
                // Same batch-suffix allowance as the linker.
                codeHead: tail.split('-')[0],
                variantTitle: String(v.title || '').trim(),
                productId: v.productId,
                productTitle: pd.title || '',
                gadget: gadgetById[pd.gadgetTypeId || pd.gadgetType] || '',
                listingKind: String(pd.listingKind || ''),
                status: String(pd.status || ''),
              });
            }
            setData(rows);
          })().catch(() => setData([]));
        }
        else if (path === 'aiMockups.getCutouts') {
          // The second design source. A cutout is one printed artwork on a
          // sheet rather than a pattern sold by the metre, so it has a piece
          // count and a size limit instead of meters.
          unsubscribe = onSnapshot(collection(db, 'cutoutInventory'), (snap) => {
            const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() })) as any[];
            rows.sort((a, b) => String(a.cutoutNumber || '').localeCompare(String(b.cutoutNumber || ''), undefined, { numeric: true }));
            setData(rows);
          });
        }
        else if (path === 'aiMockups.getTemplates') {
          // Template mockups live beside the shared prompt settings, which are
          // already admin-only, rather than in a collection of their own.
          unsubscribe = onSnapshot(
            query(collection(db, 'gadgetMockupSettings'), where('kind', '==', 'template')),
            (snap) => setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
          );
        }
        else if (path === 'aiMockups.getSettings') {
          // Single doc holding the prompt fragments every shot shares.
          unsubscribe = onSnapshot(doc(db, 'gadgetMockupSettings', 'default'), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else if (path === 'aiMockups.getJobs') {
          /*
           * With `rNumber`, this design's mockups — all of them.
           *
           * The studio used to ask for the newest 300 across every design and
           * then filter that list down to the one on screen, so a day's work
           * disappeared from the studio as soon as the next day's generations
           * and the launch pipeline's own mockups pushed it past 300. The
           * pictures were never lost — they were on their listings the whole
           * time — but the design read as if nothing had ever been made for
           * it, and its approved count read 0.
           */
          const q = args?.rNumber
            ? query(collection(db, 'designMockups'), where('rNumber', '==', String(args.rNumber)), limit(args?.take || 500))
            : query(collection(db, 'designMockups'), orderBy('createdAt', 'desc'), limit(args?.take || 200));
          unsubscribe = onSnapshot(q, (snap) => {
            const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            // The per-design query cannot order on the server without a
            // composite index, so it sorts here — the same newest-first order.
            if (args?.rNumber) rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setData(rows);
          });
        }
        else if (path === 'aiMockups.getApprovedCounts') {
          /*
           * How many shots are finished per design, for the badges down the
           * studio's design list. Counted off the approved mockups themselves
           * rather than a page of recent ones, so a design that was finished
           * last week still shows its count.
           */
          const q = query(collection(db, 'designMockups'), where('status', '==', 'approved'));
          unsubscribe = onSnapshot(q, (snap) => {
            const counts: Record<string, number> = {};
            snap.docs.forEach((d) => {
              const r = String((d.data() as any).rNumber || '').trim();
              if (r) counts[r] = (counts[r] || 0) + 1;
            });
            setData(counts);
          });
        }
        else if (path === 'homepage.getActiveHeroSlides') {
          const q = query(collection(db, 'heroSlides'));
          unsubscribe = onSnapshot(q, (snap) => {
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
        else if (path === 'homepage.getAllHeroSlides') {
          const q = query(collection(db, 'heroSlides'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveFeatureBanners') {
          const q = query(collection(db, 'featureBanners'));
          unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllFeatureBanners') {
          const q = query(collection(db, 'featureBanners'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getActiveUgcVideos') {
          const q = query(collection(db, 'ugcVideos'));
          unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getAllUgcVideos') {
          const q = query(collection(db, 'ugcVideos'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepageSectionCards.getActiveSectionCards') {
          const q = query(collection(db, 'homepageSectionCards'), where('sectionId', '==', args?.sectionId));
          unsubscribe = onSnapshot(q, (snap) => {
            // Empty from cache is not an answer — see getActiveHeroSlides.
            if (snap.empty && snap.metadata.fromCache) return;
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.filter((d: any) => d.isActive === true).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepageSectionCards.getAllSectionCards') {
          const q = query(collection(db, 'homepageSectionCards'), where('sectionId', '==', args?.sectionId));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'homepage.getHomepageSettings') {
          unsubscribe = onSnapshot(doc(db, 'homepageSettings', 'default'), (snap) => {
            setData(snap.exists() ? snap.data() : null);
          });
        }
        else if (path === 'homepage.getProductsByTags' || path === 'products.getProductsByTag') {
          const limitNum = args?.maxProducts || args?.limit || 10;
          const tagsArg = args?.tags || (args?.tag ? [args.tag] : []);
          
          const fromCatalogue = await catalogueProducts();
          if (fromCatalogue) {
            const tagged = tagsArg.length
              ? fromCatalogue.filter((d: any) => tagsArg.some((t: string) => (d.tags || []).includes(t)))
              : fromCatalogue;
            // A few spare in case some have gone inactive since the build.
            const shown = await refreshProducts(tagged.slice(0, limitNum + 4), path);
            if (active) setData(shown.slice(0, limitNum));
            return;
          }
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          unsubscribe = onSnapshot(q, async (snap) => {
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
          unsubscribe = onSnapshot(q, (snap) => {
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
          
          unsubscribe = () => {
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
          
          unsubscribe = () => {
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
          
          unsubscribe = () => {
            unsubscribeAuth();
            innerUnsubscribe();
          };
        }
        else if (path === 'orders.getOrderPublic' || path === 'admin.orders.getOrderDetails') {
          if (!args?.orderId) {
            setData(null);
            return;
          }
          unsubscribe = onSnapshot(doc(db, 'orders', args.orderId), (snap) => {
            if (!snap.exists()) { setData(null); return; }
            const order = normalizeOrder({ _id: snap.id, ...snap.data() });
            setData(order);

            // Resolve each line's real SKU from the catalogue.
            //
            // Only 57 of 161 live order lines carry a `sku` field; the rest
            // carry just the variant title, and the admin page was printing
            // that under a "SKU:" label — so #4025 read "SKU: Default" when the
            // variant it was sold as is L-356. The variant is found the same
            // way the stock ledger finds it, by productId and title.
            void (async () => {
              try {
                const ids = [...new Set((order.items || []).map((i: any) => i?.productId).filter(Boolean))];
                if (!ids.length) return;
                const chunks: any[][] = [];
                for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
                const snaps = await Promise.all(chunks.map((c) =>
                  getDocs(query(collection(db, 'variants'), where('productId', 'in', c)))
                ));
                const byKey = new Map<string, string>();
                const byProduct = new Map<string, string[]>();
                snaps.forEach((qs) => qs.docs.forEach((d) => {
                  const v: any = d.data();
                  if (!v.sku) return;
                  byKey.set(`${v.productId}::${String(v.title ?? '').trim().toLowerCase()}`, v.sku);
                  byProduct.set(v.productId, [...(byProduct.get(v.productId) || []), v.sku]);
                }));
                const items = (order.items || []).map((i: any) => {
                  if (i?.sku) return i;
                  const exact = byKey.get(`${i?.productId}::${String(i?.variant ?? '').trim().toLowerCase()}`);
                  // A product with exactly one variant has no ambiguity, even
                  // when the recorded title does not match it.
                  const only = byProduct.get(i?.productId);
                  const sku = exact || (only && only.length === 1 ? only[0] : undefined);
                  return sku ? { ...i, sku } : i;
                });
                setData({ ...order, items });
              } catch (err) {
                console.error('could not resolve order line SKUs:', err);
              }
            })();
          });
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.empty ? null : { _id: snap.docs[0].id, ...snap.docs[0].data() });
          });
        }
        else if (path === 'admin.orders.getAllOrders') {
          const q = query(collection(db, 'orders'), limit(500));
          unsubscribe = onSnapshot(q, (snap) => {
            let docs = snap.docs.map(d => normalizeOrder({ _id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

            if (args?.showDeleted) {
              // Deleted tab: only orders explicitly marked deleted
              docs = docs.filter((d: any) => d.isDeleted === true || d.status === 'deleted');
            } else {
              // All other tabs: exclude deleted orders
              docs = docs.filter((d: any) => !d.isDeleted && d.status !== 'deleted');
              if (args?.status && args.status !== 'all') {
                docs = docs.filter((d: any) => d.status === args.status);
              }
            }

            if (args?.paymentStatus && args.paymentStatus !== 'all') {
              docs = docs.filter((d: any) => d.paymentStatus === args.paymentStatus);
            }
            setData(docs);
          });
        }
        else if (path === 'admin.orders.searchOrders') {
          if (!args?.searchTerm) {
            setData([]);
            return;
          }
          /*
           * Firestore has no full-text search, so orders are pulled and
           * filtered here. Two things were wrong with that.
           *
           * It read `limit(100)` with no ordering, so it searched an arbitrary
           * hundred of the orders that exist — with 148 on file, roughly a
           * third of them could not be found at all, and which third was up to
           * Firestore. And it matched `customerName` and `phone` while the
           * table beside it displays `shippingAddress.fullName` and
           * `shippingAddress.phone`, so a name read off the screen often
           * found nothing.
           *
           * The cap is a real ceiling, not a page size: past it, this needs
           * proper pagination or a search index rather than a bigger number.
           */
          const q = query(collection(db, 'orders'), limit(1000));
          unsubscribe = onSnapshot(q, (snap) => {
            const term = args.searchTerm.trim().toLowerCase();
            // "#4025", "4025" and "4025 " are the same search.
            const bare = term.replace(/^#/, '');
            const digits = term.replace(/\D/g, '');
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const has = (v: any) => String(v || '').toLowerCase().includes(term);
            const filtered = docs.filter((d: any) =>
              has(d.orderNumber) ||
              String(d.orderNumber || '').toLowerCase().replace(/^#/, '').includes(bare) ||
              has(d.failedOrderNumber) ||
              has(d.orderId) ||
              has(d.customerName) ||
              has(d.shippingAddress?.fullName) ||
              has(d.customerInfo?.name) ||
              has(d.email) ||
              has(d.customerEmail) ||
              has(d.guestEmail) ||
              has(d.customerInfo?.email) ||
              // A tracking number is how a customer service call usually starts.
              has(d.awbNumber) ||
              has(d.manualTrackingNumber) ||
              (digits.length >= 6 && (
                String(d.phone || '').replace(/\D/g, '').includes(digits) ||
                String(d.shippingAddress?.phone || '').replace(/\D/g, '').includes(digits) ||
                String(d.customerInfo?.phone || '').replace(/\D/g, '').includes(digits)
              ))
            );
            filtered.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(filtered);
          });
        }
        else if (path === 'abandonedCarts.getAbandonedCartStats') {
          unsubscribe = onSnapshot(collection(db, 'abandonedCarts'), (snap) => {
            const carts = snap.docs.map(d => d.data() as any);
            const byStatus = (s: string) => carts.filter(c => c.status === s);
            const sum = (list: any[]) => list.reduce((n, c) => n + (c.cartTotal || 0), 0);
            const recovered = byStatus("recovered");
            setData({
              total: carts.length,
              pending: byStatus("pending").length,
              reminded: byStatus("reminded").length,
              recovered: recovered.length,
              expired: byStatus("expired").length,
              totalValue: sum(carts),
              recoveredValue: sum(recovered),
              revenue: sum(recovered),
              recoveryRate: carts.length ? (recovered.length / carts.length) * 100 : 0,
            });
          });
        }
        else if (path === 'abandonedCartSettings.getSettings') {
          // Defaults mirror the Cloud Function's, and enabled stays false until
          // an admin turns it on.
          unsubscribe = onSnapshot(doc(db, 'abandonedCartSettings', 'default'), (snap) => {
            setData({
              enabled: false,
              delayHours: 4,
              secondReminderEnabled: false,
              secondReminderDelayHours: 24,
              dailyEmailCap: 200,
              couponPrefix: "COMEBACK",
              couponDiscountType: "percentage",
              couponDiscountValue: 10,
              couponValidityDays: 7,
              ...(snap.exists() ? snap.data() : {}),
            });
          });
        }
        else if (path === 'abandonedCarts.getAllAbandonedCarts') {
          let q = query(collection(db, 'abandonedCarts'), limit(100));
          if (args?.status && args.status !== 'all') {
            q = query(collection(db, 'abandonedCarts'), where('status', '==', args.status), limit(100));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            docs.sort((a: any, b: any) => {
              const aTime = a.createdAt || a._creationTime || 0;
              const bTime = b.createdAt || b._creationTime || 0;
              return bTime - aTime;
            });
            setData(docs);
          });
        }
        else if (path === 'admin.orders.getOrderVariantInventory') {
          // Mock inventory for admin
          setData([]);
        }
        else if (path === 'admin.orders.getOrderStats') {
          const q = query(collection(db, 'orders'), limit(500));
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => d.data() as any);
            const nonDeleted = docs.filter((d) => !d?.isDeleted);
            const getPayStatus = (d: any) => d?.paymentStatus || d?.paymentInfo?.status;

            /*
             * Counted through the same normaliser the tabs filter by.
             *
             * These were counted off the raw `status`, so every order the live
             * checkout wrote — which says "pending", not "processing" — fell
             * into none of the tabs and the numbers above them never added up
             * to the total. "pending_payment" was worse: it counted orders
             * whose *payment* was pending, which is a different question and
             * gave a figure that disagreed with the list it sat on.
             */
            const counts = Object.fromEntries(ORDER_STATUSES.map((st) => [st, 0])) as Record<string, number>;
            for (const d of nonDeleted) {
              const st = normalizeOrderStatus(d?.status, normalizePaymentStatus(getPayStatus(d)), d);
              if (st in counts) counts[st] += 1;
            }
            /*
             * Money and payment counts belong here too.
             *
             * The cards above the table read these from the *filtered* list,
             * so opening the Processing tab made the page announce "Total
             * Orders 5" and "0 delivered" while the tabs beside it said 148
             * and 14. Two sources for one question is one too many; the cards
             * now read the same numbers the tabs do.
             */
            const money = (d: any) => Number(d?.total ?? d?.amountPayable) || 0;
            const paid = nonDeleted.filter((d) => normalizePaymentStatus(getPayStatus(d)) === 'success');
            setData({
              ...counts,
              total: nonDeleted.length,
              failed: nonDeleted.filter((d) => normalizePaymentStatus(getPayStatus(d)) === 'failed').length,
              deleted: docs.filter((d) => d?.isDeleted).length,
              revenue: paid.reduce((sum, d) => sum + money(d), 0),
              paidOrders: paid.length,
              pendingPayments: nonDeleted.filter((d) => {
                const p = normalizePaymentStatus(getPayStatus(d));
                return p === 'pending' || !p;
              }).length,
              failedPayments: nonDeleted.filter((d) => normalizePaymentStatus(getPayStatus(d)) === 'failed').length,
            });
          });
        }
        else if (path === 'orders.checkOrderInventory') {
          if (!args?.orderId) {
            setData(null);
          } else {
            (async () => {
              const osnap = await getDoc(doc(db, 'orders', args.orderId));
              if (!osnap.exists()) {
                setData({ available: false, unavailableItems: [] });
                return;
              }
              const items: any[] = osnap.data().items || [];
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
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
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

          unsubscribe = onSnapshot(
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
                        discountedPrice: Number(entry.discountedPrice) || Number(v.price) || 0,
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
        else if (path === 'checkoutUpsells.listAllRules') {
          const q = query(collection(db, 'checkoutUpsells'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
            setData(data);
          });
        }
        else if (path === 'shipping.getShippingSettings') {
          unsubscribe = onSnapshot(doc(db, 'settings', 'shipping'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({
                baseRate: 0,
                freeShippingThreshold: 500,
                flatShippingFee: 50,
                codFee: 50,
                expressShippingFee: 100,
                expressShippingEnabled: true,
                shippingIncludesTax: false
              });
            }
          });
        }
        else if (path === 'wallet.getWalletSettings') {
          unsubscribe = onSnapshot(doc(db, 'walletSettings', 'default'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({
                maxUsageType: 'percentage',
                maxUsageValue: 10,
                referralRewardAmount: 0,
                referralMinOrderValue: 0,
                walletEnabled: true
              });
            }
          });
        }
        else if (path === 'wallet.getAllUsersWithWallets') {
          const q = query(collection(db, 'users'));
          unsubscribe = onSnapshot(q, (snap) => {
            const users = snap.docs.map(d => ({
              _id: d.id,
              name: d.data().name || 'Unknown',
              email: d.data().email || '',
              walletBalance: d.data().walletBalance || 0,
              transactionCount: d.data().transactionCount || 0
            }));
            setData(users);
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'referrals.getReferralStats') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData({ totalEarned: 0, successfulReferrals: 0, referralCode: '' });
              return;
            }
            
            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setData({
                  totalEarned: data.referralEarnings || 0,
                  successfulReferrals: data.referralCount || 0,
                  referralCode: data.referralCode || `REF${user.uid.substring(0, 5).toUpperCase()}`
                });
              }
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'admin.bugReports.getBugStats') {
          const q = query(collection(db, 'bugReports'));
          unsubscribe = onSnapshot(q, (snap) => {
            let pending = 0, resolved = 0, deleted = 0;
            snap.docs.forEach(d => {
              const s = d.data().status;
              if (s === 'resolved') resolved++;
              else if (s === 'deleted') deleted++;
              else pending++;
            });
            setData({ total: snap.size, pending, resolved, deleted });
          });
        }
        else if (path === 'admin.bugReports.getBugReports') {
          const q = query(collection(db, 'bugReports'));
          unsubscribe = onSnapshot(q, async (snap) => {
            const reports = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Also attach mock attachments for now or query bugAttachments
            const attachSnap = await getDocs(collection(db, 'bugAttachments'));
            const attachMap: Record<string, any[]> = {};
            attachSnap.docs.forEach(d => {
              const data = d.data();
              if (!attachMap[data.bugReportId]) attachMap[data.bugReportId] = [];
              attachMap[data.bugReportId].push({ _id: d.id, ...data });
            });
            reports.forEach((r: any) => r.attachments = attachMap[r._id] || []);
            setData(reports);
          });
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

            setData({ available: true, codFee, prepaidAmount, codAmount, reason: "", isMixedCart, showOption: true });
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
                let collectionIds: string[] = [];
                if (rules.some(r => r.targetType === "collection")) {
                  const cp = await getDocs(query(collection(db, 'collectionProducts'),
                    where('productId', '==', item.productId)));
                  collectionIds = cp.docs.map(d => d.data().collectionId);
                }

                const applicable = rules.filter(r =>
                  (r.targetType === "variant" && r.targetId === item.variantId) ||
                  (r.targetType === "product" && r.targetId === item.productId) ||
                  (r.targetType === "collection" && collectionIds.includes(r.targetId))
                ).filter(r =>
                  (r.minCartValue === undefined || cartTotal >= r.minCartValue) &&
                  (r.maxCartValue === undefined || cartTotal <= r.maxCartValue)
                );

                const perUnit = applicable.reduce((best, r) => {
                  const amount = Math.round(r.cashbackType === "fixed"
                    ? r.cashbackValue
                    : (item.finalPrice * r.cashbackValue) / 100);
                  return amount > best ? amount : best;
                }, 0);

                return {
                  productId: item.productId,
                  variantId: item.variantId,
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
        else if (path === 'cashback.getAllCashbackRules') {
          const q = query(collection(db, 'cashbackRules'));
          unsubscribe = onSnapshot(q, (snap) => {
            const rules = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            setData(rules);
          });
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
        else if (path === 'products.getProductVariants') {
          if (!args?.productId) {
            setData([]);
            return;
          }
          const q = query(collection(db, 'variants'), where('productId', '==', args.productId));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
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
            const cacheKey = `${args.brand}|${args.model}|${args.sku}`;
            const cached = mockupLookupCache.get(cacheKey);
            if (cached !== undefined) {
              setData(cached);
            } else {
            (async () => {
              const finish = (value: any) => {
                mockupLookupCache.set(cacheKey, value);
                setData(value);
              };

              const exact = await getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', args.brand),
                where('model', '==', args.model),
                where('sku', '==', args.sku),
                limit(1)
              ));
              const exactUrl = exact.empty ? null : mockupUrlFrom(exact.docs[0].data());
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
                where('sku', '==', args.sku),
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
                if (i >= 6 && (!best || i > best.score)) best = { doc: d, score: i };
              }
              if (best) {
                finish({ url: mockupUrlFrom(best.doc.data()), model: best.doc.data().model, exact: false });
                return;
              }

              const hero = await getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', HERO_MOCKUP_BRAND),
                where('model', '==', HERO_MOCKUP_MODEL),
                where('sku', '==', args.sku),
                limit(1)
              ));
              finish(hero.empty
                ? null
                : { url: mockupUrlFrom(hero.docs[0].data()), model: HERO_MOCKUP_MODEL, exact: false });
            })();
            }
          }
        }
        else if (path === 'supportedModels.getMetadata') {
          const q = query(collection(db, 'modelMetadata'), where('key', '==', 'current'), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
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
            unsubscribe = onSnapshot(q, (snap) => {
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
              unsubscribe = onSnapshot(fallbackQ, (snap) => {
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
            if (active) setData(hits.slice(0, args?.limit || 10));
            return;
          }
          // Fetch all active models to search in-memory
          const q = query(collection(db, 'supportedModels'), where('isActive', '==', true));
          unsubscribe = onSnapshot(q, (snap) => {
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
              if (active) setData(shape(modelRows));
              return;
            }
          }
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
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
        else if (path === 'supportedModels.getBrands') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brands = new Set<string>();
            snap.docs.forEach(d => {
              const brandName = d.data().brandName;
              if (brandName) brands.add(brandName);
            });
            setData(Array.from(brands).sort((a, b) => a.localeCompare(b)));
          });
        }
        else if (path === 'supportedModels.getBrandsWithCounts') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brandMap: Record<string, { count: number, categories: Set<string> }> = {};
            snap.docs.forEach(d => {
              const data = d.data();
              const brandName = data.brandName;
              const category = data.category;
              if (brandName) {
                if (!brandMap[brandName]) {
                  brandMap[brandName] = { count: 0, categories: new Set() };
                }
                brandMap[brandName].count++;
                if (category) {
                  brandMap[brandName].categories.add(category);
                }
              }
            });
            
            const result = Object.keys(brandMap).map(brand => ({
              brand,
              count: brandMap[brand].count,
              categories: Array.from(brandMap[brand].categories).sort()
            })).sort((a, b) => a.brand.localeCompare(b.brand));
            
            setData(result);
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
            unsubscribe = onSnapshot(q, (snap) => {
              let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              docs.sort((a: any, b: any) => a.modelName.localeCompare(b.modelName));
              setData(docs);
            }, (error) => {
              console.error("Index error, falling back to client-side filter", error);
              const fallbackQ = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand));
              unsubscribe = onSnapshot(fallbackQ, (snap) => {
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
        else if (path === 'supportedModels.getStats') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            let total = 0;
            let active = 0;
            let inactive = 0;
            const categoryBreakdown: Record<string, number> = {};
            
            snap.docs.forEach(d => {
              const data = d.data();
              total++;
              if (data.isActive) active++;
              else inactive++;
              
              const category = data.category;
              if (category) {
                categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
              }
            });
            
            setData({ total, active, inactive, categoryBreakdown });
          });
        }
        else if (path === 'supportedModels.getModelsByCategory') {
          let q = query(collection(db, 'supportedModels'));
          if (args && args.category) {
            q = query(collection(db, 'supportedModels'), where('category', '==', args.category));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (args && args.isActive !== undefined) {
              data = data.filter((d: any) => d.isActive === args.isActive);
            }
            setData(data);
          });
        }
        else if (path === 'supportedModels.getModelCountByGadgetType') {
          if (!args?.gadgetTypeId) {
            setData(0);
          } else {
            unsubscribe = onSnapshot(
              query(collection(db, 'supportedModels'), where('gadgetTypeId', '==', args.gadgetTypeId)),
              (snap) => setData(snap.size)
            );
          }
        }
        else if (path === 'supportedModels.getLatest') {
          const q = query(collection(db, 'supportedModels'), limit(args?.count || 20));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'stockNotifications.getNotificationStats') {
          // Waiting requests grouped by product and variant, each with the
          // people behind it: the number they typed, when, and whether they
          // were signed in — which is how a test entry or a fake is spotted.
          // Requests saved before titles were stored are named from the
          // product and variant themselves.
          const names = new Map<string, any>();
          const nameOf = async (col: 'products' | 'variants', id: string) => {
            const key = `${col}/${id}`;
            if (!id) return null;
            if (!names.has(key)) {
              names.set(key, getDoc(doc(db, col, id)).then((d) => (d.exists() ? d.data() : null)).catch(() => null));
            }
            return names.get(key);
          };
          unsubscribe = onSnapshot(
            query(collection(db, 'stockNotifications'), where('status', '==', 'waiting')),
            (snap) => {
              void (async () => {
                const rows = snap.docs.map(d => ({ _id: d.id, ...(d.data() as any) }));
                const perPhone = new Map<string, number>();
                rows.forEach(n => perPhone.set(n.phoneNumber, (perPhone.get(n.phoneNumber) || 0) + 1));
                const products = new Map<string, any>();
                for (const n of rows) {
                  const variant: any = await nameOf('variants', n.variantId);
                  const productId = n.productId || variant?.productId || '';
                  const product: any = n.productTitle ? null : await nameOf('products', productId);
                  if (!products.has(productId)) {
                    products.set(productId, {
                      productId,
                      productTitle: n.productTitle || product?.title || 'Unknown product',
                      productSlug: n.productSlug || product?.slug || '',
                      variants: new Map<string, any>(),
                      totalCount: 0,
                    });
                  }
                  const p = products.get(productId);
                  p.totalCount++;
                  if (!p.variants.has(n.variantId)) {
                    p.variants.set(n.variantId, {
                      variantId: n.variantId,
                      variantTitle: n.variantTitle || variant?.title || 'Unknown variant',
                      sku: n.sku || variant?.sku || '',
                      inventoryQuantity: variant?.inventoryQuantity,
                      count: 0,
                      requests: [] as any[],
                    });
                  }
                  const v = p.variants.get(n.variantId);
                  v.count++;
                  v.requests.push({
                    _id: n._id,
                    phoneNumber: n.phoneNumber,
                    createdAt: n.createdAt || 0,
                    userId: n.userId || '',
                    userEmail: n.userEmail || '',
                    requestsFromThisNumber: perPhone.get(n.phoneNumber) || 1,
                  });
                }
                setData(Array.from(products.values())
                  .map(p => ({
                    ...p,
                    variants: Array.from(p.variants.values()).map((v: any) => ({
                      ...v,
                      requests: v.requests.sort((a: any, b: any) => b.createdAt - a.createdAt),
                    })),
                  }))
                  .sort((a, b) => b.totalCount - a.totalCount));
              })();
            }
          );
        }
        else if (path === 'stockNotifications.getWhatsAppHealth') {
          // Everything that has to be true for a back-in-stock message to
          // leave, checked where it can be, plus what the last sends did.
          void (async () => {
            try {
              const [uc, msgs, notified] = await Promise.all([
                getDocs(query(collection(db, 'whatsappUsecases'), where('usecaseKey', '==', 'back_in_stock'), limit(1))),
                getDocs(query(collection(db, 'whatsappMessages'), where('usecaseKey', '==', 'back_in_stock'), limit(100))),
                getDocs(query(collection(db, 'stockNotifications'), where('status', '==', 'notified'), limit(200))),
              ]);
              const usecase: any = uc.empty ? null : uc.docs[0].data();
              let template: any = null;
              const wid = usecase?.providerTemplateId;
              if (wid) {
                const t = await getDocs(query(collection(db, 'whatsappTemplates'), where('providerTemplateId', '==', wid), limit(1)));
                template = t.empty ? null : t.docs[0].data();
              }
              const recent = msgs.docs
                .map(d => ({ _id: d.id, ...(d.data() as any) }))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .slice(0, 15)
                .map(m => ({
                  _id: m._id,
                  phone: m.recipientPhone,
                  status: m.status,
                  reason: m.failureReason || '',
                  createdAt: m.createdAt || 0,
                  sentAt: m.sentAt || 0,
                }));
              setData({
                usecase: usecase
                  ? { enabled: usecase.enabled === true, templateName: usecase.templateName || '', providerTemplateId: wid || '' }
                  : null,
                template: template
                  ? { name: template.templateName || '', variables: template.variables || [] }
                  : null,
                recent,
                notifiedTotal: notified.size,
              });
            } catch (e: any) {
              setData({ error: e?.message || 'Could not read the WhatsApp setup' });
            }
          })();
        }
        else if (path === 'mediaLibrary.getFolders') {
          unsubscribe = onSnapshot(collection(db, 'mediaLibrary'), (snap) => {
            const folders = new Set<string>();
            snap.docs.forEach(d => {
              const f = d.data().folder;
              if (f) folders.add(f);
            });
            setData(Array.from(folders).sort());
          });
        }
        else if (path === 'mediaLibrary.listMedia') {
          unsubscribe = onSnapshot(collection(db, 'mediaLibrary'), (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));

            if (args?.folder) docs = docs.filter(m => m.folder === args.folder);
            if (args?.mediaType) docs = docs.filter(m => (m.mediaType || 'image') === args.mediaType);
            if (args?.searchQuery) {
              const needle = String(args.searchQuery).toLowerCase();
              docs = docs.filter(m => (m.filename || "").toLowerCase().includes(needle));
            }

            docs.sort((a, b) => (b.createdAt || b._creationTime || 0) - (a.createdAt || a._creationTime || 0));
            const total = docs.length;
            const offset = args?.offset || 0;
            if (args?.limit) docs = docs.slice(offset, offset + args.limit);
            setData({ items: docs, totalCount: total });
          });
        }
        else if (path === 'collections.getAllCollections' || path === 'collections.getAllCollectionsWithCounts') {
          const q = query(collection(db, 'collections'));
          unsubscribe = onSnapshot(q, (snap) => {
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
          unsubscribe = onSnapshot(q, (snap) => {
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
          unsubscribe = onSnapshot(q, (snap) => {
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
          
          unsubscribe = onSnapshot(q, async (snap) => {
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
        else if (path === 'products.getAllVariantsWithProducts') {
          const fetchVariants = async () => {
            try {
              const vSnap = await getDocs(collection(db, 'variants'));
              const pSnap = await getDocs(collection(db, 'products'));
              const productsMap: Record<string, any> = {};
              pSnap.docs.forEach(p => {
                productsMap[p.id] = p.data();
              });
              const docs = vSnap.docs.map(d => {
                const vData = d.data();
                const pData = productsMap[vData.productId] || {};
                return {
                  _id: d.id,
                  ...vData,
                  productTitle: pData.title || "Unknown Product",
                  title: vData.title || "",
                  sku: vData.sku || ""
                };
              });
              setData(docs);
            } catch (err) {
              console.error(err);
              setData([]);
            }
          };
          fetchVariants();
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
          unsubscribe = () => { unsubProducts(); unsubVariants(); };
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
            if (active) setData(countFacets(fromCatalogue));
            return;
          }
          unsubscribe = onSnapshot(query(collection(db, 'products'), where('status', '==', 'active')), (snap) => {
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
          unsubscribe = onSnapshot(q, async (snap) => {
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
            if (active) setData(shown.slice(0, args?.limit || 15));
            return;
          }
          const q = query(collection(db, 'products'), where('status', '==', 'active'));
          unsubscribe = onSnapshot(q, async (snap) => {
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
        else if (path === 'products.exportProductsForBulkEdit') {
          if (!args?.productIds || args.productIds.length === 0) {
            setData([]);
            return;
          }
          
          const fetchExportData = async () => {
            const productDocs: any[] = [];
            for (let i = 0; i < args.productIds.length; i += 10) {
              const chunk = args.productIds.slice(i, i + 10);
              const pq = query(collection(db, 'products'), where('__name__', 'in', chunk));
              const snap = await getDocs(pq);
              productDocs.push(...snap.docs.map(d => ({ _id: d.id, ...d.data() })));
            }

            const exportRows: any[] = [];
            for (const product of productDocs) {
              const vq = query(collection(db, 'variants'), where('productId', '==', product._id));
              const vsnap = await getDocs(vq);
              const variants = vsnap.docs.map(v => ({ _id: v.id, ...v.data() }));

              for (const variant of variants) {
                exportRows.push({
                  productId: product._id,
                  productTitle: product.title || "",
                  productSlug: product.slug || "",
                  productStatus: product.status || "",
                  collectionName: product.collectionName || "",
                  variantId: variant._id,
                  variantTitle: variant.title || "",
                  sku: variant.sku || "",
                  price: variant.price || 0,
                  compareAtPrice: variant.compareAtPrice || 0,
                  inventoryQuantity: variant.inventoryQuantity || 0,
                  weight: variant.weight || 0,
                  weightUnit: variant.weightUnit || "g",
                });
              }
            }
            setData(exportRows);
          };
          fetchExportData();
        }
        else if (path === 'rollsManagement.getStockLevels') {
          // How many units each variant can still be cut from its vinyl roll.
          // A variant with no R-number is not made from roll material at all
          // (accessories), so it is reported as unlimited rather than zero.
          const ROLL_WIDTH_CM = 29.5;
          const UNLIMITED = 999999;

          const computeStockLevels = async () => {
            try {
              const [vSnap, pSnap, rSnap, gSnap, cSnap] = await Promise.all([
                getDocs(collection(db, 'variants')),
                getDocs(collection(db, 'products')),
                getDocs(collection(db, 'rollInventory')),
                getDocs(collection(db, 'gadgetConsumption')),
                getDocs(collection(db, 'cutoutInventory')),
              ]);

              const productsMap: Record<string, any> = {};
              pSnap.docs.forEach(d => { productsMap[d.id] = d.data(); });

              const rollsMap: Record<string, any> = {};
              rSnap.docs.forEach(d => {
                const r = d.data() as any;
                if (r.rNumber) rollsMap[String(r.rNumber).trim().toUpperCase()] = r;
              });

              // Cutouts are stocked as whole sheets rather than by the metre,
              // so one unit costs `multiplier` sheets and no geometry is
              // involved: a laptop lid is one sheet, lid plus keyboard is two.
              // One cutout carries more than one SKU code: a design is sold as
              // "Only Top" and "Top + Keyboard Area" under consecutive numbers
              // (LP-3D-05 and L-3D-06 are both Naruto sunset Forest). They are
              // one sheet pile, so every code points at the same record.
              const cutoutsMap: Record<string, any> = {};
              cSnap.docs.forEach(d => {
                const c = d.data() as any;
                const entry = { _id: d.id, ...c };
                for (const code of [c.cutoutNumber, ...(c.aliases || [])]) {
                  if (code) cutoutsMap[String(code).trim().toUpperCase()] = entry;
                }
              });

              // A variant names its design in rNumber, or failing that in the
              // leading segments of its SKU: LP-3d-07-LPK is cutout LP-3d-07.
              const designOf = (variant: any) => {
                const rn = String(variant.rNumber || '').trim().toUpperCase();
                if (rn && rollsMap[rn]) return { kind: 'roll' as const, code: rn, doc: rollsMap[rn] };
                if (rn && cutoutsMap[rn]) return { kind: 'cutout' as const, code: rn, doc: cutoutsMap[rn] };
                const parts = String(variant.sku || '').split('-');
                for (let k = parts.length - 1; k >= 1; k--) {
                  const code = parts.slice(0, k).join('-').toUpperCase();
                  if (rollsMap[code]) return { kind: 'roll' as const, code, doc: rollsMap[code] };
                  if (cutoutsMap[code]) return { kind: 'cutout' as const, code, doc: cutoutsMap[code] };
                }
                return null;
              };

              // Consumption rows are keyed by gadget type, which products carry
              // directly; the category name is only a fallback for older rows.
              const gadgetByTypeId: Record<string, any> = {};
              const gadgetByName: Record<string, any> = {};
              gSnap.docs.forEach(d => {
                const g = d.data() as any;
                if (g.gadgetTypeId) gadgetByTypeId[g.gadgetTypeId] = g;
                if (g.categoryName) gadgetByName[String(g.categoryName).toLowerCase()] = g;
              });

              const levels = vSnap.docs.map(vDoc => {
                const variant = vDoc.data() as any;
                const product = productsMap[variant.productId];
                if (!product) return null;

                const design = designOf(variant);
                if (!design) {
                  return { variantId: vDoc.id, availableUnits: UNLIMITED, rollMeters: 0, rNumber: null, designName: null };
                }

                if (design.kind === 'cutout') {
                  const sheets = Number(design.doc.sheetsAvailable) || 0;
                  const multiplier = Number(variant.materialMultiplier) || 1;
                  return {
                    variantId: vDoc.id,
                    availableUnits: Math.floor(sheets / Math.max(multiplier, 1)),
                    rollMeters: 0,
                    sheetsAvailable: sheets,
                    source: 'cutout',
                    rNumber: design.code,
                    designName: design.doc.designName || null,
                  };
                }

                const rNumber = design.code;
                const roll = design.doc;
                if (!roll || !(Number(roll.metersAvailable) > 0)) {
                  return {
                    variantId: vDoc.id, availableUnits: 0, rollMeters: 0,
                    rNumber, designName: roll?.designName || null,
                  };
                }

                const rollMeters = Number(roll.metersAvailable);
                const gadget = gadgetByTypeId[product.gadgetTypeId]
                  || gadgetByName[String(product.gadgetCategory || '').toLowerCase()];
                if (!gadget || !(gadget.lengthCm > 0) || !(gadget.widthCm > 0)) {
                  // Nothing to measure against — do not claim it is out of stock.
                  return { variantId: vDoc.id, availableUnits: UNLIMITED, rollMeters, rNumber, designName: roll.designName || null };
                }

                const rollLengthCm = rollMeters * 100;
                const multiplier = Number(variant.materialMultiplier) || 1;
                let availableUnits: number;

                if (roll.isContinuous) {
                  const totalAreaCm2 = ROLL_WIDTH_CM * rollLengthCm;
                  availableUnits = Math.floor(totalAreaCm2 / (gadget.lengthCm * gadget.widthCm * multiplier));
                } else {
                  // Non-continuous prints cannot be rotated freely, so count
                  // whole pieces in each orientation and keep the better one.
                  const effLength = gadget.lengthCm * Math.sqrt(multiplier);
                  const effWidth = gadget.widthCm * Math.sqrt(multiplier);
                  const units1 = Math.floor(ROLL_WIDTH_CM / effWidth) * Math.floor(rollLengthCm / effLength);
                  const units2 = effLength <= ROLL_WIDTH_CM
                    ? Math.floor(ROLL_WIDTH_CM / effLength) * Math.floor(rollLengthCm / effWidth)
                    : 0;
                  availableUnits = Math.max(units1, units2);
                }

                return {
                  variantId: vDoc.id,
                  availableUnits: Number.isFinite(availableUnits) ? Math.max(0, availableUnits) : 0,
                  rollMeters,
                  rNumber,
                  designName: roll.designName || null,
                };
              }).filter(Boolean);

              setData(levels);
            } catch (err) {
              console.error('[firebase-hooks] getStockLevels failed:', err);
              setData([]);
            }
          };
          computeStockLevels();
        }
        else if (path === 'modelRequests.getAllModelRequests') {
          unsubscribe = onSnapshot(collection(db, 'modelRequests'), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any))
              .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))));
        }
        else if (path === 'homepage.getAllCategoryDisplaySettings') {
          unsubscribe = onSnapshot(collection(db, 'categoryDisplaySettings'), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any))
              .sort((a, b) => (a.order || 0) - (b.order || 0))));
        }
        else if (path === 'products.getAllVariants') {
          unsubscribe = onSnapshot(query(collection(db, 'variants'), limit(2000)), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() }))));
        }
        else if (path === 'whatsapp.getAllTemplates') {
          unsubscribe = onSnapshot(collection(db, 'whatsappTemplates'), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() }))));
        }
        else if (path === 'uploadJobs.getAllUploadJobs' || path === 'uploadJobs.getActiveUploadJobs') {
          unsubscribe = onSnapshot(collection(db, 'uploadJobs'), (snap) => {
            let jobs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            if (path === 'uploadJobs.getActiveUploadJobs') {
              jobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
            }
            setData(jobs.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0)));
          });
        }
        else if (path === 'googleDriveImportPublic.getAllImportJobs' || path === 'googleDriveImportPublic.getActiveImportJobs') {
          unsubscribe = onSnapshot(collection(db, 'googleDriveImportJobs'), (snap) => {
            let jobs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            if (path.endsWith('getActiveImportJobs')) {
              jobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
            }
            setData(jobs.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0)));
          });
        }
        else if (path === 'collections.getCollectionProducts' || path === 'collections.previewCollectionProducts') {
          if (!args?.collectionId) {
            setData([]);
          } else {
            (async () => {
              const links = await getDocs(query(collection(db, 'collectionProducts'),
                where('collectionId', '==', args.collectionId)));
              const ids = links.docs.map(d => d.data().productId);
              const products = await Promise.all(ids.map(async (id: string) => {
                const p = await getDoc(doc(db, 'products', id));
                return p.exists() ? { _id: p.id, ...p.data() } : null;
              }));
              setData(products.filter(Boolean));
            })();
          }
        }
        else if (path === 'coupons.getEligibleProducts') {
          unsubscribe = onSnapshot(query(collection(db, 'products'), where('status', '==', 'active')), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() }))));
        }
        else if (path === 'migrateGst.getOrdersWithoutGst') {
          unsubscribe = onSnapshot(query(collection(db, 'orders'), limit(500)), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any))
              .filter(o => o.gstAmount === undefined || o.gstAmount === null)));
        }
        else if (path === 'whatsappDebugLogs.getErrorTypes' || path === 'whatsappDebugLogs.getUsecasesWithLogs') {
          const field = path.endsWith('getErrorTypes') ? 'errorType' : 'usecaseId';
          unsubscribe = onSnapshot(collection(db, 'whatsappDebugLogs'), (snap) => {
            const values = new Set<string>();
            snap.docs.forEach(d => {
              const v = (d.data() as any)[field];
              if (v) values.add(v);
            });
            setData(Array.from(values).sort());
          });
        }
        else if (path === 'mockups.getMockupsCount') {
          (async () => {
            const c = await getCountFromServer(collection(db, 'mockups'));
            setData(c.data().count);
          })();
        }
        else if (path === 'mockups.getRecentMockups') {
          unsubscribe = onSnapshot(collection(db, 'mockups'), (snap) => {
            setData(snap.docs
              .map(d => ({ _id: d.id, ...d.data() } as any))
              .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
              .slice(0, args?.limit || 20));
          });
        }
        else if (path === 'mockups.getMissingMockupsStats' || path === 'mockups.getMissingMockups') {
          const category = args?.category || "phone";
          (async () => {
            const models = (await getDocs(query(collection(db, 'supportedModels'),
              where('category', '==', category)))).docs
              .map(d => ({ _id: d.id, ...d.data() } as any))
              .filter(m => m.isActive);

            const msnap = await getDocs(query(collection(db, 'mockups'), limit(3000)));
            const byModelId = new Set<string>();
            const byBrandModel = new Set<string>();
            msnap.docs.forEach(d => {
              const m: any = d.data();
              if (m.supportedModelId) byModelId.add(m.supportedModelId);
              if (m.brand && m.model) byBrandModel.add(`${m.brand}|${m.model}`);
            });

            const without = models.filter(m =>
              !byModelId.has(m._id) && !byBrandModel.has(`${m.brandName}|${m.modelName}`));

            if (path === 'mockups.getMissingMockupsStats') {
              setData({
                totalMissingCombinations: without.length,
                modelsAffected: models.length,
                brandsAffected: new Set(models.map(m => m.brandName)).size,
                modelsWithMockups: models.length - without.length,
                modelsWithoutMockups: without.length,
                totalSKUs: models.length - without.length,
              });
            } else {
              const pageSize = args?.limit || 100;
              setData({
                results: without.slice(0, pageSize),
                totalAvailable: without.length,
                hasMore: without.length > pageSize,
              });
            }
          })();
        }
        else if (path === 'cod.getCodSettings') {
          unsubscribe = onSnapshot(collection(db, 'codSettings'), (snap) => {
            setData(snap.empty
              ? {
                  enabled: false, codFeeType: "fixed", codFeeValue: 0,
                  partialCodEnabled: false, prepaidType: "fixed", prepaidValue: 0,
                  minOrderAmountEnabled: false, minOrderAmount: 0,
                  maxOrderAmountEnabled: false, maxOrderAmount: 0,
                  minProductCountEnabled: false, minProductCount: 0,
                  maxProductCountEnabled: false, maxProductCount: 0,
                  productIdsEnabled: false, productIds: [],
                  collectionIdsEnabled: false, collectionIds: [],
                  variantIdsEnabled: false, variantIds: [],
                  matchMode: "ALL", allowMixedCartCod: false,
                  showCodOnPaymentPage: true, hideWhenIneligible: false, displayRules: [],
                }
              : { _id: snap.docs[0].id, ...snap.docs[0].data() });
          });
        }
        else if (path === 'coupons.getCouponUsageStats') {
          unsubscribe = onSnapshot(
            query(collection(db, 'couponUsage'), where('couponId', '==', args?.couponId ?? '')),
            (snap) => {
              const usages = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
              setData({
                totalUsages: usages.length,
                uniqueUsers: new Set(usages.map(u => u.userId).filter(Boolean)).size,
                totalDiscount: usages.reduce((n, u) => n + (u.discountAmount || 0), 0),
                recentUsages: usages
                  .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
                  .slice(0, 10),
              });
            }
          );
        }
        else if (path === 'migrateCloudinaryToR2.getMigrationStatus') {
          (async () => {
            const onR2 = (list: any[], field: string) =>
              list.filter(x => typeof x[field] === 'string' && x[field].includes('r2.dev')).length;
            const [p, m, ml] = await Promise.all([
              getDocs(query(collection(db, 'products'), limit(2000))),
              getDocs(query(collection(db, 'mockups'), limit(3000))),
              getDocs(collection(db, 'mediaLibrary')),
            ]);
            const products = p.docs.map(d => d.data() as any);
            setData({
              products: {
                total: products.length,
                migrated: products.filter(x => (x.images || []).some((i: any) => (i.url || "").includes('r2.dev'))).length,
              },
              mockups: {
                total: m.size,
                migrated: m.docs.filter(d => !!d.data().r2Key).length,
              },
              mediaLibrary: {
                total: ml.size,
                migrated: onR2(ml.docs.map(d => d.data() as any), 'url'),
              },
              siteAssets: { total: 0, migrated: 0 },
            });
          })();
        }
        else if (path === 'wallet.getUserWalletDetails') {
          if (!args?.userId) {
            setData(null);
          } else {
            (async () => {
              const u = await getDoc(doc(db, 'users', args.userId));
              const t = await getDocs(query(collection(db, 'walletTransactions'), where('userId', '==', args.userId)));
              const txns = t.docs
                .map(d => ({ _id: d.id, ...d.data() } as any))
                .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));
              setData({
                user: u.exists() ? { _id: u.id, ...u.data() } : null,
                stats: {
                  totalCredited: txns.filter(x => x.amount > 0).reduce((n, x) => n + x.amount, 0),
                  totalDebited: txns.filter(x => x.amount < 0).reduce((n, x) => n + Math.abs(x.amount), 0),
                  transactionCount: txns.length,
                },
                recentTransactions: txns.slice(0, 20),
              });
            })();
          }
        }
        else if (path === 'whatsapp.getUsecaseWithTemplate') {
          (async () => {
            const u = args?.usecaseId ? await getDoc(doc(db, 'whatsappUsecases', args.usecaseId)) : null;
            const usecase = u?.exists() ? { _id: u.id, ...u.data() } as any : null;
            let template = null;
            if (usecase?.templateId) {
              const t = await getDoc(doc(db, 'whatsappTemplates', usecase.templateId));
              if (t.exists()) template = { _id: t.id, ...t.data() };
            }
            setData({ usecase, template });
          })();
        }
        else if (path === 'whatsappDebugLogs.getDebugLog') {
          if (!args?.logId) {
            setData({ log: null });
          } else {
            unsubscribe = onSnapshot(doc(db, 'whatsappDebugLogs', args.logId), (snap) =>
              setData({ log: snap.exists() ? { _id: snap.id, ...snap.data() } : null }));
          }
        }
        else if (path === 'whatsappDebugLogs.getDebugStats') {
          unsubscribe = onSnapshot(collection(db, 'whatsappDebugLogs'), (snap) => {
            const logs = snap.docs.map(d => d.data() as any);
            const success = logs.filter(l => l.success === true || l.status === 'success').length;
            setData({
              totalLogs: logs.length,
              successLogs: success,
              failedLogs: logs.length - success,
              successRate: logs.length ? Math.round((success / logs.length) * 100) : 0,
            });
          });
        }
        else if (path === 'rollsManagement.getGadgetConsumption') {
          unsubscribe = onSnapshot(collection(db, 'gadgetConsumption'), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() }))));
        }
        else if (path === 'rollsManagement.getRollInventory') {
          unsubscribe = onSnapshot(collection(db, 'rollInventory'), (snap) =>
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() }))));
        }
        else if (path === 'rollsManagement.getProductsByRNumber') {
          /*
           * Ask the backend what the mapping resolves to, rather than working
           * it out again here.
           *
           * This used to group on the `rNumber` field alone. The order
           * pipeline also walks the SKU's leading segments, so the two
           * disagreed by 293 variants — every one of them reported here as
           * unmapped while checkout resolved it perfectly well. Whoever read
           * this tab was looking at phantom gaps and hand-assigning numbers
           * that were never needed. One resolver now, in functions/materials,
           * and this calls it.
           *
           * `groups` stays keyed by code so existing callers keep working; it
           * now covers cutouts as well as rolls, and carries the coverage
           * figures the tab needs to show what is genuinely unstocked.
           */
          const load = async () => {
            try {
              const fn = httpsCallable(functions, 'materialMapping');
              const res: any = await fn({});
              const payload = res?.data || {};
              const groups: Record<string, any[]> = {};
              const meta: Record<string, any> = {};
              Object.entries(payload.groups || {}).forEach(([code, g]: [string, any]) => {
                groups[code] = g.items || [];
                meta[code] = { kind: g.kind, designName: g.designName, amount: g.amount, unit: g.unit };
              });
              setData({
                groups,
                meta,
                unmapped: [],
                unmatchedByPrefix: payload.unmatchedByPrefix || {},
                orphanStock: payload.orphanStock || [],
                totals: payload.totals || null,
              });
            } catch (e) {
              console.error('materialMapping failed', e);
              setData({ groups: {}, meta: {}, unmapped: [], unmatchedByPrefix: {}, orphanStock: [], totals: null });
            }
          };
          void load();
          // Stock edits and manual assignments both change the answer. Each
          // listener's first snapshot is the state `load` already asked about,
          // and answering it called the function three more times at once —
          // four cold calls of a function that reads the whole catalogue, which
          // is most of why the Cutouts tab took ten seconds to open. Later
          // changes arrive in bursts (a sheet edit restocks a dozen variants),
          // so they are folded into one call.
          let timer: ReturnType<typeof setTimeout> | null = null;
          const reload = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { timer = null; void load(); }, 1500);
          };
          const afterFirst = () => {
            let first = true;
            return () => { if (first) { first = false; return; } reload(); };
          };
          const unsubV = onSnapshot(collection(db, 'variants'), afterFirst());
          const unsubR = onSnapshot(collection(db, 'rollInventory'), afterFirst());
          const unsubC = onSnapshot(collection(db, 'cutoutInventory'), afterFirst());
          unsubscribe = () => { if (timer) clearTimeout(timer); unsubV(); unsubR(); unsubC(); };
        }
        else if (path === 'rollsManagement.getLowStockAlerts') {
          const ROLL_WIDTH_CM = 29.5;
          // Gadget consumption is edited on the same tab and feeds the estimate,
          // so alerts have to recompute when either side changes.
          const recompute = async () => {
            const snap = await getDocs(collection(db, 'rollInventory'));
            const gsnap = await getDocs(collection(db, 'gadgetConsumption'));
            const phone = gsnap.docs
              .map(d => d.data() as any)
              .find(g => (g.categoryName || "").toLowerCase() === "phone skin");
            if (!phone) { setData([]); return; }

            const alerts = snap.docs
              .map(d => d.data() as any)
              .filter(roll => roll.metersAvailable > 0)
              .map(roll => {
                const lengthCm = roll.metersAvailable * 100;
                const estimatedUnits = roll.isContinuous
                  ? Math.floor((ROLL_WIDTH_CM * lengthCm) / (phone.lengthCm * phone.widthCm))
                  : Math.floor(ROLL_WIDTH_CM / phone.widthCm) * Math.floor(lengthCm / phone.lengthCm);
                return {
                  rNumber: roll.rNumber,
                  designName: roll.designName,
                  metersAvailable: roll.metersAvailable,
                  estimatedUnits,
                  categories: ["Phone Skin"],
                };
              })
              .filter(a => a.estimatedUnits < 10 || a.metersAvailable < 1)
              .sort((a, b) => a.estimatedUnits - b.estimatedUnits);

            setData(alerts);
          };

          const unsubRolls = onSnapshot(collection(db, 'rollInventory'), () => { void recompute(); });
          const unsubGadgets = onSnapshot(collection(db, 'gadgetConsumption'), () => { void recompute(); });
          unsubscribe = () => { unsubRolls(); unsubGadgets(); };
        }
        else if (path === 'products.getProduct' || path === 'products.getProductBySlug') {
          const fetchProduct = async () => {
            try {
              const targetId = args?.productId || args?.id;
              let productData = null;

              if (targetId) {
                const snap = await getDoc(doc(db, 'products', targetId));
                if (snap.exists()) {
                  productData = { _id: snap.id, ...snap.data() };
                }
              } else if (args?.slug) {
                const q = query(collection(db, 'products'), where('slug', '==', args.slug), limit(1));
                const snap = await getDocs(q);
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
              console.error("Error fetching product and variants:", error);
              setData(null);
            }
          };

          fetchProduct();
          unsubscribe = () => {};
        }
        else if (path === 'productCategories.listAllCategories') {
          // Returns an object with per-category counts, not a plain list.
          // Assigning a product to a category changes products, not the config,
          // so both sides have to refresh the counts.
          const recompute = async () => {
            const snap = await getDocs(collection(db, 'productCategoriesConfig'));
            const configs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            const products = await getDocs(collection(db, 'products'));

            const counts: Record<string, number> = {};
            products.docs.forEach(d => {
              const c = d.data().productCategory || "uncategorized";
              counts[c] = (counts[c] || 0) + 1;
            });

            setData({
              categories: configs
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(c => ({
                  id: c.slug,
                  name: c.name,
                  count: counts[c.slug] || 0,
                  isActive: c.isActive,
                  icon: c.icon,
                })),
              uncategorizedCount: counts["uncategorized"] || 0,
              totalProducts: products.size,
            });
          };

          const unsubConfigs = onSnapshot(collection(db, 'productCategoriesConfig'), () => { void recompute(); });
          const unsubProducts = onSnapshot(collection(db, 'products'), () => { void recompute(); });
          unsubscribe = () => { unsubConfigs(); unsubProducts(); };
        }
        else if (path === 'productCategories.listAllWithCounts' || path === 'productCategories.listAll' || path === 'productCategories.listActive') {
          const q = query(collection(db, 'productCategoriesConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
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
        else if (path === 'productSections.listSectionContent') {
          const q = query(collection(db, 'productSectionContent'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'productSections.listSuggestedProductsConfigs') {
          const q = query(collection(db, 'suggestedProductsConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'productSections.listTrendingProductsConfigs') {
          const q = query(collection(db, 'trendingProductsConfig'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'productClassification.getClassificationStats') {
          // Finish types are edited on this same page, so a change there has to
          // refresh the cards too — watch both sides, not just products.
          const recompute = async () => {
            const snap = await getDocs(query(collection(db, 'products'), where('status', '==', 'active')));
            {
              const products = snap.docs.map(d => d.data() as any);
              const classified = products.filter(p => p.gadgetCategory && p.finishTypeId).length;

              const byGadget: Record<string, number> = {};
              products.forEach(p => {
                if (p.gadgetCategory) byGadget[p.gadgetCategory] = (byGadget[p.gadgetCategory] || 0) + 1;
              });

              const fsnap = await getDocs(collection(db, 'finishTypes'));
              const byFinish: Record<string, number> = {};
              fsnap.docs.forEach(f => {
                const count = products.filter(p => p.finishTypeId === f.id).length;
                if (count > 0) byFinish[f.data().displayName || f.data().name] = count;
              });

              setData({
                total: products.length,
                classified,
                unclassified: products.length - classified,
                partiallyClassified: products.filter(p =>
                  (p.gadgetCategory && !p.finishTypeId) || (!p.gadgetCategory && p.finishTypeId)).length,
                byGadget,
                byFinish,
                totalFinishTypes: fsnap.size,
              });
            }
          };

          const unsubProducts = onSnapshot(collection(db, 'products'), () => { void recompute(); });
          const unsubFinishes = onSnapshot(collection(db, 'finishTypes'), () => { void recompute(); });
          unsubscribe = () => { unsubProducts(); unsubFinishes(); };
        }
        else if (path === 'productClassification.previewAutoClassification') {
          setData({ results: [] });
        }
        else if (path === 'migrateProductCategory.previewProductCategoryMigration') {
          setData({ stats: { total: 0, willChange: 0 }, preview: [] });
        }
        else if (path === 'modelRequests.findSimilarModels') {
          const search = (args?.modelName || "").toLowerCase().trim();
          if (search.length < 2) {
            setData([]);
          } else {
            const brandSearch = args?.brandName?.toLowerCase().trim();
            const keywords = search.split(/\s+/).filter((k: string) => k.length > 1);
            const similar = (rows: any[]) => rows
              .filter(m => {
                if (args?.category && m.category !== args.category) return false;
                if (brandSearch && (m.brandName || "").toLowerCase() !== brandSearch) return false;
                const name = (m.modelName || "").toLowerCase();
                return keywords.every((k: string) => name.includes(k));
              })
              .slice(0, 5)
              .map(m => ({ _id: m._id, brandName: m.brandName, modelName: m.modelName, category: m.category }));
            const modelRows = await catalogueModels();
            if (modelRows) {
              if (active) setData(similar(modelRows));
              return;
            }
            unsubscribe = onSnapshot(
              query(collection(db, 'supportedModels'), where('isActive', '==', true)),
              (snap) => {
                const matches = snap.docs
                  .map(d => ({ _id: d.id, ...d.data() } as any))
                  .filter(m => {
                    if (args?.category && m.category !== args.category) return false;
                    if (brandSearch && (m.brandName || "").toLowerCase() !== brandSearch) return false;
                    const name = (m.modelName || "").toLowerCase();
                    return keywords.every((k: string) => name.includes(k));
                  })
                  .slice(0, 5);
                setData(matches.map(m => ({
                  _id: m._id, brandName: m.brandName, modelName: m.modelName, category: m.category,
                })));
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
              const other = rules.filter(r =>
                (r.targetType === "variant") ||
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
          unsubscribe = onSnapshot(
            query(collection(db, 'coupons'), where('isActive', '==', true)),
            (snap) => {
              const now = Date.now();
              setData(snap.docs
                .map(d => ({ _id: d.id, ...d.data() } as any))
                .filter(c => (!c.expiresAt || c.expiresAt > now) &&
                             (!c.usageLimit || (c.usageCount || 0) < c.usageLimit) &&
                             c.isPublic !== false));
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

              let picked: any[] = [];
              if (config.sourceType === 'manual' && config.manualProductIds?.length) {
                const wanted = new Set(config.manualProductIds);
                picked = candidates.filter(p => wanted.has(p._id));
              } else if (config.sourceType === 'same-category' && product.productCategory) {
                picked = candidates.filter(p => p.productCategory === product.productCategory);
              } else if (config.sourceType === 'tag-based' && config.filterTags?.length) {
                picked = candidates.filter(p => p.tags?.some((t: string) => config.filterTags.includes(t)));
              }
              picked = picked.slice(0, config.maxProducts || 8);

              // The cards read product.variants for price and stock — live.
              const withVariants = await refreshProducts(picked, path);

              if (active) setData({ config, products: withVariants });
            })();
          }
        }
        else if (path === 'productCategories.getProductsByCategory') {
          // Returns {products,total,hasMore}. Without a handler this fell through
          // to the generic fallback, which answers with a plain array — the page
          // guards on the result being present, then reads .products.length off it.
          const pageSize = args?.limit || 50;
          const offset = args?.offset || 0;
          unsubscribe = onSnapshot(collection(db, 'products'), (snap) => {
            let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            if (args?.category === "uncategorized") {
              docs = docs.filter(p => !p.productCategory);
            } else if (args?.category) {
              docs = docs.filter(p => p.productCategory === args.category);
            }
            setData({
              products: docs.slice(offset, offset + pageSize),
              total: docs.length,
              hasMore: offset + pageSize < docs.length,
            });
          });
        }
        else if (path === 'productCategories.getUncategorizedProducts') {
          unsubscribe = onSnapshot(collection(db, 'products'), (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() } as any)).filter(p => !p.productCategory));
          });
        }
        else if (path === 'productClassification.getUnclassifiedProducts' || path === 'productClassification.getProductsByClassification') {
          setData([]);
        }
        else if (path === 'productCategories.getCategoryStats') {
          // Flat map: the page indexes it by category slug and reads .uncategorized.
          unsubscribe = onSnapshot(collection(db, 'products'), (snap) => {
            const stats: Record<string, number> = { total: snap.size, uncategorized: 0 };
            snap.docs.forEach(d => {
              const slug = d.data().productCategory;
              if (!slug) stats.uncategorized++;
              else stats[slug] = (stats[slug] || 0) + 1;
            });
            setData(stats);
          });
        }
        else if (path === 'supportedModels.getModelInfo') {
          const q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brand), where('modelName', '==', args.model), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
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
          unsubscribe = onSnapshot(q, (snap) => {
            const hit = snap.docs.find((d) => {
              const g: any = d.data();
              return g.category === args.category || g.name === args.category;
            });
            setData(hit ? { _id: hit.id, ...hit.data() } : null);
          });
        }
        else if (path === 'gadgetTypes.getActive' || path === 'gadgetTypes.listAllActive' || path === 'gadgetTypes.listActive' || path === 'gadgetTypes.list') {
          const q = query(collection(db, 'gadgetTypes'));
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'gadgetTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            // No gadgetType document carries an `order`, so sorting by
            // `(a.order || 0)` left every one of them at 0 and the list came out
            // in Firestore id order — which is why the picker opened on
            // Controller. Fall back to the order customers actually shop in.
            const RANK: Record<string, number> = {
              phone: 1, laptop: 2, 'mac-mini': 3, camera: 4, tablet: 5,
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
          unsubscribe = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            if (path !== 'finishTypes.list') {
              data = data.filter((d: any) => d.isActive === true);
            }
            data = data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setData(data);
          });
        }
        else if (path === 'categoryDisplaySettings.getAll') {
          const q = query(collection(db, 'categoryDisplaySettings'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'seoPages.getPageBySlug') {
          const q = query(collection(db, 'seoPages'), where('slug', '==', args.slug), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'seoPages.getPage' || path === 'seoPages.getPageById') {
          const ref = doc(db, 'seoPages', args.pageId);
          unsubscribe = onSnapshot(ref, (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else if (path === 'seoPages.listPages') {
          const baseConstraints: any[] = [];
          if (args?.pageType) {
            baseConstraints.push(where('pageType', '==', args.pageType));
          }
          if (typeof args?.isPublished === 'boolean') {
            baseConstraints.push(where('isPublished', '==', args.isPublished));
          }
          const q = query(collection(db, 'seoPages'), ...baseConstraints);
          unsubscribe = onSnapshot(q, (snap) => {
            const term = String(args?.searchQuery || '').toLowerCase().trim();
            let data = snap.docs.map(d => ({ _id: d.id, ...d.data() })) as any[];
            if (term) {
              data = data.filter((p) => {
                const metaTitle = String(p.metaTitle || '').toLowerCase();
                const slug = String(p.slug || '').toLowerCase();
                const h1Heading = String(p.h1Heading || '').toLowerCase();
                return metaTitle.includes(term) || slug.includes(term) || h1Heading.includes(term);
              });
            }
            data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
            setData(data);
          });
        }
        else if (path === 'seoTemplates.getTemplates') {
          const q = query(collection(db, 'seoPageTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs
              .map(d => ({ _id: d.id, ...d.data() }))
              .sort((a: any, b: any) => String(a.pageType || '').localeCompare(String(b.pageType || '')));
            setData(data);
          });
        }
        else if (path === 'seoTemplates.getTemplateByType') {
          const q = query(collection(db, 'seoPageTemplates'), where('pageType', '==', args.pageType), limit(1));
          unsubscribe = onSnapshot(q, (snap) => {
            if (!snap.empty) {
              setData({ _id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'sitemap.getSitemapUrls') {
          const fetchSitemap = async () => {
            try {
              const baseUrl = "https://goskinly.com";
              const urls: any[] = [];
              const staticPages = [
                { path: "/", priority: 1.0, changefreq: "daily" },
                { path: "/products", priority: 0.9, changefreq: "daily" },
                { path: "/devices", priority: 0.9, changefreq: "weekly" },
                { path: "/policies/privacy", priority: 0.3, changefreq: "monthly" },
                { path: "/policies/terms", priority: 0.3, changefreq: "monthly" },
                { path: "/policies/shipping", priority: 0.4, changefreq: "monthly" },
                { path: "/policies/returns", priority: 0.4, changefreq: "monthly" },
              ];

              const now = new Date().toISOString();
              staticPages.forEach((page) => {
                urls.push({
                  url: `${baseUrl}${page.path}`,
                  lastmod: now,
                  changefreq: page.changefreq,
                  priority: page.priority,
                });
              });

              // Products
              const pq = query(collection(db, 'products'), where('status', '==', 'active'));
              const pSnap = await getDocs(pq);
              pSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/products/${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "weekly",
                    priority: 0.8,
                  });
                }
              });

              // Collections
              const cq = query(collection(db, 'collections'));
              const cSnap = await getDocs(cq);
              cSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/shop?collection=${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "daily",
                    priority: 0.7,
                  });
                }
              });

              // SEO Pages
              const sq = query(collection(db, 'seoPages'), where('isPublished', '==', true));
              const sSnap = await getDocs(sq);
              sSnap.docs.forEach((doc) => {
                const data = doc.data();
                if (data.slug) {
                  urls.push({
                    url: `${baseUrl}/${data.slug}`,
                    lastmod: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date(data.createdAt || data._creationTime || Date.now()).toISOString(),
                    changefreq: "weekly",
                    priority: 0.85,
                  });
                }
              });

              setData(urls);
            } catch (err) {
              console.error("Error fetching sitemap:", err);
              setData([]);
            }
          };
          fetchSitemap();
        }
        else if (path === 'admin.customers.getAll') {
          /*
           * A customer, in a shop whose orders are mostly guests'.
           *
           * There is a `users` collection, but a guest never appears in it —
           * so grouping by user id would miss most of the people who have
           * actually bought something. The email is what identifies a
           * customer here, with the phone as a fallback for the handful of
           * older orders that carry no email.
           */
          unsubscribe = onSnapshot(query(collection(db, 'orders'), limit(1000)), async (snap) => {
            const rows = snap.docs
              .map(d => normalizeOrder({ _id: d.id, ...d.data() }))
              .filter((o: any) => !o.isDeleted);

            const byKey = new Map<string, any>();
            for (const o of rows) {
              const email = String(o.email || o.customerEmail || o.guestEmail || '').trim().toLowerCase();
              const phone = String(o.shippingAddress?.phone || o.phone || '').replace(/\D/g, '').slice(-10);
              const key = email || (phone ? `p:${phone}` : '');
              if (!key) continue;
              const c = byKey.get(key) || {
                key, email, phone,
                name: o.shippingAddress?.fullName || o.customerName || '',
                city: o.shippingAddress?.city || '',
                userId: o.userId && !String(o.userId).startsWith('guest') ? o.userId : null,
                orders: 0, spent: 0, delivered: 0, rto: 0, cancelled: 0, open: 0,
                cod: 0, prepaid: 0, firstAt: Infinity, lastAt: 0, orderIds: [] as string[],
              };
              c.orders += 1;
              c.orderIds.push(o._id);
              if (!c.email && email) c.email = email;
              if (!c.phone && phone) c.phone = phone;
              if (!c.userId && o.userId && !String(o.userId).startsWith('guest')) c.userId = o.userId;
              // Money counts only where money actually arrived.
              if (normalizePaymentStatus(o.paymentStatus) === 'success' || o.status === 'delivered') {
                c.spent += Number(o.total) || 0;
              }
              if (o.status === 'delivered') c.delivered += 1;
              else if (o.status === 'rto') c.rto += 1;
              else if (o.status === 'cancelled') c.cancelled += 1;
              else c.open += 1;
              if (String(o.paymentMethod || '').toLowerCase() === 'cod') c.cod += 1; else c.prepaid += 1;
              const t = o._creationTime || o.createdAt || 0;
              if (t) { c.firstAt = Math.min(c.firstAt, t); c.lastAt = Math.max(c.lastAt, t); }
              byKey.set(key, c);
            }

            // Wallet balances, for the accounts that have one.
            let wallets = new Map<string, number>();
            try {
              const us = await getDocs(query(collection(db, 'users'), limit(1000)));
              wallets = new Map(us.docs.map(d => [d.id, Number((d.data() as any)?.walletBalance) || 0]));
            } catch { /* balances are a nicety; the list is the point */ }

            const list = [...byKey.values()].map((c: any) => ({
              ...c,
              firstAt: c.firstAt === Infinity ? 0 : c.firstAt,
              wallet: c.userId ? (wallets.get(c.userId) || 0) : 0,
              // Of the parcels that reached a conclusion, how many came back.
              rtoRate: (c.delivered + c.rto) > 0 ? c.rto / (c.delivered + c.rto) : 0,
            }));
            list.sort((a: any, b: any) => b.lastAt - a.lastAt);
            setData(list);
          });
        }
        else if (path === 'backup.getRecent') {
          // Newest first, by the day key the backup writes itself under.
          unsubscribe = onSnapshot(collection(db, 'backups'), (snap) => {
            const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            rows.sort((a: any, b: any) => String(b.day || '').localeCompare(String(a.day || '')));
            setData(rows.slice(0, 7));
          });
        }
        else if (path === 'settings.getSetting') {
          unsubscribe = onSnapshot(doc(db, 'settings', args?.key || 'default'), (snap) => {
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
            const bySku = (brand: string, model: string, skus: string[]) =>
              Promise.all(chunked([...new Set(skus)], 30).map((c) => getDocs(query(
                collection(db, 'mockups'),
                where('brand', '==', brand),
                where('model', '==', model),
                where('sku', 'in', c),
              )))).then((snaps) => snaps.flatMap((sn) => sn.docs));
            (async () => {
              const result: Record<string, string> = {};
              const collectRows = (docs: any[]) => {
                docs.forEach(d => {
                  const m: any = d.data();
                  const url = mockupUrlFrom(m);
                  if (!url) return;
                  for (const target of requestedSkus) {
                    if (!result[target] && skuMatches(m.sku, target)) result[target] = url;
                  }
                });
              };
              collectRows(await bySku(args.brand, args.model, requestedSkus));
              const missing = requestedSkus.filter(sku => !result[sku]);
              if (missing.length > 0 && !(args.brand === HERO_MOCKUP_BRAND && args.model === HERO_MOCKUP_MODEL)) {
                collectRows(await bySku(HERO_MOCKUP_BRAND, HERO_MOCKUP_MODEL, missing));
              }
              if (active) setData({ mockups: result, cursor: "", isDone: true });
            })().catch((err) => console.error('[firebase-hooks] mockup lookup failed:', err));
          }
        }
        else if (path === 'mockupsAdvanced.getUniqueBrands') {
          const q = query(collection(db, 'supportedModels'));
          unsubscribe = onSnapshot(q, (snap) => {
            const brands = new Set<string>();
            snap.docs.forEach(d => {
              const brandName = d.data().brandName;
              if (brandName) brands.add(brandName.trim());
            });
            setData(Array.from(brands).sort((a, b) => a.localeCompare(b)));
          });
        }
        else if (path === 'mockupsAdvanced.getModelsWithMockups') {
          let q = query(collection(db, 'supportedModels'));
          if (args?.brandFilter && args.brandFilter !== "all") {
            q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brandFilter));
          }
          unsubscribe = onSnapshot(q, async (snap) => {
            const models = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Fetch all mockups to group them efficiently
            const mockupsSnap = await getDocs(collection(db, 'mockups'));
            
            // Map models by their names (case-insensitive) for fallback matching
            const mockupsCountByModelId = new Map<string, number>();
            const mockupsCountByBrandModel = new Map<string, number>();
            
            mockupsSnap.docs.forEach(d => {
              const data = d.data();
              const modelId = data.supportedModelId;
              const brand = data.brand?.toLowerCase().trim() || "";
              const modelName = data.model?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              
              if (modelId) {
                mockupsCountByModelId.set(modelId, (mockupsCountByModelId.get(modelId) || 0) + 1);
              } else if (brand && modelName) {
                mockupsCountByBrandModel.set(key, (mockupsCountByBrandModel.get(key) || 0) + 1);
              }
            });
            
            const modelsWithMockups = models.filter(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              return mockupsCountByModelId.has(m._id) || mockupsCountByBrandModel.has(key);
            }).map(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              const count = (mockupsCountByModelId.get(m._id) || 0) + (mockupsCountByBrandModel.get(key) || 0);
              return {
                ...m,
                mockupCount: count
              };
            });
            setData(modelsWithMockups);
          });
        }
        else if (path === 'mockupsAdvanced.getModelsMissingMockups') {
          let q = query(collection(db, 'supportedModels'));
          if (args?.brandFilter && args.brandFilter !== "all") {
            q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brandFilter));
          }
          unsubscribe = onSnapshot(q, async (snap) => {
            const models = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            // Fetch all mockups to group them efficiently
            const mockupsSnap = await getDocs(collection(db, 'mockups'));
            
            const modelsWithMockups = new Set<string>();
            const modelsWithMockupsByBrandModel = new Set<string>();
            
            mockupsSnap.docs.forEach(d => {
              const data = d.data();
              const modelId = data.supportedModelId;
              const brand = data.brand?.toLowerCase().trim() || "";
              const modelName = data.model?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              
              if (modelId) {
                modelsWithMockups.add(modelId);
              } else if (brand && modelName) {
                modelsWithMockupsByBrandModel.add(key);
              }
            });
            
            const missingModels = models.filter(m => {
              const brand = m.brandName?.toLowerCase().trim() || "";
              const modelName = m.modelName?.toLowerCase().trim() || "";
              const key = `${brand}_${modelName}`;
              return !modelsWithMockups.has(m._id) && !modelsWithMockupsByBrandModel.has(key);
            });
            setData(missingModels);
          });
        }
        else if (path === 'mockupsAdvanced.getModelsWithFullCoverage') {
          let q = query(collection(db, 'supportedModels'));
          if (args?.brandFilter && args.brandFilter !== "all") {
            q = query(collection(db, 'supportedModels'), where('brandName', '==', args.brandFilter));
          }
          unsubscribe = onSnapshot(q, async (snap) => {
            const models = snap.docs.map(d => ({ _id: d.id, ...d.data() } as any));
            const mockupsSnap = await getDocs(collection(db, 'mockups'));

            const skusByModelId = new Map<string, Set<string>>();
            const skusByBrandModel = new Map<string, Set<string>>();
            mockupsSnap.docs.forEach(d => {
              const m: any = d.data();
              const sku = (m.sku || "").toUpperCase();
              if (!sku) return;
              if (m.supportedModelId) {
                if (!skusByModelId.has(m.supportedModelId)) skusByModelId.set(m.supportedModelId, new Set());
                skusByModelId.get(m.supportedModelId)!.add(sku);
              } else {
                const key = `${(m.brand || "").toLowerCase().trim()}_${(m.model || "").toLowerCase().trim()}`;
                if (!skusByBrandModel.has(key)) skusByBrandModel.set(key, new Set());
                skusByBrandModel.get(key)!.add(sku);
              }
            });

            const full = models.flatMap(model => {
              const key = `${(model.brandName || "").toLowerCase().trim()}_${(model.modelName || "").toLowerCase().trim()}`;
              const skus = skusByModelId.get(model._id) ?? skusByBrandModel.get(key);
              if (!skus || skus.size < TOTAL_PHONE_SKIN_SKUS) return [];
              return [{
                _id: model._id,
                brandName: model.brandName,
                modelName: model.modelName,
                category: model.category,
                mockupCount: skus.size,
                totalSKUs: TOTAL_PHONE_SKIN_SKUS,
              }];
            });

            full.sort((a, b) =>
              a.brandName.localeCompare(b.brandName) || a.modelName.localeCompare(b.modelName)
            );
            setData(full);
          });
        }
        else if (path === 'mockupsAdvanced.getOverviewStats') {
          (async () => {
            const countSnap = await getCountFromServer(collection(db, 'mockups'));
            const totalMockups = countSnap.data().count;

            const sampleSnap = await getDocs(query(collection(db, 'mockups'), limit(MOCKUP_SAMPLE_LIMIT)));
            const uniqueSKUs = new Set(
              sampleSnap.docs.map(d => (d.data().sku || "").toUpperCase()).filter(Boolean)
            ).size;

            setData({
              totalMockups,
              uniqueSKUs,
              totalSKUs: TOTAL_PHONE_SKIN_SKUS,
              coverage: Math.min(Math.round((uniqueSKUs / TOTAL_PHONE_SKIN_SKUS) * 100), 100),
            });
          })();
        }
        else if (path === 'mockupsAdvanced.getModelMockupStats') {
          if (!args?.modelId) {
            setData(null);
            return;
          }
          
          // First, get the model details to fallback to brand/model name matching
          const modelDoc = await getDoc(doc(db, 'supportedModels', args.modelId));
          const modelData = modelDoc.exists() ? modelDoc.data() : null;
          
          // Try to find mockups by modelId
          let q = query(collection(db, 'mockups'), where('supportedModelId', '==', args.modelId));
          
          unsubscribe = onSnapshot(q, async (snap) => {
            let mockups = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            
            // Fallback: If no mockups found by ID but we have model data, search by brand/model name
            if (mockups.length === 0 && modelData) {
               const allMockupsSnap = await getDocs(collection(db, 'mockups'));
               const brandNameLower = modelData.brandName?.toLowerCase().trim() || "";
               const modelNameLower = modelData.modelName?.toLowerCase().trim() || "";
               
               if (brandNameLower && modelNameLower) {
                 mockups = allMockupsSnap.docs
                   .map(d => ({ _id: d.id, ...d.data() }))
                   .filter((m: any) => 
                     !m.supportedModelId && 
                     m.brand?.toLowerCase().trim() === brandNameLower && 
                     m.model?.toLowerCase().trim() === modelNameLower
                   );
               }
            }
            
            setData({
              totalSKUs: TOTAL_PHONE_SKIN_SKUS,
              uploadedSKUs: mockups.length,
              missingSKUs: [],
              missingSKUsInStock: [],
              missingSKUsOutOfStock: [],
              coverage: Math.min(Math.round((mockups.length / TOTAL_PHONE_SKIN_SKUS) * 100), 100),
              mockups: mockups
            });
          });
        }
        else if (path === 'variantConsumptionPresets.listByGadgetType') {
          if (!args?.gadgetTypeId) {
            setData([]);
          } else {
            unsubscribe = onSnapshot(
              query(collection(db, 'variantConsumptionPresets'),
                where('gadgetTypeId', '==', args.gadgetTypeId),
                where('isActive', '==', true)),
              (snap) => setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
            );
          }
        }
        else if (path === 'variantConsumptionPresets.listAll') {
          // Watch the presets, not the gadget types: presets are what this page
          // edits, and a listener on the unchanging side never re-fires, so the
          // toggle wrote successfully but the row kept rendering the old value.
          unsubscribe = onSnapshot(collection(db, 'variantConsumptionPresets'), async (snap) => {
            const presets = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const gadgetSnap = await getDocs(collection(db, 'gadgetTypes'));

            setData(gadgetSnap.docs.map(d => {
              const gt = { _id: d.id, ...d.data() };
              return { gadgetType: gt, presets: presets.filter((p: any) => p.gadgetTypeId === gt._id) };
            }));
          });
        }
        else if (path === 'phoneCollectionsQueries.getPhoneCollectionsWithCounts') {
          const q = query(collection(db, 'phoneCollections'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getApprovedTemplates') {
          const q = query(collection(db, 'whatsappTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getAllUsecases') {
          const q = query(collection(db, 'whatsappUsecases'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'whatsapp.getWhatsAppProviderSettings') {
          unsubscribe = onSnapshot(doc(db, 'whatsappSettings', 'provider'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData(null);
            }
          });
        }
        else if (path === 'whatsapp.getAdminNotificationSettings') {
          unsubscribe = onSnapshot(doc(db, 'whatsappSettings', 'adminNotifications'), (snap) => {
            if (snap.exists()) {
              setData(snap.data());
            } else {
              setData({ enabled: false, adminPhone: '' });
            }
          });
        }
        else if (path === 'whatsappMessaging.getMessages') {
          let q = query(collection(db, 'whatsappMessages'), limit(50));
          if (args?.status && args.status !== 'all') {
            q = query(collection(db, 'whatsappMessages'), where('status', '==', args.status), limit(50));
          } else if (args?.usecaseKey && args.usecaseKey !== 'all') {
            q = query(collection(db, 'whatsappMessages'), where('usecaseKey', '==', args.usecaseKey), limit(50));
          } else if (args?.recipientPhone) {
            q = query(collection(db, 'whatsappMessages'), where('recipientPhone', '==', args.recipientPhone), limit(50));
          }
          unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({
              _id: d.id,
              ...d.data(),
              createdAtFormatted: new Date(d.data().createdAt || Date.now()).toLocaleString(),
              sentAtFormatted: d.data().sentAt ? new Date(d.data().sentAt).toLocaleString() : null,
            }));
            docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
            setData(docs);
          });
        }
        else if (path === 'whatsappMessaging.getQueueStats') {
          unsubscribe = onSnapshot(collection(db, 'whatsappQueue'), (snap) => {
            const count = (s: string) => snap.docs.filter(d => d.data().status === s).length;
            setData({ pending: count("pending"), processing: count("processing"), failed: count("failed") });
          });
        }
        else if (path === 'whatsappMessaging.getDeliveryStats') {
          unsubscribe = onSnapshot(collection(db, 'whatsappMessages'), (snap) => {
            const count = (s: string) => snap.docs.filter(d => d.data().status === s).length;
            setData({
              total: snap.size,
              delivered: count("delivered"),
              failed: count("failed"),
              pending: count("pending"),
              sent: count("sent"),
              read: count("read"),
            });
          });
        }
        else if (path === 'whatsappMessaging.getMessageDetails') {
          if (!args?.messageId) {
            setData(null);
            return;
          }
          unsubscribe = onSnapshot(doc(db, 'whatsappMessages', args.messageId), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        else if (path === 'whatsappHealthCheck.getSystemHealth') {
          // A health page that reports hardcoded zeros is worse than no health
          // page: this one claimed "healthy, 0 stuck, 100% success" no matter
          // what the queue held, counted enabled usecases off a field that does
          // not exist (isActive, where the data says enabled), and never set
          // `issues` — which the table dereferences, so the page crashed before
          // it could draw. Every number below is now read.
          unsubscribe = onSnapshot(collection(db, 'whatsappUsecases'), async (snap) => {
            try {
              const [tplSnap, queueSnap, msgSnap, providerSnap] = await Promise.all([
                getDocs(collection(db, 'whatsappTemplates')),
                getDocs(collection(db, 'whatsappQueue')),
                getDocs(collection(db, 'whatsappMessages')),
                getDoc(doc(db, 'whatsappSettings', 'provider')),
              ]);

              const templates = tplSnap.docs.map(d => ({ _id: d.id, ...(d.data() as any) }));
              const approved = new Set(
                templates.filter(t => String(t.status || '').toLowerCase() === 'approved')
                  .map(t => String(t.templateName || ''))
              );
              const knownTemplate = new Set(templates.map(t => String(t.templateName || '')));

              const queue = { pending: 0, processing: 0, failed: 0, stuck: 0 };
              const STUCK_AFTER = 15 * 60 * 1000;
              queueSnap.docs.forEach((d) => {
                const r: any = d.data();
                const st = String(r.status || '');
                if (st === 'pending' || st === 'queued') queue.pending++;
                else if (st === 'processing') {
                  queue.processing++;
                  // Claimed but never finished: the run that took it died.
                  if (Date.now() - Number(r.lastAttemptAt || r.createdAt || 0) > STUCK_AFTER) queue.stuck++;
                } else if (st === 'failed') queue.failed++;
              });

              const messages = msgSnap.docs.map(d => d.data() as any);
              const since24h = Date.now() - 24 * 60 * 60 * 1000;
              const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
              const recent = messages.filter(m => Number(m.createdAt || 0) >= since24h);
              const ok = (m: any) => ['sent', 'delivered', 'read'].includes(String(m.status || ''));
              const rate = (list: any[]) =>
                list.length ? Math.round((list.filter(ok).length / list.length) * 100) : 0;

              const usecases = snap.docs.map((d) => {
                const u: any = { _id: d.id, ...(d.data() as any) };
                const key = String(u.usecaseKey || '');
                const tplName = String(u.templateName || '');
                const mine = messages.filter(m => String(m.usecaseKey) === key && Number(m.createdAt || 0) >= since7d);
                const lastSent = messages
                  .filter(m => String(m.usecaseKey) === key && m.sentAt)
                  .reduce((max, m) => Math.max(max, Number(m.sentAt || 0)), 0);

                const issues: string[] = [];
                if (!tplName) issues.push('No template linked');
                else if (!knownTemplate.has(tplName)) issues.push(`Template "${tplName}" not found`);
                else if (!approved.has(tplName)) issues.push(`Template "${tplName}" not approved`);
                if (u.enabled !== true) issues.push('Disabled');

                return {
                  ...u,
                  displayName: u.displayName || key.replace(/_/g, ' '),
                  enabled: u.enabled === true,
                  isTransactional: u.isTransactional ?? /order|otp|cod|payment|delivery/.test(key),
                  messageCount: mine.length,
                  successRate: mine.length ? rate(mine) : null,
                  lastSent: lastSent || null,
                  issues,
                  status: issues.length === 0 ? 'healthy' : (u.enabled === true ? 'warning' : 'disabled'),
                };
              });

              const provider: any = providerSnap.exists() ? providerSnap.data() : null;
              const enabledUsecases = usecases.filter(u => u.enabled).length;
              const broken = usecases.filter(u => u.enabled && u.issues.length > 0).length;

              setData({
                overallStatus: queue.stuck > 0 || broken > 0 ? 'warning'
                  : enabledUsecases === 0 ? 'warning' : 'healthy',
                provider: {
                  configured: !!provider?.providerName,
                  active: !!provider?.providerName,
                  provider: provider?.providerName || 'not configured',
                  // The key the worker sends with lives in the functions
                  // environment, which the browser cannot see. Saying "yes"
                  // here would be a guess, so it reports what it can check.
                  hasCredentials: !!provider?.authKeyHint || !!provider?.authKey,
                },
                queue,
                stats: {
                  messages: recent.length,
                  messages24h: recent.length,
                  successRate: rate(recent),
                  enabledUsecases,
                  totalUsecases: usecases.length,
                },
                usecases,
              });
            } catch (err) {
              console.error('getSystemHealth failed:', err);
              setData({
                overallStatus: 'warning',
                provider: { configured: false, active: false, provider: 'unknown', hasCredentials: false },
                queue: { pending: 0, processing: 0, failed: 0, stuck: 0 },
                stats: { messages: 0, messages24h: 0, successRate: 0, enabledUsecases: 0, totalUsecases: 0 },
                usecases: [],
              });
            }
          });
        }
        else if (path === 'emailManagement.getAllUsecases') {
          const q = query(collection(db, 'emailUsecaseTemplates'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'emailManagement.getStats') {
          setData({ total: 0, sent: 0, failed: 0, pending: 0, successRate: 0 });
        }
        else if (path === 'users.isCurrentUserAdmin') {
          let innerUnsubscribe = () => {};
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          
          const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
              setData({ isAdmin: false, isAuthenticated: false });
              return;
            }

            if (user.email === 'chandan1992@gmail.com') {
              setData({ isAdmin: true, isAuthenticated: true });
              return;
            }

            // Check firestore user doc
            innerUnsubscribe = onSnapshot(doc(db, 'users', await resolveUserDocId(user)), (snap) => {
              if (snap.exists() && snap.data().isAdmin) {
                setData({ isAdmin: true, isAuthenticated: true });
              } else {
                setData({ isAdmin: false, isAuthenticated: true });
              }
            });
          });
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
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
          unsubscribe = () => { unsubscribeAuth(); innerUnsubscribe(); };
        }
        else if (path === 'reviews.getAllReviews') {
          const q = query(collection(db, 'reviews'));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'reviews.getProductReviews') {
          if (!args?.productId) { setData([]); return; }
          const q = query(collection(db, 'reviews'), where('productId', '==', args.productId));
          unsubscribe = onSnapshot(q, (snap) => {
            setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
          });
        }
        else if (path === 'reviews.getReviewStats') {
          if (!args?.productId) { setData({ count: 0, verifiedCount: 0, averageRating: 0 }); return; }
          const q = query(collection(db, 'reviews'), where('productId', '==', args.productId));
          unsubscribe = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => d.data());
            const verified = all.filter(r => r.verified);
            const totalRating = all.reduce((sum, r) => sum + (r.rating || 0), 0);
            setData({
              count: all.length,
              verifiedCount: verified.length,
              averageRating: all.length > 0 ? totalRating / all.length : 0,
            });
          });
        }
        else if (path === 'exports.getOrdersForExport') {
          const { startDate, endDate, orderIds, status } = args || {};
          const statusFilter = status && status !== 'all' ? status : null;

          const applyFilters = (orders: any[]) => {
            let filtered = orders;
            if (startDate && endDate) {
              filtered = filtered.filter((o: any) => {
                const t = o?._creationTime || 0;
                return t >= startDate && t <= endDate;
              });
            }
            if (statusFilter) {
              filtered = filtered.filter((o: any) => o?.status === statusFilter);
            }
            filtered.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));
            return filtered;
          };

          if (Array.isArray(orderIds) && orderIds.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < orderIds.length; i += 10) chunks.push(orderIds.slice(i, i + 10));

            const unsubs: Array<() => void> = [];
            const ordersById = new Map<string, any>();

            chunks.forEach((chunk) => {
              const q = query(collection(db, 'orders'), where(documentId(), 'in', chunk));
              const u = onSnapshot(q, (snap) => {
                snap.docs.forEach((d) => ordersById.set(d.id, { _id: d.id, ...d.data() }));
                setData(applyFilters(Array.from(ordersById.values())));
              });
              unsubs.push(u);
            });

            unsubscribe = () => unsubs.forEach((u) => u());
          } else {
            let q = query(collection(db, 'orders'));
            if (startDate && endDate) {
              q = query(q, where('_creationTime', '>=', startDate), where('_creationTime', '<=', endDate));
            }

            unsubscribe = onSnapshot(q, (snap) => {
              const orders = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              setData(applyFilters(orders));
            });
          }
        }
        else if (path === 'exports.getExportStats') {
          const { startDate, endDate, orderIds, status } = args || {};
          const statusFilter = status && status !== 'all' ? status : null;

          const computeStats = (orders: any[]) => {
            let filtered = orders;
            if (startDate && endDate) {
              filtered = filtered.filter((o: any) => {
                const t = o?._creationTime || 0;
                return t >= startDate && t <= endDate;
              });
            }
            if (statusFilter) {
              filtered = filtered.filter((o: any) => o?.status === statusFilter);
            }

            let totalRevenue = 0;
            let totalTaxableAmount = 0;
            let totalGst = 0;
            let totalCgst = 0;
            let totalSgst = 0;
            let totalIgst = 0;

            filtered.forEach((order: any) => {
              if (order?.status !== 'cancelled' && order?.status !== 'failed') {
                totalRevenue += order?.total || 0;
                totalTaxableAmount += order?.taxableAmount || 0;
                totalGst += order?.totalGstAmount || 0;
                totalCgst += order?.cgstAmount || 0;
                totalSgst += order?.sgstAmount || 0;
                totalIgst += order?.igstAmount || 0;
              }
            });

            return {
              totalOrders: filtered.length,
              totalRevenue,
              totalTaxableAmount,
              totalGst,
              totalCgst,
              totalSgst,
              totalIgst
            };
          };

          if (Array.isArray(orderIds) && orderIds.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < orderIds.length; i += 10) chunks.push(orderIds.slice(i, i + 10));

            const unsubs: Array<() => void> = [];
            const ordersById = new Map<string, any>();

            chunks.forEach((chunk) => {
              const q = query(collection(db, 'orders'), where(documentId(), 'in', chunk));
              const u = onSnapshot(q, (snap) => {
                snap.docs.forEach((d) => ordersById.set(d.id, { _id: d.id, ...d.data() }));
                setData(computeStats(Array.from(ordersById.values())));
              });
              unsubs.push(u);
            });

            unsubscribe = () => unsubs.forEach((u) => u());
          } else {
            let q = query(collection(db, 'orders'));
            if (startDate && endDate) {
              q = query(q, where('_creationTime', '>=', startDate), where('_creationTime', '<=', endDate));
            }

            unsubscribe = onSnapshot(q, (snap) => {
              const orders = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
              setData(computeStats(orders));
            });
          }
        }
        // Fallback for direct document gets
        else if (args?.id) {
          const collectionName = path.split('.')[0];
          unsubscribe = onSnapshot(doc(db, collectionName, args.id), (snap) => {
            setData(snap.exists() ? { _id: snap.id, ...snap.data() } : null);
          });
        }
        // Fallback for simple collection queries
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
            unsubscribe = onSnapshot(q, (snap) => {
              setData(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
            });
          }
        }
      } catch (err: any) {
        console.error(`Error in useQuery for ${path}:`, err);
        setError(err);
      }
    };

    fetchData();

    return () => { active = false; unsubscribe(); };
  }, [path, JSON.stringify(args)]);

  return data;
}

export function useMutation(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args?: any) => {
    try {
      console.log(`Mutation called for ${path} with args:`, args);
      
      const collectionName = path.split('.')[0];
      const actionName = path.split('.')[1];

      if (path === 'loginOtp.generateLoginOtp' || path === 'loginOtp.verifyLoginOtp') {
        // OTP is generated and checked server-side; the browser never sees the code.
        const fn = httpsCallable(functions, path.split('.')[1]);
        const res: any = await fn(args);
        return res.data;
      }

      if (path === 'abandonedCartSettings.updateSettings') {
        await setDoc(doc(db, 'abandonedCartSettings', 'default'), {
          ...args,
          updatedAt: Date.now(),
        }, { merge: true });
        return { success: true };
      }

      if (path === 'whatsappConsent.updateMyConsent') {
        const { getAuth } = await import('firebase/auth');
        const user = getAuth().currentUser;
        if (!user) throw new Error("Please sign in to update your preferences");
        await setDoc(doc(db, 'users', await resolveUserDocId(user)), {
          whatsappConsentType: args.consentType,
          whatsappConsentAt: Date.now(),
        }, { merge: true });
        return { success: true };
      }

      if (path === 'users.updateCurrentUser') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          // Remove undefined values to avoid Firebase errors
          const cleanArgs = Object.fromEntries(Object.entries(args).filter(([_, v]) => v !== undefined));
          await setDoc(doc(db, 'users', await resolveUserDocId(user)), cleanArgs, { merge: true });
        }
        return { success: true };
      }

      if (collectionName === 'seoTemplates') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error('UNAUTHENTICATED');
        const updatedBy = user.email || user.uid;
        const updatedAt = Date.now();
        const templatesCollection = collection(db, 'seoPageTemplates');

        const buildDefaultTemplates = () => ([
          {
            pageType: "brand",
            displayName: "Brand Pages",
            description: "Landing pages for each brand (Samsung, Apple, etc.)",
            layoutConfig: {
              sections: [
                { id: "hero", label: "Hero Banner", enabled: true, order: 1 },
                { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
                { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
                { id: "intro", label: "Brand Introduction", enabled: true, order: 4 },
                { id: "products", label: "Product Grid", enabled: true, order: 5 },
                { id: "faqs", label: "FAQs", enabled: true, order: 6 },
              ],
            },
            defaultFilters: {
              autoCategorize: true,
              filterByBrand: true,
              filterByDevice: false,
              filterByProduct: false,
              filterByDesign: false,
              showModelSelector: false,
            },
            contentStructure: {
              h1Pattern: "{Brand} Skins - Premium Protection for All Devices",
              introLength: "2-3 paragraphs",
              includeSections: ["benefits", "features", "compatibility"],
              keywordsToInclude: ["premium", "protection", "durability", "quality"],
            },
          },
          {
            pageType: "device",
            displayName: "Device Pages",
            description: "Landing pages for device categories (Mobile, Tablet, etc.)",
            layoutConfig: {
              sections: [
                { id: "hero", label: "Device Hero", enabled: true, order: 1 },
                { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
                { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
                { id: "showcase", label: "Device Showcase", enabled: true, order: 4 },
                { id: "products", label: "Product Grid", enabled: true, order: 5 },
                { id: "faqs", label: "FAQs", enabled: true, order: 6 },
              ],
            },
            defaultFilters: {
              autoCategorize: false,
              filterByBrand: false,
              filterByDevice: true,
              filterByProduct: false,
              filterByDesign: false,
              showModelSelector: true,
            },
            contentStructure: {
              h1Pattern: "{Device} Skins - Perfect Fit for All {Device} Models",
              introLength: "2-3 paragraphs",
              includeSections: ["benefits", "features", "installation", "models"],
              keywordsToInclude: ["perfect fit", "precise cut", "easy application"],
            },
          },
          {
            pageType: "product",
            displayName: "Product Pages",
            description: "Landing pages for product types (Skins, Cases, etc.)",
            layoutConfig: {
              sections: [
                { id: "hero", label: "Product Hero", enabled: true, order: 1 },
                { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
                { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
                { id: "features", label: "Feature Highlights", enabled: true, order: 4 },
                { id: "products", label: "Product Grid", enabled: true, order: 5 },
                { id: "faqs", label: "FAQs", enabled: true, order: 6 },
              ],
            },
            defaultFilters: {
              autoCategorize: false,
              filterByBrand: false,
              filterByDevice: false,
              filterByProduct: true,
              filterByDesign: false,
              showModelSelector: false,
            },
            contentStructure: {
              h1Pattern: "{Product} - Premium Quality at Best Prices",
              introLength: "2-3 paragraphs",
              includeSections: ["benefits", "features", "quality", "installation"],
              keywordsToInclude: ["premium", "quality", "affordable", "best price"],
            },
          },
          {
            pageType: "skin-type",
            displayName: "Skin Type Pages",
            description: "Landing pages for skin designs (Anime, Carbon Fiber, etc.)",
            layoutConfig: {
              sections: [
                { id: "hero", label: "Skin Type Hero", enabled: true, order: 1 },
                { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
                { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
                { id: "benefits", label: "Benefits", enabled: true, order: 4 },
                { id: "products", label: "Product Grid", enabled: true, order: 5 },
                { id: "guide", label: "Installation Guide", enabled: true, order: 6 },
                { id: "faqs", label: "FAQs", enabled: true, order: 7 },
              ],
            },
            defaultFilters: {
              autoCategorize: false,
              filterByBrand: false,
              filterByDevice: false,
              filterByProduct: false,
              filterByDesign: true,
              showModelSelector: false,
            },
            contentStructure: {
              h1Pattern: "{DesignType} Skins - Unique Designs for Your Device",
              introLength: "2-3 paragraphs",
              includeSections: ["benefits", "features", "style", "installation"],
              keywordsToInclude: ["unique", "design", "style", "personalization"],
            },
          },
          {
            pageType: "keyword",
            displayName: "Keyword Pages",
            description: "SEO landing pages for specific keywords",
            layoutConfig: {
              sections: [
                { id: "hero", label: "SEO Hero", enabled: true, order: 1 },
                { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
                { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
                { id: "content", label: "SEO Content", enabled: true, order: 4 },
                { id: "products", label: "Wide Product Grid", enabled: true, order: 5 },
                { id: "faqs", label: "FAQs", enabled: true, order: 6 },
                { id: "cta", label: "Call to Action", enabled: true, order: 7 },
              ],
            },
            defaultFilters: {
              autoCategorize: false,
              filterByBrand: false,
              filterByDevice: false,
              filterByProduct: false,
              filterByDesign: false,
              showModelSelector: false,
            },
            contentStructure: {
              h1Pattern: "{Keyword} - Best Quality at GoSkinly",
              introLength: "3-4 paragraphs",
              includeSections: ["benefits", "features", "comparison", "why-goskinly", "installation"],
              keywordsToInclude: ["best", "premium", "quality", "goskinly", "agra"],
            },
          },
        ]);

        if (actionName === 'getTemplates') {
          const snap = await getDocs(templatesCollection);
          return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        }

        if (actionName === 'updateTemplate') {
          const q = query(templatesCollection, where('pageType', '==', args.pageType), limit(1));
          const snap = await getDocs(q);
          const updates: any = { updatedAt, updatedBy };
          if (args.displayName !== undefined) updates.displayName = args.displayName;
          if (args.description !== undefined) updates.description = args.description;
          if (args.defaultHeroImage !== undefined) updates.defaultHeroImage = args.defaultHeroImage;
          if (args.layoutConfig !== undefined) updates.layoutConfig = args.layoutConfig;
          if (args.defaultFilters !== undefined) updates.defaultFilters = args.defaultFilters;
          if (args.contentStructure !== undefined) updates.contentStructure = args.contentStructure;

          if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, updates);
            return { templateId: snap.docs[0].id, isNew: false };
          }

          const docRef = await addDoc(templatesCollection, {
            pageType: args.pageType,
            displayName: args.displayName || args.pageType,
            description: args.description,
            defaultHeroImage: args.defaultHeroImage,
            layoutConfig: args.layoutConfig || { sections: [] },
            defaultFilters: args.defaultFilters || {},
            contentStructure: args.contentStructure || { h1Pattern: "", introLength: "2-3 paragraphs", includeSections: [], keywordsToInclude: [] },
            updatedAt,
            updatedBy,
          });
          return { templateId: docRef.id, isNew: true };
        }

        if (actionName === 'initializeDefaultTemplates') {
          const existing = await getDocs(templatesCollection);
          if (existing.size > 0) return { message: "Templates already initialized", count: existing.size };
          const batch = writeBatch(db);
          buildDefaultTemplates().forEach((t) => {
            const ref = doc(templatesCollection);
            batch.set(ref, { ...t, updatedAt, updatedBy });
          });
          await batch.commit();
          return { message: "Default templates initialized", count: 5 };
        }

        if (actionName === 'reinitializeTemplates') {
          const existing = await getDocs(templatesCollection);
          const batch = writeBatch(db);
          existing.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          const batch2 = writeBatch(db);
          buildDefaultTemplates().forEach((t) => {
            const ref = doc(templatesCollection);
            batch2.set(ref, { ...t, updatedAt, updatedBy });
          });
          await batch2.commit();
          return { message: "Templates re-initialized successfully", deleted: existing.size, created: 5 };
        }

        if (actionName === 'initializeDefaultHeroImages') {
          const heroImageMap: Record<string, string> = {
            brand: "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/media-library/seo-hero-brand.webp",
            device: "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/media-library/seo-hero-device.webp",
            keyword: "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/media-library/seo-hero-keyword.webp",
            "skin-type": "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/media-library/seo-hero-keyword.webp",
          };
          const existing = await getDocs(templatesCollection);
          const batch = writeBatch(db);
          let updatedCount = 0;
          existing.docs.forEach(d => {
            const data = d.data() as any;
            const hero = heroImageMap[String(data.pageType || "")];
            if (hero) {
              batch.update(d.ref, { defaultHeroImage: hero, updatedAt, updatedBy });
              updatedCount++;
            }
          });
          if (updatedCount > 0) await batch.commit();
          return { success: true, updatedCount, message: `Updated ${updatedCount} templates with default hero images` };
        }
      }
      
      // Handle cart specific operations
      if (collectionName === 'cart') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        
        // --- CART & CHECKOUT (Guest operations) ---
        if (actionName === 'syncGuestCartToDb' || actionName === 'syncGuestCart') {
          // Allow this operation for both authenticated users and guests
          const sessionId = args.sessionId;
          if (!user && !sessionId) return { success: false };
          
          const batch = writeBatch(db);
          for (const item of (args.items || args.guestCartItems || [])) {
            // Re-verify prices for guest items to prevent tampering
            let realPrice = item.price;
            try {
               const variantQ = query(collection(db, 'variants'), where('productId', '==', item.productId), where('title', '==', item.variant));
               const variantSnap = await getDocs(variantQ);
               if (!variantSnap.empty) {
                 realPrice = variantSnap.docs[0].data().price || item.price;
               }
            } catch(e) {}
            
            const newDoc = doc(collection(db, 'cart'));
            const cartData: any = {
              ...item,
              price: realPrice,
              addedAt: Date.now()
            };
            
            if (user) {
              cartData.userId = user.uid;
            } else if (sessionId) {
              cartData.sessionId = sessionId;
            }
            
            batch.set(newDoc, cartData);
          }
          await batch.commit();
          return { success: true };
        }
        
        // For other cart operations, try to use user OR sessionId
        const sessionId = args.sessionId;
        
        if (!user && !sessionId) {
          throw new Error('UNAUTHENTICATED');
        }

        
        if (actionName === 'addToCart') {
          // Fetch the real price from DB to prevent tampering
          const productSnap = await getDoc(doc(db, 'products', args.productId));
          let realPrice = args.price; // fallback
          if (productSnap.exists()) {
             const variantQ = query(collection(db, 'variants'), where('productId', '==', args.productId), where('title', '==', args.variant));
             const variantSnap = await getDocs(variantQ);
             if (!variantSnap.empty) {
               realPrice = variantSnap.docs[0].data().price || args.price;
             }
          }
          
          const cartData: any = {
            ...args,
            price: realPrice,
            addedAt: Date.now()
          };
          
          if (user) cartData.userId = user.uid;
          else if (sessionId) cartData.sessionId = sessionId;
          
          const docRef = await addDoc(collection(db, 'cart'), cartData);
          return docRef.id;
        }
        if (actionName === 'removeFromCart') {
          const targetId = args.id || args.cartId;
          await deleteDoc(doc(db, 'cart', targetId));
          return targetId;
        }
        if (actionName === 'updateQuantity') {
          const targetId = args.id || args.cartId;
          await updateDoc(doc(db, 'cart', targetId), { quantity: args.quantity });
          return targetId;
        }
        if (actionName === 'clearCart') {
          if (user) {
            const q = query(collection(db, 'cart'), where('userId', 'in', await userIdCandidates(user)));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          } else if (sessionId) {
            const q = query(collection(db, 'cart'), where('sessionId', '==', sessionId));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          return true;
        }
      }
      

      
      if (collectionName === 'coupons' && actionName === 'validateCoupon') {
        const q = query(collection(db, 'coupons'), where('code', '==', args.code), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return { isValid: false, reason: "Invalid code" };
        
        const c = snap.docs[0].data();
        if (!c.isActive) return { isValid: false, reason: "Coupon inactive" };
        
        return { 
          isValid: true, 
          coupon: { _id: snap.docs[0].id, ...c }, 
          discountAmount: c.discountValue || 100,
          walletCreditAmount: c.cashbackValue || 0
        };
      }
      
      // Public: no auth, the callable checks the contact against the order.
      if (collectionName === 'orders' && actionName === 'trackOrder') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const call = httpsCallable(getFunctions(), 'trackOrder');
        const res = await call({ orderNumber: args?.orderNumber, contact: args?.contact });
        return res.data;
      }

      if (collectionName === 'orders' && actionName === 'createOrder') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callCreateOrder = httpsCallable(functions, 'createOrder');
        const response = await callCreateOrder(args);
        return response.data;
      }

      if (collectionName === 'orders' && actionName === 'placeOrder') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          const mockOrderId = `mock-order-${Date.now()}`;
          const result: any = { orderId: mockOrderId, orderNumber: `#9001`, remainingAmount: args.amount || 100, trackingToken: `TRACK-${mockOrderId}` };
          if (args.paymentMethod === 'phonepe') {
            result.paymentUrl = `http://localhost:5175/mock-payment?orderId=${mockOrderId}&amount=${args.amount}`;
            result.merchantTransactionId = `MTXN-${Date.now()}`;
          }
          return result;
        }
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callable = httpsCallable(functions, 'placeOrder');
        const response = await callable(args);
        return response.data;
      }
      
      if (collectionName === 'phonepe' && actionName === 'initiatePayment') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          console.log("Mocking PhonePe payment initiation for:", args);
          return {
            success: true,
            merchantTransactionId: `MTXN-${Date.now()}`,
            paymentUrl: `http://localhost:5175/mock-payment?orderId=${args.orderId}&amount=${args.amount}`
          };
        }
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callable = httpsCallable(functions, 'initiatePayment');
        const res: any = await callable(args);
        return res.data;
      }
      if (collectionName === 'phonepe' && actionName === 'checkPaymentStatus') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          return {
            success: true,
            paymentStatus: 'success',
            transactionId: args.merchantTransactionId
          };
        }
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callable = httpsCallable(functions, 'checkPaymentStatus');
        const res: any = await callable(args);
        return res.data;
      }
      if (collectionName === 'codOtp' && actionName === 'generateCodOtp') {
        return { success: true };
      }
      if (collectionName === 'codOtp' && actionName === 'verifyCodOtp') {
        return { success: true };
      }
      
      if (collectionName === 'abandonedCartsActions') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const fns = getFunctions();
        // Scanning is the cron's job; the dashboard only triggers a pass or
        // retires a single cart, both of which respect the per-cart cap.
        if (actionName === 'processAbandonedCarts') {
          const res: any = await httpsCallable(fns, 'runAbandonedCartReminders')({});
          return res.data;
        }
        if (actionName === 'sendAbandonedCartReminder') {
          const res: any = await httpsCallable(fns, 'sendAbandonedCartReminderNow')(args || {});
          return res.data;
        }
        if (actionName === 'scanAndTrackAbandonedCarts') {
          const res: any = await httpsCallable(fns, 'scanAbandonedCarts')({});
          return res.data;
        }
      }

      if (actionName === 'generateUploadUrl' || actionName === 'generateImageUploadUrl') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callUpload = httpsCallable(functions, 'generateUploadUrl');
        
        // Pass fake filename for R2 generation
        const fileName = args?.fileName || `upload_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const contentType = args?.contentType || 'image/jpeg';
        
        const response = await callUpload({ fileName, contentType });
        return response.data?.uploadUrl || "";
      }
      
      if (actionName === 'sendWhatsAppMessage' || actionName === 'sendOrderWhatsApp') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callWhatsApp = httpsCallable(functions, 'sendWhatsAppMessage');
        const response = await callWhatsApp(args);
        return response.data;
      }
      
      if (collectionName === 'seoContentGenerator' && actionName === 'generateSEOContent') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callGenerate = httpsCallable(functions, 'generateSEOContent');
        const response = await callGenerate(args);
        return response.data;
      }
      
      if (collectionName === 'rapidshyp' && actionName === 'createShipment') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions();
        const callShipment = httpsCallable(functions, 'createShipment');
        const response = await callShipment(args);
        return response.data;
      }

      // The order in RapidShyp with no courier picked, for a parcel that
      // wants a person's eye before it ships. The action is named after the
      // function: useAction falls back to calling a callable by the action's
      // own name, so a different name here reaches nothing and the admin is
      // told "internal".
      if (collectionName === 'rapidshyp' && actionName === 'createRapidshypOrder') {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const call = httpsCallable(getFunctions(), 'createRapidshypOrder');
        const response = await call(args);
        return response.data;
      }
      
      // --- END CART & CHECKOUT ---
      if (collectionName === 'orders' || collectionName === 'admin') {
        const trueCollection = collectionName === 'admin' ? path.split('.')[1] : collectionName;
        const actualActionName = collectionName === 'admin' ? path.split('.')[2] : actionName;
        
        if (actualActionName === 'updatePaymentStatus' || actualActionName === 'updateOrderPaymentStatus') {
          let docId = args.orderId;
          
          if (!docId && args.merchantTransactionId) {
            // Find order by merchantTxnId
            const q = query(collection(db, trueCollection), limit(10));
            const snap = await getDocs(q);
            // Just picking the first one for local mock, in real DB would search by merchantTransactionId
            if (!snap.empty) docId = snap.docs[0].id;
          }
          
          if (docId) {
            await updateDoc(doc(db, trueCollection, docId), { 
              paymentStatus: args.status || args.paymentStatus,
              updatedAt: Date.now()
            });
          }
          return docId;
        }
        
        /*
         * Status moves go to the server, never straight to the document.
         *
         * This used to write `status` here and return the order id, while the
         * page read `result.whatsappErrors` off that string — always
         * undefined, so it reported "status updated and WhatsApp notification
         * sent" on every change, having sent nothing. The callable owns the
         * transition graph, the history and the messages, and it answers with
         * what actually happened.
         */
        if (actualActionName === 'updateOrderStatus' || actualActionName === 'setOrderStatus') {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const call = httpsCallable(getFunctions(), 'setOrderStatusAdmin');
          const res = await call({
            orderId: args.orderId,
            orderIds: args.orderIds,
            status: args.status,
            reason: args.reason,
            force: args.force === true,
            notify: args.notify === true,
          });
          return res.data;
        }

        /*
         * Shipping details typed in by hand.
         *
         * The form sends awbNumber / trackingUrl / shippingStatus; this read
         * courierName / trackingNumber / status, so every field it wrote was
         * undefined — which Firestore rejects outright, meaning the Edit
         * Shipping dialog had never once saved anything. It also forced the
         * order to "shipped", which is not what editing an AWB means; the
         * status dropdown is where that is decided.
         */
        if (actualActionName === 'updateShippingInfo') {
          const patch: Record<string, unknown> = { updatedAt: Date.now() };
          if (args.awbNumber !== undefined) patch.awbNumber = String(args.awbNumber || '').trim();
          if (args.trackingUrl !== undefined) patch.trackingUrl = String(args.trackingUrl || '').trim();
          if (args.shippingStatus !== undefined) patch.shippingStatus = String(args.shippingStatus || '').trim();
          if (args.courierName !== undefined) patch.courierName = String(args.courierName || '').trim();
          await updateDoc(doc(db, trueCollection, args.orderId), patch);
          return args.orderId;
        }
        
        if (actualActionName === 'updateOrderShippingAddress') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            shippingAddress: {
              firstName: args.firstName,
              lastName: args.lastName,
              address1: args.address1,
              address2: args.address2,
              city: args.city,
              state: args.state,
              pincode: args.pincode,
              phone: args.phone,
              email: args.email
            },
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateCustomerInfo') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            customerName: args.customerName,
            email: args.email,
            phone: args.phone,
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        if (actualActionName === 'updateOrderItems') {
          await updateDoc(doc(db, trueCollection, args.orderId), { 
            items: args.items,
            subtotal: args.subtotal,
            total: args.total,
            updatedAt: Date.now()
          });
          return args.orderId;
        }
        
        /*
         * Deleting and restoring leave the status alone.
         *
         * Soft-delete used to overwrite it with the literal "deleted", which is
         * not one of the statuses and destroyed the only record of where the
         * order had got to — and restore then guessed "processing", so a
         * delivered order deleted by mistake came back as one still to pack.
         * `isDeleted` is what deletion means; the status is not its business.
         */
        if (actualActionName === 'softDeleteOrders') {
          const batch = writeBatch(db);
          args.orderIds.forEach((id: string) => {
            batch.update(doc(db, 'orders', id), { isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() });
          });
          await batch.commit();
          return { deletedCount: args.orderIds.length };
        }

        if (actualActionName === 'restoreOrders') {
          const batch = writeBatch(db);
          args.orderIds.forEach((id: string) => {
            batch.update(doc(db, 'orders', id), { isDeleted: false, updatedAt: Date.now() });
          });
          await batch.commit();
          return { restoredCount: args.orderIds.length };
        }

        // Same door as the single change: a batch write here would have been
        // the one route left that could put an order anywhere at all.
        if (actualActionName === 'bulkUpdateOrderStatus') {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const call = httpsCallable(getFunctions(), 'setOrderStatusAdmin');
          const res = await call({ orderIds: args.orderIds, status: args.status, force: args.force === true });
          return res.data;
        }

        if (actualActionName === 'bulkUpdatePaymentStatus') {
          const batch = writeBatch(db);
          args.orderIds.forEach((id: string) => {
            batch.update(doc(db, 'orders', id), { paymentStatus: args.paymentStatus, updatedAt: Date.now() });
          });
          await batch.commit();
          return { updatedCount: args.orderIds.length };
        }
        
        if (actualActionName === 'deleteOrder') {
          await deleteDoc(doc(db, 'orders', args.orderId));
          return true;
        }
        
        if (actualActionName === 'createManualOrder') {
          const docRef = await addDoc(collection(db, 'orders'), {
            ...args.orderData,
            orderNumber: `MAN-${Math.floor(Math.random() * 100000)}`,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          return docRef.id;
        }
      }
      
      if (collectionName === 'mockupsAdvanced') {
        if (actionName === 'migrateMockupsToModels') {
          return { updated: 0, noMatch: 0, total: 0 };
        }
        if (actionName === 'deleteAllMockupsForModel') {
          const q = query(collection(db, 'mockups'), where('supportedModelId', '==', args.modelId));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snap.size };
        }
        if (actionName === 'storeMockupAdvanced') {
          const docRef = await addDoc(collection(db, 'mockups'), args);
          return docRef.id;
        }
        if (actionName === 'deleteMockup') {
          await deleteDoc(doc(db, 'mockups', args.mockupId));
          return { success: true };
        }
        if (actionName === 'deleteAllMockups') {
          return { deleted: 0, hasMore: false };
        }
        if (actionName === 'deleteMockupsBySKU') {
          const q = query(collection(db, 'mockups'), where('sku', '==', args.sku));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
          return { deleted: snap.size };
        }
      }

      if (collectionName === 'variantConsumptionPresets') {
        if (actionName === 'create') {
          const docRef = await addDoc(collection(db, 'variantConsumptionPresets'), { ...args, isActive: true });
          return docRef.id;
        }
        if (actionName === 'update') {
          await updateDoc(doc(db, 'variantConsumptionPresets', args.presetId), args);
          return args.presetId;
        }
        if (actionName === 'remove') {
          await deleteDoc(doc(db, 'variantConsumptionPresets', args.presetId));
          return { success: true };
        }
        if (actionName === 'toggleActive') {
          await updateDoc(doc(db, 'variantConsumptionPresets', args.presetId), { isActive: args.isActive });
          return args.presetId;
        }
      }
      
      if (collectionName === 'phoneCollections') {
        if (actionName === 'runPhoneCollectionsMigration') {
          return { collectionsCreated: 0, productsAssigned: 0, errors: [] };
        }
      }
      
      if (collectionName === 'migrateVariantPresetsAutoAssign') {
        if (actionName === 'autoAssignPresets') {
          return { success: true, matched: 0, unmatched: 0, skipped: 0, statusBreakdown: { active: 0, draft: 0, archived: 0 }, unmatchedVariants: [] };
        }
      }

      if (collectionName === 'rapidshyp') {
        return { success: true, message: "Mocked rapidshyp response" };
      }

      // ── seoPages: must come BEFORE generic update/delete/create handlers ──
      if (collectionName === 'seoPages') {
        const pagesCollection = collection(db, 'seoPages');

        if (actionName === 'regeneratePageContent') {
          const snap = await getDoc(doc(pagesCollection, args.pageId));
          if (!snap.exists()) throw new Error('Page not found');
          const page = snap.data() as any;
          return { value: page.h1Heading || page.title || page.slug || '', pageType: page.pageType || 'keyword' };
        }

        if (actionName === 'updatePage') {
          const { pageId, ...updates } = args;
          const clean: any = { updatedAt: Date.now() };
          const fields = ['contentHTML', 'metaDescription', 'metaTitle', 'h1Heading', 'slug', 'faqs', 'imageAltTexts', 'heroImageUrl', 'isPublished', 'keywords', 'filterConfig'];
          fields.forEach(f => { if (updates[f] !== undefined) clean[f] = updates[f]; });
          await updateDoc(doc(pagesCollection, pageId), clean);
          return { pageId };
        }

        if (actionName === 'createPage') {
          const docRef = await addDoc(pagesCollection, { ...args, createdAt: Date.now(), updatedAt: Date.now() });
          return { pageId: docRef.id, slug: args.slug };
        }

        if (actionName === 'deletePage') {
          await deleteDoc(doc(pagesCollection, args.pageId));
          return { pageId: args.pageId };
        }

        if (actionName === 'togglePublish') {
          await updateDoc(doc(pagesCollection, args.pageId), { isPublished: args.isPublished, updatedAt: Date.now() });
          return { pageId: args.pageId, isPublished: args.isPublished };
        }

        if (actionName === 'clonePage') {
          const snap = await getDoc(doc(pagesCollection, args.pageId));
          if (!snap.exists()) throw new Error('Page not found');
          const data = snap.data() as any;
          const newSlug = `${data.slug || 'page'}-copy-${Date.now()}`;
          const docRef = await addDoc(pagesCollection, { ...data, slug: newSlug, isPublished: false, createdAt: Date.now(), updatedAt: Date.now() });
          return { pageId: docRef.id, slug: newSlug };
        }

        if (actionName === 'bulkTogglePublish') {
          const batch = writeBatch(db);
          (args.pageIds || []).forEach((id: string) => {
            batch.update(doc(pagesCollection, id), { isPublished: args.isPublished, updatedAt: Date.now() });
          });
          await batch.commit();
          return { updatedCount: (args.pageIds || []).length };
        }

        if (actionName === 'bulkDeletePages') {
          const batch = writeBatch(db);
          (args.pageIds || []).forEach((id: string) => {
            batch.delete(doc(pagesCollection, id));
          });
          await batch.commit();
          return { deletedCount: (args.pageIds || []).length };
        }

        if (actionName === 'updateHeroImage') {
          await updateDoc(doc(pagesCollection, args.pageId), { heroImageUrl: args.heroImageUrl, updatedAt: Date.now() });
          return { pageId: args.pageId };
        }

        if (actionName === 'syncPageWithTemplate') {
          const pageSnap = await getDoc(doc(pagesCollection, args.pageId));
          if (!pageSnap.exists()) throw new Error('Page not found');
          const page = pageSnap.data() as any;
          const tq = query(collection(db, 'seoPageTemplates'), where('pageType', '==', page.pageType), limit(1));
          const tSnap = await getDocs(tq);
          if (tSnap.empty) return { addedSections: 0 };
          const template = tSnap.docs[0].data() as any;
          const existingSections = (page.layoutConfig?.sections || []).map((s: any) => s.id);
          const newSections = (template.layoutConfig?.sections || []).filter((s: any) => !existingSections.includes(s.id));
          if (newSections.length > 0) {
            const merged = [...(page.layoutConfig?.sections || []), ...newSections];
            await updateDoc(doc(pagesCollection, args.pageId), { 'layoutConfig.sections': merged, updatedAt: Date.now() });
          }
          return { addedSections: newSections.length };
        }

        if (actionName === 'syncAllPagesWithTemplates') {
          const allPages = await getDocs(pagesCollection);
          const allTemplates = await getDocs(collection(db, 'seoPageTemplates'));
          const templateMap: Record<string, any> = {};
          allTemplates.docs.forEach(d => { templateMap[d.data().pageType] = d.data(); });
          let syncedPages = 0;
          let totalAddedSections = 0;
          const batch = writeBatch(db);
          allPages.docs.forEach(d => {
            const page = d.data() as any;
            const template = templateMap[page.pageType];
            if (!template) return;
            const existingSections = (page.layoutConfig?.sections || []).map((s: any) => s.id);
            const newSections = (template.layoutConfig?.sections || []).filter((s: any) => !existingSections.includes(s.id));
            if (newSections.length > 0) {
              const merged = [...(page.layoutConfig?.sections || []), ...newSections];
              batch.update(d.ref, { 'layoutConfig.sections': merged, updatedAt: Date.now() });
              syncedPages++;
              totalAddedSections += newSections.length;
            }
          });
          if (syncedPages > 0) await batch.commit();
          return { syncedPages, totalAddedSections };
        }
      }
      // ── end seoPages ──

      if (path === 'homepage.bulkUpdateCategoryDisplaySettings') {
        // Rows are keyed by categoryName, not by a document id, and the payload
        // is a whole array — the generic writer has nothing to aim at.
        const incoming: any[] = args?.categories || [];
        const existing = await getDocs(collection(db, 'categoryDisplaySettings'));
        const byName = new Map(existing.docs.map(d => [d.data().categoryName, d.id]));

        const { getAuth } = await import('firebase/auth');
        const editor = getAuth().currentUser?.email || null;

        for (let i = 0; i < incoming.length; i += 400) {
          const batch = writeBatch(db);
          incoming.slice(i, i + 400).forEach(cat => {
            const clean = Object.fromEntries(Object.entries(cat).filter(([, v]) => v !== undefined));
            const payload = { ...clean, updatedAt: Date.now(), ...(editor ? { updatedBy: editor } : {}) };
            const id = byName.get(cat.categoryName);
            batch.set(
              id ? doc(db, 'categoryDisplaySettings', id) : doc(collection(db, 'categoryDisplaySettings')),
              payload,
              { merge: true }
            );
          });
          await batch.commit();
        }
        return { success: true, updated: incoming.length };
      }

      // These namespaces have no collection of their own — they edit products in
      // bulk, so the generic writer would aim at a collection that
      // does not exist (and they carry no single document id anyway).
      if (collectionName === 'productClassification' || collectionName === 'productCategories') {
        const applyToProducts = async (ids: string[], patch: Record<string, any>) => {
          const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
          if (Object.keys(clean).length === 0) return { updated: 0 };
          for (let i = 0; i < ids.length; i += 400) {
            const batch = writeBatch(db);
            ids.slice(i, i + 400).forEach(id => batch.update(doc(db, 'products', id), clean));
            await batch.commit();
          }
          return { updated: ids.length };
        };

        if (actionName === 'bulkUpdateClassification') {
          return applyToProducts(args.productIds || [], {
            gadgetCategory: args.gadgetCategory,
            finishTypeId: args.finishTypeId,
          });
        }
        if (actionName === 'updateSingleProductClassification') {
          return applyToProducts([args.productId], {
            gadgetCategory: args.gadgetCategory,
            finishTypeId: args.finishTypeId,
          });
        }
        if (actionName === 'bulkUpdateProductCategories') {
          return applyToProducts(args.productIds || [], { productCategory: args.category });
        }
        if (actionName === 'updateProductCategory') {
          return applyToProducts([args.productId], { productCategory: args.category });
        }
      }

      // Variants live under api.products.* but are their own collection; without
      // this the generic writer would create variants as product documents.
      if (collectionName === 'products' && actionName.toLowerCase().includes('variant')) {
        if (actionName === 'createVariant') {
          const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
          const ref = await addDoc(collection(db, 'variants'), clean);
          return ref.id;
        }
        if (actionName === 'updateVariant') {
          const { variantId, ...rest } = args;
          if (!variantId) throw new Error("variantId is required");
          const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
          await updateDoc(doc(db, 'variants', variantId), clean);
          return variantId;
        }
        if (actionName === 'deleteVariant') {
          if (!args?.variantId) throw new Error("variantId is required");
          await deleteDoc(doc(db, 'variants', args.variantId));
          return { success: true };
        }
      }

      // Settings that live as a single document. The generic writer needs an id
      // and these payloads have none, so it rejected every save.
      //
      // Where each one is written has to match where it is read, and for two of
      // them it did not. Shipping was written into a `shippingSettings`
      // collection that no security rule allows — so the save was denied
      // outright — while the reader, and checkout, look at `settings/shipping`.
      // Wallet was written to an auto-id document while its reader asks for
      // `walletSettings/default`, so a save could succeed and still never be
      // seen. Both now name the document the reader uses.
      //
      // COD keeps reuse-the-existing-document: its reader takes whatever is in
      // the collection, and there is already a live row there with a generated
      // id. Pinning an id would write a second one beside it.
      const SINGLETON: Record<string, { collection: string; docId?: string }> = {
        'cod.updateCodSettings': { collection: 'codSettings' },
        'cod.initializeCodSettings': { collection: 'codSettings' },
        'codDisplayRules.updateDisplaySettings': { collection: 'codSettings' },
        'wallet.saveWalletSettings': { collection: 'walletSettings', docId: 'default' },
        'shipping.updateShippingSettings': { collection: 'settings', docId: 'shipping' },
      };
      const singleton = SINGLETON[path];
      if (singleton) {
        let ref;
        if (singleton.docId) {
          ref = doc(db, singleton.collection, singleton.docId);
        } else {
          const existing = await getDocs(query(collection(db, singleton.collection), limit(1)));
          ref = existing.empty
            ? doc(collection(db, singleton.collection))
            : doc(db, singleton.collection, existing.docs[0].id);
        }
        const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
        await setDoc(ref, { ...clean, updatedAt: Date.now() }, { merge: true });
        return ref.id;
      }

      if (path === 'bulkProductCreator.createBulkProducts') {
        const rows: any[] = args?.products || [];
        const success: any[] = [];
        const failed: any[] = [];

        for (const row of rows) {
          try {
            const slug = String(row.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const productRef = await addDoc(collection(db, 'products'), Object.fromEntries(
              Object.entries({
                title: row.title,
                slug,
                description: row.customDescription || "",
                status: row.status || "active",
                productCategory: row.productCategory,
                gadgetTypeId: row.gadgetTypeId,
                finishTypeId: row.finishTypeId,
                gadgetCategory: row.gadgetCategory,
                images: (row.images || []).map((url: string) => ({ url, alt: row.title })),
                tags: [],
                hasMultipleVariants: false,
                _creationTime: Date.now(),
              }).filter(([, v]) => v !== undefined)
            ));

            // A product with no variant has no price and cannot be bought.
            await addDoc(collection(db, 'variants'), Object.fromEntries(
              Object.entries({
                productId: productRef.id,
                sku: row.sku,
                title: "Default Title",
                price: row.price,
                compareAtPrice: row.compareAtPrice,
                inventoryQuantity: row.inventoryQuantity ?? 0,
                isDefaultVariant: true,
                _creationTime: Date.now(),
              }).filter(([, v]) => v !== undefined)
            ));

            success.push({ title: row.title, productId: productRef.id });
          } catch (e: any) {
            failed.push({ title: row.title, error: e?.message || "Failed to create" });
          }
        }
        return { success, failed };
      }

      if (path === 'mockupsUpload.storeMockupFile') {
        // Filenames arrive as Brand_Model_SKU or Model_SKU.
        const base = String(args?.filename || "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
        const parts = base.split("_").filter(Boolean);
        if (parts.length < 2) throw new Error(`Invalid filename: ${args?.filename} — expected Brand_Model_SKU`);

        const sku = parts[parts.length - 1];
        const brand = parts.length >= 3 ? parts[0] : "";
        const model = (parts.length >= 3 ? parts.slice(1, -1) : parts.slice(0, -1)).join(" ");

        const existing = await getDocs(query(collection(db, 'mockups'),
          where('brand', '==', brand), where('model', '==', model), where('sku', '==', sku), limit(1)));

        /*
         * Which supported model this is. The storefront finds mockups by name,
         * but the model page's counts and the SEO pages find them by id, and
         * without it an upload counts for nothing there. Exact name first,
         * then the brand's models compared the way filenames are written.
         */
        let supportedModelId = "";
        if (brand) {
          const exact = await getDocs(query(collection(db, 'supportedModels'),
            where('brandName', '==', brand), where('modelName', '==', model), limit(1)));
          if (!exact.empty) supportedModelId = exact.docs[0].id;
          else {
            // "Oppo_Oppo A57_T-16" is the Oppo "A57": the brand is sometimes
            // written into the model part of the filename too.
            const n = (x: string) => normalizeModelName(x).toLowerCase();
            const wanted = new Set([n(model), n(model).replace(new RegExp(`^${n(brand)}`), "")]);
            const all = await getDocs(query(collection(db, 'supportedModels'), where('brandName', '==', brand)));
            const hit = all.docs.find((d) => wanted.has(n(String(d.data().modelName || ""))));
            if (hit) supportedModelId = hit.id;
          }
        }

        const payload = {
          brand, model, sku,
          r2Key: args.r2Key || `mockups/${brand}/${model}/${sku}.webp`,
          r2Bucket: 'skinly',
          storageProvider: 'r2',
          ...(supportedModelId ? { supportedModelId } : {}),
        };

        if (existing.empty) {
          await addDoc(collection(db, 'mockups'), { ...payload, _creationTime: Date.now() });
          return { action: "created", brand, model, sku };
        }
        await updateDoc(existing.docs[0].ref, payload);
        return { action: "updated", brand, model, sku };
      }

      if (path === 'whatsappSeed.checkSeeded') {
        const [t, u] = await Promise.all([
          getDocs(collection(db, 'whatsappTemplates')),
          getDocs(collection(db, 'whatsappUsecases')),
        ]);
        return { seeded: !t.empty && !u.empty, templates: t.size, usecases: u.size };
      }

      if (path === 'whatsappSeed.seedTemplates' || path === 'whatsappSeed.seedUsecases' || path === 'emailSeed.seedEmailUsecases') {
        // Config was rebuilt from the messages that actually sent; re-seeding
        // would only overwrite it with guesses.
        const coll = path === 'whatsappSeed.seedTemplates' ? 'whatsappTemplates'
          : path === 'whatsappSeed.seedUsecases' ? 'whatsappUsecases'
          : 'emailUsecaseTemplates';
        const snap = await getDocs(collection(db, coll));
        return { skipped: true, existing: snap.size, message: `${snap.size} already configured — nothing to seed` };
      }

      if (collectionName === 'googleDriveImportPublic' || collectionName === 'googleDriveImport') {
        const JOB_STATUS: Record<string, string> = {
          pauseImportJob: 'paused',
          resumeImportJob: 'pending',
          cancelImportJob: 'cancelled',
        };
        if (JOB_STATUS[actionName]) {
          if (!args?.jobId) throw new Error("jobId is required");
          await updateDoc(doc(db, 'googleDriveImportJobs', args.jobId), {
            status: JOB_STATUS[actionName], updatedAt: Date.now(),
          });
          return { success: true };
        }
        if (actionName === 'deleteImportJob') {
          if (!args?.jobId) throw new Error("jobId is required");
          await deleteDoc(doc(db, 'googleDriveImportJobs', args.jobId));
          return { success: true };
        }
        if (actionName === 'retryFailedFiles') {
          if (!args?.jobId) throw new Error("jobId is required");
          const snap = await getDoc(doc(db, 'googleDriveImportJobs', args.jobId));
          const failed = (snap.exists() ? (snap.data() as any).failedFiles : []) || [];
          await updateDoc(doc(db, 'googleDriveImportJobs', args.jobId), {
            status: 'pending', failedFiles: [], retryCount: ((snap.data() as any)?.retryCount || 0) + 1,
            updatedAt: Date.now(),
          });
          return { retried: failed.length };
        }
        if (actionName === 'checkApiKeyStatus') {
          const s = await getDocs(query(collection(db, 'settings'), where('key', '==', 'googleDriveApiKey'), limit(1)));
          return { configured: !s.empty && !!s.docs[0].data().value };
        }
        if (actionName === 'startGoogleDriveImport') {
          // Listing a Drive folder, pulling each file and turning it into a
          // product needs a server-side runner with Drive credentials; there
          // isn't one, and pretending to start would leave a job stuck forever.
          throw new Error("Google Drive import is not connected yet — no Drive credentials are configured for this project");
        }
      }

      if (path === 'stockNotificationsActions.sendRestockNotifications') {
        if (!args?.variantId) throw new Error("variantId is required");

        // Queued rather than sent here — the worker owns delivery, so these get
        // the same claim, retry cap and daily ceiling as everything else.
        const uc = await getDocs(query(collection(db, 'whatsappUsecases'),
          where('usecaseKey', '==', 'back_in_stock'), limit(1)));
        if (uc.empty) {
          throw new Error('No "back_in_stock" WhatsApp template is set up yet — add one under WhatsApp → Usecases first');
        }
        if (uc.docs[0].data().enabled !== true) {
          throw new Error('The "back_in_stock" usecase is switched off — enable it under WhatsApp → Usecases');
        }
        const usecase: any = uc.docs[0].data();

        const waiting = await getDocs(query(collection(db, 'stockNotifications'),
          where('variantId', '==', args.variantId), where('status', '==', 'waiting')));
        if (waiting.empty) return { queued: 0 };

        // Requests made before titles were stored carry none, and the template
        // would go out with an empty product name.
        const variantSnap = await getDoc(doc(db, 'variants', String(args.variantId)));
        const variant: any = variantSnap.exists() ? variantSnap.data() : null;
        const productSnap = variant?.productId ? await getDoc(doc(db, 'products', variant.productId)) : null;
        const product: any = productSnap?.exists() ? productSnap.data() : null;

        const batch = writeBatch(db);
        waiting.docs.forEach(d => {
          const n: any = d.data();
          const msgRef = doc(collection(db, 'whatsappMessages'));
          batch.set(msgRef, {
            usecaseKey: 'back_in_stock',
            templateName: usecase.templateName,
            providerTemplateId: usecase.providerTemplateId,
            recipientPhone: n.phoneNumber,
            recipientUserId: n.userId || null,
            // Every name the template editor offers that this message can
            // fill; the worker sends only the ones the template declares.
            variables: {
              product_name: n.productTitle || product?.title || "",
              variant_name: n.variantTitle || variant?.title || "",
              model_name: n.variantTitle || variant?.title || "",
              product_url: `https://goskinly.com/products/${n.productSlug || product?.slug || ""}`,
              product_price: variant?.price ? `₹${variant.price}` : "",
              shop_url: "https://goskinly.com",
              company_name: "Skinly",
              customer_name: "there",
              stock_notification: "back in stock",
            },
            status: 'pending',
            retryCount: 0,
            createdAt: Date.now(),
          });
          batch.set(doc(collection(db, 'whatsappQueue')), {
            messageId: msgRef.id,
            status: 'pending',
            attempts: 0,
            priority: 'normal',
            scheduledFor: Date.now(),
          });
          // Kept as history under a fresh id: the waiting request's id is
          // variant+phone, and it has to be free again for the next time this
          // customer asks.
          batch.set(doc(collection(db, 'stockNotifications')), {
            ...n,
            status: 'notified',
            notifiedAt: Date.now(),
            messageId: msgRef.id,
          });
          batch.delete(d.ref);
        });
        await batch.commit();
        // Send now rather than on the worker's next five-minute pass, so the
        // result is known while the admin is still looking.
        let sent = 0;
        let workerError = '';
        try {
          const res: any = await httpsCallable(functions, 'triggerWhatsAppWorker')({});
          sent = Number(res?.data?.sent) || 0;
        } catch (e: any) {
          workerError = e?.message || 'worker call failed';
        }
        return { queued: waiting.size, sent, workerError };
      }

      if (path === 'whatsappMessaging.triggerWorker' || path === 'whatsappActions.testTemplate') {
        const fn = httpsCallable(functions,
          path === 'whatsappActions.testTemplate' ? 'testWhatsAppTemplate' : 'triggerWhatsAppWorker');
        const res: any = await fn(args || {});
        return res.data;
      }

      if (path === 'whatsappAutoFix.autoLinkTemplates') {
        // Point each usecase at the template it last actually sent with.
        const [usecases, templates] = await Promise.all([
          getDocs(collection(db, 'whatsappUsecases')),
          getDocs(collection(db, 'whatsappTemplates')),
        ]);
        const byName = new Map(templates.docs.map(d => [d.data().templateName, d.data()]));
        const batch = writeBatch(db);
        let linked = 0;
        usecases.docs.forEach(d => {
          const u: any = d.data();
          const t: any = byName.get(u.templateName);
          if (t && u.providerTemplateId !== t.providerTemplateId) {
            batch.update(d.ref, { providerTemplateId: t.providerTemplateId, lastUpdatedAt: Date.now() });
            linked++;
          }
        });
        if (linked) await batch.commit();
        return { linked };
      }

      if (path === 'whatsappAutoFix.clearStuckQueue') {
        // Anything left processing is from a worker run that never finished.
        const stuck = await getDocs(query(collection(db, 'whatsappQueue'), where('status', '==', 'processing')));
        const batch = writeBatch(db);
        stuck.docs.forEach(d => batch.update(d.ref, { status: 'pending', lastAttemptAt: Date.now() }));
        if (!stuck.empty) await batch.commit();
        return { cleared: stuck.size };
      }

      if (path === 'whatsappMessaging.retryMessage') {
        if (!args?.messageId) throw new Error("messageId is required");
        await updateDoc(doc(db, 'whatsappMessages', args.messageId), {
          status: 'pending', retryCount: (args.retryCount || 0) + 1, lastAttemptAt: Date.now(),
        });
        const queued = await getDocs(query(collection(db, 'whatsappQueue'), where('messageId', '==', args.messageId), limit(1)));
        if (!queued.empty) {
          await updateDoc(queued.docs[0].ref, { status: 'pending', scheduledFor: Date.now() });
        }
        return { success: true };
      }

      if (path === 'wallet.adminCreditWallet' || path === 'wallet.adminDebitWallet') {
        const isCredit = path.endsWith('adminCreditWallet');
        const amount = Number(args?.amount);
        if (!args?.userId) throw new Error("userId is required");
        if (!(amount > 0)) throw new Error("Amount must be greater than 0");

        const { getAuth } = await import('firebase/auth');
        const adminEmail = getAuth().currentUser?.email || null;
        const userRef = doc(db, 'users', args.userId);

        // Balance and ledger row must move together, or the two disagree.
        const result = await runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) throw new Error("User not found");

          const before = snap.data().walletBalance || 0;
          if (!isCredit && before < amount) throw new Error(`Insufficient balance (₹${before})`);
          const after = isCredit ? before + amount : before - amount;

          tx.update(userRef, { walletBalance: after });
          tx.set(doc(collection(db, 'walletTransactions')), {
            userId: args.userId,
            transactionType: isCredit ? "credit" : "debit",
            amount,
            source: isCredit ? "admin_credit" : "admin_debit",
            balanceBefore: before,
            balanceAfter: after,
            description: args.description || "",
            adminEmail,
            createdAt: Date.now(),
          });
          return after;
        });

        return { success: true, newBalance: result };
      }

      if (collectionName === 'rollsManagement') {
        // R-numbers and multipliers live on variants, not on a rollsManagement
        // collection — there isn't one.
        if (actionName === 'assignRNumber') {
          await updateDoc(doc(db, 'variants', args.variantId), { rNumber: args.rNumber });
          return { success: true };
        }
        if (actionName === 'removeRNumberAssignment') {
          await updateDoc(doc(db, 'variants', args.variantId), { rNumber: deleteField() });
          return { success: true };
        }
        if (actionName === 'updateMaterialMultiplier') {
          await updateDoc(doc(db, 'variants', args.variantId), { materialMultiplier: args.multiplier });
          return { success: true };
        }
        if (actionName === 'bulkAssignRNumber') {
          const ids: string[] = args.productIds || [];
          let updated = 0;
          for (const pid of ids) {
            const vs = await getDocs(query(collection(db, 'variants'), where('productId', '==', pid)));
            const batch = writeBatch(db);
            vs.docs.forEach(v => { batch.update(v.ref, { rNumber: args.rNumber }); updated++; });
            if (!vs.empty) await batch.commit();
          }
          return { success: true, updated };
        }
      }

      if (path === 'aiMockups.linkMockupToProducts') {
        // A variant SKU is `<design code>-<view code>`, so every variant for a
        // design sits in one contiguous key range. The range is tight: "R-290-LP"
        // sorts above "R-29-\uf8ff" because '0' > '-', so a longer design code
        // cannot leak in.
        const design = String(args.rNumber || '').trim();
        /*
         * The listing kinds this one picture may land on. Normally just its
         * own; several when angles share a picture, because several brands
         * ship the same device and one photograph serves all their listings.
         */
        const allowed = (Array.isArray(args.listings) && args.listings.length ? args.listings : [args.listing])
          .map((l: string) => String(l || '').trim().toLowerCase())
          .filter(Boolean);
        const codes = (args.skuCodes || []).map((c: string) => String(c).trim().toUpperCase()).filter(Boolean);
        // Titles are the fallback for SKUs with no view code. "Default" and
        // "Default Title" are excluded: they appear across every gadget and say
        // nothing about which view a variant is.
        const titles = (args.variantTitles || [])
          .map((t: string) => String(t).trim().toLowerCase())
          .filter((t: string) => t && t !== 'default' && t !== 'default title');
        if (!design || (!codes.length && !titles.length)) {
          return { success: false, linked: 0, reason: 'No design code, SKU codes or variant titles' };
        }

        const [snap, wholeSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'variants'),
            where('sku', '>=', `${design}-`),
            where('sku', '<', `${design}-\uf8ff`)
          )),
          // A single-variant product's SKU may be the bare design code with no
          // view suffix at all, so the range query above never sees it.
          getDocs(query(collection(db, 'variants'), where('sku', '==', design))),
        ]);
        const allDocs = [...snap.docs, ...wholeSnap.docs];

        const productIds = new Set<string>();
        const matchedSkus: string[] = [];
        const unmatched: any[] = [];
        allDocs.forEach((d) => {
          const data: any = d.data();
          const sku = String(data.sku || '');
          // Case-insensitive on the tail only: the catalogue holds IPAD and iPAD.
          // Some SKUs carry a batch suffix after the view code — R-06-LPK-2,
          // R-10-DRC-F12 — so the code is either the whole tail or its first
          // segment. Matching is never attempted further left than that: design
          // codes start with things like LP and LC, which are themselves view
          // codes, and scanning would match the wrong half of the SKU.
          const tail = sku.slice(design.length + 1).toUpperCase();
          const byCode = codes.includes(tail) || codes.includes(tail.split('-')[0]);
          const byTitle = titles.includes(String(data.title || '').trim().toLowerCase());
          if ((byCode || byTitle) && data.productId) {
            productIds.add(data.productId);
            matchedSkus.push(sku);
          } else if (data.productId) {
            unmatched.push(data);
          }
        });

        // Last resort, and only where the shot asked for it: a product with one
        // variant has only one view, so there is nothing to disambiguate.
        if (args.matchSingleVariant) {
          const byProduct: Record<string, any[]> = {};
          unmatched.forEach((v) => { (byProduct[v.productId] ||= []).push(v); });
          for (const [pid, vs] of Object.entries(byProduct)) {
            if (productIds.has(pid) || vs.length !== 1) continue;
            const all = await getDocs(query(collection(db, 'variants'), where('productId', '==', pid)));
            if (all.size === 1) { productIds.add(pid); matchedSkus.push(String(vs[0].sku || '')); }
          }
        }

        // The view code alone is not unique across the catalogue: PS5 is both a
        // console SKU (R-20-PS5) and a controller SKU (R-18-PS5, "Play Station
        // 5"). Without this the console shot would also land on the controller
        // product. When the shot names a gadget, the product must agree.
        let allowedTypeIds: Set<string> | null = null;
        if (args.gadget) {
          const gts = await getDocs(collection(db, 'gadgetTypes'));
          allowedTypeIds = new Set(
            gts.docs
              .filter((g) => String((g.data() as any).name || '').toLowerCase() === String(args.gadget).toLowerCase())
              .map((g) => g.id)
          );
          if (!allowedTypeIds.size) allowedTypeIds = null;
        }

        // A brand listing takes only its own brand's pictures. Without this a
        // one-variant listing (OnePlus, iPhone) took every phone shot through
        // the single-variant rule, and "Only Top" pulled the generic laptop
        // shot onto the MacBook listing.
        const listing = String(args.listing || '').trim().toLowerCase();
        const listingIsPreset = allowed.some((l: string) => !!presetFor(l));

        let linked = 0, alreadyThere = 0, wrongGadget = 0, wrongListing = 0;
        for (const pid of productIds) {
          const pref = doc(db, 'products', pid);
          const psnap = await getDoc(pref);
          if (!psnap.exists()) continue;
          const pdata: any = psnap.data();
          if (allowedTypeIds) {
            const gt = pdata.gadgetTypeId || pdata.gadgetType;
            if (!allowedTypeIds.has(gt)) { wrongGadget++; continue; }
          }
          const kind = String(pdata.listingKind || '').trim().toLowerCase();
          if (allowed.length && (kind ? !allowed.includes(kind) : listingIsPreset)) { wrongListing++; continue; }
          const images = Array.isArray(pdata.images) ? pdata.images : [];
          if (images.some((i: any) => (typeof i === 'string' ? i : i?.url) === args.url)) { alreadyThere++; continue; }
          // The listing's own pictures lead, in the order they were approved;
          // older pictures carried over from before follow them.
          /*
           * The picture is one file; what it is called here is this listing's
           * own business. A shared picture came with the alt text and the
           * listing tag of the angle that made it, so the Oppo charger's
           * picture described itself as a Xiaomi charger to Google and to
           * anyone reading with a screen reader. Where several listings share
           * a picture, each takes its own title and its own tag.
           */
          const mine = allowed.length > 1 && kind && allowed.includes(kind);
          const added = {
            url: args.url,
            alt: (mine ? pdata.title : args.alt) || pdata.title || '',
            ...(mine ? { listing: kind } : listing ? { listing } : {}),
          };
          const tag = mine ? kind : listing;
          const next = tag && kind
            ? [...images.filter((i: any) => i?.listing === kind), added, ...images.filter((i: any) => i?.listing !== kind)]
            : [...images, added];
          await updateDoc(pref, {
            images: next,
            updatedAt: Date.now(),
            // A studio listing waits in draft for its first approved picture:
            // a listing with no photo is not worth showing to anyone.
            ...(pdata.awaitingImage ? { status: 'active', awaitingImage: deleteField(), publishedAt: Date.now() } : {}),
          });
          linked++;
        }
        return { success: true, linked, alreadyThere, wrongGadget, wrongListing, matchedSkus, productIds: [...productIds] };
      }

      // ---------------------------------------------------------------------
      // Actions the Convex migration left without an implementation.
      //
      // These are plain Firestore writes the signed-in user is already allowed
      // to make, so they live here with the other two hundred rather than
      // becoming Cloud Functions. The three that could not — moving money,
      // holding the MSG91 key, deciding what is still owed — did become
      // functions, in functions/src/ordersAdmin.ts.
      // ---------------------------------------------------------------------

      if (path === 'aiMockups.tidyListingImages') {
        // Puts a design's brand listings right after pictures landed on the
        // wrong one. Each studio picture belongs to one listing kind — the
        // job's own, or for older jobs the one its shot maps to — and moves
        // there when this design has that listing; a picture for a listing the
        // design does not have stays where it is unless the job named it
        // outright. The listing's own pictures lead; pictures no job accounts
        // for (older mockups) follow, untouched.
        const design = String(args.rNumber || '').trim();
        if (!design) throw new Error('Missing design code');
        const [snap, wholeSnap, jobSnap] = await Promise.all([
          getDocs(query(collection(db, 'variants'), where('sku', '>=', `${design}-`), where('sku', '<', `${design}-\uf8ff`))),
          getDocs(query(collection(db, 'variants'), where('sku', '==', design))),
          getDocs(query(collection(db, 'designMockups'), where('rNumber', '==', design))),
        ]);
        /*
         * Which listings each picture belongs to — often one, sometimes
         * several. Angles that share a picture (the brands that all ship the
         * same charger) put every listing it serves on the job, and reading
         * only the first of them made the picture look misplaced on the other
         * five: it was moved off each of them in turn, and a listing left with
         * nothing went back to draft. Which is exactly what happened to Oppo,
         * OnePlus, Realme, Samsung and Vivo Charger.
         */
        const kindByUrl = new Map<string, { kinds: string[]; explicit: boolean; shared: boolean }>();
        jobSnap.docs.forEach((d) => {
          const j: any = d.data();
          if (!j.url) return;
          const named = (Array.isArray(j.listings) && j.listings.length ? j.listings : j.listing ? [j.listing] : [])
            .map((l: string) => String(l || '').trim().toLowerCase())
            .filter(Boolean);
          if (named.length) {
            kindByUrl.set(String(j.url), { kinds: named, explicit: true, shared: named.length > 1 });
            return;
          }
          const kind = listingOf({ suffix: String(j.suffix || '').replace(/-(len|wid)$/, ''), gadget: j.gadget }).toLowerCase();
          if (presetFor(kind)) kindByUrl.set(String(j.url), { kinds: [kind], explicit: false, shared: false });
        });
        const productIds = new Set<string>();
        [...snap.docs, ...wholeSnap.docs].forEach((d) => { const pid = (d.data() as any).productId; if (pid) productIds.add(pid); });

        const products: Array<{ id: string; data: any; kind: string; images: any[] }> = [];
        for (const pid of productIds) {
          const psnap = await getDoc(doc(db, 'products', pid));
          if (!psnap.exists()) continue;
          const data: any = psnap.data();
          if (data.status === 'archived') continue;
          const kind = String(data.listingKind || '').trim().toLowerCase();
          if (kind) products.push({ id: pid, data, kind, images: Array.isArray(data.images) ? data.images : [] });
        }
        const byKind = new Map(products.map((p) => [p.kind, p]));
        const urlOf = (i: any) => String(typeof i === 'string' ? i : i?.url || '');
        const asObject = (i: any, kind: string, title: string) =>
          typeof i === 'string' ? { url: i, alt: title, listing: kind } : { ...i, listing: kind };

        // own: made for this listing; mapped: older shots that map to it.
        const plan = new Map(products.map((p) => [p.id, { own: [] as any[], mapped: [] as any[], old: [] as any[] }]));
        let removed = 0, moved = 0;
        for (const p of products) {
          const slot = plan.get(p.id)!;
          for (const img of p.images) {
            const url = urlOf(img);
            // A job speaks for its picture wherever the tag disagrees: the tag
            // says where a picture sits, the job says where it belongs.
            const fromJob = kindByUrl.get(url);
            const tagged = typeof img === 'object' && img?.listing
              ? { kinds: [String(img.listing).trim().toLowerCase()], explicit: true, shared: false }
              : null;
            const from = fromJob || tagged;
            if (!from) { slot.old.push(img); continue; }
            if (from.kinds.includes(p.kind)) {
              (from.explicit ? slot.own : slot.mapped).push(asObject(img, p.kind, p.data.title || ''));
              continue;
            }
            const belongsTo = from.kinds.find((k) => byKind.has(k)) || from.kinds[0];
            const target = byKind.get(belongsTo);
            if (target) {
              const tslot = plan.get(target.id)!;
              if (target.images.some((x) => urlOf(x) === url) || tslot.mapped.some((x) => urlOf(x) === url)) {
                removed++;
              } else {
                (from.explicit ? tslot.own : tslot.mapped).push(asObject(img, belongsTo, target.data.title || ''));
                moved++;
              }
            } else if (from.explicit) {
              removed++;
            } else {
              slot.old.push(img);
            }
          }
        }

        /*
         * A shared picture onto every listing that shares it.
         *
         * Only the shared ones, and only where the listing has not got it
         * already — enough to put right a listing the old reading emptied,
         * without resurrecting a picture somebody deleted from a listing of
         * its own.
         */
        let added = 0;
        for (const [url, from] of kindByUrl) {
          if (!from.shared) continue;
          for (const kind of from.kinds) {
            const target = byKind.get(kind);
            if (!target) continue;
            const tslot = plan.get(target.id)!;
            if ([...tslot.own, ...tslot.mapped, ...tslot.old].some((x) => urlOf(x) === url)) continue;
            tslot.own.push({ url, alt: target.data.title || '', listing: kind });
            added++;
          }
        }

        let changed = 0;
        const hidden: string[] = [];
        for (const p of products) {
          const { own, mapped, old } = plan.get(p.id)!;
          const next = [...own, ...mapped, ...old];
          if (JSON.stringify(next) === JSON.stringify(p.images)) continue;
          // A listing left with no picture waits in draft; its first approved
          // picture publishes it again, as with a new listing.
          const emptied = !next.length && p.data.status === 'active';
          const filled = next.length && p.data.awaitingImage;
          await updateDoc(doc(db, 'products', p.id), {
            images: next,
            updatedAt: Date.now(),
            ...(emptied ? { status: 'draft', awaitingImage: true } : {}),
            ...(filled ? { status: 'active', awaitingImage: deleteField(), publishedAt: Date.now() } : {}),
          });
          changed++;
          if (emptied) hidden.push(String(p.data.listingKind || p.data.title || p.id));
        }
        return { success: true, removed, moved, added, changed, hidden, products: products.length };
      }

      if (path === 'stockNotifications.deleteRequest') {
        if (!args?.id) throw new Error('Missing request');
        await deleteDoc(doc(db, 'stockNotifications', String(args.id)));
        return { success: true };
      }

      if (path === 'stockNotifications.subscribeToNotification') {
        const { getAuth } = await import('firebase/auth');
        const user = getAuth().currentUser;
        const phone = String(args.phoneNumber || '').replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Please enter a valid 10-digit mobile number');
        if (!args.variantId) throw new Error('Missing variant');

        // One subscription per person per variant, or a restock texts them
        // once for every time they pressed the button.
        //
        // This used to check with a query first, but only admins may read this
        // collection, so every customer's request failed on that query and
        // nothing was saved — only requests made while signed in as an admin
        // ever arrived. The document id now is the uniqueness: a customer may
        // create it, and creating it again is an update, which the rules
        // refuse, which is exactly "already subscribed".
        const variantSnap = await getDoc(doc(db, 'variants', String(args.variantId)));
        const variant: any = variantSnap.exists() ? variantSnap.data() : {};
        const productId = String(args.productId || variant.productId || '');
        const productSnap = productId ? await getDoc(doc(db, 'products', productId)) : null;
        const product: any = productSnap?.exists() ? productSnap.data() : {};
        try {
          await setDoc(doc(db, 'stockNotifications', `${args.variantId}_${phone}`), {
            variantId: String(args.variantId),
            productId,
            productTitle: String(product.title || ''),
            productSlug: String(product.slug || ''),
            variantTitle: String(variant.title || args.variantTitle || ''),
            sku: String(variant.sku || ''),
            phoneNumber: phone,
            userId: user?.uid || '',
            userEmail: user?.email || '',
            status: 'waiting',
            createdAt: Date.now(),
          });
        } catch (e: any) {
          if (e?.code === 'permission-denied') return { success: true, alreadySubscribed: true };
          throw e;
        }
        return { success: true, alreadySubscribed: false };
      }

      if (path === 'bugReports.submitBugReport') {
        const { getAuth } = await import('firebase/auth');
        const user = getAuth().currentUser;
        const details = String(args.bugDetails || '').trim();
        if (!details) throw new Error('Please describe the problem');

        // A short human-readable id, so a customer can quote it back.
        const bugId = `BUG-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const ref = await addDoc(collection(db, 'bugReports'), {
          bugId,
          userEmail: String(args.userEmail || user?.email || ''),
          userPhone: String(args.userPhone || ''),
          bugDetails: details,
          userId: user?.uid || '',
          status: 'open',
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          createdAt: Date.now(),
        });
        return { success: true, bugReportId: ref.id, bugId };
      }

      if (path === 'bugReports.attachFileToBug') {
        if (!args.bugReportId) throw new Error('Missing bug report');
        await addDoc(collection(db, 'bugAttachments'), {
          bugReportId: args.bugReportId,
          fileId: args.fileId || '',
          fileName: args.fileName || '',
          fileSize: Number(args.fileSize) || 0,
          fileType: args.fileType || '',
          createdAt: Date.now(),
        });
        return { success: true };
      }

      if (path === 'admin.orders.restockInventory') {
        const list = Array.isArray(args.itemsToRestock) ? args.itemsToRestock : [];
        const results: any[] = [];
        for (const line of list) {
          const sku = String(line?.variant || '');
          const qty = Number(line?.quantity) || 0;
          try {
            if (!sku) throw new Error('no SKU on this line');
            const found = await getDocs(query(collection(db, 'variants'), where('sku', '==', sku), limit(1)));
            if (found.empty) throw new Error('variant not found');
            const vref = found.docs[0].ref;
            const current = Number((found.docs[0].data() as any).inventoryQuantity) || 0;
            await updateDoc(vref, { inventoryQuantity: current + qty, restockedAt: Date.now() });
            results.push({ sku, success: true, from: current, to: current + qty });
          } catch (e: any) {
            results.push({ sku, success: false, error: e?.message || 'failed' });
          }
        }
        const failed = results.filter(r => !r.success);
        if (args.orderId) {
          // Kept on the order so a second click is visibly a second restock.
          const oref = doc(db, 'orders', args.orderId);
          const osnap = await getDoc(oref);
          const history = Array.isArray((osnap.data() as any)?.restockingHistory) ? (osnap.data() as any).restockingHistory : [];
          await updateDoc(oref, {
            restockingHistory: [...history, { at: Date.now(), items: results }],
            updatedAt: Date.now(),
          });
        }
        return { success: failed.length === 0, results };
      }

      if (path === 'admin.orders.recordRtoAction') {
        if (!args.orderId) throw new Error('Missing orderId');
        const oref = doc(db, 'orders', args.orderId);
        const osnap = await getDoc(oref);
        if (!osnap.exists()) throw new Error('Order not found');
        const prior = Array.isArray((osnap.data() as any).rtoActions) ? (osnap.data() as any).rtoActions : [];
        const entry = {
          at: Date.now(),
          actionType: args.actionType || 'resolved',
          ...(args.notes ? { notes: String(args.notes) } : {}),
          ...(args.newOrderNumber ? { newOrderNumber: String(args.newOrderNumber) } : {}),
        };
        await updateDoc(oref, { rtoActions: [...prior, entry], updatedAt: Date.now() });
        return { success: true, actionType: entry.actionType };
      }

      if (path === 'backup.runBackupNow' || path === 'orders.runUnpaidSweep' || path === 'orders.runDailyDigest' || path === 'seo.runSeoAutoPages') {
        // Both read or rewrite a lot; they belong on the server.
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const name = path.split('.')[1];
        // The client gives up after 70 s by default; writing a batch of SEO
        // pages takes several minutes, and the function allows nine.
        const call = httpsCallable(getFunctions(), name, { timeout: 540_000 });
        const res = await call(args || {});
        return res.data;
      }

      if (path === 'admin.orders.backfillOrderStatuses') {
        // A one-off rewrite of the statuses written before the vocabulary was
        // settled. Server-side because it reads every order.
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const call = httpsCallable(getFunctions(), 'backfillOrderStatuses');
        const res = await call({ dryRun: args?.dryRun === true });
        return res.data;
      }

      if (path === 'admin.manualTracking.saveManualTracking') {
        // Server-side, because saving a tracking number also moves the order,
        // and that decision belongs to one place. See saveManualTracking in
        // functions/src/rapidshyp.ts for what this used to get wrong.
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const call = httpsCallable(getFunctions(), 'saveManualTracking');
        const res = await call({
          orderId: args.orderId,
          trackingNumber: args.trackingNumber,
          courierCompany: args.courierCompany,
        });
        return res.data;
      }

      if (path === 'admin.orders.restoreOrders') {
        const ids: string[] = Array.isArray(args.orderIds) ? args.orderIds : args.orderId ? [args.orderId] : [];
        if (!ids.length) throw new Error('No orders selected');
        const batch = writeBatch(db);
        ids.forEach((id) => batch.update(doc(db, 'orders', id), { isDeleted: false, updatedAt: Date.now() }));
        await batch.commit();
        return { success: true, restored: ids.length };
      }

      if (path === 'admin.orders.sendOrderStatusWhatsApp') {
        if (!args.orderId) throw new Error('Missing orderId');
        const osnap = await getDoc(doc(db, 'orders', args.orderId));
        if (!osnap.exists()) throw new Error('Order not found');
        const order: any = osnap.data();
        const phone = String(order.shippingAddress?.phone || order.phone || '').replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('This order has no usable mobile number');

        // Map the admin's email-type vocabulary onto the usecase keys the
        // worker knows. Anything unmapped is refused rather than queued into
        // a usecase that does not exist.
        const USECASE: Record<string, string> = {
          order_confirmed: 'order_received',
          order_dispatched: 'order_dispatched',
          order_delivered: 'order_delivered',
          order_cancelled: 'order_cancelled',
        };
        const usecaseKey = USECASE[String(args.whatsappType || 'order_confirmed')];
        if (!usecaseKey) throw new Error(`No WhatsApp usecase for "${args.whatsappType}"`);

        const uc = await getDocs(query(collection(db, 'whatsappUsecases'), where('usecaseKey', '==', usecaseKey), limit(1)));
        if (uc.empty) throw new Error(`WhatsApp usecase "${usecaseKey}" does not exist`);
        if ((uc.docs[0].data() as any).enabled !== true) throw new Error(`The "${usecaseKey}" WhatsApp message is switched off`);

        const msg = await addDoc(collection(db, 'whatsappMessages'), {
          usecaseKey,
          recipientPhone: phone,
          recipientName: order.customerName || order.shippingAddress?.fullName || '',
          relatedOrderId: args.orderId,
          // Snake_case here, camelCase in the email templates — the two
          // providers were configured separately and neither accepts the
          // other's names. Authkey drops what it does not recognise, so a
          // wrong name is a blank in the message, not an error.
          // order_received's template declares order_total as well; Authkey
          // drops any name it does not recognise, so a missing one is a blank
          // in the delivered message rather than an error.
          variables: {
            customer_name: order.shippingAddress?.fullName || order.customerName || 'Customer',
            order_number: String(order.orderNumber || order.failedOrderNumber || 'Pending'),
            order_total: String(Number(order.total ?? order.amountPayable ?? 0).toFixed(2)),
            product_name: (Array.isArray(order.items) ? order.items : [])
              .map((i: any) => i?.productTitle).filter(Boolean).join(', '),
          },
          status: 'pending',
          createdAt: Date.now(),
        });
        await addDoc(collection(db, 'whatsappQueue'), {
          messageId: msg.id,
          status: 'pending',
          attempts: 0,
          scheduledFor: Date.now(),
          createdAt: Date.now(),
        });
        return { success: true, queued: true };
      }

      if (path === 'products.deleteProduct') {
        /*
         * Deleting a product never worked.
         *
         * There was no handler, so it fell through to the generic writer,
         * which reads the target id from a fixed list of names — id, couponId,
         * ruleId, pageId, slideId, bannerId, videoId, reviewId, promptId,
         * mockupId. `productId` was not among them, so the id came out
         * undefined and it threw "ID required for delete" every time.
         *
         * Adding the name to that list would have deleted the product row and
         * left every variant behind it orphaned, still carrying stock and
         * still matched by the material resolver. The confirm dialog promises
         * the variants go too, so they go.
         */
        if (!args.productId) throw new Error('Missing productId');
        const pref = doc(db, 'products', args.productId);
        const psnap = await getDoc(pref);
        if (!psnap.exists()) throw new Error('Product not found');

        const vs = await getDocs(query(collection(db, 'variants'), where('productId', '==', args.productId)));
        const refs = [...vs.docs.map((d) => d.ref), pref];
        // Product last, so a failure part-way leaves a product with fewer
        // variants rather than variants belonging to nothing.
        for (let i = 0; i < refs.length; i += 450) {
          const batch = writeBatch(db);
          refs.slice(i, i + 450).forEach((r) => batch.delete(r));
          await batch.commit();
        }
        return { success: true, variants: vs.size };
      }

      if (path === 'products.deleteAllProducts') {
        /*
         * The "Delete all products" nuke button, same bug as deleteProduct
         * once was: no handler, so it fell through to the generic writer
         * looking for an id in the args — and this call passes none at all,
         * always "ID required for delete (deleteAllProducts)". Three confirm
         * dialogs stand in front of this button; once past them, it deletes
         * every product and every variant, in batches.
         */
        const [prodSnap, varSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'variants')),
        ]);
        const refs = [...varSnap.docs.map((d) => d.ref), ...prodSnap.docs.map((d) => d.ref)];
        for (let i = 0; i < refs.length; i += 450) {
          const batch = writeBatch(db);
          refs.slice(i, i + 450).forEach((r) => batch.delete(r));
          await batch.commit();
        }
        return { success: true, deletedProducts: prodSnap.size, deletedVariants: varSnap.size };
      }

      if (path === 'products.bulkUpdateVariantPrices') {
        // Same missing-handler shape: the dialog was built and then wired to
        // a mutation nobody implemented, so every "Apply Changes" click threw.
        const updates: Array<{ variantId: string; newPrice: number }> = Array.isArray(args?.updates) ? args.updates : [];
        if (!updates.length) throw new Error('No price changes to apply');
        let successCount = 0, errorCount = 0;
        for (let i = 0; i < updates.length; i += 450) {
          const batch = writeBatch(db);
          let inThisBatch = 0;
          for (const u of updates.slice(i, i + 450)) {
            if (!u?.variantId || !(Number(u.newPrice) >= 0)) { errorCount++; continue; }
            batch.update(doc(db, 'variants', u.variantId), { price: Number(u.newPrice), updatedAt: Date.now() });
            inThisBatch++;
          }
          if (inThisBatch) {
            try { await batch.commit(); successCount += inThisBatch; }
            catch (e) { console.error('bulkUpdateVariantPrices batch failed', e); errorCount += inThisBatch; }
          }
        }
        return { success: true, successCount, errorCount };
      }

      if (path === 'products.cloneProduct') {
        if (!args.productId) throw new Error('Missing productId');
        const psnap = await getDoc(doc(db, 'products', args.productId));
        if (!psnap.exists()) throw new Error('Product not found');
        const p: any = psnap.data();

        // Slug and SKU are unique keys; a clone that reuses either would
        // shadow the original on the storefront.
        const stamp = Date.now().toString(36).slice(-4);
        const clone = await addDoc(collection(db, 'products'), {
          ...p,
          title: `${p.title} (copy)`,
          slug: `${p.slug}-copy-${stamp}`,
          status: 'draft',
          _creationTime: Date.now(),
          createdAt: Date.now(),
        });
        const vs = await getDocs(query(collection(db, 'variants'), where('productId', '==', args.productId)));
        const batch = writeBatch(db);
        vs.docs.forEach((d) => {
          const v: any = d.data();
          batch.set(doc(collection(db, 'variants')), {
            ...v,
            productId: clone.id,
            sku: `${v.sku}-C${stamp}`,
            inventoryQuantity: 0,
            _creationTime: Date.now(),
          });
        });
        await batch.commit();
        return { success: true, productId: clone.id, variants: vs.size };
      }

      if (path === 'products.reorderProductImages') {
        if (!args.productId) throw new Error('Missing productId');
        const images = Array.isArray(args.images) ? args.images : [];
        await updateDoc(doc(db, 'products', args.productId), {
          images: images.map((i: any) => (typeof i === 'string' ? { url: i } : (i.alt ? { url: i.url, alt: i.alt } : { url: i.url }))),
          updatedAt: Date.now(),
        });
        return { success: true };
      }

      if (path === 'cashback.toggleCashbackRule') {
        if (!args.ruleId) throw new Error('Missing ruleId');
        await updateDoc(doc(db, 'cashbackRules', args.ruleId), { isActive: args.isActive === true, updatedAt: Date.now() });
        return { success: true };
      }

      if (path === 'collections.syncAutoCollectionProducts') {
        // Same rules the scheduled resync uses, for one collection on demand.
        const fn = httpsCallable(functions, 'syncProductCollections');
        const res: any = await fn({ collectionId: args.collectionId });
        return { success: true, synced: res?.data?.synced ?? res?.data?.updated ?? 0 };
      }

      if (path === 'productCategories.reorder') {
        const ids: string[] = Array.isArray(args.categoryIds) ? args.categoryIds : [];
        const batch = writeBatch(db);
        ids.forEach((id, i) => batch.update(doc(db, 'productCategoriesConfig', id), { order: i, updatedAt: Date.now() }));
        await batch.commit();
        return { success: true, reordered: ids.length };
      }

      if (path === 'supportedModels.renameBrand') {
        const oldName = String(args.oldName || '');
        const newName = String(args.newName || '').trim();
        if (!oldName || !newName) throw new Error('Both the old and new brand name are required');
        const hits = await getDocs(query(collection(db, 'supportedModels'), where('brandName', '==', oldName)));
        for (let i = 0; i < hits.docs.length; i += 450) {
          const batch = writeBatch(db);
          hits.docs.slice(i, i + 450).forEach((d) => batch.update(d.ref, { brandName: newName }));
          await batch.commit();
        }
        return hits.size;
      }

      if (path === 'supportedModels.mergeBrands') {
        const sources: string[] = Array.isArray(args.sourceNames) ? args.sourceNames : [];
        const target = String(args.targetName || '').trim();
        if (!sources.length || !target) throw new Error('Pick the brands to merge and a target name');
        let moved = 0;
        for (const name of sources) {
          if (name === target) continue;
          const hits = await getDocs(query(collection(db, 'supportedModels'), where('brandName', '==', name)));
          for (let i = 0; i < hits.docs.length; i += 450) {
            const batch = writeBatch(db);
            hits.docs.slice(i, i + 450).forEach((d) => batch.update(d.ref, { brandName: target }));
            await batch.commit();
          }
          moved += hits.size;
        }
        return moved;
      }

      if (path === 'modelRequests.approveModelRequests') {
        const ids: string[] = Array.isArray(args.requestIds) ? args.requestIds : [];
        let successCount = 0;
        const errors: string[] = [];
        for (const id of ids) {
          try {
            const rsnap = await getDoc(doc(db, 'modelRequests', id));
            if (!rsnap.exists()) throw new Error('request not found');
            const r: any = rsnap.data();
            const brandName = String(r.brandName || r.brand || '').trim();
            const modelName = String(r.modelName || r.model || '').trim();
            if (!brandName || !modelName) throw new Error('request has no brand or model');

            // Approving the same model twice would put a duplicate in the
            // picker, so an existing row just gets reactivated.
            const existing = await getDocs(query(
              collection(db, 'supportedModels'),
              where('brandName', '==', brandName),
              where('modelName', '==', modelName),
              limit(1)
            ));
            if (existing.empty) {
              // Without a category the model never appears in a picker, which
              // filters by it; _creationTime lets the storefront see it before
              // the next build.
              const category = String(r.category || '').trim() || undefined;
              let gadgetTypeId: string | undefined;
              if (category) {
                const g = await getDocs(query(collection(db, 'gadgetTypes'), where('name', '==', category), limit(1)));
                gadgetTypeId = g.empty ? undefined : g.docs[0].id;
              }
              await addDoc(collection(db, 'supportedModels'), {
                brandName, modelName, isActive: true, createdAt: Date.now(), _creationTime: Date.now(),
                ...(category ? { category } : {}),
                ...(gadgetTypeId ? { gadgetTypeId } : {}),
              });
            } else {
              await updateDoc(existing.docs[0].ref, { isActive: true });
            }
            await updateDoc(rsnap.ref, { status: 'approved', approvedAt: Date.now() });
            successCount++;
          } catch (e: any) {
            errors.push(`${id}: ${e?.message || 'failed'}`);
          }
        }
        return { success: errors.length === 0, successCount, errors };
      }

      if (path === 'modelRequests.rejectModelRequest') {
        if (!args.requestId) throw new Error('Missing requestId');
        await updateDoc(doc(db, 'modelRequests', args.requestId), {
          status: 'rejected',
          rejectedAt: Date.now(),
          ...(args.reason ? { rejectionReason: String(args.reason) } : {}),
        });
        return { success: true };
      }

      if (path === 'rollsManagement.syncInventoryFromRolls') {
        /*
         * Counts what the shelf can make and writes it onto the variants —
         * one design, or every design there is.
         *
         * "Every" now includes the cutouts. It read the rolls alone, so a
         * precut design's listings were never in a sweep at all and could sit
         * at zero however often this was run.
         */
        const codes: string[] = [];
        if (args.syncAll) {
          const [rolls, cutouts] = await Promise.all([
            getDocs(collection(db, 'rollInventory')),
            getDocs(collection(db, 'cutoutInventory')),
          ]);
          rolls.docs.forEach((d) => { const r: any = d.data(); if (r.rNumber) codes.push(String(r.rNumber)); });
          cutouts.docs.forEach((d) => { const c: any = d.data(); if (c.cutoutNumber) codes.push(String(c.cutoutNumber)); });
        } else if (args.rNumber) {
          codes.push(String(args.rNumber));
        }
        if (!codes.length) throw new Error('Nothing to sync');
        const fn = httpsCallable(functions, 'recalcMaterialStock');
        let syncedCount = 0;
        /*
         * Codes go together, not in small batches. One call reads the variants
         * and the products once and then answers for every code it was given,
         * so splitting 70 codes into batches of 25 read the whole catalogue
         * three times to do the work of one pass. The batch is large enough to
         * be one call in practice and small enough to stay a sane payload.
         */
        for (let i = 0; i < codes.length; i += 400) {
          const res: any = await fn({ codes: codes.slice(i, i + 400) });
          syncedCount += Number(res?.data?.updated) || 0;
        }
        return { success: true, syncedCount, designs: codes.length };
      }

      if (path === 'mockups.bulkImportMockups') {
        const rows: any[] = Array.isArray(args.mockups) ? args.mockups : [];
        let imported = 0, updated = 0, skipped = 0;
        for (const row of rows) {
          const sku = String(row?.sku || '').trim();
          const model = String(row?.model || '').trim();
          if (!sku || !model) { skipped++; continue; }
          const existing = await getDocs(query(
            collection(db, 'mockups'),
            where('sku', '==', sku),
            where('model', '==', model),
            limit(1)
          ));
          const payload = {
            brand: String(row?.brand || ''),
            model, sku,
            fileId: String(row?.fileId || ''),
            updatedAt: Date.now(),
          };
          if (existing.empty) { await addDoc(collection(db, 'mockups'), { ...payload, createdAt: Date.now() }); imported++; }
          else { await updateDoc(existing.docs[0].ref, payload); updated++; }
        }
        return { success: true, imported, updated, skipped };
      }

      if (path === 'mockups.clearAllMockups') {
        const all = await getDocs(collection(db, 'mockups'));
        for (let i = 0; i < all.docs.length; i += 450) {
          const batch = writeBatch(db);
          all.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        return { success: true, deleted: all.size };
      }

      if (path === 'uploadJobs.pauseUploadJob' || path === 'uploadJobs.resumeUploadJob' || path === 'uploadJobs.cancelUploadJob') {
        if (!args.jobId) throw new Error('Missing jobId');
        const status = path.endsWith('pauseUploadJob') ? 'paused'
          : path.endsWith('resumeUploadJob') ? 'running' : 'cancelled';
        await updateDoc(doc(db, 'uploadJobs', args.jobId), { status, updatedAt: Date.now() });
        return { success: true, status };
      }

      if (path === 'googleDriveImportPublic.pauseImportJob' || path === 'googleDriveImportPublic.resumeImportJob' || path === 'googleDriveImportPublic.cancelImportJob') {
        if (!args.jobId) throw new Error('Missing jobId');
        const status = path.endsWith('pauseImportJob') ? 'paused'
          : path.endsWith('resumeImportJob') ? 'running' : 'cancelled';
        await updateDoc(doc(db, 'googleDriveImportJobs', args.jobId), { status, updatedAt: Date.now() });
        return { success: true, status };
      }

      if (path === 'whatsapp.syncTemplateLinks') {
        // A usecase points at a template by name; an approved template that no
        // usecase names is what silently stops a message going out.
        const [ucs, tpls] = await Promise.all([
          getDocs(collection(db, 'whatsappUsecases')),
          getDocs(collection(db, 'whatsappTemplates')),
        ]);
        const byName = new Map<string, any>();
        tpls.docs.forEach((d) => { const t: any = d.data(); if (t.templateName) byName.set(String(t.templateName), { id: d.id, ...t }); });
        let linked = 0;
        const orphans: string[] = [];
        for (const d of ucs.docs) {
          const u: any = d.data();
          const t = u.templateName ? byName.get(String(u.templateName)) : null;
          if (!t) { orphans.push(String(u.usecaseKey || d.id)); continue; }
          if (u.templateId !== t.id) { await updateDoc(d.ref, { templateId: t.id, updatedAt: Date.now() }); linked++; }
        }
        return {
          success: orphans.length === 0,
          linked,
          orphans,
          message: orphans.length
            ? `Linked ${linked}. No approved template for: ${orphans.join(', ')}`
            : `Linked ${linked} usecase${linked === 1 ? '' : 's'} to their templates`,
        };
      }

      if (path === 'whatsappAutoFix.enableTransactionalUsecases') {
        // Only the transactional ones. Marketing stays off unless someone
        // deliberately turns it on.
        const TRANSACTIONAL = ['order_received', 'admin_new_order', 'cod_otp_verification', 'order_dispatched', 'order_delivered'];
        const ucs = await getDocs(collection(db, 'whatsappUsecases'));
        let enabled = 0;
        const batch = writeBatch(db);
        ucs.docs.forEach((d) => {
          const u: any = d.data();
          if (TRANSACTIONAL.includes(String(u.usecaseKey)) && u.enabled !== true) {
            batch.update(d.ref, { enabled: true, updatedAt: Date.now() });
            enabled++;
          }
        });
        if (enabled) await batch.commit();
        return { success: true, enabled, message: `Enabled ${enabled} transactional usecase${enabled === 1 ? '' : 's'}` };
      }

      // ---------------------------------------------------------------------
      // Catalogue maintenance.
      //
      // These were written off as spent migrations, but the data says
      // otherwise: every gadget and finish count had drifted from the truth
      // (phone stored 438 against 480 actual), 223 products carry no
      // gadgetCategory and 201 no finishTypeId. They are recurring repairs, so
      // each one is idempotent and safe to press twice.
      // ---------------------------------------------------------------------

      /** Everything these repairs need, read once. */
      const loadCatalogue = async () => {
        const [products, gadgetTypes, finishTypes] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'gadgetTypes')),
          getDocs(collection(db, 'finishTypes')),
        ]);
        return { products, gadgetTypes, finishTypes };
      };

      const commitAll = async (writes: Array<{ ref: any; data: any }>) => {
        for (let i = 0; i < writes.length; i += 450) {
          const batch = writeBatch(db);
          writes.slice(i, i + 450).forEach((w) => batch.update(w.ref, w.data));
          await batch.commit();
        }
      };

      if (path === 'gadgetTypes.recalculateProductCounts' || path === 'finishTypes.recalculateAllCounts') {
        const isGadget = path.startsWith('gadgetTypes');
        const { products, gadgetTypes, finishTypes } = await loadCatalogue();
        const types = isGadget ? gadgetTypes : finishTypes;
        const field = isGadget ? 'gadgetTypeId' : 'finishTypeId';

        const counts = new Map<string, number>();
        products.docs.forEach((d) => {
          const id = (d.data() as any)[field];
          if (id) counts.set(id, (counts.get(id) || 0) + 1);
        });

        const writes = types.docs
          .filter((d) => Number((d.data() as any).productCount || 0) !== (counts.get(d.id) || 0))
          .map((d) => ({ ref: d.ref, data: { productCount: counts.get(d.id) || 0 } }));
        await commitAll(writes);
        return {
          success: true,
          updated: writes.length,
          message: writes.length
            ? `Recounted ${writes.length} of ${types.size} ${isGadget ? 'gadget' : 'finish'} types`
            : 'All counts already correct',
        };
      }

      if (path === 'gadgetTypes.migrateProductGadgetTypes' || path === 'productClassification.applyAutoClassification') {
        const { products, gadgetTypes, finishTypes } = await loadCatalogue();
        const gadgetByName = new Map<string, string>();
        gadgetTypes.docs.forEach((d) => gadgetByName.set(String((d.data() as any).name || '').toLowerCase(), d.id));
        const gadgetNameById = new Map<string, string>();
        gadgetTypes.docs.forEach((d) => gadgetNameById.set(d.id, String((d.data() as any).name || '')));
        const finishByName = new Map<string, string>();
        finishTypes.docs.forEach((d) => finishByName.set(String((d.data() as any).name || '').toLowerCase(), d.id));

        // Title wording is the last resort, and only where the field is blank —
        // nothing already set is ever overwritten.
        const guessGadget = (title: string): string | null => {
          const t = title.toLowerCase();
          for (const [needle, name] of [
            ['laptop', 'laptop'], ['macbook', 'laptop'], ['mac mini', 'mac-mini'], ['ipad', 'tablet'],
            ['tablet', 'tablet'], ['lens', 'lens'], ['camera', 'camera'], ['drone', 'drone'],
            ['controller', 'controller'], ['play station', 'console'], ['playstation', 'console'],
            ['ps5', 'console'], ['xbox', 'console'], ['charger', 'charger'], ['gimbal', 'gimbals'],
            ['phone', 'phone'],
          ] as Array<[string, string]>) {
            if (t.includes(needle)) return gadgetByName.get(name) || null;
          }
          return null;
        };
        const guessFinish = (title: string, finishType?: string): string | null => {
          const t = `${finishType || ''} ${title}`.toLowerCase();
          if (/tranz|transparent|membrane/.test(t)) return finishByName.get('transparent') || null;
          if (/3d|emboss|textur/.test(t)) return finishByName.get('embossed') || null;
          if (/matte/.test(t)) return finishByName.get('matte') || null;
          return null;
        };

        const writes: Array<{ ref: any; data: any }> = [];
        products.docs.forEach((d) => {
          const p: any = d.data();
          const patch: any = {};
          const gadgetTypeId = p.gadgetTypeId || (p.gadgetCategory ? gadgetByName.get(String(p.gadgetCategory).toLowerCase()) : null) || guessGadget(String(p.title || ''));
          if (!p.gadgetTypeId && gadgetTypeId) patch.gadgetTypeId = gadgetTypeId;
          // gadgetCategory is the denormalised name; derive it from the id.
          const name = gadgetNameById.get(gadgetTypeId || p.gadgetTypeId);
          if (!p.gadgetCategory && name) patch.gadgetCategory = name;
          if (!p.finishTypeId) {
            const f = guessFinish(String(p.title || ''), p.finishType);
            if (f) patch.finishTypeId = f;
          }
          if (Object.keys(patch).length) writes.push({ ref: d.ref, data: patch });
        });
        await commitAll(writes);
        return {
          success: true,
          classified: writes.length,
          updated: writes.length,
          message: writes.length
            ? `Filled missing fields on ${writes.length} product${writes.length === 1 ? '' : 's'}`
            : 'Every product is already classified',
        };
      }

      if (path === 'migrateProductCategory.migrateProductsToProductCategory') {
        const products = await getDocs(collection(db, 'products'));
        const writes = products.docs
          .filter((d) => !(d.data() as any).productCategory)
          .map((d) => ({ ref: d.ref, data: { productCategory: 'skin' } }));
        await commitAll(writes);
        return {
          success: true,
          updated: writes.length,
          message: writes.length ? `Set a product category on ${writes.length} product(s)` : 'Every product already has a category',
        };
      }

      if (path === 'migrateModelsToGadgetTypes.migrateModelsToGadgetTypes') {
        const [models, gadgetTypes] = await Promise.all([
          getDocs(collection(db, 'supportedModels')),
          getDocs(collection(db, 'gadgetTypes')),
        ]);
        const phoneId = gadgetTypes.docs.find((d) => String((d.data() as any).name).toLowerCase() === 'phone')?.id;
        if (!phoneId) throw new Error('No "phone" gadget type to assign');
        const writes = models.docs
          .filter((d) => !(d.data() as any).gadgetTypeId)
          .map((d) => ({ ref: d.ref, data: { gadgetTypeId: phoneId } }));
        await commitAll(writes);
        return {
          success: true,
          updated: writes.length,
          message: writes.length ? `Linked ${writes.length} model(s) to a gadget type` : 'Every model is already linked',
        };
      }

      if (path === 'gadgetTypes.seed' || path === 'finishTypes.seedInitialFinishTypes' || path === 'productCategories.seedDefaults') {
        // Idempotent: an existing row is left exactly as it is, so pressing
        // these cannot disturb a catalogue that is already set up.
        const spec = path === 'gadgetTypes.seed'
          ? { col: 'gadgetTypes', key: 'name', rows: [
              ['phone','Phone'],['laptop','Laptop'],['tablet','Tablet'],['camera','Camera'],['lens','Lens'],
              ['console','Console'],['controller','Controller'],['drone','Drone'],['charger','Charger'],
              ['mac-mini','Mac Mini'],['gimbals','Gimbals'],['accessory','Accessory'],
            ] }
          : path === 'finishTypes.seedInitialFinishTypes'
          ? { col: 'finishTypes', key: 'name', rows: [
              ['matte','Matte'],['embossed','3D (Embossed)'],['transparent','Transparent'],
              ['protectors','Protectors/Membranes'],['premium-leather','Premium Leather'],
            ] }
          : { col: 'productCategoriesConfig', key: 'name', rows: [
              ['Skins','Skins'],['Cases & Covers','Cases & Covers'],['Screen Protectors','Screen Protectors'],
              ['Camera Rings','Camera Rings'],['Magneto X','Magneto X'],['Accessories','Accessories'],
            ] };

        const existing = await getDocs(collection(db, spec.col));
        const have = new Set(existing.docs.map((d) => String((d.data() as any)[spec.key] || '').toLowerCase()));
        let added = 0;
        for (const [name, displayName] of spec.rows) {
          if (have.has(name.toLowerCase())) continue;
          await addDoc(collection(db, spec.col), {
            [spec.key]: name, displayName, isActive: true, productCount: 0, createdAt: Date.now(),
          });
          added++;
        }
        return {
          success: true,
          added,
          message: added ? `Added ${added} missing row(s)` : 'Everything is already present — nothing added',
        };
      }

      if (path === 'aiMockups.saveTemplate') {
        const { id, ...rest } = args || {};
        if (!id) throw new Error('Missing template id');
        const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
        await setDoc(doc(db, 'gadgetMockupSettings', String(id)), { ...clean, kind: 'template', updatedAt: Date.now() }, { merge: true });
        return id;
      }

      if (path === 'aiMockups.updateMockupSettings') {
        await setDoc(doc(db, 'gadgetMockupSettings', 'default'), { ...args, updatedAt: Date.now() }, { merge: true });
        return 'default';
      }

      if (path === 'settings.updateSetting') {
        await setDoc(doc(db, 'settings', args.key), { ...args, updatedAt: Date.now() }, { merge: true });
        return args.key;
      }

      // Listings are built server-side, where the OpenAI key lives. The name
      // contains "create", so without this the generic writer below would put a
      // junk document into a `listings` collection that does not exist.
      if (collectionName === 'listings') {
        const fn = httpsCallable(functions, actionName);
        const res: any = await fn(args);
        return res.data;
      }

      let targetCollection = collectionName;
      // These namespaces cover more than one collection, so the target depends on
      // the action rather than the namespace.
      const byAction = actionName.toLowerCase();
      if (byAction.includes('rollinventory')) targetCollection = 'rollInventory';
      else if (byAction.includes('cutoutinventory')) targetCollection = 'cutoutInventory';
      else if (byAction.includes('mockupprompt')) targetCollection = 'gadgetMockupPrompts';
      else if (byAction.includes('designmockup')) targetCollection = 'designMockups';
      else if (byAction.includes('gadgetconsumption')) targetCollection = 'gadgetConsumption';
      else if (byAction.includes('suggestedproducts')) targetCollection = 'suggestedProductsConfig';
      else if (byAction.includes('trendingproducts')) targetCollection = 'trendingProductsConfig';
      else if (byAction.includes('sectioncontent')) targetCollection = 'productSectionContent';
      else if (collectionName === 'cashback') targetCollection = 'cashbackRules';
      else if (collectionName === 'whatsapp' && byAction.includes('template')) targetCollection = 'whatsappTemplates';
      else if (actionName.toLowerCase().includes('heroslide')) targetCollection = 'heroSlides';
      else if (actionName.toLowerCase().includes('featurebanner')) targetCollection = 'featureBanners';
      else if (actionName.toLowerCase().includes('ugcvideo')) targetCollection = 'ugcVideos';
      else if (actionName === 'updateHomepageSettings') targetCollection = 'homepageSettings';
      else if (actionName.toLowerCase().includes('homepagesection')) targetCollection = 'homepageSections';
      else if (collectionName === 'admin') targetCollection = path.split('.')[1];

      // These two were written inside the `includes('update') || includes('edit')`
      // block below, and neither name contains either word — so they were
      // unreachable, fell through to the callable fallback, and failed with
      // "internal" because no such Cloud Function exists. That is why the
      // WhatsApp provider settings would not save and whatsappSettings/provider
      // never existed.
      if (actionName === 'saveWhatsAppProviderSettings' || actionName === 'saveAdminNotificationSettings') {
        const docId = actionName === 'saveWhatsAppProviderSettings' ? 'provider' : 'adminNotifications';
        // Firestore rejects undefined, and these forms send it for every field
        // the admin left blank.
        const clean: any = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));

        // The auth key never lands in Firestore.
        //
        // The worker sends with process.env.WHATSAPP_AUTHKEY and has never read
        // this document, so storing the secret here bought nothing — while
        // costing a plaintext copy in the database, in the Firebase console,
        // and back down the wire into every admin's browser, where the dialog
        // refilled the input with it. Only a hint is kept, enough for the UI to
        // say a key is set.
        if ('authKey' in clean) {
          const key = String(clean.authKey || '');
          delete clean.authKey;
          if (key) {
            clean.authKeyHint = `••••${key.slice(-4)}`;
            clean.authKeySetAt = Date.now();
          }
        }
        // Any plaintext key written before this change goes now.
        await setDoc(doc(db, 'whatsappSettings', docId), {
          ...clean,
          ...(docId === 'provider' ? { authKey: deleteField() } : {}),
          lastUpdatedAt: Date.now(),
        }, { merge: true });
        return docId;
      }

      // Generic add/update
      if (actionName.includes('create') || actionName.includes('add') || actionName.includes('insert')) {
        const clean: Record<string, unknown> = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
        // The storefront finds products added since its last build by this.
        if (clean._creationTime === undefined) clean._creationTime = Date.now();
        const docRef = await addDoc(collection(db, targetCollection), clean);
        return docRef.id;
      }
      
      if (actionName.includes('update') || actionName.includes('edit')) {
        if (actionName === 'updateHomepageSettings') {
          await setDoc(doc(db, targetCollection, 'default'), args, { merge: true });
          return 'default';
        }
        
        if (actionName === 'updateUsecase') {
          // find doc by usecaseKey
          const q = query(collection(db, 'whatsappUsecases'), where('usecaseKey', '==', args.usecaseKey), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'whatsappUsecases', snap.docs[0].id), args);
            return snap.docs[0].id;
          }
          throw new Error("Usecase not found");
        }

        if (actionName === 'redeemWalletCreditCoupon') {
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const user = auth.currentUser;
          if (!user) throw new Error("Must be logged in");
          
          if (!args.code) throw new Error("Code required");
          
          // Mock coupon redemption logic for wallet credit
          const code = args.code.toUpperCase();
          if (code === 'WELCOME50' || code === 'SKINLY50') {
            const amount = 50;
            const userDoc = await getDoc(doc(db, 'users', await resolveUserDocId(user)));
            const currentBalance = userDoc.exists() ? (userDoc.data().walletBalance || 0) : 0;
            
            // Log transaction
            await addDoc(collection(db, 'walletTransactions'), {
              userId: user.uid,
              amount: amount,
              type: 'credit',
              source: 'coupon_credit',
              status: 'completed',
              description: `Redeemed coupon ${code}`,
              metadata: { code }
            });
            
            // Update balance
            await updateDoc(doc(db, 'users', await resolveUserDocId(user)), { walletBalance: currentBalance + amount });
            return { success: true, message: "Coupon redeemed successfully", creditAmount: amount };
          }
          
          throw new Error("Invalid or expired coupon code");
        }

        // Which argument holds the document's own id depends on the collection:
        // sectionId is the card's parent, but the section's own id. Resolve by
        // collection first so a parent reference is never mistaken for the target.
        const OWN_ID_BY_COLLECTION: Record<string, string> = {
          products: 'productId',
          variants: 'variantId',
          coupons: 'couponId',
          orders: 'orderId',
          collections: 'collectionId',
          homepageSections: 'sectionId',
          homepageSectionCards: 'cardId',
          heroSlides: 'slideId',
          gadgetMockupPrompts: 'promptId',
          designMockups: 'mockupId',
          featureBanners: 'bannerId',
          ugcVideos: 'videoId',
          seoPages: 'pageId',
          seoTemplates: 'templateId',
          variantConsumptionPresets: 'presetId',
        };
        const FALLBACK_ID_KEYS = [
          'id', 'promptId', 'mockupId', 'cardId', 'ruleId', 'bugReportId', 'requestId', 'reviewId', 'slideId', 'bannerId', 'videoId', 'productId',
          'variantId', 'couponId', 'orderId', 'pageId', 'templateId', 'presetId',
          'usecaseId', 'jobId', 'mockupId', 'modelId', 'categoryId',
        ];

        const preferred = OWN_ID_BY_COLLECTION[targetCollection];
        const idKey = (preferred && args[preferred]) ? preferred : FALLBACK_ID_KEYS.find(k => args[k]);
        if (!idKey) throw new Error(`ID required for update (${actionName})`);
        const targetId = args[idKey];

        // Strip only the id being written to — every other key is real data, and
        // Firestore rejects undefined, which these payloads use for cleared fields.
        //
        // The strip has to go all the way down. A product's images arrive as
        // `{ url, alt }` and `alt` is undefined on anything uploaded without one,
        // which Firestore rejects from inside the array with an error naming the
        // document but not the field.
        const data = Object.fromEntries(
          Object.entries(args)
            .filter(([k, v]) => k !== idKey && v !== undefined)
            .map(([k, v]) => [k, stripUndefinedDeep(v)])
        );

        await updateDoc(doc(db, targetCollection, targetId), data);
        return targetId;
      }
      
      if (actionName === 'bulkDisableCoupons') {
          const BATCH_SIZE = 450;
          for (let i = 0; i < args.couponIds.length; i += BATCH_SIZE) {
            const chunk = args.couponIds.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach((id: string) => {
              if (id) batch.set(doc(db, 'coupons', id), { isActive: false }, { merge: true });
            });
            await batch.commit();
          }
          return { success: true };
        }

        if (actionName === 'bulkReorderSections') {
          const batch = writeBatch(db);
          args.sectionOrders.forEach((so: any) => {
            batch.update(doc(db, 'homepageSections', so.sectionId), { order: so.order });
          });
          await batch.commit();
          return { success: true };
        }

        if (actionName === 'bulkReorderSectionCards') {
          const batch = writeBatch(db);
          args.cardOrders.forEach((co: any) => {
            batch.update(doc(db, 'homepageSectionCards', co.cardId), { order: co.order });
          });
          await batch.commit();
          return { success: true };
        }

        const actionNameLower = actionName.toLowerCase();
        if (actionNameLower.includes('delete') || actionNameLower.includes('remove')) {
          const bulkIds = args.couponIds || args.ids || args.pageIds || args.productIds;
          if (bulkIds && Array.isArray(bulkIds)) {
            const BATCH_SIZE = 450;
            for (let i = 0; i < bulkIds.length; i += BATCH_SIZE) {
              const chunk = bulkIds.slice(i, i + BATCH_SIZE);
              const batch = writeBatch(db);
              chunk.forEach((id: string) => {
                if (id) batch.delete(doc(db, collectionName, id));
              });
              await batch.commit();
            }
            return { success: true };
          }

          /*
           * Find the id rather than recognising its name.
           *
           * This was a hardcoded list — id, couponId, ruleId, pageId, slideId,
           * bannerId, videoId, reviewId, promptId, mockupId — and every caller
           * naming its argument anything else got "ID required for delete" and
           * a toast saying the thing failed. `productId` was the one that bit;
           * variantId, cardId, templateId, presetId, modelId, collectionId and
           * jobId are all names in use that the list never knew either.
           *
           * So: take the known names first, and otherwise accept a single
           * `*Id` argument. Two of them is genuinely ambiguous and says so
           * instead of silently deleting whichever the list happened to reach.
           */
          const named = args.id || args.couponId || args.ruleId || args.pageId || args.slideId || args.bannerId || args.videoId || args.reviewId || args.promptId || args.mockupId;
          let targetId = named;
          if (!targetId) {
            const idish = Object.entries(args || {}).filter(
              ([k, v]) => /id$/i.test(k) && typeof v === 'string' && v,
            );
            if (idish.length === 1) targetId = idish[0][1] as string;
            else if (idish.length > 1) {
              throw new Error(
                `Ambiguous delete (${actionName}): ${idish.map(([k]) => k).join(', ')}`,
              );
            }
          }
          if (!targetId) throw new Error(`ID required for delete (${actionName})`);
          await deleteDoc(doc(db, targetCollection, targetId));
          return targetId;
        }
      
      if (collectionName === 'reviews' && actionName === 'addReview') {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) throw new Error('Must be logged in to post a review');
        const reviewDoc = await addDoc(collection(db, 'reviews'), {
          ...args,
          userId: user.uid,
          verified: false,
          createdAt: Date.now(),
        });
        return reviewDoc.id;
      }

      // Default: try calling a cloud function
      console.log(`Unmapped action ${actionName}, trying cloud function...`);
      const callable = httpsCallable(functions, actionName);
      const result = await callable(args);
      return result.data;
      
    } catch (err) {
      console.error(`Mutation error in ${path}:`, err);
      throw err;
    }
  }, [path]);
}

export function useAction(apiRef: any) {
  const path = getPath(apiRef);

  return useCallback(async (args?: any) => {
    console.log(`Action called for ${path} with args:`, args);
    const collectionName = path.split('.')[0];
    const actionName = path.split('.').pop() || 'defaultAction';
    
    // Check for mocked actions first
    if (collectionName === 'phonepe' && actionName === 'initiatePayment') {
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocal) {
        console.log("Mocking PhonePe payment initiation for:", args);
        return {
          success: true,
          merchantTransactionId: `MTXN-${Date.now()}`,
          paymentUrl: `http://localhost:5175/mock-payment?orderId=${args.orderId}&amount=${args.amount}`
        };
      }
      const callable = httpsCallable(functions, 'initiatePayment');
      const res: any = await callable(args);
      return res.data;
    }
    
    if (collectionName === 'phonepe' && actionName === 'checkPaymentStatus') {
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocal) {
        return {
          success: true,
          paymentStatus: 'success',
          transactionId: args.merchantTransactionId
        };
      }
      const callable = httpsCallable(functions, 'checkPaymentStatus');
      const res: any = await callable(args);
      return res.data;
    }
    
    if (collectionName === 'phoneCollections' && actionName === 'runPhoneCollectionsMigration') {
      return { collectionsCreated: 0, productsAssigned: 0, errors: [] };
    }
    
    if (collectionName === 'migrateVariantPresetsAutoAssign' && actionName === 'autoAssignPresets') {
      return { success: true, matched: 0, unmatched: 0, skipped: 0, statusBreakdown: { active: 0, draft: 0, archived: 0 }, unmatchedVariants: [] };
    }

    // Intercept R2 uploads to use presigned URLs directly from the client
    // This avoids sending huge base64 payloads through Firebase Functions
    if ((collectionName === 'r2' && actionName === 'uploadToR2') || 
        (collectionName === 'mediaLibrary' && actionName === 'uploadAndAddToLibrary')) {
      try {
        console.log(`Intercepting ${actionName} locally...`);
        const callable = httpsCallable(functions, 'generateUploadUrl');
        
        // Handle mediaLibrary specific payload structure
        const fileBase64 = args.fileBase64 || args.imageBase64;
        let r2Key = args.key;
        
        if (!r2Key && args.filename) {
          const sanitizedFilename = args.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
          const folder = args.folder || "general";
          r2Key = `${folder}/${sanitizedFilename}_${Date.now()}`;
        }

        // Every R2 upload in the app funnels through here, so this is the one
        // place worth compressing at. Callers used to pick the extension and the
        // Content-Type themselves and several of them simply hardcoded `.webp`
        // — the homepage banners were 2 MB PNGs wearing WebP filenames. The
        // normaliser re-encodes what it can and, either way, returns a type and
        // extension that actually describe the bytes.
        const declaredContentType =
          args.contentType || (args.mediaType === 'video' ? 'video/mp4' : undefined);
        const normalized = await normalizeImageForUpload(fileBase64, declaredContentType);
        const contentType = normalized.contentType;
        if (normalized.extension) r2Key = withExtension(r2Key, normalized.extension);

        if (normalized.converted) {
          console.log(
            `Converted upload to WebP: ${(normalized.originalSize / 1024).toFixed(0)}KB -> ` +
            `${(normalized.bytes.byteLength / 1024).toFixed(0)}KB (${normalized.width}x${normalized.height})`
          );
        }
        
        const res: any = await callable({
          fileName: r2Key,
          contentType: contentType
        });
        
        if (res.data && res.data.success) {
          const blob = new Blob([normalized.bytes as BlobPart], { type: contentType });
          
          // Upload directly to R2 using the presigned URL
          // Make sure not to send any extra headers that aren't signed
          const uploadRes = await fetch(res.data.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': contentType
            }
          });
          
          if (uploadRes.ok) {
            // Add a fallback URL computation in case Cloud Function doesn't return publicUrl
            const finalPublicUrl = res.data.publicUrl || `https://cdn.goskinly.com/${r2Key}`;

            // If it's a media library upload, save the document to Firestore
            if (collectionName === 'mediaLibrary') {
              try {
                const { getFirestore, collection, addDoc } = await import('firebase/firestore');
                const { getAuth } = await import('firebase/auth');
                const db = getFirestore();
                const auth = getAuth();
                
                
                await addDoc(collection(db, 'mediaLibrary'), {
                  cloudinaryUrl: finalPublicUrl, // Use the computed fallback URL
                  cloudinaryPublicId: r2Key,
                  filename: args.filename || r2Key.split('/').pop(),
                  folder: args.folder || "general",
                  mediaType: args.mediaType || "image",
                  format: normalized.extension,
                  width: normalized.width,
                  height: normalized.height,
                  bytes: normalized.bytes.byteLength,
                  tags: args.tags || [],
                  uploadedBy: auth.currentUser?.email || "system",
                  createdAt: Date.now()
                });
              } catch (e: any) {
                console.error("Failed to save media record to Firestore:", e);
                // If it's a blocked by client error (ad blocker), alert the user
                if (e.message?.includes('Failed to fetch') || e.name === 'FirebaseError') {
                  console.warn("Firestore write blocked by client (likely an ad blocker). Media uploaded to R2 but not saved to library.");
                }
              }
            }
            
            return {
              success: true,
              url: finalPublicUrl,
              publicUrl: finalPublicUrl, // Keep both for compatibility
              cloudinaryUrl: finalPublicUrl, // For media library compatibility
              publicId: r2Key, // For media library compatibility
              key: r2Key,
              bucket: 'skinly'
            };
          } else {
            return { success: false, error: 'Failed to upload to R2 via presigned URL' };
          }
        }
        return { success: false, error: res.data?.error || 'Failed to generate upload URL' };
      } catch (err: any) {
        console.error("R2 Upload error:", err);
        return { success: false, error: err.message };
      }
    }
    
    // Intercept media library deletion
    if (collectionName === 'mediaLibrary' && (actionName === 'deleteMedia' || actionName === 'bulkDeleteMedia')) {
      try {
        const { getFirestore, doc, deleteDoc } = await import('firebase/firestore');
        const db = getFirestore();
        
        if (actionName === 'deleteMedia') {
          await deleteDoc(doc(db, 'mediaLibrary', args.id));
          return { success: true };
        } else {
          const promises = args.ids.map((id: string) => deleteDoc(doc(db, 'mediaLibrary', id)));
          await Promise.all(promises);
          return { success: true, deletedCount: args.ids.length };
        }
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    // ── Shared: call OpenAI directly (avoids CF auth issues) ──
    // ── Shared: ask the server to call OpenAI ──
    //
    // This used to read the key out of Firestore and call api.openai.com from
    // the browser, with a comment saying it "avoids CF auth issues". The key it
    // read sat in `settings`, which is world-readable by rule, so the secret was
    // downloadable by anyone — and then shipped in an Authorization header from
    // every admin's browser. The Cloud Function holds the key instead, where
    // nothing can read it back out.
    const callOpenAIForSEO = async (payload: {
      pageType: string; keywords: string[]; brandName?: string;
      deviceCategory?: string; productType?: string; designType?: string; notes?: string;
    }): Promise<{ success: boolean; contentHTML: string; faqs: any[]; imageAltTexts: string[]; error?: string }> => {
      try {
        const fn = httpsCallable(functions, 'generateSEOContent');
        const res: any = await fn(payload);
        const d = res?.data || {};
        return {
          success: d.success !== false,
          contentHTML: d.contentHTML || '',
          faqs: d.faqs || [],
          imageAltTexts: d.imageAltTexts || [],
        };
      } catch (err: any) {
        return {
          success: false, contentHTML: '', faqs: [], imageAltTexts: [],
          error: err?.message || 'SEO generation failed',
        };
      }
    };

    if (collectionName === 'seoContentGenerator' && actionName === 'generateSEOContent') {
      return await callOpenAIForSEO(args);
    }

    // seoProductGenerator — also uses callOpenAIForSEO (no CF)
    if (collectionName === 'seoProductGenerator') {
      /*
       * A product's meta title and description, from the product itself.
       *
       * These used to be lifted from the generated landing-page copy: the first
       * <h2> and first <p>. For a product the prompt's keyword is
       * "<gadget> Skins", so every phone product would have been titled "Best
       * phone Skins in India — Starting ₹149" — one title across the catalogue
       * — with a description promising free delivery everywhere.
       */
      const GADGET_WORD: Record<string, string> = {
        phone: 'phone', laptop: 'laptop', tablet: 'tablet', camera: 'camera', lens: 'lens',
        drone: 'drone', charger: 'charger', console: 'console', controller: 'controller',
        gimbals: 'gimbal', 'mac-mini': 'Mac mini',
      };
      const FINISH_WORD: Record<string, string> = {
        matte: 'Matte', embossed: '3D textured', transparent: 'Transparent', 'premium-leather': 'Leather',
      };
      const fit = (text: string, max: number) =>
        text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
      const buildProductMeta = async (productId: string | undefined, p: any) => {
        const title = String(p.title || p.name || 'Skin').replace(/\s+/g, ' ').trim();
        let price = 0;
        if (productId) {
          const vs = await getDocs(query(collection(db, 'variants'), where('productId', '==', productId)));
          const prices = vs.docs.map(d => Number((d.data() as any).price)).filter(n => n > 0);
          if (prices.length) price = Math.min(...prices);
        }
        const isSkin = p.productCategory ? p.productCategory === 'skin' : !!(p.finishType || p.finishTypeId);
        const suffix = isSkin ? ' – Custom Cut | GoSkinly' : ' | GoSkinly';
        const metaTitle = (title + suffix).length <= 60 ? title + suffix : fit(title, 60 - ' | GoSkinly'.length) + ' | GoSkinly';
        const gadget = GADGET_WORD[p.gadgetCategory] || 'device';
        const finish = FINISH_WORD[p.finishType];
        const from = price ? ` from ₹${price}` : '';
        const metaDescription = fit(
          isSkin
            ? `${title}, printed and cut for your exact ${gadget} model.${finish ? ` ${finish} finish` : ''}${from}. Free shipping above ₹499.`
            : `${title}${from}. Ships across India; free shipping above ₹499.`,
          160,
        );
        return { metaTitle, metaDescription };
      };
      const extractSEOFields = (data: any, title: string) => {
        const h2Match = data.contentHTML?.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const metaTitle = (h2Match?.[1]?.replace(/<[^>]*>/g, '') || `${title} Skin | GoSkinly`).substring(0, 60);
        const pMatch = data.contentHTML?.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const metaDescription = (pMatch?.[1]?.replace(/<[^>]*>/g, '') || `${title} at GoSkinly. Free shipping above ₹499.`).substring(0, 160);
        const tags: string[] = (data.imageAltTexts || [])
          .slice(0, 8)
          .map((t: string) => t.split(' ').filter((w: string) => w.length > 3).slice(0, 3).join(' '))
          .filter(Boolean);
        return { metaTitle, metaDescription, tags, description: data.contentHTML || '' };
      };

      if (actionName === 'generateProductSEO') {
        const productSnap = await getDoc(doc(db, 'products', args.productId));
        if (!productSnap.exists()) throw new Error('Product not found');
        const product = productSnap.data() as any;
        const title = product.title || product.name || 'Phone Skin';
        const data = await callOpenAIForSEO({ pageType: 'product', keywords: [title], productType: product.gadgetCategory || product.category });
        return { ...extractSEOFields(data, title), ...(await buildProductMeta(args.productId, product)) };
      }

      if (actionName === 'generateSEOFromFormData') {
        const title = args.title || 'Phone Skin';
        const data = await callOpenAIForSEO({ pageType: 'product', keywords: [title], productType: args.gadgetCategory, notes: args.finishType ? `Finish type: ${args.finishType}` : undefined });
        const fields = { ...extractSEOFields(data, title), ...(await buildProductMeta(undefined, args)) };
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const imageAlt = (data.imageAltTexts || [])[0] || `${title} phone skin India`;
        return { ...fields, slug, imageAlt };
      }

      if (actionName === 'bulkGenerateProductSEO') {
        const productIds: string[] = args.productIds || [];
        for (const productId of productIds) {
          const productSnap = await getDoc(doc(db, 'products', productId));
          if (!productSnap.exists()) continue;
          const product = productSnap.data() as any;
          // Meta fields only, so no model call: they are built from the product.
          const { metaTitle, metaDescription } = await buildProductMeta(productId, product);
          await updateDoc(doc(db, 'products', productId), { metaTitle, metaDescription, updatedAt: Date.now() });
        }
        return { success: true };
      }
    }

    // The abandoned-cart page calls these through useAction, which fell
    // through to the default below and asked for Cloud Functions named
    // processAbandonedCarts / sendAbandonedCartReminder / scanAndTrack… —
    // none of which exist — so every button failed without reaching the
    // server. (The mapping that did exist sat in useMutation, which the page
    // never uses.)
    if (collectionName === 'abandonedCartsActions') {
      const name =
        actionName === 'processAbandonedCarts' ? 'runAbandonedCartReminders'
        : actionName === 'sendAbandonedCartReminder' ? 'sendAbandonedCartReminderNow'
        : actionName === 'scanAndTrackAbandonedCarts' ? 'scanAbandonedCarts'
        : actionName;
      const res: any = await httpsCallable(functions, name)(args || {});
      return res.data;
    }

    // Default to calling cloud function
    const callable = httpsCallable(functions, actionName);
    const result = await callable(args);
    return result.data;
  }, [path]);
}

export function Authenticated({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && isSignedIn) return <>{children}</>;
  return null;
}

export function Unauthenticated({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && !isSignedIn) return <>{children}</>;
  return null;
}

export function AuthLoading({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return <>{children}</>;
  return null;
}

export function ConvexProvider({ children }: { children: React.ReactNode, client?: any }) {
  return <>{children}</>;
}


/** Products re-read live on a listing's first load: about two screens of cards. */
const LIVE_FIRST_SCREENS = 48;

export function usePaginatedQuery(apiRef: any, args: any, options: { initialNumItems: number }) {
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [status, setStatus] = useState<"LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted">("LoadingFirstPage");
  const path = getPath(apiRef);

  useEffect(() => {
    if (args === 'skip') return;
    
    const collectionName = path.includes('products') ? 'products' : path.split('.')[0];
    
    /*
     * Args change while a fetch is in flight — on a fresh load of
     * ?gadget=gimbals the first run goes out before the gadget list has
     * resolved, so without `gadgetTypeId`, and a second follows with it. The
     * unfiltered one fetches more variants and lands last, overwriting the
     * right answer with every product. Only the latest run may write.
     */
    let cancelled = false;

    const fetchInitial = async () => {
      readLabel = `paginated:${path}`;
      setStatus("LoadingFirstPage");
      try {
        // Products come from the build's catalogue when there is one (the
        // whole collection was 959 reads per visit); otherwise all active
        // documents, filtered here to avoid composite indexes.
        const fromCatalogue = collectionName === 'products' ? await catalogueProducts() : null;
        if (cancelled) return;
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
        
        if (cancelled) return;
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
        
        if (cancelled) return;
        setResults(data);
        setStatus(filtered.length <= options.initialNumItems ? "Exhausted" : "CanLoadMore");
      } catch (err) {
        console.error(`Error in paginated query ${path}:`, err);
        if (!cancelled) setStatus("Exhausted");
      }
    };
    
    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [path, JSON.stringify(args), options.initialNumItems]);

  const loadMore = useCallback(async (numItems: number) => {
    if (status === 'Exhausted' || status === 'LoadingMore') return;
    
    setStatus("LoadingMore");
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
  }, [path, status, results.length, allMatches]);

  return { results, status, loadMore };
}

export function useConvex() {
  return {
    query: async (apiRef: any, args?: any) => {
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
        const minPurchase = Number(
          coupon.minPurchase ?? coupon.minCartValue ?? coupon.minPurchaseAmount ?? 0
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

        // Same story for the cap: the form writes `maxDiscount`.
        const maxDiscount = Number(coupon.maxDiscount ?? coupon.maxDiscountAmount ?? 0);

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === "percentage") {
          discountAmount = Math.floor(cartTotal * (coupon.discountValue / 100));
          if (maxDiscount > 0) {
            discountAmount = Math.min(discountAmount, maxDiscount);
          }
        } else {
          discountAmount = Math.min(cartTotal, coupon.discountValue);
        }
        
        return {
          coupon: { _id: snap.docs[0].id, ...coupon },
          discountAmount: discountAmount,
          isWalletCredit: coupon.isWalletCredit || false,
          walletCreditAmount: coupon.isWalletCredit ? discountAmount : 0
        };
      }
      
      // One-off order reads for the payment return page. Without these every
      // query here returned null, so its "check our own database" fallback
      // always concluded the order did not exist.
      if (path === 'orders.getOrderPublic') {
        if (!args?.orderId) return null;
        const snap = await getDoc(doc(db, 'orders', String(args.orderId)));
        return snap.exists() ? normalizeOrder({ _id: snap.id, ...snap.data() }) : null;
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
    },
    mutation: async (apiRef: any, args?: any) => {
      const path = getPath(apiRef);
      console.log(`Manual mutation called for ${path} with args:`, args);
      return null;
    },
    action: async (apiRef: any, args?: any) => {
      const path = getPath(apiRef);
      console.log(`Manual action called for ${path} with args:`, args);
      
      const collectionName = path.split('.')[0];
      const actionName = path.split('.')[1];
      
      if (collectionName === 'phonepe' && actionName === 'initiatePayment') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          console.log("Mocking PhonePe payment initiation for:", args);
          return {
            success: true,
            merchantTransactionId: `MTXN-${Date.now()}`,
            paymentUrl: `http://localhost:5175/mock-payment?orderId=${args.orderId}&amount=${args.amount}`
          };
        }
        const callable = httpsCallable(functions, 'initiatePayment');
        const res: any = await callable(args);
        return res.data;
      }
      
      if (collectionName === 'phonepe' && actionName === 'checkPaymentStatus') {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          return {
            success: true,
            paymentStatus: 'success',
            transactionId: args.merchantTransactionId
          };
        }
        const callable = httpsCallable(functions, 'checkPaymentStatus');
        const res: any = await callable(args);
        return res.data;
      }
      
      return null;
    }
  };
}
