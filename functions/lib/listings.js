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
exports.suggestDesignDetails = exports.reviseListing = exports.moveRestockRequests = exports.createListingForDesign = exports.createListing = exports.setListingCollections = exports.writeListingCopy = exports.getListingTemplate = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v1/https");
const auth_1 = require("./auth");
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
const resolveOpenAIKey = async () => {
    // .env first: that is where the key actually lives for this project. The
    // Firestore doc is the admin-settings convention the SEO tool uses.
    // Environment only: `settings` is world-readable by rule, so a key kept there
    // is a key anyone can download.
    if (process.env.OPENAI_API_KEY)
        return process.env.OPENAI_API_KEY;
    throw new https_1.HttpsError("failed-precondition", "OPENAI_API_KEY is not set in the functions environment.");
};
/**
 * The variant shape most products of this listing kind already use.
 *
 * One gadget can hold several kinds of listing — PS5, Series X and Series S
 * are all consoles — so the caller names the SKU view codes its pictures are
 * for, and only shapes made entirely of those codes count. With no such shape
 * there is no precedent, and `precedent: false` tells the studio to let the
 * admin write the variants rather than copy a different product's.
 */
async function templateForGadget(db, gadgetTypeId, prefer = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const productSnap = await db.collection("products").where("gadgetTypeId", "==", gadgetTypeId).get();
    // Only this gadget's variants: reading all ~1,800 to use a hundred was most
    // of the seven seconds the studio waited on this.
    const ids = productSnap.docs.map((d) => d.id);
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30)
        chunks.push(ids.slice(i, i + 30));
    const variantSnaps = await Promise.all(chunks.map((c) => db.collection("variants").where("productId", "in", c).get()));
    const byProduct = new Map();
    for (const snap of variantSnaps) {
        for (const d of snap.docs) {
            const v = d.data();
            if (!byProduct.has(v.productId))
                byProduct.set(v.productId, []);
            byProduct.get(v.productId).push(v);
        }
    }
    // A product's shape is its set of SKU tails. The tail is what is left after
    // the design code, which is every leading segment but the last — except for
    // single-variant gadgets, where the whole SKU is the design code.
    const shapes = new Map();
    for (const list of byProduct.values()) {
        const entries = list
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
        if (!entries.length || entries.some((e) => !e.price))
            continue;
        const key = entries.map((e) => `${e.skuTail}|${e.title}|${e.price}`).join("::");
        const seen = shapes.get(key);
        if (seen)
            seen.count++;
        else
            shapes.set(key, { count: 1, variants: entries });
    }
    const codes = new Set((prefer.codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean));
    const ranked = [...shapes.values()].sort((a, b) => b.count - a.count);
    const fits = (v) => v.every((e) => e.skuTail && codes.has(e.skuTail));
    const best = codes.size ? ranked.find((sh) => fits(sh.variants)) : ranked[0];
    const precedent = !!best;
    const firstCode = [...codes][0] || "";
    const sample = (_a = productSnap.docs.find((d) => d.data().length > 0)) === null || _a === void 0 ? void 0 : _a.data();
    return {
        precedent,
        variants: (best === null || best === void 0 ? void 0 : best.variants) || [
            { skuTail: firstCode, title: "Default Title", price: ((_c = (_b = ranked[0]) === null || _b === void 0 ? void 0 : _b.variants[0]) === null || _c === void 0 ? void 0 : _c.price) || 299, materialMultiplier: 1 },
        ],
        finishTypeId: sample === null || sample === void 0 ? void 0 : sample.finishTypeId,
        dims: {
            length: (_d = sample === null || sample === void 0 ? void 0 : sample.length) !== null && _d !== void 0 ? _d : 10,
            breadth: (_e = sample === null || sample === void 0 ? void 0 : sample.breadth) !== null && _e !== void 0 ? _e : 10,
            height: (_f = sample === null || sample === void 0 ? void 0 : sample.height) !== null && _f !== void 0 ? _f : 2,
            weight: (_g = sample === null || sample === void 0 ? void 0 : sample.weight) !== null && _g !== void 0 ? _g : 100,
        },
    };
}
/** The shot carries a gadget name; the catalogue keys on the id. */
async function resolveGadget(db, gadgetTypeId, gadget) {
    if (gadgetTypeId) {
        const doc = await db.collection("gadgetTypes").doc(gadgetTypeId).get();
        if (doc.exists) {
            const g = doc.data();
            return { id: doc.id, name: g.name || gadget, displayName: g.displayName || g.name || gadget };
        }
    }
    const needle = gadget.trim().toLowerCase();
    if (!needle)
        throw new https_1.HttpsError("invalid-argument", "A gadget is required");
    const all = await db.collection("gadgetTypes").get();
    const hit = all.docs.find((d) => String(d.data().name || "").toLowerCase() === needle);
    if (!hit)
        throw new https_1.HttpsError("not-found", `No gadget type called "${gadget}"`);
    const g = hit.data();
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
function applyFinishRules(variants, gadgetName, finish) {
    const tranzy = /tranz|transparent|membrane/i.test(finish);
    if (!tranzy || gadgetName.toLowerCase() !== "laptop")
        return variants;
    const topOnly = variants.filter((v) => !/K$/i.test(v.skuTail) && !/keyboard/i.test(v.title));
    const kept = (topOnly.length ? topOnly : variants.slice(0, 1)).slice(0, 1);
    return kept.map((v) => (Object.assign(Object.assign({}, v), { title: "Only Top" })));
}
/** What the studio needs to show before it asks the admin to confirm. */
exports.getListingTemplate = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const db = admin.firestore();
    const g = await resolveGadget(db, String((data === null || data === void 0 ? void 0 : data.gadgetTypeId) || ""), String((data === null || data === void 0 ? void 0 : data.gadget) || ""));
    const tpl = await templateForGadget(db, g.id, {
        codes: Array.isArray(data === null || data === void 0 ? void 0 : data.skuCodes) ? data.skuCodes : [],
    });
    return Object.assign(Object.assign({ success: true }, tpl), { gadgetTypeId: g.id, gadgetName: g.displayName, variants: applyFinishRules(tpl.variants, g.name, String((data === null || data === void 0 ? void 0 : data.finish) || "")) });
});
const SYSTEM = `You write product listings for Skinly, an Indian D2C brand selling precision-cut vinyl
skins and wraps for laptops, phones, consoles, cameras, drones and other gadgets.

Write for a real shopper and for Google at the same time. Indian English, warm but not breathless.
Never invent a specification you were not given — no dimensions, no materials beyond the finish you
are told about, no compatibility claims about specific device models, no warranty terms, no prices.

Reply with JSON only, in exactly this shape:
{
  "title": "60-70 characters. The design name, the finish, the device (as named in Product), the word Skin.",
  "slug": "lowercase-hyphenated-from-the-title, no stop words dropped mid-phrase, under 70 chars",
  "metaTitle": "under 60 characters, ends with | Skinly",
  "metaDescription": "140-155 characters, one sentence of benefit plus a light call to action",
  "description": "350-500 words of markdown. Open with one bold hook line. Then four or five short
    sections with an emoji and a bold heading each: the design, the finish and feel, precision fit
    for this device, protection and durability, easy application and clean removal. Close with a
    3-question mini FAQ. Use **bold** for headings and blank lines between sections.",
  "tags": ["10-15 lowercase search tags: the subject, the colours, the device, the brand, the finish"],
  "collections": ["0-4 names copied exactly from the Collections list that genuinely fit this design's
    subject or colour; never a device or finish collection; [] if none fit"]
}`;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
/** Collections whose membership is decided by the device, not the design. */
const isGadgetCollection = (name) => /\bskins?\b|tempered|cases?|covers?|magneto/i.test(name);
/** The words of a listing, and the theme collections it belongs in. */
async function writeListingCopy(db, args) {
    var _a, _b, _c, _d;
    const collectionSnap = await db.collection("collections").get();
    const themeCollections = collectionSnap.docs
        .map((d) => ({ id: d.id, name: String(d.data().name || d.data().title || "").trim(), rules: d.data().rules }))
        .filter((c) => c.name && !isGadgetCollection(c.name) && !(Array.isArray(c.rules) && c.rules.length));
    const apiKey = await resolveOpenAIKey();
    const fetchFn = global.fetch || require("node-fetch");
    const listingName = args.listingName || "";
    const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.7,
            max_tokens: 2400,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM },
                {
                    role: "user",
                    content: `Design name: ${args.designName || args.designCode}\n` +
                        `Design code: ${args.designCode}\n` +
                        `Gadget: ${args.gadgetLabel}\n` +
                        (listingName && listingName.toLowerCase() !== args.gadgetLabel.toLowerCase()
                            ? `Product: a skin for ${listingName} devices (name this device family in the title)\n`
                            : "") +
                        `Finish: ${args.finishLabel}\n` +
                        `Material: ${args.source === "cutout" ? "die-cut printed sheet" : "printed vinyl roll"}\n` +
                        (((_a = args.themes) === null || _a === void 0 ? void 0 : _a.length) ? `Design themes: ${args.themes.join(", ")}\n` : "") +
                        `Variants offered: ${args.variantTitles.join(", ")}\n` +
                        `Collections: ${themeCollections.map((c) => c.name).join(" | ")}`,
                },
            ],
        }),
    });
    if (!res.ok) {
        console.error("writeListingCopy: OpenAI failed", await res.text());
        throw new https_1.HttpsError("internal", "The copywriter call failed — try again");
    }
    const body = await res.json();
    let copy;
    try {
        copy = JSON.parse(((_d = (_c = (_b = body.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "{}");
    }
    catch (_e) {
        throw new https_1.HttpsError("internal", "The copywriter returned something unreadable");
    }
    const title = String(copy.title || `${args.designName || args.designCode} ${args.finishLabel} ${listingName || args.gadgetLabel} Skin`).trim();
    const tags = Array.isArray(copy.tags)
        ? copy.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 15)
        : [];
    const picked = new Set((Array.isArray(copy.collections) ? copy.collections : []).map((n) => String(n).trim().toLowerCase()));
    return {
        title,
        slug: slugify(String(copy.slug || title)),
        metaTitle: String(copy.metaTitle || `${title} | Skinly`).slice(0, 70),
        metaDescription: String(copy.metaDescription || "").slice(0, 170),
        description: String(copy.description || ""),
        tags,
        collectionIds: themeCollections.filter((c) => picked.has(c.name.toLowerCase())).map((c) => c.id),
    };
}
exports.writeListingCopy = writeListingCopy;
/**
 * Sets a listing's studio-made collection links: the gadget's own collection
 * plus the theme collections the copywriter chose. They carry
 * source:"listing" — the rule-based sync removes only its own "auto" links,
 * which is what used to wipe theme links as soon as a listing was saved.
 */
async function setListingCollections(db, productId, gadgetLabel, themeIds) {
    const [collections, existing] = await Promise.all([
        db.collection("collections").get(),
        db.collection("collectionProducts").where("productId", "==", productId).get(),
    ]);
    const wanted = new Set(themeIds);
    for (const d of collections.docs) {
        const name = String(d.data().name || d.data().title || "").toLowerCase();
        if (name === `${gadgetLabel.toLowerCase()} skins`)
            wanted.add(d.id);
    }
    const batch = db.batch();
    const now = Date.now();
    const have = new Map(existing.docs.map((d) => [String(d.data().collectionId), d]));
    for (const d of existing.docs) {
        const x = d.data();
        if (x.source === "listing" && !wanted.has(x.collectionId))
            batch.delete(d.ref);
    }
    for (const cid of wanted) {
        if (have.has(cid))
            continue;
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
exports.setListingCollections = setListingCollections;
/** The catalogue's finish record for a printed finish ("3D Textured" → embossed). */
async function resolveFinish(db, finish) {
    const snap = await db.collection("finishTypes").get();
    const needle = finish.toLowerCase();
    const hit = needle
        ? snap.docs.find((d) => {
            const f = d.data();
            const hay = `${f.name} ${f.displayName}`.toLowerCase();
            if (/tranz|transparent|membrane/.test(needle))
                return /transparent/.test(hay);
            if (/3d|emboss|textur/.test(needle))
                return /emboss/.test(hay);
            return hay.includes(needle);
        })
        : undefined;
    return {
        id: hit === null || hit === void 0 ? void 0 : hit.id,
        name: hit ? String(hit.data().name || "") : "",
        label: hit ? String(hit.data().displayName || finish) : finish || "Matte",
    };
}
const brandList = (v) => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
/** Creates the product, its variants and its collection links. */
async function createListing(db, spec) {
    var _a;
    const designCode = String(spec.designCode || "").trim().toUpperCase();
    const designName = String(spec.designName || "").trim();
    const listingName = String(spec.listing || "").trim();
    const publishNow = spec.publishNow === true;
    const modelBrands = brandList(spec.modelBrands);
    const modelBrandsExclude = brandList(spec.modelBrandsExclude);
    const finish = String(spec.finish || "").trim();
    const source = spec.source === "cutout" ? "cutout" : "roll";
    const imageUrl = String(spec.imageUrl || "").trim();
    const variants = Array.isArray(spec.variants) ? spec.variants : [];
    if (!designCode)
        throw new https_1.HttpsError("invalid-argument", "A design code is required");
    if (!variants.length)
        throw new https_1.HttpsError("invalid-argument", "At least one variant is required");
    const gadgetType = await resolveGadget(db, String(spec.gadgetTypeId || ""), String(spec.gadget || "").trim());
    const gadgetTypeId = gadgetType.id;
    if (variants.some((v) => !(Number(v.price) > 0))) {
        throw new https_1.HttpsError("invalid-argument", "Every variant needs a price");
    }
    // Refuse to make a second listing for a pair that already has one.
    const skus = variants.map((v) => `${designCode}${v.skuTail ? `-${v.skuTail}` : ""}`.toUpperCase());
    for (let i = 0; i < skus.length; i += 30) {
        const existing = await db.collection("variants").where("sku", "in", skus.slice(i, i + 30)).get();
        if (!existing.empty) {
            throw new https_1.HttpsError("already-exists", `${existing.docs.map((d) => d.data().sku).join(", ")} already exists — refresh the studio.`);
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
    for (let n = 2;; n++) {
        const clash = await db.collection("products").where("slug", "==", slug).limit(1).get();
        if (clash.empty)
            break;
        slug = `${copy.slug}-${n}`;
        if (n > 20)
            throw new https_1.HttpsError("internal", "Could not find a free slug");
    }
    const now = Date.now();
    const productRef = db.collection("products").doc();
    await productRef.set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ _creationTime: now, title: copy.title, slug, description: copy.description, metaTitle: copy.metaTitle, metaDescription: copy.metaDescription, tags: copy.tags, 
        // Live now when asked; otherwise a draft until its first mockup is approved.
        status: publishNow ? "active" : "draft" }, (publishNow ? { publishedAt: now } : { awaitingImage: true })), { productCategory: "skin", productType: "physical", gadgetTypeId, gadgetCategory: gadgetType.name }), (finishTypeId ? { finishTypeId } : {})), (finishInfo.name ? { finishType: finishInfo.name } : {})), { hasMultipleVariants: variants.length > 1, 
        // The raw roll photo is kept for reference but is not a product picture.
        images: [] }), (imageUrl ? { designImageUrl: imageUrl } : {})), { length: tpl.dims.length, breadth: tpl.dims.breadth, height: tpl.dims.height, weight: tpl.dims.weight, createdFromDesign: designCode }), (listingName ? { listingKind: listingName } : {})), (modelBrands.length ? { modelBrands } : {})), (modelBrandsExclude.length ? { modelBrandsExclude } : {})), (((_a = spec.themes) === null || _a === void 0 ? void 0 : _a.length) ? { designThemes: spec.themes } : {})), { createdAt: now }));
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
exports.createListing = createListing;
exports.createListingForDesign = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    const db = admin.firestore();
    const out = await createListing(db, {
        designCode: data === null || data === void 0 ? void 0 : data.designCode,
        designName: data === null || data === void 0 ? void 0 : data.designName,
        gadgetTypeId: data === null || data === void 0 ? void 0 : data.gadgetTypeId,
        gadget: data === null || data === void 0 ? void 0 : data.gadget,
        listing: data === null || data === void 0 ? void 0 : data.listing,
        publishNow: (data === null || data === void 0 ? void 0 : data.publishNow) === true,
        modelBrands: data === null || data === void 0 ? void 0 : data.modelBrands,
        modelBrandsExclude: data === null || data === void 0 ? void 0 : data.modelBrandsExclude,
        finish: data === null || data === void 0 ? void 0 : data.finish,
        source: data === null || data === void 0 ? void 0 : data.source,
        imageUrl: data === null || data === void 0 ? void 0 : data.imageUrl,
        themes: Array.isArray(data === null || data === void 0 ? void 0 : data.themes) ? data.themes : undefined,
        variants: Array.isArray(data === null || data === void 0 ? void 0 : data.variants) ? data.variants : [],
    });
    // The design already has stock; the new variants start at zero until this
    // reads the shelf and writes what it can actually make.
    try {
        const { syncStockForDesign } = await Promise.resolve().then(() => __importStar(require("./materials")));
        await syncStockForDesign(db, [String((data === null || data === void 0 ? void 0 : data.designCode) || "").toUpperCase()]);
    }
    catch (e) {
        console.warn("createListingForDesign: stock sync skipped", (e === null || e === void 0 ? void 0 : e.message) || e);
    }
    return Object.assign({ success: true }, out);
});
/** Moves waiting restock requests from one variant to another. */
async function moveRestockRequests(db, fromVariantId, toSku) {
    const [waiting, target] = await Promise.all([
        db.collection("stockNotifications").where("variantId", "==", fromVariantId).where("status", "==", "waiting").get(),
        db.collection("variants").where("sku", "==", toSku).limit(1).get(),
    ]);
    if (waiting.empty || target.empty)
        return 0;
    const to = target.docs[0];
    const tv = to.data();
    const product = await db.collection("products").doc(String(tv.productId)).get();
    const pd = (product.data() || {});
    let moved = 0;
    for (const n of waiting.docs) {
        const x = n.data();
        await db.collection("stockNotifications").doc(`${to.id}_${x.phoneNumber}`).set(Object.assign(Object.assign({}, x), { variantId: to.id, variantTitle: String(tv.title || ""), sku: String(tv.sku || ""), productId: String(tv.productId), productTitle: String(pd.title || ""), productSlug: String(pd.slug || ""), movedFrom: fromVariantId }));
        await n.ref.delete();
        moved++;
    }
    return moved;
}
exports.moveRestockRequests = moveRestockRequests;
/**
 * Brings an existing listing into the shape a studio listing has: its
 * variants renamed, repriced or added per the listing's preset, its brand
 * scope set, and — for listings from before the studio — its words and theme
 * collections rewritten. The URL (slug) is kept: that is what search engines
 * and shoppers already know.
 */
