import * as admin from "firebase-admin";
import { resolveOpenAIKey, parseGeneratedContent } from "./seo";

/**
 * What an SEO landing page says, and whether it is fit to publish.
 *
 * The first generator was given a page's name and a list of "brand facts"
 * typed into a prompt — "starting from ₹149", "1000+ models" — and nothing
 * else. So 97 pages promised a ₹149 floor under titles that said "From ₹49",
 * 51 claimed a third of the models we carry, a model page had to invent what
 * it could not be told ("your brand-new MacBook Air…"), and a MacBook page was
 * told to repeat "phone skin India". Every kind of page got the same five
 * headings.
 *
 * Here each page is written from what the catalogue actually holds for it —
 * how many designs, which finishes, which designs are pictured on that exact
 * device, its sister models — under a prompt made for its kind of page. No
 * price goes into the prose: prices move (a 24-hour sale took phone skins to
 * ₹49 and back to ₹199), so they live only in the title and description the
 * build writes from the live catalogue every night. Then the page is checked:
 * long enough, no price, no cash-on-delivery, no stale counts. A page that
 * fails is kept as a draft with its reasons, never published.
 */

export const CONTENT_VERSION = 2;

/* ------------------------------------------------------------------ facts */

export interface SiteFacts {
  models: number;
  brands: number;
  designs: number;
  freeShippingAt: number;
}

/** Rounded down, so the copy can only ever undersell: 3,695 → "3,600+". */
export const claim = (n: number, step = 100) =>
  `${(Math.floor(n / step) * step).toLocaleString("en-IN")}+`;

/** "L-172-PH" → "L-172"; the design a SKU is a cut of. */
export const designCode = (sku: unknown): string | null => {
  const m = String(sku || "").toUpperCase().match(/^([A-Z]{1,3})-?(\d{1,4})/);
  return m ? `${m[1]}-${Number(m[2])}` : null;
};

const FINISH_WORDS: Record<string, string> = {
  matte: "matte",
  embossed: "3D embossed (textured)",
  "3d-textured": "3D textured",
  transparent: "transparent",
};

