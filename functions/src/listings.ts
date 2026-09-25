import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v1/https";
import { requireAdmin } from "./auth";

/**
 * Creates the missing product listing for a design, from the studio.
 *
 * The mockup studio can make a picture of any design on any gadget, but an
 * approved picture has nowhere to go unless a listing exists for that
 * design-and-gadget pair — and for most designs most gadgets are simply
 * missing. Rather than sending the admin off to build one by hand, this makes
 * it in one call.
 *
 * The variant shape is not written down here. It is read back out of the
 * catalogue: whatever set of SKU tails, titles, prices and multipliers most of
 * the existing products for that gadget already use is what a new one gets.
 * Hard-coding "a laptop has Only Top and Top + Keyboard Area at 199 and 349"
 * would be a second, quietly diverging copy of a decision the catalogue has
 * already made 103 times.
 *
 * Only the words are generated — title, slug, meta, description, tags — and
 * only those, because those are the part with no precedent to copy.
 */

const resolveOpenAIKey = async (): Promise<string> => {
  // .env first: that is where the key actually lives for this project. The
  // Firestore doc is the admin-settings convention the SEO tool uses.
  // Environment only: `settings` is world-readable by rule, so a key kept there
  // is a key anyone can download.
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  throw new HttpsError(
    "failed-precondition",
    "OPENAI_API_KEY is not set in the functions environment."
  );
};

interface VariantTemplate {
  /** The tail after the design code: LP, LPK, CAM… Empty for single-variant gadgets. */
  skuTail: string;
  title: string;
  price: number;
  materialMultiplier: number;
  weight?: number;
}

/**
 * The variant shape most products of this listing kind already use.
 *
 * One gadget can hold several kinds of listing — PS5, Series X and Series S
 * are all consoles — so the caller names the SKU view codes its pictures are
 * for, and only shapes made entirely of those codes count. With no such shape
 * there is no precedent, and `precedent: false` tells the studio to let the
 * admin write the variants rather than copy a different product's.
 */
async function templateForGadget(
  db: admin.firestore.Firestore,
  gadgetTypeId: string,
  prefer: { codes?: string[] } = {}
): Promise<{ variants: VariantTemplate[]; finishTypeId?: string; dims: any; precedent: boolean }> {
  const productSnap = await db.collection("products").where("gadgetTypeId", "==", gadgetTypeId).get();
  // Only this gadget's variants: reading all ~1,800 to use a hundred was most
  // of the seven seconds the studio waited on this.
  const ids = productSnap.docs.map((d) => d.id);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const variantSnaps = await Promise.all(
    chunks.map((c) => db.collection("variants").where("productId", "in", c).get())
  );
  const byProduct = new Map<string, any[]>();
  for (const snap of variantSnaps) {
    for (const d of snap.docs) {
      const v = d.data() as any;
      if (!byProduct.has(v.productId)) byProduct.set(v.productId, []);
      byProduct.get(v.productId)!.push(v);
    }
  }

  // A product's shape is its set of SKU tails. The tail is what is left after
  // the design code, which is every leading segment but the last — except for
  // single-variant gadgets, where the whole SKU is the design code.
  const shapes = new Map<string, { count: number; variants: VariantTemplate[] }>();
  for (const list of byProduct.values()) {
    const entries: VariantTemplate[] = list
      .map((v) => {
        const parts = String(v.sku || "").split("-");
        const tail = list.length === 1 && parts.length <= 2 ? "" : parts[parts.length - 1] || "";
        return {
          skuTail: tail.toUpperCase(),
          title: String(v.title || "Default Title"),
          price: Number(v.price) || 0,
          materialMultiplier: Number(v.materialMultiplier) || 1,
          weight: Number(v.weight) || undefined,
        };
      })
      .sort((a, b) => a.skuTail.localeCompare(b.skuTail));
    if (!entries.length || entries.some((e) => !e.price)) continue;
    const key = entries.map((e) => `${e.skuTail}|${e.title}|${e.price}`).join("::");
    const seen = shapes.get(key);
    if (seen) seen.count++;
    else shapes.set(key, { count: 1, variants: entries });
  }

  const codes = new Set((prefer.codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean));
  const ranked = [...shapes.values()].sort((a, b) => b.count - a.count);
  const fits = (v: VariantTemplate[]) => v.every((e) => e.skuTail && codes.has(e.skuTail));
  const best = codes.size ? ranked.find((sh) => fits(sh.variants)) : ranked[0];
  const precedent = !!best;
  const firstCode = [...codes][0] || "";
  const sample = productSnap.docs.find((d) => (d.data() as any).length > 0)?.data() as any;
  return {
    precedent,
    variants: best?.variants || [
      { skuTail: firstCode, title: "Default Title", price: ranked[0]?.variants[0]?.price || 299, materialMultiplier: 1 },
    ],
    finishTypeId: sample?.finishTypeId,
    dims: {
      length: sample?.length ?? 10,
      breadth: sample?.breadth ?? 10,
      height: sample?.height ?? 2,
      weight: sample?.weight ?? 100,
    },
  };
}

