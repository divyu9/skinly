import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { askClaudeJson } from "./seo";
import { requestRebuild } from "./rebuild";
import { GUIDE_TOPICS, HAND_WRITTEN, type GuideTopic } from "./guideTopics";

/**
 * A new guide every other day, written by Claude Sonnet 5.5.
 *
 * The thirteen guides that started /guides were written by hand
 * (src/content/guides.mjs). This keeps the section growing: it takes the next
 * topic from the queue (guideTopics in Firestore first, then guideTopics.ts),
 * gives the writer the facts of how the shop actually works and the pages it
 * may link to, and checks the article before it goes out — the same checks
 * the build applies (src/lib/guides.mjs guideIssues): long enough, a short
 * answer, four sections, three FAQs, three working internal links, no price,
 * no cash on delivery. An article that fails is kept as a draft with its
 * reasons; one that passes is published and the storefront rebuilt.
 *
 * Stored whole as JSON in `guide`, because a table's rows are arrays of
 * arrays and Firestore can't hold those as fields. scripts/prerender.mjs
 * reads the published ones and writes their pages.
 *
 * Settings (settings/<KEY>.value): GUIDES_AUTO_ENABLED (default on),
 * GUIDES_AUTO_PUBLISH (default on), GUIDES_AUTO_EVERY_HOURS (default 44, so
 * a nightly run writes every second night).
 */

const MODEL = "claude-sonnet-5-5";
const MIN_WORDS = 900;

async function setting(db: admin.firestore.Firestore, key: string): Promise<any> {
  const snap = await db.collection("settings").doc(key).get();
  return snap.exists ? (snap.data() as any)?.value : undefined;
}

/* ------------------------------------------------------------- the checks */

