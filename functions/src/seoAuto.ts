import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import {
  CONTENT_VERSION, loadWriterContext, writeCopy, storedDescription, needsRewrite, demandKey,
  type WriterContext, type PageTarget,
} from "./seoWriter";
import { requestRebuild } from "./rebuild";

/**
 * Model pages that make themselves.
 *
 * There are 3,684 models in the database and 230 landing pages, and each of
 * those pages is a search anybody actually types — "samsung galaxy s23 skins".
 * The machinery to write one has existed for a while; what has never existed
 * is anything that notices a model has no page. So a gap opened while the site
 * was down, and it would open again every month as new phones launch, because
 * filling it depended on somebody remembering.
 *
 * This runs nightly, newest models first: any new phone gets its page within a
 * day of being added, and the backlog is chipped at from the front. The daily
 * cap is what stops one night's run spending a month's OpenAI budget.
 *
 * Pages are made unpublished unless SEO_AUTO_PUBLISH says otherwise, and the
 * morning digest reports how many are waiting — thin or wrong pages at scale
 * are worse for a site than missing ones, so a person sees them first.
 */

const SETTINGS = {
  perDay: "SEO_AUTO_PAGES_PER_DAY",
  autoPublish: "SEO_AUTO_PUBLISH",
};

async function setting(db: admin.firestore.Firestore, key: string): Promise<any> {
  const snap = await db.collection("settings").doc(key).get();
  return snap.exists ? (snap.data() as any)?.value : undefined;
}

