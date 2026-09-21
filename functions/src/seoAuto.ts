import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { generateSeoContentCore } from "./seo";
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
/**
 * Every page that ought to exist and does not, with nothing capped.
 *
 * `fillMissingSeoPages` already worked this out, but only ever to write the
 * top N of it — so the admin could see a count and a sample and had no way to
 * say "that one, that one, and the seven console pages". This is the same
 * list, whole, in the order it is worth doing, for a person to choose from.
 */
export async function listMissingSeoPages(db: admin.firestore.Firestore) {
  const [pageSnap, targets] = await Promise.all([
    db.collection("seoPages").select("slug").get(),
    allTargets(db),
  ]);
  const have = new Set(pageSnap.docs.map((d) => String((d.data() as any).slug || "")));
  const fresh = Date.now() - 30 * 86400000;
  const worth = (t: Target) => t.depth * (Number((t as any).weight) || 1);
  return targets
    .filter((t) => !have.has(t.slug))
    .sort((a, z) => {
      const an = a.kind === "model" && Number((a as any).createdAt) > fresh ? 1 : 0;
      const zn = z.kind === "model" && Number((z as any).createdAt) > fresh ? 1 : 0;
      return zn - an || worth(z) - worth(a)
        || (Number((z as any).createdAt) || 0) - (Number((a as any).createdAt) || 0);
    })
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      kind: t.kind,
      gadget: t.gadget || null,
      brand: (t as any).brandName || null,
      depth: t.depth,
      weight: Number((t as any).weight) || 1,
      worth: Math.round(worth(t)),
      fresh: t.kind === "model" && Number((t as any).createdAt) > fresh,
    }));
}

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

export interface FillResult {
  considered: number;
  created: number;
  failed: number;
  published: boolean;
  slugs: string[];
  errors: string[];
  /** Pages whose stored type was fixed on the way in. */
  repaired: number;
  /** What the storefront rebuild request said, when one was made. */
  rebuild?: string;
}

/**
 * Writes the pages that are missing, the most valuable first.
 *
 * Order matters more than it looks. A phone added yesterday is what people are
 * searching for today, so anything new jumps the queue; after that it is
 * simply whichever missing page has the most stock behind it, which is how
 * "dell laptop skins" gets written before the four hundredth Acer model.
 */