/** "Yellow And Black Magnet Matte Apple iPhone Skin" → "Yellow And Black Magnet". */
export const designName = (title: unknown): string =>
  String(title || "")
    .replace(/\s*[-–(].*$/, "")
    .split(/\s+(?:matte|3d|embossed|transparent|textured|glossy)\b/i)[0]
    .trim();

/* ---------------------------------------------------------------- context */

export interface WriterContext {
  facts: SiteFacts;
  models: any[];
  /** Active skins, with the design code of their first SKU. */
  skins: Array<{ id: string; title: string; gadget: string; finish: string; exclude: string[]; code: string | null }>;
  /** Design titles by product id, for naming what a mockup shows. */
  titleById: Map<string, string>;
  /** Product ids per collection id. */
  membership: Map<string, string[]>;
  /** Mockups per supportedModel id. */
  mockups: Map<string, number>;
  /** Orders per "brand|model", lower-cased. */
  ordered: Map<string, number>;
  /** Model requests per "brand|model", lower-cased. */
  requested: Map<string, number>;
}

const key = (brand: unknown, model: unknown) =>
  `${String(brand || "").trim().toLowerCase()}|${String(model || "").trim().toLowerCase().replace(new RegExp(`^${String(brand || "").trim().toLowerCase()}\\s+`), "")}`;
export const demandKey = key;

export async function loadWriterContext(db: admin.firestore.Firestore): Promise<WriterContext> {
  const [modelSnap, prodSnap, varSnap, cpSnap, mockSnap, orderSnap, reqSnap, shipSnap] = await Promise.all([
    db.collection("supportedModels").get(),
    db.collection("products").where("status", "==", "active").get(),
    db.collection("variants").select("productId", "sku").get(),
    db.collection("collectionProducts").get(),
    db.collection("mockups").select("supportedModelId").get(),
    db.collection("orders").select("items", "paymentStatus", "paymentMethod").get(),
    db.collection("modelRequests").select("brandName", "modelName").get(),
    db.collection("settings").doc("shipping").get(),
  ]);

  const firstSku = new Map<string, string>();
  for (const d of varSnap.docs) {
    const v = d.data() as any;
    if (v.productId && v.sku && !firstSku.has(v.productId)) firstSku.set(v.productId, v.sku);
  }
  const titleById = new Map<string, string>();
  const skins: WriterContext["skins"] = [];
  for (const d of prodSnap.docs) {
    const p = d.data() as any;
    titleById.set(d.id, String(p.title || ""));
    if (p.productCategory !== "skin") continue;
    skins.push({
      id: d.id,
      title: String(p.title || ""),
      gadget: String(p.gadgetCategory || "").toLowerCase(),
      finish: String(p.finishType || "").toLowerCase(),
      exclude: Array.isArray(p.modelBrandsExclude) ? p.modelBrandsExclude.map((b: any) => String(b).toLowerCase()) : [],
      code: designCode(firstSku.get(d.id)),
    });
  }

  const membership = new Map<string, string[]>();
  for (const d of cpSnap.docs) {
    const r = d.data() as any;
    if (!r.collectionId || !r.productId) continue;
    membership.set(r.collectionId, [...(membership.get(r.collectionId) || []), r.productId]);
  }

  const mockups = new Map<string, number>();
  for (const d of mockSnap.docs) {
    const id = d.get("supportedModelId");
    if (id) mockups.set(id, (mockups.get(id) || 0) + 1);
  }

  const ordered = new Map<string, number>();
  for (const d of orderSnap.docs) {
    const o = d.data() as any;
    const paid = String(o.paymentStatus || "").toLowerCase() === "success" || String(o.paymentMethod || "").toLowerCase() === "cod";
    if (!paid) continue;
    for (const it of o.items || []) {
      if (!it?.phoneModel) continue;
      const k = key(it.phoneBrand, it.phoneModel);
      ordered.set(k, (ordered.get(k) || 0) + (Number(it.quantity) || 1));
    }
  }
  const requested = new Map<string, number>();
  for (const d of reqSnap.docs) {
    const r = d.data() as any;
    const k = key(r.brandName, r.modelName);
    requested.set(k, (requested.get(k) || 0) + 1);
  }

  const models = modelSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((m) => m.isActive !== false && m.brandName && m.modelName);
  const ship = shipSnap.exists ? (shipSnap.data() as any) : {};
  const facts: SiteFacts = {
    models: models.length,
    brands: new Set(models.map((m) => String(m.brandName).trim().toLowerCase())).size,
    designs: new Set(skins.map((s) => s.code).filter(Boolean)).size,
    freeShippingAt: Number(ship.freeShippingThreshold ?? 500),
  };

  return { facts, models, skins, titleById, membership, mockups, ordered, requested };
}

/* ------------------------------------------------------------------ brief */

export interface PageTarget {
  kind: "model" | "brand-gadget" | "theme" | "theme-gadget" | "other";
  slug: string;
  name: string;
  brandName?: string;
  gadget?: string;
  modelId?: string;
  modelName?: string;
  collectionId?: string;
  collection?: string;
}

export interface Brief {
  kind: PageTarget["kind"];
  name: string;
  gadget: string;
  gadgetWord: string;
  brand?: string;
  designCount: number;
  finishes: string[];
  sampleDesigns: string[];
  mockups?: number;
  siblings?: string[];
  modelCount?: number;
  sampleModels?: string[];
  gadgetsCovered?: string[];
}

const GADGET_WORD: Record<string, string> = {
  phone: "phone", laptop: "laptop", tablet: "tablet", camera: "camera", lens: "lens",
  controller: "controller", console: "console", drone: "drone", charger: "charger",
  gimbals: "gimbal", gimbal: "gimbal", "mac-mini": "Mac mini", "action-camera": "action camera",
};

const pickDistinct = (xs: string[], n: number) => [...new Set(xs.filter(Boolean))].slice(0, n);

export async function briefFor(db: admin.firestore.Firestore, ctx: WriterContext, t: PageTarget): Promise<Brief> {
  const gadget = String(t.gadget || "").toLowerCase();
  const brandLc = String(t.brandName || "").toLowerCase();
  const onGadget = ctx.skins.filter((s) => (!gadget || s.gadget === gadget) && !(brandLc && s.exclude.includes(brandLc)));
  const base: Brief = {
    kind: t.kind,
    name: t.name,
    gadget,
    gadgetWord: GADGET_WORD[gadget] || "device",
    ...(t.brandName ? { brand: t.brandName } : {}),
    designCount: new Set(onGadget.map((s) => s.code).filter(Boolean)).size || onGadget.length,
    finishes: pickDistinct(onGadget.map((s) => FINISH_WORDS[s.finish]), 4),
    sampleDesigns: pickDistinct(onGadget.map((s) => designName(s.title)), 8),
  };

  if (t.kind === "model" && t.modelId) {
    base.mockups = ctx.mockups.get(t.modelId) || 0;
    // The designs actually pictured on this device, by name.
    if (base.mockups) {
      const snap = await db.collection("mockups").where("supportedModelId", "==", t.modelId).select("sku").limit(200).get();
      const codes = new Set(snap.docs.map((d) => designCode(d.get("sku"))).filter(Boolean));
      const named = onGadget.filter((s) => s.code && codes.has(s.code)).map((s) => designName(s.title));
      if (named.length) base.sampleDesigns = pickDistinct(named, 8);
    }
    const me = ctx.models.find((m) => m.id === t.modelId);
    if (me) {
      const series = String(me.modelName).split(/\s+/).slice(0, 2).join(" ").toLowerCase();
      base.siblings = pickDistinct(
        ctx.models
          .filter((m) => m.id !== me.id && m.brandName === me.brandName && (m.category || "") === (me.category || "") &&
            String(m.modelName).toLowerCase().startsWith(series))
          .map((m) => String(m.modelName)),
        6,
      );
    }
  }
  if (t.kind === "brand-gadget" && t.brandName) {
    const theirs = ctx.models
      .filter((m) => String(m.brandName).toLowerCase() === brandLc && String(m.category || "").toLowerCase() === gadget)
      .sort((a, b) => (Number(b._creationTime || b.createdAt) || 0) - (Number(a._creationTime || a.createdAt) || 0));
    base.modelCount = theirs.length;
    base.sampleModels = pickDistinct(theirs.map((m) => String(m.modelName)), 10);
  }
  if ((t.kind === "theme" || t.kind === "theme-gadget") && t.collectionId) {
    const ids = new Set(ctx.membership.get(t.collectionId) || []);
    const inTheme = ctx.skins.filter((s) => ids.has(s.id) && (!gadget || s.gadget === gadget));
    base.designCount = new Set(inTheme.map((s) => s.code).filter(Boolean)).size || inTheme.length;
    base.finishes = pickDistinct(inTheme.map((s) => FINISH_WORDS[s.finish]), 4);
    base.sampleDesigns = pickDistinct(inTheme.map((s) => designName(s.title)), 10);
    base.gadgetsCovered = pickDistinct(inTheme.map((s) => GADGET_WORD[s.gadget] || s.gadget), 8);
  }
  return base;
}

/* ---------------------------------------------------------------- prompts */

const SYSTEM = (f: SiteFacts) => `You write landing-page copy for GoSkinly (goskinly.com), an Indian brand of vinyl skins for gadgets. Indian English, direct and friendly, like a knowledgeable friend; no corporate filler.

FACTS YOU MAY USE (all true):
- GoSkinly makes vinyl skins for phones, laptops, tablets, consoles, controllers, cameras, lenses, drones, gimbals, chargers and Mac mini.
- ${claim(f.models)} models from ${f.brands} brands are supported; ${claim(f.designs, 10)} designs.
- Every skin is printed and cut to order for the exact model the customer picks, which is why orders are paid online (UPI, cards, netbanking) when placed.
- Finishes: matte, 3D embossed/textured and transparent (use only those listed in the brief for this page).
- A skin guards against everyday scratches and scuffs, adds little bulk, and comes off without sticky residue.
- Delivery across India; free shipping on orders of ₹${f.freeShippingAt} and above.

NEVER:
- state any price, discount, cashback or offer (prices change daily; the page shows the live price elsewhere). The only ₹ figure allowed is the free-shipping threshold ₹${f.freeShippingAt}.
- mention cash on delivery or COD.
- state any specification, release date, size, camera count, port layout or feature of a device unless it is in the brief.
- claim a warranty, a return window, water or drop protection, or anything about competitors.
- add links or URLs.
- use: "in conclusion", "it's worth noting", "certainly", "as an AI", "top-notch", "look no further", "elevate", "unleash", "game-changer", "seamless".

OUTPUT: JSON only — {"contentHTML": "...", "faqs": [{"question": "...", "answer": "..."}], "imageAltTexts": ["..."]}. contentHTML uses only <h2>, <p>, <ul>, <li>, <strong>.`;

const KEYWORDS: Record<string, (b: Brief) => string[]> = {
  phone: (b) => [`${b.name} skin`, `${b.name} back skin`, `${b.brand || ""} mobile skin`.trim(), "mobile back skin"],
  laptop: (b) => [`${b.name} skin`, "laptop skin", "laptop wrap", `${b.brand || ""} laptop skin`.trim()],
  tablet: (b) => [`${b.name} skin`, "tablet skin", `${b.brand || ""} tablet skin`.trim()],
  console: (b) => [`${b.name} skin`, "console skin", "console wrap"],
  controller: (b) => [`${b.name} skin`, "controller skin"],
  camera: (b) => [`${b.name} skin`, "camera skin", "camera wrap"],
  lens: (b) => [`${b.name} skin`, "lens skin", "lens wrap"],
  drone: (b) => [`${b.name} skin`, "drone skin"],
  charger: (b) => [`${b.name} skin`, "charger skin"],
};
const keywordsFor = (b: Brief) => (KEYWORDS[b.gadget] || ((x: Brief) => [`${x.name}`, "device skin"]))(b).filter(Boolean);

function userPrompt(b: Brief): string {
  const brief = JSON.stringify(b, null, 1);
  const kw = keywordsFor(b).map((k) => `"${k}"`).join(", ");
  if (b.kind === "model") {
    return `Write the page for "${b.name} skins".
BRIEF (the only facts about this device and its designs you may use):
${brief}

STRUCTURE (these headings, in this order, with the name filled in):
<h2>${b.name} skins, cut to order</h2> — 2 short paragraphs: ${b.designCount} designs for this ${b.gadgetWord}${b.mockups ? `, ${b.mockups} of them pictured on the ${b.name} itself so the customer sees the real thing` : ""}; printed and cut for this exact model after ordering.
<h2>Designs people pick for the ${b.name}</h2> — mention 5-8 names from sampleDesigns naturally.
<h2>Finishes</h2> — only the finishes in the brief, one line each on how they look and feel.
<h2>Skin or case?</h2> — honest comparison, no specs.
<h2>How to apply it</h2> — 4-step <ul>.
${b.siblings?.length ? `<h2>Other ${b.brand || ""} models</h2> — one sentence naming: ${b.siblings.join(", ")}.` : ""}
LENGTH: at least 550 words in contentHTML (aim for 600). Use each of these phrases once, naturally: ${kw}.
FAQS: 5, specific to buying a skin for the ${b.name} (fit, finishes, application, removal, delivery). No prices.
imageAltTexts: 4, each naming the ${b.name} and a design from the brief.`;
  }
  if (b.kind === "brand-gadget") {
    return `Write the hub page for "${b.name} skins" — every ${b.brand} ${b.gadgetWord} we cut skins for.
BRIEF:
${brief}

STRUCTURE:
<h2>${b.name} skins for ${b.modelCount} models</h2> — 2 paragraphs: which ${b.brand} ${b.gadgetWord}s are covered (name 6-8 from sampleModels), cut to order for each.
<h2>Finding your exact model</h2> — how to pick the model on the site; the cut depends on it.
<h2>Designs and themes</h2> — mention 5-8 names from sampleDesigns.
<h2>Finishes</h2> — only the finishes in the brief.
<h2>How ordering works</h2> — pick model, pick design, it is printed and cut to order, paid online, shipped across India.
LENGTH: at least 600 words (aim for 650). Use each of these phrases once, naturally: ${kw}.
FAQS: 6 about ${b.brand} ${b.gadgetWord} skins (model coverage, fit, finishes, removal, delivery). No prices.
imageAltTexts: 4.`;
  }
  if (b.kind === "theme" || b.kind === "theme-gadget") {
    return `Write the page for "${b.name}" — a design theme.
BRIEF:
${brief}

STRUCTURE:
<h2>${b.name}</h2> — 2 paragraphs on the theme and who it suits; ${b.designCount} designs.
<h2>Designs in this collection</h2> — mention 6-10 names from sampleDesigns.
<h2>Gadgets it comes on</h2> — the gadgetsCovered, cut to order for the exact model.
<h2>Finishes</h2> — only the finishes in the brief.
<h2>Choosing your design</h2> — practical tips (colour of the device, finish, how busy the art is).
LENGTH: at least 550 words (aim for 600). Use "${b.name.toLowerCase()}" 3-4 times naturally.
FAQS: 5 about this theme's skins. No prices.
imageAltTexts: 4.`;
  }
  return `Write the landing page for "${b.name}".
BRIEF:
${brief}
STRUCTURE: 4-5 <h2> sections that help someone choose a skin for this; mention designs from sampleDesigns and only the finishes in the brief.
LENGTH: at least 550 words. FAQS: 5. imageAltTexts: 4. No prices.`;
}

/* ---------------------------------------------------------------- quality */

const textOf = (html: string) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Why this copy may not be published, or an empty list. */
export function qualityIssues(html: string, faqs: any[], facts: SiteFacts, kind: PageTarget["kind"]): string[] {
  const issues: string[] = [];
  const text = `${textOf(html)} ${(faqs || []).map((f) => `${f?.question || ""} ${f?.answer || ""}`).join(" ")}`;
  const words = textOf(html).split(" ").filter(Boolean).length;
  // Enough to say something real; the prompt asks for more, and GPT-4o
  // writes a little under what it is asked for.
  const floor = kind === "brand-gadget" ? 350 : 300;
  if (words < floor) issues.push(`only ${words} words (needs ${floor})`);
  // ₹, "Rs." (with its full stop — "DJI RS 3" is a gimbal) or INR before a number.
  const prices = [...text.matchAll(/(?:₹|\bRs\.|\bINR)\s?(\d[\d,]*)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const stray = prices.filter((p) => p !== facts.freeShippingAt);
  if (stray.length) issues.push(`mentions a price (₹${stray.slice(0, 3).join(", ₹")})`);
  if (/cash on delivery|\bCOD\b/i.test(text)) issues.push("mentions cash on delivery");
  if (/\b1,?000\s*\+|\b(500|800)\s*\+\s*(designs|models)/i.test(text)) issues.push("states an old count");
  if (/https?:\/\/|<a\s/i.test(html)) issues.push("contains a link");
  const banned = text.match(/in conclusion|it's worth noting|as an ai|top-notch|look no further|elevate|unleash|game-changer|seamless/i);
  if (banned) issues.push(`uses a banned phrase ("${banned[0]}")`);
  if ((faqs || []).filter((f) => f?.question && f?.answer).length < 4) issues.push("fewer than 4 FAQs");
  return issues;
}

/* ------------------------------------------------------------------ write */

async function callModel(system: string, user: string): Promise<{ contentHTML: string; faqs: any[]; imageAltTexts: string[] }> {
  const apiKey = await resolveOpenAIKey();
  const fetch = require("node-fetch");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.6,
      max_tokens: 2600,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  const parsed = parseGeneratedContent(data.choices?.[0]?.message?.content || "");
  // Words the prompt forbids but the model still reaches for are swapped
  // rather than failing a whole page over one adjective.
  const tidy = (t: string) => String(t || "")
    .replace(/\bseamlessly\b/gi, "smoothly").replace(/\bseamless\b/gi, "smooth")
    .replace(/\belevates?\b/gi, "lifts").replace(/\bunleash(es)?\b/gi, "bring$1 out")
    .replace(/\bgame-changer\b/gi, "big help").replace(/\btop-notch\b/gi, "high-quality");
  return {
    contentHTML: tidy(parsed.contentHTML.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")),
    faqs: (parsed.faqs || []).map((f: any) => ({ ...f, question: tidy(f?.question), answer: tidy(f?.answer) })),
    imageAltTexts: parsed.imageAltTexts || [],
  };
}

export interface Written {
  contentHTML: string;
  faqs: any[];
  imageAltTexts: string[];
  issues: string[];
  brief: Brief;
}

/** Writes a page's copy; one retry with the problems named, then the verdict. */
export async function writeCopy(db: admin.firestore.Firestore, ctx: WriterContext, t: PageTarget): Promise<Written> {
  const brief = await briefFor(db, ctx, t);
  const system = SYSTEM(ctx.facts);
  let user = userPrompt(brief);
  let out = await callModel(system, user);
  let issues = qualityIssues(out.contentHTML, out.faqs, ctx.facts, t.kind);
  if (issues.length) {
    user += `\n\nYOUR LAST DRAFT WAS REJECTED FOR: ${issues.join("; ")}. Write it again and fix exactly those.`;
    out = await callModel(system, user);
    issues = qualityIssues(out.contentHTML, out.faqs, ctx.facts, t.kind);
  }
  return { ...out, issues, brief };
}

/**
 * The description kept on the page record. The build replaces it with one
 * written from the live catalogue (counts, finishes, today's lowest price);
 * this is only the fallback, so it names no price.
 */
export function storedDescription(b: Brief, facts: SiteFacts): string {
  const finishes = b.finishes.length ? ` in ${b.finishes.slice(0, 3).join(", ")} finishes` : "";
  if (b.kind === "model") {
    return `${b.designCount} skin designs printed and cut for the ${b.name}${finishes}. Made to order, delivered across India, free shipping over ₹${facts.freeShippingAt}.`;
  }
  if (b.kind === "brand-gadget") {
    return `Skins for ${b.modelCount || "every"} ${b.name} models, ${b.designCount} designs${finishes}, each cut to order. Free shipping over ₹${facts.freeShippingAt}.`;
  }
  return `${b.designCount} ${b.name.toLowerCase()} designs${finishes}, printed and cut for your exact device. Free shipping over ₹${facts.freeShippingAt}.`;
}

/** Old copy that should be rewritten: machine-written, stale claims, or thin. */
export function needsRewrite(page: any): string[] {
  if (Number(page?.contentVersion) >= CONTENT_VERSION) return [];
  const reasons: string[] = [];
  const text = textOf(page?.contentHTML || "");
  const words = text.split(" ").filter(Boolean).length;
  if (page?.autoGenerated === true) reasons.push("written by the old generator");
  if (/₹\s?149|starting from ₹|from just ₹/i.test(text)) reasons.push("states a fixed price");
  if (/\b1,?000\s*\+/i.test(text)) reasons.push("states 1000+");
  if (/cash on delivery|\bCOD\b/i.test(text)) reasons.push("mentions COD");
  if (words < 300) reasons.push(`only ${words} words`);
  return reasons;
}