/** The shot carries a gadget name; the catalogue keys on the id. */
async function resolveGadget(
  db: admin.firestore.Firestore,
  gadgetTypeId: string,
  gadget: string
): Promise<{ id: string; name: string; displayName: string }> {
  if (gadgetTypeId) {
    const doc = await db.collection("gadgetTypes").doc(gadgetTypeId).get();
    if (doc.exists) {
      const g = doc.data() as any;
      return { id: doc.id, name: g.name || gadget, displayName: g.displayName || g.name || gadget };
    }
  }
  const needle = gadget.trim().toLowerCase();
  if (!needle) throw new HttpsError("invalid-argument", "A gadget is required");
  const all = await db.collection("gadgetTypes").get();
  const hit = all.docs.find((d) => String((d.data() as any).name || "").toLowerCase() === needle);
  if (!hit) throw new HttpsError("not-found", `No gadget type called "${gadget}"`);
  const g = hit.data() as any;
  return { id: hit.id, name: g.name, displayName: g.displayName || g.name };
}

/**
 * A Tranzy skin has no keyboard variant.
 *
 * The transparent film is a matte membrane over the lid; it is not sold for the
 * keyboard deck at all. Left alone the template would copy the two-variant
 * laptop shape and create a "Top + Keyboard Area" that can never be fulfilled —
 * and a lone "Default Title" where "Only Top" is what the listing means.
 */
function applyFinishRules(
  variants: VariantTemplate[],
  gadgetName: string,
  finish: string
): VariantTemplate[] {
  const tranzy = /tranz|transparent|membrane/i.test(finish);
  if (!tranzy || gadgetName.toLowerCase() !== "laptop") return variants;
  const topOnly = variants.filter((v) => !/K$/i.test(v.skuTail) && !/keyboard/i.test(v.title));
  const kept = (topOnly.length ? topOnly : variants.slice(0, 1)).slice(0, 1);
  return kept.map((v) => ({ ...v, title: "Only Top" }));
}

/** What the studio needs to show before it asks the admin to confirm. */
export const getListingTemplate = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();
  const g = await resolveGadget(db, String(data?.gadgetTypeId || ""), String(data?.gadget || ""));
  const tpl = await templateForGadget(db, g.id, {
    codes: Array.isArray(data?.skuCodes) ? data.skuCodes : [],
  });
  return {
    success: true,
    ...tpl,
    gadgetTypeId: g.id,
    gadgetName: g.displayName,
    variants: applyFinishRules(tpl.variants, g.name, String(data?.finish || "")),
  };
});

const SYSTEM = `You write product listings for GoSkinly, an Indian D2C brand selling precision-cut vinyl
skins and wraps for laptops, phones, consoles, cameras, drones and other gadgets.

Write for a real shopper and for Google at the same time. Indian English, warm but not breathless.
The brand is GoSkinly, always one word with the capital G and S; never just "Skinly".
Never invent a specification you were not given — no dimensions, no materials beyond the finish you
are told about, no compatibility claims about specific device models, no warranty terms, no prices.

Reply with JSON only, in exactly this shape:
{
  "title": "60-70 characters. The design name, the finish, the device exactly as given in Device, the word Skin.",
  "slug": "lowercase-hyphenated-from-the-title, no stop words dropped mid-phrase, under 70 chars",
  "metaTitle": "under 60 characters, ends with | GoSkinly",
  "metaDescription": "140-155 characters, one sentence of benefit plus a light call to action",
  "description": "350-500 words of markdown. Open with one bold hook line. Then four or five short
    sections with an emoji and a bold heading each: the design, the finish and feel, precision fit
    for this device, protection and durability, easy application and clean removal. Close with a
    3-question mini FAQ. Use **bold** for headings and blank lines between sections.",
  "tags": ["10-15 lowercase search tags: the subject, the colours, the device, the brand, the finish"],
  "collections": ["0-4 names copied exactly from the Collections list that genuinely fit this design's
    subject or colour; never a device or finish collection; [] if none fit"]
}`;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/** Collections whose membership is decided by the device, not the design. */
const isGadgetCollection = (name: string) => /\bskins?\b|tempered|cases?|covers?|magneto/i.test(name);