export async function fillMissingSeoPages(
  db: admin.firestore.Firestore,
  opts: { limit?: number; dryRun?: boolean; kinds?: string[]; gadgets?: string[]; slugs?: string[] } = {}
): Promise<FillResult> {
  // Before anything else, and regardless of the cap.
  const repaired = opts.dryRun ? 0 : await repairAutoPageTypes(db);

  /*
   * A named list of slugs is a person pointing at a screen, so it ignores the
   * nightly cap entirely — the cap exists to pace an unattended job, not to
   * argue with somebody who has just ticked eleven boxes.
   */
  const picked = (opts.slugs || []).map(String).filter(Boolean);
  const perDay = picked.length
    ? picked.length
    : Number(opts.limit ?? (await setting(db, SETTINGS.perDay)) ?? 0);
  const out: FillResult = { considered: 0, created: 0, failed: 0, published: false, slugs: [], errors: [], repaired };
  if (!(perDay > 0)) return out;

  const autoPublish = (await setting(db, SETTINGS.autoPublish)) === true;
  out.published = autoPublish;

  const [pageSnap, templateSnap, targets] = await Promise.all([
    db.collection("seoPages").get(),
    db.collection("seoPageTemplates").get(),
    allTargets(db),
  ]);
  const slugs = new Set(pageSnap.docs.map((d) => String((d.data() as any).slug || "")));
  const templates = templateSnap.docs.map((d) => d.data() as any);
  const templateFor = (kind: Target["kind"]) =>
    templates.find((t) => t.pageType === pageTypeFor(kind)) || templates.find((t) => t.pageType === "device");

  const fresh = Date.now() - 30 * 86400000;
  const want = new Set(picked);
  const missing = targets
    .filter((t) => !slugs.has(t.slug))
    .filter((t) => !want.size || want.has(t.slug))
    .filter((t) => !opts.kinds?.length || opts.kinds.includes(t.kind))
    /*
     * Narrowed by gadget, so the work can be done in the order it is worth
     * doing rather than all at once. A console page and a phone page cost the
     * same to write and are worth six times apart; running the console,
     * camera and lens pages first and phones last is the whole strategy.
     */
    .filter((t) => !opts.gadgets?.length || (t.gadget ? opts.gadgets.includes(t.gadget) : true))
    // A model added in the last month first; then by how much sits behind it.
    .sort((a, z) => {
      const an = a.kind === "model" && Number((a as any).createdAt) > fresh ? 1 : 0;
      const zn = z.kind === "model" && Number((z as any).createdAt) > fresh ? 1 : 0;
      const worth = (t: Target) => t.depth * (Number((t as any).weight) || 1);
      /*
       * Among model pages, which are all worth the same on paper, the one
       * added most recently goes first. The database has no release date —
       * the only timestamp is when the row was imported — so this is a proxy
       * for "recent device", and a good one going forward: models are added
       * as they launch.
       */
      return zn - an || worth(z) - worth(a)
        || (Number((z as any).createdAt) || 0) - (Number((a as any).createdAt) || 0);
    })
    .slice(0, perDay);

  out.considered = missing.length;
  if (opts.dryRun) {
    out.slugs = missing.map((t) => `${t.slug} (${t.depth})`);
    return out;
  }

  for (const t of missing) {
    try {
      const ai = await generateSeoContentCore({
        pageType: "device",
        keywords: [t.name],
        deviceCategory: t.name,
        ...(t.brandName ? { brandName: t.brandName } : {}),
      });
      if (!ai.contentHTML) throw new Error("no content came back");

      const title = `${t.name} Skins & Wraps`.replace(/ Skins Skins/, " Skins");
      const template = templateFor(t.kind);
      await db.collection("seoPages").add({
        pageType: pageTypeFor(t.kind),
        slug: t.slug,
        h1Heading: title,
        metaTitle: title,
        metaDescription: metaDescriptionFrom(ai.contentHTML),
        contentHTML: ai.contentHTML,
        faqs: ai.faqs || [],
        keywords: [t.name],
        imageAltTexts: ai.imageAltTexts || [],
        filterConfig: t.filterConfig,
        ...(template?.layoutConfig?.sections ? { layoutOverrides: { sections: template.layoutConfig.sections } } : {}),
        isPublished: autoPublish,
        // Stamped, so these can be found, reviewed and — if the writing turns
        // out wrong — removed as a group.
        autoGenerated: true,
        autoGeneratedKind: t.kind,
        autoGeneratedDepth: t.depth,
        autoGeneratedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      out.created++;
      out.slugs.push(t.slug);
    } catch (e: any) {
      out.failed++;
      out.errors.push(`${t.slug}: ${e?.message || e}`);
      console.error("seoAuto: page failed", { slug: t.slug, error: e?.message || e });
    }
  }

  /*
   * Nothing here pushes a commit, and Hostinger deploys on pushes — so a page
   * written or repaired now would sit unrendered until 3 am unless somebody
   * asked. Asked here instead.
   */
  if (out.created || repaired) {
    const r = await requestRebuild(`seo pages: ${out.created} written, ${repaired} repaired`);
    out.rebuild = r.note;
  }

  console.log("fillMissingSeoPages", { created: out.created, failed: out.failed, autoPublish, repaired });
  return out;
}

/** 20:00 UTC is 01:30 in Agra — before the nightly rebuild picks the pages up. */
export const seoAutoPages = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .pubsub.schedule("0 20 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    await fillMissingSeoPages(admin.firestore());
    return null;
  });

/** The coverage figures and a run, on demand, for the admin screen. */
export const runSeoAutoPages = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();
    if (data?.coverageOnly === true) {
      const repaired = await repairAutoPageTypes(db);
      const c = await seoCoverage(db);
      const tiers = Object.entries(c.byKind || {})
        .map(([k, v]: any) => `${k}: ${v.have}/${v.total}`)
        .join(" · ");
      return {
        success: true,
        coverage: c,
        message: (repaired ? `${repaired} repaired · ` : "")
          + `${c.modelsWithPage} of ${c.models} models have a page — ${tiers}`
          + (c.waitingToPublish ? ` · ${c.waitingToPublish} waiting to be published` : ""),
      };
    }
    // The whole pending list, for the screen that lets an admin pick from it.
    if (data?.pendingOnly === true) {
      return { success: true, pending: await listMissingSeoPages(db) };
    }
    const limit = data?.limit === undefined ? undefined : Number(data.limit);
    const out = await fillMissingSeoPages(db, {
      limit,
      dryRun: data?.dryRun === true,
      kinds: Array.isArray(data?.kinds) ? data.kinds.map(String) : undefined,
      gadgets: Array.isArray(data?.gadgets) ? data.gadgets.map(String) : undefined,
      // Capped so one click cannot start a job that outlives the function.
      slugs: Array.isArray(data?.slugs) ? data.slugs.map(String).slice(0, 50) : undefined,
    });
    if (!out.considered) {
      const fixed = out.repaired ? `${out.repaired} existing page${out.repaired === 1 ? "" : "s"} repaired. ` : "";
      const after = out.rebuild ? ` ${out.rebuild}.` : "";
      return {
        ...out,
        message: fixed + after + (limit
          ? "No page left to write for that number."
          : "No new pages written — set \"Pages a night\" above zero, or type a number and press this again."),
      };
    }
    return {
      ...out,
      message: (out.repaired ? `${out.repaired} repaired · ` : "") + (data?.dryRun === true
        ? `${out.considered} pages would be written: ${out.slugs.slice(0, 5).join(", ")}…`
        : `${out.created} pages written${out.failed ? `, ${out.failed} failed` : ""}`
          + (out.published ? " and published" : " — waiting to be published")
          + (out.rebuild ? `. ${out.rebuild}` : "")),
    };
  });
