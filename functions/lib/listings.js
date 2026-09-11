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
exports.createListingForDesign = exports.getListingTemplate = void 0;
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
    var _a;
    // .env first: that is where the key actually lives for this project. The
    // Firestore doc is the admin-settings convention the SEO tool uses.
    if (process.env.OPENAI_API_KEY)
        return process.env.OPENAI_API_KEY;
    const snap = await admin.firestore().collection("settings").doc("openaiApiKey").get();
    const value = snap.exists ? (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.value : undefined;
    if (value)
        return value;
    throw new https_1.HttpsError("failed-precondition", "No OpenAI key. Add it in Admin → Settings → AI Configuration, or set OPENAI_API_KEY.");
};
/** The variant shape most products of this gadget already use. */
async function templateForGadget(db, gadgetTypeId) {
    var _a, _b, _c, _d, _e;
    const [productSnap, variantSnap] = await Promise.all([
        db.collection("products").where("gadgetTypeId", "==", gadgetTypeId).get(),
        db.collection("variants").get(),
    ]);
    const ids = new Set(productSnap.docs.map((d) => d.id));
    const byProduct = new Map();
    for (const d of variantSnap.docs) {
        const v = d.data();
        if (!ids.has(v.productId))
            continue;
        if (!byProduct.has(v.productId))
            byProduct.set(v.productId, []);
        byProduct.get(v.productId).push(v);
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
    const best = [...shapes.values()].sort((a, b) => b.count - a.count)[0];
    const sample = (_a = productSnap.docs.find((d) => d.data().length > 0)) === null || _a === void 0 ? void 0 : _a.data();
    return {
        variants: (best === null || best === void 0 ? void 0 : best.variants) || [{ skuTail: "", title: "Default Title", price: 299, materialMultiplier: 1 }],
        finishTypeId: sample === null || sample === void 0 ? void 0 : sample.finishTypeId,
        dims: {
            length: (_b = sample === null || sample === void 0 ? void 0 : sample.length) !== null && _b !== void 0 ? _b : 10,
            breadth: (_c = sample === null || sample === void 0 ? void 0 : sample.breadth) !== null && _c !== void 0 ? _c : 10,
            height: (_d = sample === null || sample === void 0 ? void 0 : sample.height) !== null && _d !== void 0 ? _d : 2,
            weight: (_e = sample === null || sample === void 0 ? void 0 : sample.weight) !== null && _e !== void 0 ? _e : 100,
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
    const tpl = await templateForGadget(db, g.id);
    return Object.assign(Object.assign({ success: true }, tpl), { gadgetTypeId: g.id, gadgetName: g.displayName, variants: applyFinishRules(tpl.variants, g.name, String((data === null || data === void 0 ? void 0 : data.finish) || "")) });
});
const SYSTEM = `You write product listings for Skinly, an Indian D2C brand selling precision-cut vinyl
skins and wraps for laptops, phones, consoles, cameras, drones and other gadgets.

Write for a real shopper and for Google at the same time. Indian English, warm but not breathless.
Never invent a specification you were not given — no dimensions, no materials beyond the finish you
are told about, no compatibility claims about specific device models, no warranty terms, no prices.

Reply with JSON only, in exactly this shape:
{
  "title": "60-70 characters. The design name, the finish, the gadget, the word Skin or Wrap.",
  "slug": "lowercase-hyphenated-from-the-title, no stop words dropped mid-phrase, under 70 chars",
  "metaTitle": "under 60 characters, ends with | Skinly",
  "metaDescription": "140-155 characters, one sentence of benefit plus a light call to action",
  "description": "350-500 words of markdown. Open with one bold hook line. Then four or five short
    sections with an emoji and a bold heading each: the design, the finish and feel, precision fit,
    protection and durability, easy application and clean removal. Close with a 3-question mini FAQ.
    Use **bold** for headings and blank lines between sections.",
  "tags": ["10-15 lowercase search tags: the subject, the colours, the gadget, the finish"]
}`;
/** Creates the product, its variants and its collection links. */
exports.createListingForDesign = (0, https_1.onCall)(async (data, context) => {
    var _a, _b, _c;
    await (0, auth_1.requireAdmin)(context);
    const db = admin.firestore();
    const designCode = String((data === null || data === void 0 ? void 0 : data.designCode) || "").trim().toUpperCase();
    const designName = String((data === null || data === void 0 ? void 0 : data.designName) || "").trim();
    const gadgetIn = String((data === null || data === void 0 ? void 0 : data.gadgetTypeId) || "");
    const gadgetName = String((data === null || data === void 0 ? void 0 : data.gadget) || "").trim();
    const finish = String((data === null || data === void 0 ? void 0 : data.finish) || "").trim();
    const source = (data === null || data === void 0 ? void 0 : data.source) === "cutout" ? "cutout" : "roll";
    const imageUrl = String((data === null || data === void 0 ? void 0 : data.imageUrl) || "").trim();
    const variants = Array.isArray(data === null || data === void 0 ? void 0 : data.variants) ? data.variants : [];
    if (!designCode)
        throw new https_1.HttpsError("invalid-argument", "A design code is required");
    if (!variants.length)
        throw new https_1.HttpsError("invalid-argument", "At least one variant is required");
    const gadgetType = await resolveGadget(db, gadgetIn, gadgetName);
    const gadgetTypeId = gadgetType.id;
    if (variants.some((v) => !(Number(v.price) > 0))) {
        throw new https_1.HttpsError("invalid-argument", "Every variant needs a price");
    }
    // Refuse to make a second listing for a pair that already has one — the
    // studio's "no listing" badge can be a stale render, and a duplicate SKU is
    // exactly the mess this tool exists to avoid.
    const tails = variants.map((v) => `${designCode}${v.skuTail ? `-${v.skuTail}` : ""}`.toUpperCase());
    const existing = await db.collection("variants")
        .where("sku", "in", tails.slice(0, 30))
        .get();
    if (!existing.empty) {
        throw new https_1.HttpsError("already-exists", `${existing.docs.map((d) => d.data().sku).join(", ")} already exists — refresh the studio.`);
    }
    const [finishSnap, collectionSnap, tpl] = await Promise.all([
        db.collection("finishTypes").get(),
        db.collection("collections").get(),
        templateForGadget(db, gadgetTypeId),
    ]);
    const gadgetLabel = gadgetType.displayName;
    // Match the finish the design is actually printed in, falling back to what
    // this gadget's other listings use.
    const finishMatch = finishSnap.docs.find((d) => {
        const f = d.data();
        const hay = `${f.name} ${f.displayName}`.toLowerCase();
        const needle = finish.toLowerCase();
        if (!needle)
            return false;
        if (/tranz|transparent|membrane/.test(needle))
            return /transparent/.test(hay);
        if (/3d|emboss|textur/.test(needle))
            return /emboss/.test(hay);
        return hay.includes(needle);
    });
    const finishTypeId = (finishMatch === null || finishMatch === void 0 ? void 0 : finishMatch.id) || tpl.finishTypeId;
    const finishLabel = finishMatch ? finishMatch.data().displayName : finish || "Matte";
    const apiKey = await resolveOpenAIKey();
    const fetchFn = global.fetch || require("node-fetch");
    const res = await fetchFn("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.7,
            max_tokens: 2200,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM },
                {
                    role: "user",
                    content: `Design name: ${designName || designCode}\n` +
                        `Design code: ${designCode}\n` +
                        `Gadget: ${gadgetLabel}\n` +
                        `Finish: ${finishLabel}\n` +
                        `Material: ${source === "cutout" ? "die-cut printed sheet" : "printed vinyl roll"}\n` +
                        `Variants offered: ${variants.map((v) => v.title).join(", ")}`,
                },
            ],
        }),
    });
    if (!res.ok) {
        console.error("createListingForDesign: OpenAI failed", await res.text());
        throw new https_1.HttpsError("internal", "The copywriter call failed — try again");
    }
    const body = await res.json();
    let copy;
    try {
        copy = JSON.parse(((_c = (_b = (_a = body.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "{}");
    }
    catch (_d) {
        throw new https_1.HttpsError("internal", "The copywriter returned something unreadable");
    }
    const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const title = String(copy.title || `${designName || designCode} ${finishLabel} ${gadgetLabel} Skin`).trim();
    let slug = slugify(String(copy.slug || title));
    // Slugs are the storefront's URLs; a collision would shadow a live page.
    for (let n = 2;; n++) {
        const clash = await db.collection("products").where("slug", "==", slug).limit(1).get();
        if (clash.empty)
            break;
        slug = `${slugify(String(copy.slug || title))}-${n}`;
        if (n > 20)
            throw new https_1.HttpsError("internal", "Could not find a free slug");
    }
    const tags = Array.isArray(copy.tags)
        ? copy.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 15)
        : [];
    const now = Date.now();
    const productRef = db.collection("products").doc();
    await productRef.set(Object.assign(Object.assign(Object.assign({ _creationTime: now, title,
        slug, description: String(copy.description || ""), metaTitle: String(copy.metaTitle || `${title} | Skinly`).slice(0, 70), metaDescription: String(copy.metaDescription || "").slice(0, 170), tags, status: "active", productCategory: "skin", productType: "physical", gadgetTypeId, gadgetCategory: gadgetType.name }, (finishTypeId ? { finishTypeId } : {})), (finishMatch ? { finishType: finishMatch.data().name } : {})), { hasMultipleVariants: variants.length > 1, images: imageUrl ? [{ url: imageUrl, alt: designCode }] : [], length: tpl.dims.length, breadth: tpl.dims.breadth, height: tpl.dims.height, weight: tpl.dims.weight, createdFromDesign: designCode, createdAt: now }));
    const batch = db.batch();
    variants.forEach((v, i) => {
        const ref = db.collection("variants").doc();
        batch.set(ref, {
            _creationTime: now + i,
            productId: productRef.id,
            sku: `${designCode}${v.skuTail ? `-${v.skuTail}` : ""}`.toUpperCase(),
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
    // Auto-collections: the gadget's own collection, plus any collection whose
    // name the generated tags name back. Both are the rules the catalogue
    // already follows, so a new listing lands where its siblings are.
    const wanted = new Set();
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    for (const d of collectionSnap.docs) {
        const c = d.data();
        const name = String(c.name || c.title || "").toLowerCase();
        if (!name)
            continue;
        if (name === `${gadgetLabel.toLowerCase()} skins`)
            wanted.add(d.id);
        else if (tagSet.has(name))
            wanted.add(d.id);
    }
    for (const cid of wanted) {
        batch.set(db.collection("collectionProducts").doc(`${cid}_${productRef.id}`), {
            collectionId: cid,
            productId: productRef.id,
            source: "auto",
            _creationTime: now,
        });
    }
    await batch.commit();
    // The design already has stock; the new variants start at zero until this
    // reads the shelf and writes what it can actually make.
    try {
        const { syncStockForDesign } = await Promise.resolve().then(() => __importStar(require("./materials")));
        await syncStockForDesign(db, [designCode]);
    }
    catch (e) {
        console.warn("createListingForDesign: stock sync skipped", (e === null || e === void 0 ? void 0 : e.message) || e);
    }
    return {
        success: true,
        productId: productRef.id,
        slug,
        title,
        skus: variants.map((v) => `${designCode}${v.skuTail ? `-${v.skuTail}` : ""}`.toUpperCase()),
        collections: wanted.size,
    };
});
//# sourceMappingURL=listings.js.map