type Block = string | Record<string, any>;
interface Guide {
  slug: string; cluster: string; title: string; metaTitle: string; description: string;
  updated: string; published?: string; answer: string; cover?: string;
  images?: Record<string, { alt: string; caption?: string; prompt: string; src?: string }>;
  sections: Array<{ id: string; h2: string; blocks: Block[] }>;
  faqs?: Array<{ q: string; a: string }>;
  related?: string[]; shop?: Array<{ label: string; href: string }>;
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const plain = (t: string) => String(t || "").replace(LINK, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");

function blockText(b: Block): string {
  if (typeof b === "string") return b;
  if (Array.isArray(b.ul) || Array.isArray(b.ol)) return (b.ul || b.ol).join(" ");
  if (b.table) return [...(b.table.head || []), ...(b.table.rows || []).flat()].join(" ");
  return b.h3 || b.tip || b.note || "";
}

/** Every string in the article that can carry a link, so links can be checked and mended. */
function mapText(g: Guide, fn: (t: string) => string): void {
  g.answer = fn(g.answer);
  for (const s of g.sections) {
    s.blocks = s.blocks.map((b) => {
      if (typeof b === "string") return fn(b);
      if (Array.isArray(b.ul)) return { ul: b.ul.map(fn) };
      if (Array.isArray(b.ol)) return { ol: b.ol.map(fn) };
      if (b.tip) return { tip: fn(b.tip) };
      if (b.note) return { note: fn(b.note) };
      if (b.table) return { table: { head: b.table.head.map(fn), rows: b.table.rows.map((r: string[]) => r.map(fn)) } };
      return b;
    });
  }
  for (const f of g.faqs || []) f.a = fn(f.a);
}

function linksOf(g: Guide): string[] {
  const out: string[] = [];
  mapText(g, (t) => { for (const m of String(t || "").matchAll(LINK)) out.push(m[2]); return t; });
  return out;
}

export function guideIssues(g: Guide, minWords = MIN_WORDS): string[] {
  const issues: string[] = [];
  const text = [g.description, g.title, g.answer, ...g.sections.flatMap((s) => [s.h2, ...s.blocks.map(blockText)]),
    ...(g.faqs || []).flatMap((f) => [f.q, f.a])].map(plain).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!g.title || g.title.length > 90) issues.push("title missing or over 90 characters");
  if (!g.description || g.description.length < 70 || g.description.length > 165) issues.push("description should be 70–165 characters");
  if (!g.answer || g.answer.length < 80) issues.push("short answer missing");
  if (g.sections.length < 4) issues.push("fewer than 4 sections");
  if ((g.faqs || []).length < 3) issues.push("fewer than 3 FAQs");
  if (words < minWords) issues.push(`only ${words} words`);
  if (/₹\s?\d|rs\.?\s?\d|inr\s?\d/i.test(text)) issues.push("states a price");
  if (/cash on delivery|\bCOD\b/i.test(text)) issues.push("mentions cash on delivery");
  if (new Set(linksOf(g).filter((l) => l.startsWith("/"))).size < 3) issues.push("fewer than 3 internal links");
  return issues;
}

/* --------------------------------------------------------------- context */

/** Pages every article may link to, whatever its topic. */
const CORE_PAGES: Array<[string, string]> = [
  ["/skins", "All skins"], ["/phone-skins", "Phone skins"], ["/laptop-skins", "Laptop skins"],
  ["/ipad-tablet-skins", "iPad & tablet skins"], ["/camera-skins", "Camera skins"], ["/lenses-skins", "Lens skins"],
  ["/gaming-console-skins", "Gaming console skins"], ["/chargers-skins", "Charger skins"], ["/drones-skins", "Drone skins"],
  ["/mac-mini-skins", "Mac mini skins"], ["/cases-covers", "Cases & covers (clear and MagSafe)"],
  ["/camera-rings", "Camera lens rings"], ["/screen-protectors", "AutoApply screen protectors"],
  ["/how-to-apply", "How to apply a skin (steps + video)"], ["/real-photos", "Real photos of our skins"],
  ["/reviews", "Customer reviews"], ["/devices", "All supported devices"],
  ["/matte-phone-skins", "Matte phone skins"], ["/3d-textured-finish-skins", "3D textured finish skins"],
  ["/transparent-skins", "Transparent (Tranzy) skins"], ["/leather-finish-skins", "Leather finish skins"],
];

interface Context {
  allowed: Map<string, string>;
  guides: Array<{ slug: string; title: string }>;
}

async function loadContext(db: admin.firestore.Firestore, topic: GuideTopic): Promise<Context> {
  const [seoSnap, guideSnap] = await Promise.all([
    db.collection("seoPages").where("isPublished", "==", true).select("slug", "title", "name").get(),
    db.collection("guides").where("status", "==", "published").select("slug", "title").get(),
  ]);
  const allowed = new Map<string, string>(CORE_PAGES);
  const seo = seoSnap.docs.map((d) => d.data() as any)
    .filter((p) => p.slug && /^[a-z0-9][a-z0-9-]*$/.test(p.slug))
    .map((p) => ({ path: `/${p.slug}`, name: String(p.name || p.title || p.slug).replace(/\s*\|\s*GoSkinly$/, "") }));
  const kw = topic.keywords.map((k) => k.toLowerCase());
  // The topic's own pages first (shortest slugs are the hubs), then a few general ones.
  const matched = seo.filter((p) => kw.some((k) => p.path.includes(k))).sort((a, b) => a.path.length - b.path.length).slice(0, 60);
  for (const p of matched) allowed.set(p.path, p.name);
  const guides = [...HAND_WRITTEN, ...guideSnap.docs.map((d) => ({ slug: String(d.get("slug")), title: String(d.get("title") || "") }))]
    .filter((g) => g.slug && g.slug !== topic.slug);
  for (const g of guides) allowed.set(`/guides/${g.slug}`, `Guide: ${g.title}`);
  return { allowed, guides };
}

/* ---------------------------------------------------------------- writing */

const FACTS = `HOW GOSKINLY WORKS (true — build on these, never contradict them):
- GoSkinly (goskinly.com) is run by Mad House Media in Agra, Uttar Pradesh, and ships across India.
- A skin is a thin printed vinyl wrap. Each one is printed and cut to order on a plotter from the template of ONE exact device model, with openings for every camera, sensor, port and button.
- Finishes: matte (low sheen, hides fingerprints and fine scratches — the everyday default), 3D textured a.k.a. embossed (a raised relief you can feel; grippiest; costs a step more than matte), Tranzy (artwork printed on clear film with a matte surface: only the ink shows and the device's own colour is the background — best on silver/white/light devices, poor on black because dark ink disappears; phone Tranzy is back-only, laptop Tranzy is lid-only), and a leather finish. We do not make glossy phone skins.
- Phones: "Only Back" or "Full Body Wrap" (back + sides). Full-body corner flaps on curved edges set with a couple of seconds of gentle warmth (a hair dryer) and a firm press.
- Laptops: "Only Top" (the lid) or "Top + Keyboard Area" (lid + the palm rest around keyboard and trackpad; keys and trackpad stay bare). MacBooks are matched by size, chip and year, or by the A-number on the bottom case.
- Tablets: "Only Back", or "Back + 20W Charger" (adds a matching skin for a 20W charger). No front/bezel skin.
- Cameras: "Without Lens" (body: flat front plate and top plate; rubber grip, dials, buttons and rear screen stay bare) or "With Lens" (adds the kit lens barrel). Lens skins wrap the barrel; the front glass, focus/zoom ring markings and the mount stay bare.
- Consoles: console alone, + 1 controller, or + 2 controllers. PS5 versions (Disc, Digital, Slim Disc, Slim Digital, Pro) and Xbox Series X/S each have their own cut; vents, ports and buttons stay clear. Controller skins wrap the shell; sticks, buttons, triggers and light bar stay bare.
- We also cut for drones (Drone Only, Drone + RC, RC with or without display), gimbals, chargers, Mac mini, action cameras and DJI Osmo Pocket.
- Every order comes with an install kit: wet and dry wipes, a dust absorber, a squeegee and a microfiber cloth. Install: clean, de-dust, line up from the bottom ports (camera first on tablets), squeegee upwards, press edges. The hold strengthens over a few hours.
- Skins peel off without residue (slowly, from a corner, at a low angle; a little warmth helps). They protect against scratches, scuffs and wear — NOT against drops. Pair with a case for drops; we sell clear and MagSafe cases, camera lens rings and AutoApply screen protectors.
- Thin vinyl doesn't block Qi wireless charging or NFC and holds in far less heat than a case. MagSafe accessories still attach; 3D textured adds a touch more distance than matte. Remove the skin before a service-centre visit.
- Every parcel is packed on camera; photos from the packing table are on /real-photos. A model not listed can be requested on the site; we add it and tell the customer on WhatsApp.`;

const SYSTEM = `You write the guides at goskinly.com/guides for GoSkinly, an Indian maker of printed vinyl device skins. Your reader is an Indian shopper deciding what to buy or how to use it. Write like the people who actually print, cut and pack these skins: practical, specific, warm, in clear Indian English. Useful first — every section should leave the reader knowing something they didn't.

${FACTS}

RULES:
- Never state a price, a discount or a rupee amount, and never mention cash on delivery. Prices change; the product page shows the live one.
- Never invent numbers, statistics, customer counts, test results, lifetimes in months, thicknesses or warranties. If something depends on the listing, say "as the listing photos show".
- Never claim compatibility for a specific model unless it is in the page list you are given.
- Don't criticise competitors or name other skin brands.
- Links: use ONLY paths from the list you are given, written as [label](/path). Put 5–10 links where they genuinely help, spread through the article, and link at least two other guides.
- Text may use only **bold** and [label](/path) — no other markdown, no HTML.

OUTPUT: one JSON object:
{
  "title": "H1, under 80 characters, phrased like the question people search",
  "metaTitle": "under 65 characters before ' | GoSkinly', ending with ' | GoSkinly'",
  "description": "meta description, 120–160 characters, one or two complete sentences",
  "answer": "the short answer: 2–4 sentences that fully answer the title on their own (answer engines quote this). Bold the key terms.",
  "sections": [ { "id": "kebab-case", "h2": "...", "blocks": [ ... ] } ],   // 5–7 sections
  "faqs": [ { "q": "...", "a": "1–3 sentences" } ],                       // 4–6, real questions people ask
  "related": ["slug-of-another-guide", ...],                                 // 2–3 from the guide list
  "shop": [ { "label": "...", "href": "/path" } ],                           // 2–3 pages from the list
  "images": [ { "key": "cover", "alt": "...", "prompt": "..." }, { "key": "kebab", "alt": "...", "caption": "...", "prompt": "..." } ]  // cover + 1–2 more
}
A block is either a string (a paragraph) or one of: {"ul": [..]}, {"ol": [..]}, {"h3": ".."}, {"tip": ".."}, {"note": ".."}, {"table": {"head": [..], "rows": [[..], ..]}}, {"img": "image-key"}.
Use a comparison table where the reader is choosing between options. Place each non-cover image as an {"img": key} block where it helps.
Image prompts: photorealistic product photography for an AI image generator — subject, device, the skin's design and finish, setting, light, framing, aspect ratio (16:9 for cover, 4:3 otherwise); always end with "No text, no logos, no watermark." Never ask for real brand logos.
Length: 1,100–1,600 words of article text in total.`;

function topicPrompt(topic: GuideTopic, ctx: Context, feedback?: string): string {
  const pages = [...ctx.allowed.entries()].map(([p, n]) => `${p} — ${n}`).join("\n");
  return `Write the guide.

TITLE IDEA: ${topic.title}
WHAT IT MUST COVER: ${topic.angle}
SECTION OF THE SITE: ${topic.cluster}

OTHER GUIDES (link two or more; "related" uses their slugs):
${ctx.guides.map((g) => `${g.slug} — ${g.title}`).join("\n")}

PAGES YOU MAY LINK TO (exact paths only):
${pages}
${feedback ? `\nYOUR PREVIOUS DRAFT WAS REJECTED FOR: ${feedback}\nFix every point.` : ""}`;
}

const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

const kebab = (s: unknown, fallback: string) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

/** The writer's reply made into a Guide, with any link it wasn't given turned back into text. */
function toGuide(raw: any, topic: GuideTopic, ctx: Context): Guide {
  const images: Guide["images"] = {};
  for (const [i, im] of (Array.isArray(raw?.images) ? raw.images : []).entries()) {
    const key = kebab(im?.key, i === 0 ? "cover" : `image-${i}`);
    if (im?.prompt) images[key] = { alt: String(im.alt || ""), ...(im.caption ? { caption: String(im.caption) } : {}), prompt: String(im.prompt) };
  }
  const guideSlugs = new Set(ctx.guides.map((g) => g.slug));
  const g: Guide = {
    slug: topic.slug,
    cluster: topic.cluster,
    title: String(raw?.title || topic.title).trim(),
    metaTitle: String(raw?.metaTitle || `${raw?.title || topic.title} | GoSkinly`).trim(),
    description: String(raw?.description || "").trim(),
    updated: today(),
    published: today(),
    answer: String(raw?.answer || "").trim(),
    cover: images.cover ? "cover" : undefined,
    images,
    sections: (Array.isArray(raw?.sections) ? raw.sections : []).map((s: any, i: number) => ({
      id: kebab(s?.id || s?.h2, `section-${i + 1}`),
      h2: String(s?.h2 || "").trim(),
      blocks: (Array.isArray(s?.blocks) ? s.blocks : []).filter((b: any) =>
        typeof b === "string" || (b && typeof b === "object" && (b.ul || b.ol || b.h3 || b.tip || b.note || b.table || (b.img && images[b.img])))),
    })).filter((s: any) => s.h2 && s.blocks.length),
    faqs: (Array.isArray(raw?.faqs) ? raw.faqs : []).map((f: any) => ({ q: String(f?.q || "").trim(), a: String(f?.a || "").trim() })).filter((f: any) => f.q && f.a),
    related: (Array.isArray(raw?.related) ? raw.related : []).map(String).filter((s: string) => guideSlugs.has(s)).slice(0, 3),
    shop: (Array.isArray(raw?.shop) ? raw.shop : []).filter((s: any) => ctx.allowed.has(String(s?.href))).map((s: any) => ({ label: String(s.label), href: String(s.href) })).slice(0, 3),
  };
  // A link to a page we weren't sure exists becomes its label: never ship a 404.
  mapText(g, (t) => String(t || "").replace(LINK, (m, label, href) => (ctx.allowed.has(href) ? m : label)));
  return g;
}

/** The next topic nobody has written: the Firestore queue first, then the built-in list. */
async function nextTopic(db: admin.firestore.Firestore, onlySlug?: string): Promise<{ topic: GuideTopic; queueId?: string } | null> {
  const taken = new Set<string>(HAND_WRITTEN.map((g) => g.slug));
  (await db.collection("guides").select().get()).docs.forEach((d) => taken.add(d.id));
  const queued = await db.collection("guideTopics").where("status", "==", "queued").get();
  const fromQueue = queued.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => Number(a.createdAt?.toMillis?.() || 0) - Number(b.createdAt?.toMillis?.() || 0))
    .map((t) => ({
      queueId: t.id,
      topic: {
        slug: kebab(t.slug || t.title, t.id),
        cluster: ["finishes", "choosing", "gadgets", "living"].includes(t.cluster) ? t.cluster : "choosing",
        title: String(t.title || ""),
        angle: String(t.angle || t.title || ""),
        keywords: Array.isArray(t.keywords) ? t.keywords.map(String) : [],
      } as GuideTopic,
    }));
  const all = [...fromQueue, ...GUIDE_TOPICS.map((topic) => ({ topic, queueId: undefined as string | undefined }))];
  return all.find((x) => x.topic.title && (onlySlug ? x.topic.slug === onlySlug : !taken.has(x.topic.slug))) || null;
}