/** "Samsung" + "Galaxy S23" → "samsung-galaxy-s23-skins", as the admin screen builds it. */
export const modelSlug = (brand: string, model: string) =>
  `${`${brand} ${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-skins`;

/**
 * One complete sentence, at most 160 characters.
 *
 * The same rules the admin screen applies, because a description cut off
 * mid-word is what Google shows the whole world. Kept in step with
 * src/pages/admin/seo-pages/auto-generate.tsx.
 */
export function metaDescriptionFrom(html: string): string {
  const firstParagraph = html.match(/<p>(.*?)<\/p>/)?.[1] || "";
  const clean = firstParagraph.replace(/<[^>]*>/g, "").trim();
  let sentence = (clean.match(/^[^.!?]+[.!?]/) || [clean])[0].trim();
  if (sentence.length <= 160) return sentence;

  sentence = sentence.replace(/\s*\([^)]*\)\s*/g, " ");
  if (sentence.length > 160) {
    sentence = sentence.split(",")[0].trim();
    if (!/[.!?]$/.test(sentence)) sentence += ".";
  }
  if (sentence.length > 160) {
    let cut = sentence.slice(0, 157);
    const space = cut.lastIndexOf(" ");
    if (space > 100) cut = cut.slice(0, space);
    cut = cut.replace(/[,;:]$/, "");
    if (!/[.!?]$/.test(cut)) cut += ".";
    sentence = cut;
  }
  return sentence.replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ naming */

/**
 * Brand names as a shopper types them, not as the database stores them.
 *
 * The database is full of shouting and spacing that came in with imported
 * spreadsheets — "One Plus", "MICROSOFT", "ZHIYUN". A slug built straight from
 * those gives `/one-plus-phone-skins`, and nobody searches "one plus".
 */
const BRAND_NAMES: Record<string, string> = {
  "one plus": "OnePlus", "oneplus": "OnePlus",
  microsoft: "Microsoft", alienware: "Alienware", razer: "Razer",
  huawei: "Huawei", fujitsu: "Fujitsu", fujifilm: "Fujifilm",
  sigma: "Sigma", tamron: "Tamron", tokina: "Tokina", viltrox: "Viltrox",
  yongnuo: "Yongnuo", zhiyun: "Zhiyun", snoppa: "Snoppa", meike: "Meike",
  leica: "Leica", moza: "Moza", feiyutech: "FeiyuTech", jooyontech: "Jooyontech",
};

/** The word a shopper uses for the thing, by gadget category. */
const GADGET_NAMES: Record<string, string> = {
  phone: "Phone", laptop: "Laptop", tablet: "Tablet", camera: "Camera",
  lens: "Lens", controller: "Controller", console: "Console", drone: "Drone",
  charger: "Charger", gimbals: "Gimbal", gimbal: "Gimbal", "mac-mini": "Mac mini",
};

/**
 * The handful of pairs a shopper names differently from the two halves.
 *
 * Nobody searches "apple tablet skins" or "apple laptop skins" — they search
 * iPad and MacBook. Sony's laptops have been VAIO for twenty years.
 */
const COMBO_NAMES: Record<string, string> = {
  "apple|tablet": "Apple iPad",
  "apple|laptop": "Apple MacBook",
  "apple|phone": "Apple iPhone",
  "sony|laptop": "Sony VAIO",
  "samsung|tablet": "Samsung Galaxy Tab",
  "samsung|phone": "Samsung Galaxy",
  "microsoft|console": "Xbox",
  /*
   * Each of these was checked against the models we actually carry, not
   * against what the brand sells: every one of Google's 27 phones is a Pixel,
   * all 7 LG laptops are Grams, all 13 Xiaomi tablets are a Pad of some kind,
   * and every HMD phone is named "HMD …" with 13 of the 18 saying Nokia.
   */
  "google|phone": "Google Pixel",
  "lg|laptop": "LG Gram",
  "xiaomi|tablet": "Xiaomi Pad",
  "hmd|phone": "HMD Nokia",
  /*
   * Samsung's laptops are the one entry here that names where the catalogue
   * is going rather than where it is. One of the 21 we list today is a Galaxy
   * Book; the rest are RV509, NT450RSE, Notebook 9 — machines from before the
   * line was renamed. Samsung has shipped nothing but Galaxy Books for
   * several years, so every model added from here will be one, and the page
   * is named for the search that will keep being made.
   */
  "samsung|laptop": "Samsung Galaxy Book",
  /*
   * The Android tablet makers who all settled on "Pad". Checked the same way:
   * all 7 OnePlus tablets are a Pad, all 5 Realme, all 4 Oppo, all 3 Honor.
   * Oppo and Honor sit under the five-model floor, so no page is written for
   * them yet — the name is here for the day they cross it.
   *
   * Motorola's six are split — four Moto Pads and two older Tab G models —
   * and it goes the way Samsung's laptops did: named for the line it ships
   * now and will keep shipping.
   */
  "one-plus|tablet": "OnePlus Pad",
  "oneplus|tablet": "OnePlus Pad",
  "realme|tablet": "Realme Pad",
  "oppo|tablet": "Oppo Pad",
  "honor|tablet": "Honor Pad",
  "motorola|tablet": "Moto Pad",
};

const pretty = (brand: string) =>
  BRAND_NAMES[brand.trim().toLowerCase()] ||
  (/^[A-Z0-9+ ]+$/.test(brand.trim())
    // ALL CAPS names read as shouting on a page title; initialisms of three
    // letters or fewer (HP, MSI, DJI, LG) are genuinely written that way.
    ? (brand.trim().length <= 3 ? brand.trim() : brand.trim().replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase()))
    : brand.trim());

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * A collection's name with the merchandising suffix taken off.
 *
 * These names are written for the shop's own navigation, not for a slug, and
 * most of them already say what they are: "Lens Skins", "Matte Phone Skins",
 * "Samsung Skins". Appending "skins" to those gave /lens-skins-skins, and
 * appending the gadget as well gave /lens-skins-lens-skins — twelve pages
 * whose URL and title both stuttered. The theme is what is left once the
 * category word is removed.
 */
const themeBase = (name: string) =>
  name.replace(/\s*&\s*wraps?\s*$/i, "").replace(/\s+(skins?|wraps?)\s*$/i, "").trim() || name.trim();

/** Whether a name already says which gadget it is for, so we do not say it twice. */
const namesGadget = (name: string, word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i").test(name);

/** "Apple" + "laptop" → { name: "Apple MacBook", slug: "apple-macbook-skins" } */
export function brandGadgetName(brand: string, gadget: string): { name: string; slug: string } {
  const key = `${slugify(brand)}|${String(gadget).toLowerCase()}`;
  const name = COMBO_NAMES[key] || `${pretty(brand)} ${GADGET_NAMES[String(gadget).toLowerCase()] || gadget}`;
  return { name, slug: `${slugify(name)}-skins` };
}

/* ---------------------------------------------------------------- targets */

/** A page that ought to exist: what to call it and what it is about. */
export interface Target {
  kind: "model" | "brand-gadget" | "theme" | "theme-gadget";
  slug: string;
  name: string;
  /** How much stock sits behind it — the order things get written in. */
  depth: number;
  filterConfig: Record<string, unknown>;
  brandName?: string;
  modelId?: string;
  modelName?: string;
  /** Which gadget this page sells, where it is about one. */
  gadget?: string;
}

/**
 * How much has to sit behind a page before it is worth having.
 *
 * A page with four products on it is a page Google will call thin, and enough
 * of those drag down the pages that are good. These floors are deliberately
 * cautious: "car skins" has ten designs across the whole catalogue and does
 * not deserve a page yet; "anime phone skins" has fifty-eight and does.
 */
const FLOORS = { brandGadget: 5, theme: 25, themeGadget: 20 };

export interface Coverage {
  models: number;
  brands: number;
  pages: number;
  modelsWithPage: number;
  modelsMissing: number;
  brandsMissing: string[];
  themesMissing: string[];
  byKind: Record<string, { total: number; have: number; missing: number }>;
  waitingToPublish: number;
}

/**
 * Every page that ought to exist, in the order it is worth writing.
 *
 * Three tiers, and the middle one is the one that was missing entirely. A
 * model page ("acer swift 5 skins") is precise but almost nobody searches it.
 * A brand page ("lenovo skins") does not say whether it is about laptops or
 * tablets. Between them sits "dell laptop skins" — 366 models behind it and a
 * phrase people genuinely type — and there was not one of those on the site.
 */
export async function allTargets(db: admin.firestore.Firestore): Promise<Target[]> {
  const [modelSnap, collSnap, cpSnap, prodSnap, variantSnap] = await Promise.all([
    db.collection("supportedModels").get(),
    db.collection("collections").get(),
    db.collection("collectionProducts").get(),
    db.collection("products").get(),
    db.collection("variants").get(),
  ]);

  /*
   * What a page of each gadget is worth, measured rather than assumed.
   *
   * A page is worth writing in proportion to what the thing behind it sells
   * for, and these differ by six times: a console skin's median is ₹1,199 and
   * a phone skin's is ₹199. Twenty-seven phone landing pages had been written
   * and one console page — which is the effort spent exactly backwards.
   *
   * Taken from the catalogue each night rather than written down here, so
   * retiring old stock or repricing a range moves the queue on its own.
   */
  const priceOf = new Map<string, number>();
  for (const d of variantSnap.docs) {
    const v = d.data() as any;
    const price = Number(v.price) || 0;
    if (!price) continue;
    const pid = String(v.productId || "");
    priceOf.set(pid, Math.max(priceOf.get(pid) || 0, price));
  }
  const pricesByGadget = new Map<string, number[]>();
  for (const d of prodSnap.docs) {
    const p = d.data() as any;
    const g = String(p.gadgetCategory || "").toLowerCase();
    const price = priceOf.get(d.id);
    if (!g || !price) continue;
    pricesByGadget.set(g, [...(pricesByGadget.get(g) || []), price]);
  }
  const median = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : 0;
  };
  const allMedian = median([...pricesByGadget.values()].flat()) || 200;
  /** 1.0 is an average-priced gadget; a console page is worth several of them. */
  const weightOf = (g?: string) => {
    if (!g) return 1;
    const m = median(pricesByGadget.get(String(g).toLowerCase()) || []);
    return m ? Math.max(0.3, Math.min(8, m / allMedian)) : 1;
  };

  const models = modelSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((m) => m.isActive !== false && m.brandName && m.modelName);

  const targets: Target[] = [];

  // Tier 1 — one page per model, newest first (handled by the caller's sort).
  for (const m of models) {
    targets.push({
      kind: "model",
      slug: modelSlug(String(m.brandName), String(m.modelName)),
      name: `${pretty(String(m.brandName))} ${m.modelName}`,
      depth: 1,
      brandName: String(m.brandName),
      modelId: String(m.id),
      modelName: String(m.modelName),
      gadget: String(m.category || m.gadgetType || "").toLowerCase() || undefined,
      filterConfig: { brand: String(m.brandName), model: String(m.modelName) },
      // Newest models are the ones being searched for today.
      ...( { createdAt: Number(m._creationTime || m.createdAt) || 0 } as any),
    });
  }

  // Tier 2 — brand × gadget, weighted by how many models sit behind it.
  const pairs = new Map<string, { brand: string; gadget: string; n: number }>();
  for (const m of models) {
    const gadget = String(m.category || m.gadgetType || m.gadgetTypeId || "").toLowerCase();
    if (!gadget) continue;
    const key = `${m.brandName}|${gadget}`;
    const cur = pairs.get(key) || { brand: String(m.brandName), gadget, n: 0 };
    cur.n++;
    pairs.set(key, cur);
  }
  for (const { brand, gadget, n } of pairs.values()) {
    if (n < FLOORS.brandGadget) continue;
    const { name, slug } = brandGadgetName(brand, gadget);
    targets.push({
      kind: "brand-gadget", slug, name, depth: n, brandName: brand, gadget,
      filterConfig: { brand, gadget },
    });
  }

  // Tier 3 — themes, from the curated collections rather than the tag soup.
  const gadgetOf = new Map(prodSnap.docs.map((d) => [d.id, String((d.data() as any).gadgetCategory || "").toLowerCase()]));
  const byCollection = new Map<string, string[]>();
  for (const d of cpSnap.docs) {
    const row = d.data() as any;
    const key = String(row.collectionId || "");
    if (!key) continue;
    byCollection.set(key, [...(byCollection.get(key) || []), String(row.productId || "")]);
  }
  for (const d of collSnap.docs) {
    const c = d.data() as any;
    if (c.isActive === false) continue;
    const name = String(c.name || "").trim();
    if (!name) continue;
    const base = themeBase(name);
    const productIds = byCollection.get(d.id) || [];
    if (productIds.length >= FLOORS.theme) {
      targets.push({
        kind: "theme",
        slug: `${slugify(base)}-skins`,
        name: `${base} Skins`,
        depth: productIds.length,
        filterConfig: { collectionId: d.id, collection: name },
      });
    }
    // …and the theme on one gadget, which is where the real searches are:
    // "anime phone skins" beats "anime skins" every time.
    const perGadget = new Map<string, number>();
    for (const pid of productIds) {
      const g = gadgetOf.get(pid);
      if (g) perGadget.set(g, (perGadget.get(g) || 0) + 1);
    }
    for (const [g, n] of perGadget) {
      if (n < FLOORS.themeGadget) continue;
      const word = GADGET_NAMES[g] || g;
      // "Matte Phone Skins" on phones is the theme page over again, under a
      // longer URL. One page, not two that compete for the same search.
      if (namesGadget(base, word)) continue;
      targets.push({
        kind: "theme-gadget",
        slug: `${slugify(`${base} ${word}`)}-skins`,
        name: `${base} ${word} Skins`,
        depth: n,
        gadget: g,
        filterConfig: { collectionId: d.id, collection: name, gadget: g },
      });
    }
  }

  // Stamped on the way out, so the caller sorts by what a page is worth
  // rather than merely by how many things sit behind it.
  for (const t of targets) (t as any).weight = weightOf(t.gadget);

  /*
   * One target per slug. Two collections can reduce to the same theme —
   * "Camera Skins" and "Camera" both become /camera-skins — and a tier can
   * collide with a broader one. Whichever has more behind it wins, so the
   * page that survives is the one worth ranking.
   */
  const bySlug = new Map<string, Target>();
  for (const t of targets) {
    if (!t.slug) continue;
    const seen = bySlug.get(t.slug);
    if (!seen || t.depth > seen.depth) bySlug.set(t.slug, t);
  }
  return [...bySlug.values()];
}

/** What has a page and what does not — the number nobody could see. */
export async function seoCoverage(db: admin.firestore.Firestore): Promise<Coverage> {
  const [pageSnap, targets] = await Promise.all([
    db.collection("seoPages").get(),
    allTargets(db),
  ]);
  const slugs = new Set(pageSnap.docs.map((d) => String((d.data() as any).slug || "")));
  const waitingToPublish = pageSnap.docs.filter(
    (d) => (d.data() as any).autoGenerated === true && (d.data() as any).isPublished !== true
  ).length;

  const byKind: Record<string, { total: number; have: number; missing: Target[] }> = {};
  for (const t of targets) {
    const b = (byKind[t.kind] ||= { total: 0, have: 0, missing: [] });
    b.total++;
    if (slugs.has(t.slug)) b.have++;
    else b.missing.push(t);
  }
  for (const b of Object.values(byKind)) b.missing.sort((a, z) => z.depth - a.depth);

  const models = byKind.model || { total: 0, have: 0, missing: [] };
  return {
    models: models.total,
    brands: new Set(targets.filter((t) => t.brandName).map((t) => t.brandName)).size,
    pages: pageSnap.size,
    modelsWithPage: models.have,
    modelsMissing: models.missing.length,
    // The tiers that were missing altogether, biggest first.
    brandsMissing: (byKind["brand-gadget"]?.missing || []).slice(0, 40).map((t) => `${t.slug} (${t.depth})`),
    themesMissing: [
      ...(byKind.theme?.missing || []),
      ...(byKind["theme-gadget"]?.missing || []),
    ].sort((a, z) => z.depth - a.depth).slice(0, 40).map((t) => `${t.slug} (${t.depth})`),
    byKind: Object.fromEntries(
      Object.entries(byKind).map(([k, v]) => [k, { total: v.total, have: v.have, missing: v.missing.length }])
    ),
    waitingToPublish,
  } as Coverage;
}

/**
 * The page type that lets the build recognise what the page is about.
 *
 * "device" in this codebase means a gadget *category* — a phone-skins page,
 * not a page about one phone — and resolveSeoTarget deliberately skips device
 * matching for it. Writing every page as "device" meant /poco-x8-power-skins
 * resolved to no brand and no gadget and listed the entire catalogue: lens
 * skins and charger skins on a page about a phone.
 *
 * A model or brand page is "brand", which is what makes the resolver read the
 * slug. A theme is "skin-type", which is what stops it trying to.
 */
const pageTypeFor = (kind: Target["kind"]) =>
  kind === "theme" || kind === "theme-gadget" ? "skin-type" : "brand";

/**
 * Repairs what earlier runs wrote as "device".
 *
 * Those pages resolve to no brand and no gadget and list the whole catalogue,
 * and there is no way to tell from the outside — a lens skin on a page about a
 * phone looks like any other product until somebody reads it.
 *
 * Deliberately outside the daily cap: a broken page is broken whether or not
 * there is budget to write new ones, and putting this behind the cap meant it
 * never ran on an account that had not set one.
 */
export async function repairAutoPageTypes(db: admin.firestore.Firestore): Promise<number> {
  const snap = await db.collection("seoPages").where("autoGenerated", "==", true).get();
  const wrong = snap.docs.filter((d) => (d.data() as any).pageType === "device");
  for (const d of wrong) {
    const kind = String((d.data() as any).autoGeneratedKind || "model") as Target["kind"];
    await d.ref.update({ pageType: pageTypeFor(kind), updatedAt: Date.now() });
  }
  if (wrong.length) console.log("seoAuto: repaired pageType on", wrong.length, "pages");
  return wrong.length;
}

/* ------------------------------------------------------------- the queue */

/**
 * Whether a missing page may be written, and why not.
 *
 * Only 393 of 3,695 models have their own mockups — every one a phone, all
 * from the January import, and nothing makes model-wise mockups any more. So
 * mockups can vouch for a phone page but cannot be what it waits for: a phone
 * added this month would wait forever. A page for a model nobody looks for
 * shows the same designs as its neighbours under a different name, and a
 * thousand of those is what Google calls doorway pages. So:
 *
 *  - a phone model is ready when it is new (last 30 days), from a brand most
 *    of India shops for, has 20 mockups of its own, or has been ordered or
 *    asked for; the long tail of small, old phones stays with its brand page;
 *  - any other model gets a page only once someone has ordered or asked for
 *    it — until then "Dell laptop skins" is the page that serves it;
 *  - brand-and-gadget and theme pages are always ready (their floors are
 *    checked when the target is made).
 */
export const MOCKUP_GATE = 20;
export type Readiness = "ready" | "waiting-mockups" | "hub-covers";

export function readiness(t: Target, ctx: WriterContext): Readiness {
  if (t.kind !== "model") return "ready";
  const demand = (ctx.ordered.get(demandKey(t.brandName, t.modelName)) || 0) + (ctx.requested.get(demandKey(t.brandName, t.modelName)) || 0);
  if (t.gadget === "phone") {
    const fresh = Number((t as any).createdAt) > Date.now() - 30 * 86400000;
    const big = BIG_PHONE_BRANDS.has(String(t.brandName || "").toLowerCase());
    return fresh || big || demand > 0 || (ctx.mockups.get(String(t.modelId)) || 0) >= MOCKUP_GATE ? "ready" : "waiting-mockups";
  }
  return demand > 0 ? "ready" : "hub-covers";
}

/** Phone brands most of India shops for; a page for one of theirs earns more. */
const BIG_PHONE_BRANDS = new Set([
  "apple", "samsung", "oneplus", "one plus", "xiaomi", "redmi", "poco", "vivo", "iqoo", "realme",
  "oppo", "motorola", "google", "nothing",
]);

/**
 * What a missing page is worth, and in words why.
 *
 * The old order was price alone — a console skin's median is six times a
 * phone skin's — so phones came last, when phones are where nearly all the
 * searches and 410 of the skins are. Now: a model added in the last month
 * first (it is what people are searching this week); then anything customers
 * have bought or asked for by name; then the hub pages, bigger first; then
 * the rest, big phone brands before small.
 */
export function worthOf(t: Target, ctx: WriterContext): { score: number; why: string } {
  const fresh = t.kind === "model" && Number((t as any).createdAt) > Date.now() - 30 * 86400000;
  const k = demandKey(t.brandName, t.modelName);
  const orders = t.kind === "model" ? ctx.ordered.get(k) || 0 : 0;
  const asks = t.kind === "model" ? ctx.requested.get(k) || 0 : 0;
  const weight = Math.sqrt(Number((t as any).weight) || 1);
  if (t.kind === "model") {
    const big = BIG_PHONE_BRANDS.has(String(t.brandName || "").toLowerCase()) ? 5 : 0;
    const score = (fresh ? 100 : 0) + orders * 10 + asks * 6 + big + 10;
    const why = [fresh && "new model", orders && `${orders} ordered`, asks && `${asks} asked for`, big && "major brand"]
      .filter(Boolean).join(", ") || "model page";
    return { score, why };
  }
  const score = 20 + Math.log2(1 + t.depth) * 5 * weight;
  return { score, why: t.kind === "brand-gadget" ? `${t.depth} models behind it` : `${t.depth} designs behind it` };
}

export interface QueueItem {
  slug: string; name: string; kind: Target["kind"]; gadget: string | null; brand: string | null;
  depth: number; score: number; why: string; readiness: Readiness; fresh: boolean;
}

/** Every missing page with its readiness and worth, most valuable first. */
export async function buildQueue(db: admin.firestore.Firestore, ctx?: WriterContext) {
  const [pageSnap, targets, c] = await Promise.all([
    db.collection("seoPages").select("slug").get(),
    allTargets(db),
    ctx ? Promise.resolve(ctx) : loadWriterContext(db),
  ]);
  const have = new Set(pageSnap.docs.map((d) => String((d.data() as any).slug || "")));
  const fresh = Date.now() - 30 * 86400000;
  const items: Array<QueueItem & { target: Target }> = targets
    .filter((t) => !have.has(t.slug))
    .map((t) => {
      const w = worthOf(t, c);
      return {
        target: t, slug: t.slug, name: t.name, kind: t.kind, gadget: t.gadget || null,
        brand: t.brandName || null, depth: t.depth, score: Math.round(w.score), why: w.why,
        readiness: readiness(t, c), fresh: t.kind === "model" && Number((t as any).createdAt) > fresh,
      };
    })
    .sort((a, z) => z.score - a.score || (Number((z.target as any).createdAt) || 0) - (Number((a.target as any).createdAt) || 0));
  return { items, targets, ctx: c, have };
}

/** The same list for the admin's picker (no targets inside). */
export async function listMissingSeoPages(db: admin.firestore.Firestore) {
  const { items } = await buildQueue(db);
  return items.map(({ target, ...rest }) => ({ ...rest, worth: rest.score }));
}

/* ------------------------------------------------------------- writing */

async function pool<T>(xs: T[], n: number, fn: (x: T) => Promise<void>) {
  const q = [...xs];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) await fn(q.shift() as T);
  }));
}

const asPageTarget = (t: Target): PageTarget => ({
  kind: t.kind, slug: t.slug, name: t.name, brandName: t.brandName, gadget: t.gadget,
  modelId: t.modelId, modelName: t.modelName,
  collectionId: (t.filterConfig as any)?.collectionId, collection: (t.filterConfig as any)?.collection,
});

/** A heading a shopper would type: phone models are "back skins". */
const headingFor = (t: Target) =>
  t.kind === "model" && t.gadget === "phone"
    ? `${t.name} Back Skins`
    : `${t.name} Skins & Wraps`.replace(/ Skins Skins/, " Skins");

export interface FillResult {
  considered: number;
  created: number;
  drafts: number;
  failed: number;
  published: boolean;
  slugs: string[];
  errors: string[];
  repaired: number;
  rewritten?: number;
  rebuild?: string;
}

/**
 * Writes missing pages, the most valuable ready ones first.
 *
 * A page that fails the quality check is saved unpublished with its reasons
 * (seoPages.qualityIssues), so it waits in SEO Pages instead of going live.
 */
export async function fillMissingSeoPages(
  db: admin.firestore.Firestore,
  opts: { limit?: number; dryRun?: boolean; kinds?: string[]; gadgets?: string[]; slugs?: string[]; rebuild?: boolean } = {}
): Promise<FillResult> {
  const repaired = opts.dryRun ? 0 : await repairAutoPageTypes(db);
  const picked = (opts.slugs || []).map(String).filter(Boolean);
  const perDay = picked.length ? picked.length : Number(opts.limit ?? (await setting(db, SETTINGS.perDay)) ?? 0);
  const out: FillResult = { considered: 0, created: 0, drafts: 0, failed: 0, published: false, slugs: [], errors: [], repaired };
  if (!(perDay > 0)) return out;

  const autoPublish = (await setting(db, SETTINGS.autoPublish)) === true;
  out.published = autoPublish;

  const { items, ctx } = await buildQueue(db);
  const templates = (await db.collection("seoPageTemplates").get()).docs.map((d) => d.data() as any);
  const templateFor = (kind: Target["kind"]) =>
    templates.find((t) => t.pageType === pageTypeFor(kind)) || templates.find((t) => t.pageType === "device");

  const want = new Set(picked);
  const chosen = items
    // A person naming pages overrides the gate; the nightly run never does.
    .filter((i) => (want.size ? want.has(i.slug) : i.readiness === "ready"))
    .filter((i) => !opts.kinds?.length || opts.kinds.includes(i.kind))
    .filter((i) => !opts.gadgets?.length || (i.gadget ? opts.gadgets.includes(i.gadget) : true))
    .slice(0, perDay);

  out.considered = chosen.length;
  if (opts.dryRun) {
    out.slugs = chosen.map((i) => `${i.slug} (${i.why})`);
    return out;
  }

  await pool(chosen, 3, async (i) => {
    const t = i.target;
    try {
      const w = await writeCopy(db, ctx, asPageTarget(t));
      if (!w.contentHTML) throw new Error("no content came back");
      const title = headingFor(t);
      const template = templateFor(t.kind);
      const ok = w.issues.length === 0;
      await db.collection("seoPages").add({
        pageType: pageTypeFor(t.kind),
        slug: t.slug,
        h1Heading: title,
        metaTitle: title,
        metaDescription: storedDescription(w.brief, ctx.facts),
        contentHTML: w.contentHTML,
        faqs: w.faqs || [],
        keywords: [t.name],
        imageAltTexts: w.imageAltTexts || [],
        filterConfig: t.filterConfig,
        ...(template?.layoutConfig?.sections ? { layoutOverrides: { sections: template.layoutConfig.sections } } : {}),
        isPublished: autoPublish && ok,
        qualityIssues: w.issues,
        contentVersion: CONTENT_VERSION,
        autoGenerated: true,
        autoGeneratedKind: t.kind,
        autoGeneratedDepth: t.depth,
        autoGeneratedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      out.created++;
      if (!ok) out.drafts++;
      out.slugs.push(ok ? t.slug : `${t.slug} (draft: ${w.issues.join("; ")})`);
    } catch (e: any) {
      out.failed++;
      out.errors.push(`${t.slug}: ${e?.message || e}`);
      console.error("seoAuto: page failed", { slug: t.slug, error: e?.message || e });
    }
  });

  if ((out.created || repaired) && opts.rebuild !== false) {
    const r = await requestRebuild(`seo pages: ${out.created} written, ${repaired} repaired`);
    out.rebuild = r.note;
  }
  console.log("fillMissingSeoPages", { created: out.created, drafts: out.drafts, failed: out.failed, autoPublish, repaired });
  return out;
}

/**
 * Rewrites existing pages that the old generator wrote or that make stale
 * claims (a fixed ₹149, "1000+ models", COD) or are thin.
 *
 * The new copy replaces the old only if it passes the check; the old copy is
 * kept on the record (previousContentHTML) either way, so a rewrite can be
 * undone. A page that fails keeps its current text and gets the reasons in
 * rewriteIssues for a person to look at.
 */
export async function rewriteSeoPages(
  db: admin.firestore.Firestore,
  opts: { limit?: number; slugs?: string[]; dryRun?: boolean; rebuild?: boolean; ctx?: WriterContext } = {}
): Promise<{ considered: number; rewritten: number; kept: number; failed: number; slugs: string[]; errors: string[]; rebuild?: string }> {
  const out = { considered: 0, rewritten: 0, kept: 0, failed: 0, slugs: [] as string[], errors: [] as string[], rebuild: undefined as string | undefined };
  const want = new Set((opts.slugs || []).map(String));
  const snap = await db.collection("seoPages").get();
  const due = snap.docs
    .map((d) => ({ ref: d.ref, page: d.data() as any, reasons: needsRewrite(d.data()) }))
    .filter((x) => (want.size ? want.has(String(x.page.slug)) : x.reasons.length > 0))
    // Published pages first: they are the ones saying the wrong thing in public.
    .sort((a, b) => Number(b.page.isPublished === true) - Number(a.page.isPublished === true))
    .slice(0, Number(opts.limit ?? 20));
  out.considered = due.length;
  if (opts.dryRun) {
    out.slugs = due.map((x) => `${x.page.slug} (${x.reasons.join(", ")})`);
    return out;
  }
  const ctx = opts.ctx || (await loadWriterContext(db));
  const targets = new Map((await allTargets(db)).map((t) => [t.slug, t]));

  await pool(due, 3, async ({ ref, page }) => {
    const slug = String(page.slug || "");
    const fc = page.filterConfig || {};
    const known = targets.get(slug);
    const t: PageTarget = known ? asPageTarget(known) : {
      kind: "other", slug,
      name: String(page.h1Heading || page.metaTitle || slug).replace(/\s*[|–-].*$/, "").replace(/\s+skins?(\s*&\s*wraps)?$/i, "").trim() || slug,
      brandName: fc.brand, gadget: fc.gadget, collectionId: fc.collectionId, collection: fc.collection,
    };
    try {
      const w = await writeCopy(db, ctx, t);
      if (w.issues.length) {
        await ref.update({ rewriteIssues: w.issues, rewriteTriedAt: Date.now() });
        out.kept++;
        out.slugs.push(`${slug} (kept: ${w.issues.join("; ")})`);
        return;
      }
      await ref.update({
        previousContentHTML: page.contentHTML || "",
        previousFaqs: page.faqs || [],
        contentHTML: w.contentHTML,
        faqs: w.faqs || [],
        imageAltTexts: w.imageAltTexts || page.imageAltTexts || [],
        metaDescription: storedDescription(w.brief, ctx.facts),
        contentVersion: CONTENT_VERSION,
        qualityIssues: [],
        rewriteIssues: admin.firestore.FieldValue.delete(),
        rewrittenAt: Date.now(),
        updatedAt: Date.now(),
      });
      out.rewritten++;
      out.slugs.push(slug);
    } catch (e: any) {
      out.failed++;
      out.errors.push(`${slug}: ${e?.message || e}`);
    }
  });

  if (out.rewritten && opts.rebuild !== false) {
    const r = await requestRebuild(`seo pages: ${out.rewritten} rewritten`);
    out.rebuild = r.note;
  }
  return out;
}

/* ------------------------------------------------------------- status */

export interface SeoStatus {
  updatedAt: number;
  facts: { models: number; brands: number; designs: number };
  settings: { perDay: number; autoPublish: boolean };
  pages: { total: number; published: number; drafts: number; needRewrite: number };
  byKind: Record<string, { total: number; have: number; ready: number; waitingMockups: number; hubCovers: number }>;
  newModels: { total: number; withPage: number; ready: number; waitingMockups: number; hubCovers: number; waitingNames: string[] };
  queue: QueueItem[];
  drafts: Array<{ slug: string; issues: string[] }>;
}

/**
 * The numbers the SEO Automation screen shows, worked out once and stored,
 * because working them out reads every model, product and mockup.
 */
export async function computeSeoStatus(db: admin.firestore.Firestore): Promise<SeoStatus> {
  const { items, targets, ctx, have } = await buildQueue(db);
  const pageSnap = await db.collection("seoPages").get();
  const pages = pageSnap.docs.map((d) => d.data() as any);
  const byKind: SeoStatus["byKind"] = {};
  for (const t of targets) {
    const b = (byKind[t.kind] ||= { total: 0, have: 0, ready: 0, waitingMockups: 0, hubCovers: 0 });
    b.total++;
    if (have.has(t.slug)) { b.have++; continue; }
    const r = readiness(t, ctx);
    if (r === "ready") b.ready++;
    else if (r === "waiting-mockups") b.waitingMockups++;
    else b.hubCovers++;
  }
  const fresh = Date.now() - 30 * 86400000;
  const newTargets = targets.filter((t) => t.kind === "model" && Number((t as any).createdAt) > fresh);
  const newMissing = newTargets.filter((t) => !have.has(t.slug));
  const drafts = pages.filter((p) => p.isPublished !== true && Array.isArray(p.qualityIssues) && p.qualityIssues.length);
  const status: SeoStatus = {
    updatedAt: Date.now(),
    facts: { models: ctx.facts.models, brands: ctx.facts.brands, designs: ctx.facts.designs },
    settings: {
      perDay: Number((await setting(db, SETTINGS.perDay)) ?? 0),
      autoPublish: (await setting(db, SETTINGS.autoPublish)) === true,
    },
    pages: {
      total: pages.length,
      published: pages.filter((p) => p.isPublished === true).length,
      drafts: drafts.length,
      needRewrite: pages.filter((p) => needsRewrite(p).length).length,
    },
    byKind,
    newModels: {
      total: newTargets.length,
      withPage: newTargets.length - newMissing.length,
      ready: newMissing.filter((t) => readiness(t, ctx) === "ready").length,
      waitingMockups: newMissing.filter((t) => readiness(t, ctx) === "waiting-mockups").length,
      hubCovers: newMissing.filter((t) => readiness(t, ctx) === "hub-covers").length,
      waitingNames: newMissing.filter((t) => readiness(t, ctx) === "waiting-mockups").slice(0, 20).map((t) => t.name),
    },
    queue: items.filter((i) => i.readiness === "ready").slice(0, 60).map(({ target, ...rest }) => rest),
    drafts: drafts.slice(0, 30).map((p) => ({ slug: String(p.slug), issues: p.qualityIssues })),
  };
  await db.collection("seoAutoStatus").doc("latest").set(status);
  return status;
}

/* ------------------------------------------------------------- schedule */

/**
 * Nightly, 20:00 UTC (01:30 in Agra), before the 3 am storefront rebuild:
 *
 *  1. write up to "pages a night" missing pages that are ready — new models
 *     first, so a phone added today has its page tomorrow once its mockups
 *     exist, with no one clicking anything;
 *  2. spend whatever is left of the same budget rewriting old pages;
 *  3. store the status the admin screen shows.
 */
export const seoAutoPages = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .pubsub.schedule("0 20 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const filled = await fillMissingSeoPages(db, { rebuild: false });
    const perDay = Number((await setting(db, SETTINGS.perDay)) ?? 0);
    const left = Math.max(0, perDay - filled.created - filled.failed);
    const rewritten = left ? await rewriteSeoPages(db, { limit: left, rebuild: false }) : null;
    if (filled.created || rewritten?.rewritten) {
      await requestRebuild(`seo pages: ${filled.created} written, ${rewritten?.rewritten || 0} rewritten`);
    }
    await computeSeoStatus(db);
    return null;
  });

/** The SEO Automation screen's door: status, preview, write, rewrite. */
export const runSeoAutoPages = functionsV1
  .runWith({ memory: "1GB", timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();

    if (data?.status === true) {
      const snap = await db.collection("seoAutoStatus").doc("latest").get();
      if (snap.exists && data?.refresh !== true) return { success: true, status: snap.data() };
      return { success: true, status: await computeSeoStatus(db) };
    }
    if (data?.pendingOnly === true) {
      return { success: true, pending: await listMissingSeoPages(db) };
    }
    if (data?.coverageOnly === true) {
      const s = await computeSeoStatus(db);
      const tiers = Object.entries(s.byKind).map(([k, v]) => `${k}: ${v.have}/${v.total}`).join(" · ");
      return { success: true, status: s, message: `${tiers} · ${s.pages.needRewrite} to rewrite` };
    }
    if (data?.rewrite === true) {
      const r = await rewriteSeoPages(db, {
        limit: data?.limit === undefined ? 12 : Math.min(30, Number(data.limit)),
        dryRun: data?.dryRun === true,
        slugs: Array.isArray(data?.slugs) ? data.slugs.map(String).slice(0, 30) : undefined,
      });
      if (!data?.dryRun) await computeSeoStatus(db);
      return {
        ...r,
        message: data?.dryRun
          ? `${r.considered} pages would be rewritten`
          : `${r.rewritten} rewritten${r.kept ? `, ${r.kept} kept (did not pass the check)` : ""}${r.failed ? `, ${r.failed} failed` : ""}${r.rebuild ? `. ${r.rebuild}` : ""}`,
      };
    }

    const limit = data?.limit === undefined ? undefined : Math.min(30, Number(data.limit));
    const out = await fillMissingSeoPages(db, {
      limit,
      dryRun: data?.dryRun === true,
      kinds: Array.isArray(data?.kinds) ? data.kinds.map(String) : undefined,
      gadgets: Array.isArray(data?.gadgets) ? data.gadgets.map(String) : undefined,
      slugs: Array.isArray(data?.slugs) ? data.slugs.map(String).slice(0, 30) : undefined,
    });
    if (data?.dryRun !== true && out.created) await computeSeoStatus(db);
    if (!out.considered) {
      return { ...out, message: limit ? "No ready page left to write." : "Set pages a night above zero, or type a number." };
    }
    return {
      ...out,
      message: data?.dryRun === true
        ? `${out.considered} pages would be written`
        : `${out.created} written${out.drafts ? ` (${out.drafts} kept as drafts)` : ""}${out.failed ? `, ${out.failed} failed` : ""}`
          + (out.published ? "" : " — unpublished, as set") + (out.rebuild ? `. ${out.rebuild}` : ""),
    };
  });