/**
 * The device as a shopper searches for it. "OnePlus" alone does not say
 * phone, so a brand-only listing name gets its gadget noun: OnePlus Phone,
 * Xiaomi Redmi Phone. Names that already say what the device is are kept.
 */
const GADGET_NOUNS: Record<string, string> = {
  phone: "Phone", mobile: "Phone", tablet: "Tablet", laptop: "Laptop", charger: "Charger",
  lens: "Lens", camera: "Camera", gimbal: "Gimbal", gimbals: "Gimbal", controller: "Controller",
  console: "Console", drone: "Drone",
};
const SAYS_DEVICE = /phone|laptop|macbook|\btab\b|tablet|ipad|\bpad\b|charger|camera|lens|gimbal|drone|controller|console|ps5|xbox|switch|mac mini/i;

export function deviceNameFor(listingName: string, gadgetLabel: string): string {
  const name = String(listingName || "").trim();
  const label = String(gadgetLabel || "").trim();
  if (!name) return label;
  if (SAYS_DEVICE.test(name)) return name;
  const noun = GADGET_NOUNS[label.toLowerCase()] || GADGET_NOUNS[label.toLowerCase().replace(/s$/, "")] || label;
  return noun ? `${name} ${noun}` : name;
}

/**
 * Reads the copywriter's JSON, and rescues it when the model stops mid-answer.
 *
 * A truncated reply — the description is long and the model sometimes runs
 * into the token ceiling — is still nearly all there, so the fields that did
 * arrive are pulled out rather than losing the whole listing to a parse error.
 */