async function reviseListing(db, spec) {
    var _a;
    const ref = db.collection("products").doc(spec.productId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", `Product ${spec.productId} is gone`);
    const product = snap.data();
    const designCode = spec.designCode.toUpperCase();
    const gadgetType = await resolveGadget(db, String(product.gadgetTypeId || ""), String(product.gadgetCategory || ""));
    // A SKU may belong to one variant only.
    const newSkus = spec.variantOps.filter((o) => o.op !== "delete").map((o) => String(o.sku).toUpperCase());
    const ownIds = new Set(spec.variantOps.filter((o) => o.op !== "create").map((o) => o.id));
    for (let i = 0; i < newSkus.length; i += 30) {
        const clash = await db.collection("variants").where("sku", "in", newSkus.slice(i, i + 30)).get();
        const foreign = clash.docs.filter((d) => !ownIds.has(d.id));
        if (foreign.length) {
            throw new https_1.HttpsError("already-exists", `${foreign.map((d) => d.data().sku).join(", ")} already belongs to another listing`);
        }
    }
    const now = Date.now();
    let moved = 0;
    const weight = Number(product.weight) || 100;
    // Creates and updates first, so a deleted variant's waiting customers have
    // somewhere to go.
    for (const op of spec.variantOps) {
        if (op.op === "update") {
            await db.collection("variants").doc(op.id).update(Object.assign(Object.assign({ sku: op.sku.toUpperCase(), title: op.title }, (Number(op.price) > 0 ? { price: Number(op.price) } : {})), { materialMultiplier: op.materialMultiplier, rNumber: designCode, revisedAt: now }));
        }
        else if (op.op === "create") {
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
        if (op.op !== "delete")
            continue;
        if (op.moveToSku)
            moved += await moveRestockRequests(db, op.id, op.moveToSku.toUpperCase());
        await db.collection("variants").doc(op.id).delete();
    }
    const remaining = await db.collection("variants").where("productId", "==", spec.productId).get();
    const modelBrands = brandList(spec.modelBrands);
    const modelBrandsExclude = brandList(spec.modelBrandsExclude);
    const patch = Object.assign({ listingKind: spec.listing, modelBrands: modelBrands.length ? modelBrands : admin.firestore.FieldValue.delete(), modelBrandsExclude: modelBrandsExclude.length ? modelBrandsExclude : admin.firestore.FieldValue.delete(), hasMultipleVariants: remaining.size > 1, createdFromDesign: designCode, revisedAt: now, updatedAt: now }, (((_a = spec.themes) === null || _a === void 0 ? void 0 : _a.length) ? { designThemes: spec.themes } : {}));
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
            variantTitles: remaining.docs.map((d) => String(d.data().title || "")),
            themes: spec.themes,
        });
        Object.assign(patch, Object.assign(Object.assign({ title: copy.title, metaTitle: copy.metaTitle, metaDescription: copy.metaDescription, description: copy.description, tags: copy.tags }, (finishInfo.id ? { finishTypeId: finishInfo.id } : {})), (finishInfo.name ? { finishType: finishInfo.name } : {})));
        collections = await setListingCollections(db, spec.productId, gadgetType.displayName, copy.collectionIds);
    }
    await ref.update(patch);
    return { productId: spec.productId, slug: String(product.slug || ""), moved, collections };
}
exports.reviseListing = reviseListing;
/**
 * A first read of a design from its photo: a shop-ready name, the likely
 * finish and the themes it belongs to. The admin confirms before anything
 * uses it.
 */