export interface WriteResult { slug?: string; status?: "published" | "draft" | "failed"; issues?: string[]; note: string }

export async function writeNextGuide(db: admin.firestore.Firestore, opts: { slug?: string; publish?: boolean } = {}): Promise<WriteResult> {
  const next = await nextTopic(db, opts.slug);
  if (!next) return { note: "no topic left to write — add one to guideTopics" };
  const { topic, queueId } = next;
  const ctx = await loadContext(db, topic);

  let guide: Guide | null = null;
  let issues: string[] = ["not written"];
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2 && issues.length; attempt++) {
    try {
      const res = await askClaudeJson({ system: SYSTEM, user: topicPrompt(topic, ctx, feedback), maxTokens: 12000 });
      if (res.refusal) { issues = [`refused: ${res.refusal}`]; break; }
      guide = toGuide(JSON.parse(res.text), topic, ctx);
      issues = guideIssues(guide);
    } catch (e: any) {
      issues = [`could not read the reply: ${String(e?.message || e).slice(0, 160)}`];
    }
    feedback = issues.join("; ");
  }

  const publish = opts.publish !== false && issues.length === 0;
  const status: WriteResult["status"] = guide ? (publish ? "published" : "draft") : "failed";
  if (guide) {
    await db.collection("guides").doc(topic.slug).set({
      slug: topic.slug,
      title: guide.title,
      cluster: topic.cluster,
      status,
      issues,
      topic,
      model: MODEL,
      guide: JSON.stringify(guide),
      imagePrompts: Object.entries(guide.images || {}).map(([key, im]) => ({ key, alt: im.alt, prompt: im.prompt })),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(publish ? { publishedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });
  }
  if (queueId) await db.collection("guideTopics").doc(queueId).set({ status: guide ? "written" : "failed", slug: topic.slug, issues }, { merge: true });
  return { slug: topic.slug, status, issues, note: publish ? "published" : guide ? `kept as a draft: ${issues.join("; ")}` : `failed: ${issues.join("; ")}` };
}

async function writeStatus(db: admin.firestore.Firestore, last?: WriteResult) {
  const [guides, upcoming] = await Promise.all([
    db.collection("guides").select("status", "slug", "title", "issues").get(),
    (async () => {
      const taken = new Set<string>(HAND_WRITTEN.map((g) => g.slug));
      (await db.collection("guides").select().get()).docs.forEach((d) => taken.add(d.id));
      return GUIDE_TOPICS.filter((t) => !taken.has(t.slug)).map((t) => t.title);
    })(),
  ]);
  const rows = guides.docs.map((d) => d.data() as any);
  await db.collection("guidesAutoStatus").doc("latest").set({
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(last?.status && last.status !== "failed" ? { lastWrittenAt: admin.firestore.FieldValue.serverTimestamp(), lastSlug: last.slug } : {}),
    ...(last ? { lastResult: last } : {}),
    published: rows.filter((r) => r.status === "published").length,
    drafts: rows.filter((r) => r.status === "draft").map((r) => ({ slug: r.slug, title: r.title, issues: r.issues || [] })).slice(0, 30),
    topicsLeft: upcoming.length,
    nextTopics: upcoming.slice(0, 5),
  }, { merge: true });
}

/* --------------------------------------------------------------- schedule */

/**
 * Nightly at 19:30 UTC (01:00 in Agra), before the 3 am storefront rebuild;
 * writes only when the last guide is at least GUIDES_AUTO_EVERY_HOURS old, so
 * one appears every second night.
 */
export const guidesAutoWriter = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .pubsub.schedule("30 19 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    if ((await setting(db, "GUIDES_AUTO_ENABLED")) === false) return null;
    const every = Number((await setting(db, "GUIDES_AUTO_EVERY_HOURS")) ?? 44);
    const st = await db.collection("guidesAutoStatus").doc("latest").get();
    const last = st.get("lastWrittenAt")?.toMillis?.() || 0;
    if (Date.now() - last < every * 3600e3) { await writeStatus(db); return null; }
    const publish = (await setting(db, "GUIDES_AUTO_PUBLISH")) !== false;
    const r = await writeNextGuide(db, { publish });
    await writeStatus(db, r);
    if (r.status === "published") await requestRebuild(`guide published: ${r.slug}`);
    functionsV1.logger.info("guidesAutoWriter", r);
    return null;
  });

/** For the admin: { status: true } to read where it stands, { write: true, slug?, publish? } to write one now. */
export const runGuidesAuto = functionsV1
  .runWith({ memory: "512MB", timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    await requireAdmin(context);
    const db = admin.firestore();
    if (data?.write === true) {
      const r = await writeNextGuide(db, { slug: data?.slug ? String(data.slug) : undefined, publish: data?.publish !== false });
      await writeStatus(db, r);
      const rebuild = r.status === "published" ? (await requestRebuild(`guide published: ${r.slug}`)).note : "";
      return { success: r.status !== "failed", ...r, message: `${r.slug || ""}: ${r.note}${rebuild ? `. ${rebuild}` : ""}` };
    }
    await writeStatus(db);
    return { success: true, status: (await db.collection("guidesAutoStatus").doc("latest").get()).data() };
  });