export function parseCopyJson(raw: string): any | null {
  const text = String(raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  if (!text) return null;
  const body = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1 || undefined);
  for (const candidate of [text, body, `${body.replace(/,\s*$/, "")}}`, `${body.replace(/[^"]*$/, "")}"}`]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* try the next repair */ }
  }
  // Last resort: take the fields one by one out of the half-finished JSON.
  const str = (key: string) => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    try { return m ? JSON.parse(`"${m[1]}"`) : ""; } catch { return m ? m[1] : ""; }
  };
  const list = (key: string) => {
    const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)`));
    return m ? (m[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map((q) => q.slice(1, -1)) : [];
  };
  const out = {
    title: str("title"), slug: str("slug"), metaTitle: str("metaTitle"),
    metaDescription: str("metaDescription"), description: str("description"),
    tags: list("tags"), collections: list("collections"),
  };
  return out.title || out.description ? out : null;
}

export interface ListingCopy {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  description: string;
  tags: string[];
  /** Theme and colour collection ids the copywriter picked. */
  collectionIds: string[];
}

/** The words of a listing, and the theme collections it belongs in. */
export async function writeListingCopy(
  db: admin.firestore.Firestore,
  args: {
    designCode: string;
    designName: string;
    gadgetLabel: string;
    listingName?: string;
    finishLabel: string;
    source: "roll" | "cutout";
    variantTitles: string[];
    themes?: string[];
  }
): Promise<ListingCopy> {
  const collectionSnap = await db.collection("collections").get();
  const themeCollections = collectionSnap.docs
    .map((d) => ({ id: d.id, name: String((d.data() as any).name || (d.data() as any).title || "").trim(), rules: (d.data() as any).rules }))
    .filter((c) => c.name && !isGadgetCollection(c.name) && !(Array.isArray(c.rules) && c.rules.length));

  const apiKey = await resolveOpenAIKey();
  const fetchFn: any = (global as any).fetch || require("node-fetch");
  const listingName = args.listingName || "";
  const device = deviceNameFor(listingName, args.gadgetLabel);
  // Older rolls were named after their whole listing title ("... Matte Finish
  // Skin"); the finish and the word Skin are added back where they belong.
  const designName = String(args.designName || args.designCode)
    .replace(/\s+(\w+\s+)?finish(\s+skin)?\s*$/i, "")
    .replace(/\s+skins?\s*$/i, "")
    .trim() || args.designCode;
  const ask = async (attempt: number) => {
    const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: attempt > 1 ? 0.4 : 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              `Design name: ${designName}\n` +
              `Design code: ${args.designCode}\n` +
              `Gadget: ${args.gadgetLabel}\n` +
              `Device: ${device} (use exactly "${device} Skin" in the title and "${device}" in the meta title, ` +
              `so a shopper can tell which gadget this is)\n` +
              `Finish: ${args.finishLabel}\n` +
              `Material: ${args.source === "cutout" ? "die-cut printed sheet" : "printed vinyl roll"}\n` +
              (args.themes?.length ? `Design themes: ${args.themes.join(", ")}\n` : "") +
              `Variants offered: ${args.variantTitles.join(", ")}\n` +
              `Collections: ${themeCollections.map((c) => c.name).join(" | ")}` +
              // A second run follows a first that came back cut off or empty.
              (attempt > 1 ? "\n\nKeep the description to about 300 words, and reply with the JSON only." : ""),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("writeListingCopy: OpenAI failed", await res.text());
      throw new HttpsError("internal", "The copywriter call failed — try again");
    }
    const body: any = await res.json();
    const choice = body.choices?.[0] || {};
    const parsed = parseCopyJson(choice.message?.content || "");
    // A title with no description is a listing with an empty page, so a reply
    // that arrived only half-written counts as a failure worth retrying.
    const usable = parsed && String(parsed.description || "").trim().length > 200;
    if (!usable) {
      console.error(
        "writeListingCopy: unreadable reply",
        JSON.stringify({
          designCode: args.designCode,
          listing: listingName,
          attempt,
          finishReason: choice.finish_reason || "",
          refusal: choice.message?.refusal || "",
          head: String(choice.message?.content || "").slice(0, 400),
        })
      );
      return { copy: null as any, reason: String(choice.finish_reason || (parsed ? "short description" : "unreadable")) };
    }
    return { copy: parsed, reason: "" };
  };

  let copy: any = null;
  let reason = "";
  for (let attempt = 1; attempt <= 2 && !copy; attempt++) {
    const out = await ask(attempt);
    copy = out.copy;
    reason = out.reason;
  }
  if (!copy) {
    throw new HttpsError("internal", `The copywriter could not finish this listing (${reason}) — run the launch again`);
  }
  const says = (t: string) => t.toLowerCase().includes(device.toLowerCase());
  let title = String(copy.title || "").trim();
  if (!title || !says(title)) title = `${designName} ${args.finishLabel} ${device} Skin`.replace(/\s+/g, " ").trim();
  let metaTitle = String(copy.metaTitle || "").trim();
  if (!metaTitle || !says(metaTitle)) metaTitle = `${designName} ${device} Skin | GoSkinly`;
  const tags: string[] = Array.isArray(copy.tags)
    ? copy.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 15)
    : [];
  // The device is what people search by; it is always a tag.
  for (const t of [`${device} skin`.toLowerCase(), device.toLowerCase()].reverse()) {
    if (!tags.includes(t)) tags.unshift(t);
  }
  const picked = new Set((Array.isArray(copy.collections) ? copy.collections : []).map((n: any) => String(n).trim().toLowerCase()));
  return {
    title,
    slug: slugify(String(copy.slug || title)),
    metaTitle: metaTitle.slice(0, 70),
    metaDescription: String(copy.metaDescription || "").slice(0, 170),
    description: String(copy.description || ""),
    tags: tags.slice(0, 16),
    collectionIds: themeCollections.filter((c) => picked.has(c.name.toLowerCase())).map((c) => c.id),
  };
}

/**
 * Sets a listing's studio-made collection links: the gadget's own collection
 * plus the theme collections the copywriter chose. They carry
 * source:"listing" — the rule-based sync removes only its own "auto" links,
 * which is what used to wipe theme links as soon as a listing was saved.
 */
export async function setListingCollections(
  db: admin.firestore.Firestore,
  productId: string,
  gadgetLabel: string,
  themeIds: string[]
): Promise<number> {
  const [collections, existing] = await Promise.all([
    db.collection("collections").get(),
    db.collection("collectionProducts").where("productId", "==", productId).get(),
  ]);
  const wanted = new Set(themeIds);
  for (const d of collections.docs) {
    const name = String((d.data() as any).name || (d.data() as any).title || "").toLowerCase();
    if (name === `${gadgetLabel.toLowerCase()} skins`) wanted.add(d.id);
  }
  const batch = db.batch();
  const now = Date.now();
  const have = new Map(existing.docs.map((d) => [String((d.data() as any).collectionId), d]));
  for (const d of existing.docs) {
    const x = d.data() as any;
    if (x.source === "listing" && !wanted.has(x.collectionId)) batch.delete(d.ref);
  }
  for (const cid of wanted) {
    if (have.has(cid)) continue;
    batch.set(db.collection("collectionProducts").doc(`${cid}_${productId}`), {
      collectionId: cid,
      productId,
      source: "listing",
      _creationTime: now,
    });
  }
  await batch.commit();
  return wanted.size;
}

/** The catalogue's finish record for a printed finish ("3D Textured" → embossed). */
async function resolveFinish(db: admin.firestore.Firestore, finish: string) {
  const snap = await db.collection("finishTypes").get();
  const needle = finish.toLowerCase();
  const hit = needle
    ? snap.docs.find((d) => {
        const f = d.data() as any;
        const hay = `${f.name} ${f.displayName}`.toLowerCase();
        if (/tranz|transparent|membrane/.test(needle)) return /transparent/.test(hay);
        if (/3d|emboss|textur/.test(needle)) return /emboss/.test(hay);
        return hay.includes(needle);
      })
    : undefined;
  return {
    id: hit?.id,
    name: hit ? String((hit.data() as any).name || "") : "",
    label: hit ? String((hit.data() as any).displayName || finish) : finish || "Matte",
  };
}

const brandList = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];

export interface CreateListingSpec {
  designCode: string;
  designName: string;
  gadgetTypeId?: string;
  gadget: string;
  listing?: string;
  publishNow?: boolean;
  modelBrands?: string[];
  modelBrandsExclude?: string[];
  finish?: string;
  source?: "roll" | "cutout";
  imageUrl?: string;
  themes?: string[];
  variants: VariantTemplate[];
}

/** Creates the product, its variants and its collection links. */
export async function createListing(db: admin.firestore.Firestore, spec: CreateListingSpec) {
  const designCode = String(spec.designCode || "").trim().toUpperCase();
  const designName = String(spec.designName || "").trim();
  const listingName = String(spec.listing || "").trim();
  const publishNow = spec.publishNow === true;
  const modelBrands = brandList(spec.modelBrands);
  const modelBrandsExclude = brandList(spec.modelBrandsExclude);
  const finish = String(spec.finish || "").trim();
  const source: "roll" | "cutout" = spec.source === "cutout" ? "cutout" : "roll";
  const imageUrl = String(spec.imageUrl || "").trim();
  const variants: VariantTemplate[] = Array.isArray(spec.variants) ? spec.variants : [];

  if (!designCode) throw new HttpsError("invalid-argument", "A design code is required");
  if (!variants.length) throw new HttpsError("invalid-argument", "At least one variant is required");
  const gadgetType = await resolveGadget(db, String(spec.gadgetTypeId || ""), String(spec.gadget || "").trim());
  const gadgetTypeId = gadgetType.id;
  if (variants.some((v) => !(Number(v.price) > 0))) {
    throw new HttpsError("invalid-argument", "Every variant needs a price");
  }

  // Refuse to make a second listing for a pair that already has one.
  const skus = variants.map((v) => `${designCode}${v.skuTail ? `-${v.skuTail}` : ""}`.toUpperCase());
  for (let i = 0; i < skus.length; i += 30) {
    const existing = await db.collection("variants").where("sku", "in", skus.slice(i, i + 30)).get();
    if (!existing.empty) {
      throw new HttpsError(
        "already-exists",
        `${existing.docs.map((d) => (d.data() as any).sku).join(", ")} already exists — refresh the studio.`
      );
    }
  }

  const [finishInfo, tpl] = await Promise.all([resolveFinish(db, finish), templateForGadget(db, gadgetTypeId)]);
  const finishTypeId = finishInfo.id || tpl.finishTypeId;
  const copy = await writeListingCopy(db, {
    designCode, designName, gadgetLabel: gadgetType.displayName, listingName,
    finishLabel: finishInfo.label, source, variantTitles: variants.map((v) => v.title), themes: spec.themes,
  });

  let slug = copy.slug;
  // Slugs are the storefront's URLs; a collision would shadow a live page.
  for (let n = 2; ; n++) {
    const clash = await db.collection("products").where("slug", "==", slug).limit(1).get();
    if (clash.empty) break;
    slug = `${copy.slug}-${n}`;
    if (n > 20) throw new HttpsError("internal", "Could not find a free slug");
  }

  const now = Date.now();
  const productRef = db.collection("products").doc();
  await productRef.set({
    _creationTime: now,
    title: copy.title,
    slug,
    description: copy.description,
    metaTitle: copy.metaTitle,
    metaDescription: copy.metaDescription,
    tags: copy.tags,
    // Live now when asked; otherwise a draft until its first mockup is approved.
    status: publishNow ? "active" : "draft",
    ...(publishNow ? { publishedAt: now } : { awaitingImage: true }),
    productCategory: "skin",
    productType: "physical",
    gadgetTypeId,
    gadgetCategory: gadgetType.name,
    ...(finishTypeId ? { finishTypeId } : {}),
    ...(finishInfo.name ? { finishType: finishInfo.name } : {}),
    hasMultipleVariants: variants.length > 1,
    // The raw roll photo is kept for reference but is not a product picture.
    images: [],
    ...(imageUrl ? { designImageUrl: imageUrl } : {}),
    length: tpl.dims.length,
    breadth: tpl.dims.breadth,
    height: tpl.dims.height,
    weight: tpl.dims.weight,
    createdFromDesign: designCode,
    ...(listingName ? { listingKind: listingName } : {}),
    ...(modelBrands.length ? { modelBrands } : {}),
    ...(modelBrandsExclude.length ? { modelBrandsExclude } : {}),
    ...(spec.themes?.length ? { designThemes: spec.themes } : {}),
    createdAt: now,
  });

  const batch = db.batch();
  variants.forEach((v, i) => {
    batch.set(db.collection("variants").doc(), {
      _creationTime: now + i,
      productId: productRef.id,
      sku: skus[i],
      title: String(v.title || "Default Title"),
      price: Number(v.price),
      inventoryQuantity: 0,
      materialMultiplier: Number(v.materialMultiplier) || 1,
      rNumber: designCode,
      weight: Number(v.weight) || tpl.dims.weight,
      weightUnit: "g",
      isDefaultVariant: variants.length === 1 && i === 0,
    });
  });
  await batch.commit();
  const collections = await setListingCollections(db, productRef.id, gadgetType.displayName, copy.collectionIds);

  return { productId: productRef.id, slug, title: copy.title, skus, collections };
}

export const createListingForDesign = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const db = admin.firestore();
  const out = await createListing(db, {
    designCode: data?.designCode,
    designName: data?.designName,
    gadgetTypeId: data?.gadgetTypeId,
    gadget: data?.gadget,
    listing: data?.listing,
    publishNow: data?.publishNow === true,
    modelBrands: data?.modelBrands,
    modelBrandsExclude: data?.modelBrandsExclude,
    finish: data?.finish,
    source: data?.source,
    imageUrl: data?.imageUrl,
    themes: Array.isArray(data?.themes) ? data.themes : undefined,
    variants: Array.isArray(data?.variants) ? data.variants : [],
  });
  // The design already has stock; the new variants start at zero until this
  // reads the shelf and writes what it can actually make.
  try {
    const { syncStockForDesign } = await import("./materials");
    await syncStockForDesign(db, [String(data?.designCode || "").toUpperCase()]);
  } catch (e: any) {
    console.warn("createListingForDesign: stock sync skipped", e?.message || e);
  }
  return { success: true, ...out };
});

/* ---------------------------------------------------------------- revision */

export type VariantOp =
  | { op: "update"; id: string; sku: string; title: string; price?: number; materialMultiplier: number }
  | { op: "create"; sku: string; title: string; price: number; materialMultiplier: number }
  | { op: "delete"; id: string; moveToSku?: string };

export interface ReviseSpec {
  productId: string;
  designCode: string;
  designName: string;
  listing: string;
  finish?: string;
  source?: "roll" | "cutout";
  modelBrands?: string[];
  modelBrandsExclude?: string[];
  themes?: string[];
  variantOps: VariantOp[];
  rewriteCopy: boolean;
}

/** Moves waiting restock requests from one variant to another. */
export async function moveRestockRequests(db: admin.firestore.Firestore, fromVariantId: string, toSku: string) {
  const [waiting, target] = await Promise.all([
    db.collection("stockNotifications").where("variantId", "==", fromVariantId).where("status", "==", "waiting").get(),
    db.collection("variants").where("sku", "==", toSku).limit(1).get(),
  ]);
  if (waiting.empty || target.empty) return 0;
  const to = target.docs[0];
  const tv = to.data() as any;
  const product = await db.collection("products").doc(String(tv.productId)).get();
  const pd = (product.data() || {}) as any;
  let moved = 0;
  for (const n of waiting.docs) {
    const x = n.data() as any;
    await db.collection("stockNotifications").doc(`${to.id}_${x.phoneNumber}`).set({
      ...x,
      variantId: to.id,
      variantTitle: String(tv.title || ""),
      sku: String(tv.sku || ""),
      productId: String(tv.productId),
      productTitle: String(pd.title || ""),
      productSlug: String(pd.slug || ""),
      movedFrom: fromVariantId,
    });
    await n.ref.delete();
    moved++;
  }
  return moved;
}

/**
 * Brings an existing listing into the shape a studio listing has: its
 * variants renamed, repriced or added per the listing's preset, its brand
 * scope set, and — for listings from before the studio — its words and theme
 * collections rewritten. The URL (slug) is kept: that is what search engines
 * and shoppers already know.
 */
export async function reviseListing(db: admin.firestore.Firestore, spec: ReviseSpec) {
  const ref = db.collection("products").doc(spec.productId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", `Product ${spec.productId} is gone`);
  const product = snap.data() as any;
  const designCode = spec.designCode.toUpperCase();
  const gadgetType = await resolveGadget(db, String(product.gadgetTypeId || ""), String(product.gadgetCategory || ""));

  // A SKU may belong to one variant only.
  const newSkus = spec.variantOps.filter((o) => o.op !== "delete").map((o: any) => String(o.sku).toUpperCase());
  const ownIds = new Set(spec.variantOps.filter((o) => o.op !== "create").map((o: any) => o.id));
  for (let i = 0; i < newSkus.length; i += 30) {
    const clash = await db.collection("variants").where("sku", "in", newSkus.slice(i, i + 30)).get();
    const foreign = clash.docs.filter((d) => !ownIds.has(d.id));
    if (foreign.length) {
      throw new HttpsError("already-exists", `${foreign.map((d) => (d.data() as any).sku).join(", ")} already belongs to another listing`);
    }
  }

  const now = Date.now();
  let moved = 0;
  const weight = Number(product.weight) || 100;
  // Creates and updates first, so a deleted variant's waiting customers have
  // somewhere to go.
  for (const op of spec.variantOps) {
    if (op.op === "update") {
      await db.collection("variants").doc(op.id).update({
        sku: op.sku.toUpperCase(),
        title: op.title,
        ...(Number(op.price) > 0 ? { price: Number(op.price) } : {}),
        materialMultiplier: op.materialMultiplier,
        rNumber: designCode,
        revisedAt: now,
      });
    } else if (op.op === "create") {
      await db.collection("variants").doc().set({
        _creationTime: now,
        productId: spec.productId,
        sku: op.sku.toUpperCase(),
        title: op.title,
        price: Number(op.price),
        inventoryQuantity: 0,
        materialMultiplier: op.materialMultiplier,
        rNumber: designCode,
        weight,
        weightUnit: "g",
        isDefaultVariant: false,
      });
    }
  }
  for (const op of spec.variantOps) {
    if (op.op !== "delete") continue;
    if (op.moveToSku) moved += await moveRestockRequests(db, op.id, op.moveToSku.toUpperCase());
    await db.collection("variants").doc(op.id).delete();
  }

  const remaining = await db.collection("variants").where("productId", "==", spec.productId).get();
  const modelBrands = brandList(spec.modelBrands);
  const modelBrandsExclude = brandList(spec.modelBrandsExclude);
  const patch: Record<string, unknown> = {
    listingKind: spec.listing,
    modelBrands: modelBrands.length ? modelBrands : admin.firestore.FieldValue.delete(),
    modelBrandsExclude: modelBrandsExclude.length ? modelBrandsExclude : admin.firestore.FieldValue.delete(),
    hasMultipleVariants: remaining.size > 1,
    createdFromDesign: designCode,
    revisedAt: now,
    updatedAt: now,
    ...(spec.themes?.length ? { designThemes: spec.themes } : {}),
  };

  let collections = 0;
  if (spec.rewriteCopy) {
    const finishInfo = await resolveFinish(db, String(spec.finish || product.finishType || ""));
    const copy = await writeListingCopy(db, {
      designCode,
      designName: spec.designName,
      gadgetLabel: gadgetType.displayName,
      listingName: spec.listing,
      finishLabel: finishInfo.label,
      source: spec.source === "cutout" ? "cutout" : "roll",
      variantTitles: remaining.docs.map((d) => String((d.data() as any).title || "")),
      themes: spec.themes,
    });
    Object.assign(patch, {
      title: copy.title,
      metaTitle: copy.metaTitle,
      metaDescription: copy.metaDescription,
      description: copy.description,
      tags: copy.tags,
      ...(finishInfo.id ? { finishTypeId: finishInfo.id } : {}),
      ...(finishInfo.name ? { finishType: finishInfo.name } : {}),
    });
    collections = await setListingCollections(db, spec.productId, gadgetType.displayName, copy.collectionIds);
  }
  await ref.update(patch);
  return { productId: spec.productId, slug: String(product.slug || ""), moved, collections };
}

/**
 * A first read of a design from its photo: a shop-ready name, the likely
 * finish and the themes it belongs to. The admin confirms before anything
 * uses it.
 */
export const suggestDesignDetails = onCall(async (data: any, context: any) => {
  await requireAdmin(context);
  const imageUrl = String(data?.imageUrl || "");
  if (!/^https:\/\//.test(imageUrl)) throw new HttpsError("invalid-argument", "An https image URL is required");
  const apiKey = await resolveOpenAIKey();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You name printed vinyl skin designs for an Indian gadget-skin shop from a photo of the printed roll or sheet. " +
            "Reply with JSON only: {\"name\": \"2-5 word shop name for the artwork, Title Case, no brand names unless the artwork is a logo design\", " +
            "\"finish\": \"Matte\" | \"3D Textured\" | \"Tranzy (transparent)\" | \"unknown\" (3D Textured if the surface shows raised relief; Tranzy if the design sits on clear film over white backing paper), " +
            "\"themes\": [\"1-4 lowercase themes such as anime, cars, marvel, abstract, nature, space, gaming, minimal, animals, music, sports, quotes, religious\"], " +
            "\"colors\": [\"1-3 lowercase dominant colours\"]}",
        },
        { role: "user", content: [{ type: "image_url", image_url: { url: imageUrl } }] },
      ],
    }),
  });
  if (!res.ok) {
    console.error("suggestDesignDetails failed", await res.text());
    throw new HttpsError("internal", "Could not read the design — fill the details in yourself");
  }
  const body: any = await res.json();
  let out: any = {};
  try { out = JSON.parse(body.choices?.[0]?.message?.content || "{}"); } catch { /* empty */ }
  return {
    name: String(out.name || "").slice(0, 60),
    finish: ["Matte", "3D Textured", "Tranzy (transparent)"].includes(out.finish) ? out.finish : "",
    themes: Array.isArray(out.themes) ? out.themes.map((t: any) => String(t).toLowerCase()).slice(0, 4) : [],
    colors: Array.isArray(out.colors) ? out.colors.map((t: any) => String(t).toLowerCase()).slice(0, 3) : [],
  };
});