exports.suggestDesignDetails = (0, https_1.onCall)(async (data, context) => {
    var _a, _b, _c;
    await (0, auth_1.requireAdmin)(context);
    const imageUrl = String((data === null || data === void 0 ? void 0 : data.imageUrl) || "");
    if (!/^https:\/\//.test(imageUrl))
        throw new https_1.HttpsError("invalid-argument", "An https image URL is required");
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
                    content: "You name printed vinyl skin designs for an Indian gadget-skin shop from a photo of the printed roll or sheet. " +
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
        throw new https_1.HttpsError("internal", "Could not read the design — fill the details in yourself");
    }
    const body = await res.json();
    let out = {};
    try {
        out = JSON.parse(((_c = (_b = (_a = body.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "{}");
    }
    catch ( /* empty */_d) { /* empty */ }
    return {
        name: String(out.name || "").slice(0, 60),
        finish: ["Matte", "3D Textured", "Tranzy (transparent)"].includes(out.finish) ? out.finish : "",
        themes: Array.isArray(out.themes) ? out.themes.map((t) => String(t).toLowerCase()).slice(0, 4) : [],
        colors: Array.isArray(out.colors) ? out.colors.map((t) => String(t).toLowerCase()).slice(0, 3) : [],
    };
});
//# sourceMappingURL=listings.js.map