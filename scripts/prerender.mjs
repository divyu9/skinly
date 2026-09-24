#!/usr/bin/env node
/**
 * Writes a real HTML file for every page we want indexed.
 *
 * The site is a single-page app served from Hostinger, and until now every URL
 * answered with the same `index.html`: one title, one description, and a
 * canonical pointing at the homepage. Crawlers that do not run JavaScript
 * (WhatsApp, Facebook, most AI crawlers) saw only that, and Google saw two
 * canonicals on every product page and picked whichever it liked.
 *
 * After `vite build` this script reads the live catalogue from Firestore (the
 * collections involved are world-readable, as the storefront itself relies
 * on) and writes, for each indexable route:
 *
 *   dist/products/<slug>.html   dist/<seo-slug>.html   dist/devices.html ...
 *
 * each with its own title, description, canonical, Open Graph tags and JSON-LD
 * in <head>, plus a <noscript> summary for crawlers that never run the app.
 * The tags carry `data-rh="true"`, the attribute react-helmet-async owns, so
 * when the app boots Helmet replaces them instead of adding a second set.
 *
 * It also writes the sitemaps and the routing half of `.htaccess`. It never
 * fails the build: if Firestore cannot be reached, the static routes and the
 * app shell are still written and `.htaccess` keeps the old catch-all
 * behaviour, so the site degrades to exactly what it was before.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { offerShippingAndReturns } from "../src/lib/merchant-schema.mjs";
import { resolveSeoTarget, selectSeoProducts, seoCopy, brandGadgetLabel, gadgetLabel, oneRowPerDesign, slugify, productSeoTitle } from "../src/lib/seo-pages.mjs";
import { CATEGORY_PAGES, GADGET_PAGES, HOME_META, PRODUCTS_META, CATALOGUE_CLAIMS, ORGANIZATION_LD } from "../src/lib/category-paths.mjs";

const SITE = "https://goskinly.com";
const DIST = path.resolve("dist");
const OG_DEFAULT = `${SITE}/og-default.jpg`;
const FALLBACK_PROJECT = "skinly-3003b"; // not a secret: it ships in the client bundle

/** Legacy or junk SEO slugs that .htaccess redirects; never prerender them. */
const REDIRECTED_SLUGS = new Set([
  "samsung-azx1-skins",
  "samsung-skins-skins",
  "samsung-galaxy-s23-skins-1",
  "samsung-galaxy-s24-skins-1",
  "mac-mini-skins-1",
  "master-skins",
  // Slugs that stuttered; .htaccess sends each to the page it duplicated.
  "lens-skins-skins",
  "lens-skins-lens-skins",
  "charger-skins-skins",
  "camera-skins-skins",
  "camera-skins-camera-skins",
  "laptop-skins-skins",
  "laptop-skins-laptop-skins",
  "matte-phone-skins-phone-skins",
  "3d-embossed-phone-skins-phone-skins",
]);

/** First path segments the app owns; an SEO page may not shadow them. */
const RESERVED = new Set([
  "", "account", "auth", "backend-skinly", "admin", "cart", "checkout", "orders",
  "payment", "mock-payment", "products", "devices", "policies", "magneto-x",
  "assets", "magneto", "app", "404", "index", "sitemap", "robots", "seo-data",
  "skins", "cases-covers", "camera-rings", "screen-protectors", "accessories",
]);

const CATEGORY_FALLBACK = {
  skin: "Skins",
  "case-cover": "Cases & Covers",
  "camera-ring": "Camera Rings",
  "magneto-x": "Magneto X",
  glass: "Screen Protectors",
  accessory: "Accessories",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const log = (...a) => console.log("[prerender]", ...a);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripHtml = (s) =>
  String(s ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

/**
 * The generated copy, kept as markup instead of flattened to a paragraph.
 *
 * Every page's prompt asks the model for three internal links inside the
 * prose, and it writes them — then `stripHtml` turned them into text and
 * `esc` made sure they could never be anything else. Eight hundred links
 * across the landing pages, written and thrown away on every build.
 *
 * They are worth keeping, and the copy reads better with its own headings and
 * lists. But this is model output that an admin can also edit by hand, so
 * nothing is trusted: a small list of tags survives, every attribute is
 * dropped except an href, and an href has to point somewhere on this site.
 * That rules out javascript:, data:, on* handlers and style in one go, by
 * allowing rather than forbidding.
 */
const ALLOWED_TAGS = new Set(["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "br"]);

const safeHref = (raw) => {
  const href = String(raw || "").trim();
  if (href.startsWith("/") && !href.startsWith("//")) return `${SITE}${href}`;
  if (href.startsWith(`${SITE}/`) || href === SITE) return href;
  // Anything else — another origin, a scheme, a protocol-relative URL — is
  // not what this content is for.
  return null;
};

function safeHtml(raw, knownPaths) {
  const withoutScripts = String(raw ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  // Links opened but not kept: their closing tag has to go with them, or the
  // markup ends up with a stray </a> hanging after the words.
  let openLinks = 0;
  let deadLinks = 0;
  const out = withoutScripts.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (whole, tagRaw, attrs) => {
    const tag = tagRaw.toLowerCase();
    const closing = whole.startsWith("</");
    if (tag === "a") {
      if (closing) {
        if (openLinks === 0) return "";
        openLinks--;
        return "</a>";
      }
      const href = safeHref((attrs.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || [])
        .slice(2).find((x) => x !== undefined));
      /*
       * A link that cannot be trusted keeps its words and loses its link —
       * and so does one that points at a page which does not exist.
       *
       * The generator's prompt shows an example anchor, and the model copies
       * it: Poco's page came back linking to /poco-galaxy-s25-ultra-skins.
       * It will always be able to invent a slug, so the build checks each one
       * against the pages it is actually writing. A dead internal link is
       * worse than no link.
       */
      if (!href) return "";
      if (knownPaths && !knownPaths.has(href.replace(SITE, "") || "/")) {
        deadLinks++;
        return "";
      }
      openLinks++;
      return `<a href="${esc(href)}">`;
    }
    if (!ALLOWED_TAGS.has(tag)) return " ";
    return closing ? `</${tag}>` : `<${tag}>`;
  });
  if (deadLinks) safeHtml.dead = (safeHtml.dead || 0) + deadLinks;
  // Tidy what the removals left behind.
  return out.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

/** Cuts long markup at the end of a block, never in the middle of a tag. */
function clipHtml(html, n) {
  if (html.length <= n) return html;
  const cut = html.slice(0, n);
  const end = Math.max(
    cut.lastIndexOf("</p>"), cut.lastIndexOf("</li>"), cut.lastIndexOf("</ul>"),
    cut.lastIndexOf("</ol>"), cut.lastIndexOf("</h2>"), cut.lastIndexOf("</h3>"),
  );
  return end > 0 ? cut.slice(0, end + cut.slice(end).indexOf(">") + 1) : stripHtml(cut);
}

const titleCase = (slug) =>
  String(slug)
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

/** Cloudinary's account is gone; its URLs answer 401. */
const liveImage = (u) => typeof u === "string" && /^https?:\/\//.test(u) && !u.includes("res.cloudinary.com");

// JSON inside <script> must not be able to close the tag.
const jsonLd = (obj) =>
  `<script type="application/ld+json" data-rh="true">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

async function projectId() {
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  for (const f of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    try {
      const m = (await fs.readFile(f, "utf8")).match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* not there */
    }
  }
  return FALLBACK_PROJECT;
}

const unwrap = (v) => {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(unwrap);
  if ("mapValue" in v)
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unwrap(x)]));
  return v;
};

async function getJson(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw last;
}

async function readCollection(project, name) {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${name}`;
  const out = [];
  let token = "";
  do {
    const body = await getJson(`${base}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    for (const d of body.documents || []) {
      out.push({ _id: d.name.split("/").pop(), ...unwrap({ mapValue: { fields: d.fields || {} } }) });
    }
    token = body.nextPageToken || "";
  } while (token);
  return out;
}

/** Every mockup row for one device (the storefront asks the same question). */
async function readMockups(project, brand, model) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`;
  const eq = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } });
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "mockups" }],
      where: { compositeFilter: { op: "AND", filters: [eq("brand", brand), eq("model", model)] } },
    },
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const rows = await res.json();
      return rows.filter((r) => r.document).map((r) => unwrap({ mapValue: { fields: r.document.fields || {} } }));
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return [];
}

const R2 = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
const mockupUrl = (m) => (m?.r2Key ? `${R2}/${m.r2Key.split("/").map(encodeURIComponent).join("/")}` : null);
// SKUs differ by suffix between catalogues, e.g. R-01 vs R-01-PH (as in firebase-hooks).
const skuMatches = (a, b) => {
  a = String(a || "").toUpperCase();
  b = String(b || "").toUpperCase();
  return !!a && !!b && (a === b || a.startsWith(b + "-") || b.startsWith(a + "-"));
};

/** Run async jobs a few at a time. */
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

// ─── the <head> for one page ──────────────────────────────────────────────────

function headFor(p) {
  const tags = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" data-rh="true" />`,
    p.robots ? `<meta name="robots" content="${esc(p.robots)}" data-rh="true" />` : "",
    p.canonical ? `<link rel="canonical" href="${esc(p.canonical)}" data-rh="true" />` : "",
    `<meta property="og:type" content="${esc(p.ogType || "website")}" data-rh="true" />`,
    `<meta property="og:site_name" content="GoSkinly" data-rh="true" />`,
    `<meta property="og:title" content="${esc(p.title)}" data-rh="true" />`,
    `<meta property="og:description" content="${esc(p.description)}" data-rh="true" />`,
    p.canonical ? `<meta property="og:url" content="${esc(p.canonical)}" data-rh="true" />` : "",
    `<meta property="og:image" content="${esc(p.image || OG_DEFAULT)}" data-rh="true" />`,
    ...(p.extraMeta || []).map(([k, v]) => `<meta property="${esc(k)}" content="${esc(v)}" data-rh="true" />`),
    `<meta name="twitter:card" content="summary_large_image" data-rh="true" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" data-rh="true" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" data-rh="true" />`,
    `<meta name="twitter:image" content="${esc(p.image || OG_DEFAULT)}" data-rh="true" />`,
    ...(p.jsonLd || []).map(jsonLd),
  ];
  return tags.filter(Boolean).join("\n    ");
}

function noscriptFor(p) {
  if (!p.body) return "";
  return `<noscript><main class="prerender-summary">${p.body}</main></noscript>`;
}

/*
 * What the page needs to draw itself, handed over in the HTML.
 *
 * A landing page showed skeletons until two Firestore queries came back —
 * "is this slug a product?" and "what is this page?" — and only then drew its
 * heading. The heading is the page's largest paint, so Lighthouse measured a
 * render delay of 8.9s on a phone, all of it spent waiting to be told things
 * this script already knew when it wrote the file. The page reads this on its
 * first render and paints at once; the live queries still run and take over.
 */
function seedFor(p) {
  if (!p.seed) return "";
  return `<script id="__seed" type="application/json">${JSON.stringify(p.seed).replace(/</g, "\\u003c")}</script>`;
}

/*
 * The homepage's first answers, and its hero, before any JavaScript runs.
 *
 * Lighthouse on a throttled phone put the hero behind a 1.2 MB bundle, then a
 * Firestore read for the sections, then another for the slides: a render
 * delay of 2.9 seconds after the image had already arrived. Two things end
 * that. The rows the build just read go into the page, so the app's first
 * render already has the real slides (firebase-hooks starts those two queries
 * from here). And the first slide is drawn as plain HTML inside #root, in the
 * place the app will draw it — 241px down at 90vw × 60vw on a phone, 228px at
 * 600 × 400 from 768px up, measured off the running page — so it paints as
 * soon as it downloads. React replaces it on its first render with the same
 * picture in the same box, already decoded, so nothing moves.
 */
function homeSeedFor(p) {
  if (!p.homeSeed) return "";
  return `<script id="__homeSeed" type="application/json">${JSON.stringify(p.homeSeed).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Copies of the first hero slide's pictures, served from the site itself.
 *
 * From r2.dev the largest paint needed a second connection — DNS, TCP and TLS
 * to another host — before a byte of the picture could move, three round
 * trips a phone pays in full. From goskinly.com it rides the connection the
 * HTML already opened and sits in Cloudflare's cache beside it. The copies are
 * named after the originals, which carry their upload time, so a changed slide
 * is a new file and the old one can be cached forever. The map of original to
 * copy goes into the page seed so the slider shows the same file React-side
 * rather than downloading the picture a second time.
 */
async function localHero(first) {
  const map = {};
  const urls = [first?.imageUrl, first?.mobileImageUrl].filter((u) => typeof u === "string" && /^https:\/\//.test(u));
  await fs.mkdir(path.join(DIST, "assets"), { recursive: true });
  for (const url of [...new Set(urls)]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      const ext = (url.match(/\.(webp|avif|png|jpe?g)(?:$|\?)/i)?.[1] || (type.includes("webp") ? "webp" : "")).toLowerCase();
      if (!ext) continue;
      const base = decodeURIComponent(url.split("/").pop().split("?")[0]).replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
      const name = `hero-${base}.${ext}`;
      await fs.writeFile(path.join(DIST, "assets", name), Buffer.from(await res.arrayBuffer()));
      map[url] = `/assets/${name}`;
    } catch { /* the shell falls back to the original URL */ }
  }
  return map;
}

function homeShell(first, local = {}) {
  if (!first?.imageUrl) return "";
  const desktop = local[first.imageUrl] || first.imageUrl;
  const mobileSrc = first.mobileImageUrl || first.imageUrl;
  const mobile = local[mobileSrc] || mobileSrc;
  return (
    `<div aria-hidden="true" class="hero-shell">` +
      `<style>.hero-shell{padding-top:241px}.hero-shell>div{width:90vw;height:60vw;border-radius:1rem;overflow:hidden;background:#f2f2f2}` +
      `.hero-shell img{width:100%;height:100%;object-fit:cover;display:block}` +
      `@media (min-width:768px){.hero-shell{padding-top:228px}.hero-shell>div{width:600px;height:400px}}</style>` +
      `<div><picture>` +
        `<source media="(max-width: 767px)" srcset="${esc(mobile)}">` +
        `<img src="${esc(desktop)}" fetchpriority="high" decoding="async" width="1200" height="800" alt="">` +
      `</picture></div>` +
    `</div>`
  );
}

/**
 * On the homepage, the app's code waits for the hero picture.
 *
 * The picture is in the HTML now, but the bundle was requested at the same
 * instant — 440 KB of script against a 50 KB image on one phone connection.
 * The bytes share the pipe, so the hero arrived last, and on a throttled phone
 * that was the whole of the largest-paint time. The shell is only a picture:
 * nothing on it needs the code until it has been seen. So the script tags are
 * lifted out and put back once the picture has been painted — the frame after
 * it loads, because "loaded" is not "on screen": when the bundle landed right
 * behind the picture, a second of script evaluation ran first and the hero
 * sat decoded but unpainted. A failed picture boots at once, and a ceiling of
 * 2.5 seconds keeps a slow image from holding the app hostage. The total
 * download is the same; the order is the one the visitor sees.
 */
function heroFirst(html) {
  const mod = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>\s*/);
  if (!mod) return html;
  const preloads = [...html.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g)];
  html = html.replace(mod[0], "");
  for (const m of preloads) html = html.replace(m[0], "");
  // The stylesheet stops blocking the first paint too: the shell carries its
  // own inline style and needs none of it, and PageSpeed charged 550 ms of
  // render-blocking to it. The app still never renders unstyled — the boot
  // below waits for the sheet as well as the picture.
  const css = html.match(/<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/);
  if (css) {
    html = html.replace(css[0],
      `<link rel="preload" as="style" crossorigin href="${css[1]}" id="__appCss" onload="this.onload=null;this.rel='stylesheet'">` +
      `<noscript><link rel="stylesheet" crossorigin href="${css[1]}"></noscript>`);
  }
  const boot =
    `<script>(function(){var d=false,t0=Date.now();function css(){var l=document.getElementById("__appCss");return !l||(l.rel==="stylesheet"&&!!l.sheet)}` +
    `function go(){if(d)return;if(!css()&&Date.now()-t0<6000){requestAnimationFrame(go);return}d=true;` +
    `${JSON.stringify(preloads.map((m) => m[1]))}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=h;document.head.appendChild(l)});` +
    `var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src=${JSON.stringify(mod[1])};document.head.appendChild(s)}` +
    `function painted(){requestAnimationFrame(function(){setTimeout(go,0)})}` +
    `var i=document.querySelector(".hero-shell img");if(!i){go();return}if(i.complete){painted();return}` +
    `i.addEventListener("load",painted);i.addEventListener("error",go);setTimeout(go,2500);` +
    `setTimeout(function(){var l=document.getElementById("__appCss");if(l&&l.rel!=="stylesheet")l.rel="stylesheet"},4000)})();</script>`;
  return html.replace("</body>", `${boot}\n</body>`);
}

function render(template, p) {
  let html = template.replace(/<title>[\s\S]*?<\/title>\s*/, "");
  html = html.replace("<!--seo-head-->", headFor(p));
  html = html.replace("<!--seo-body-->", noscriptFor(p) + seedFor(p) + homeSeedFor(p));
  if (p.rootHtml) {
    html = html.replace('<div id="root"></div>', `<div id="root">${p.rootHtml}</div>`);
    html = heroFirst(html);
  }
  // The hero image is only the LCP on the homepage; anywhere else the preload
  // is a wasted download on the most constrained connection.
  if (!p.keepHero) html = html.replace(/\s*<link rel="preload" as="image" data-hero[^>]*>/g, "");
  // The preload names the same file the shell shows, or it is a second
  // download of the hero from the other host.
  for (const [orig, local] of Object.entries(p.homeSeed?.heroLocal || {})) {
    html = html.split(`href="${esc(orig)}"`).join(`href="${local}"`).split(`href="${orig}"`).join(`href="${local}"`);
  }
  return html;
}

async function writePage(route, html) {
  const rel = route === "/" ? "index.html" : `${route.replace(/^\/+/, "")}.html`;
  const file = path.join(DIST, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

const breadcrumbLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: c.url,
  })),
});

const crumbLinks = (items) =>
  `<nav>${items
    .slice(0, -1)
    .map((c) => `<a href="${esc(c.url)}">${esc(c.name)}</a>`)
    .join(" › ")}</nav>`;

// ─── pages ────────────────────────────────────────────────────────────────────

/**
 * What the three hand-written pages can say about the real catalogue.
 *
 * The landing pages carry ~940 words of their own in the HTML a crawler is
 * served, and product pages ~310. The homepage carried 50, /products 33 and
 * /devices 9 — everything else arrived only after React had run and fetched
 * from Firestore. Google does render, but these are the three most important
 * URLs on the site, and they were the three with nothing in them.
 *
 * Nothing here is written by hand: the gadget counts, brand counts and design
 * total are read from the same catalogue the rest of the build uses, so they
 * cannot drift from what the shop actually sells.
 */
function siteHub(active, models, seoSlugs) {
  const byGadget = new Map();
  for (const p of active) {
    const g = p.gadgetCategory;
    if (!g) continue;
    byGadget.set(g, (byGadget.get(g) || 0) + 1);
  }
  const gadgets = [...byGadget.entries()]
    .filter(([g]) => GADGET_PAGES[g])
    .sort((a, b) => b[1] - a[1])
    .map(([gadget, count]) => ({ gadget, count, href: GADGET_PAGES[gadget] }));

  const byBrand = new Map();
  for (const m of models) {
    if (!m?.brandName || m.isActive === false) continue;
    const row = byBrand.get(m.brandName) || { models: 0, gadgets: new Set() };
    row.models += 1;
    if (m.category) row.gadgets.add(m.category);
    byBrand.set(m.brandName, row);
  }
  const brands = [...byBrand.entries()]
    .sort((a, b) => b[1].models - a[1].models)
    .map(([brand, row]) => {
      // A brand hub exists only where a page was written for it; a link to a
      // page this build does not produce is a 404 with extra steps.
      const slug = `${slugify(brand)}-skins`;
      return { brand, models: row.models, href: seoSlugs.has(slug) ? `/${slug}` : null };
    });

  return { gadgets, brands, designs: active.length, models: models.filter((m) => m.isActive !== false).length };
}

const hubList = (items) => items.length ? `<ul>${items.join("")}</ul>` : "";

function staticPages(hub, home = null) {
  const homeDescription = HOME_META.description;
  const productsDescription = PRODUCTS_META.description;
  const policy = (slug, title, description) => ({
    route: `/policies/${slug}`,
    title,
    description,
    canonical: `${SITE}/policies/${slug}`,
    priority: slug === "shipping" || slug === "returns" ? "0.4" : "0.3",
  });
  return [
    {
      route: "/",
      title: HOME_META.title,
      description: homeDescription,
      canonical: `${SITE}/`,
      keepHero: true,
      ...(home ? { homeSeed: home.seed, rootHtml: home.shell } : {}),
      priority: "1.0",
      jsonLd: [
        // Shared with Index.tsx's Helmet (src/lib/category-paths.mjs).
        ORGANIZATION_LD,
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "GoSkinly",
          url: SITE,
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${SITE}/products?search={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        },
      ],
      body:
        `<h1>${esc(HOME_META.heading)}</h1><p>${esc(homeDescription)}</p>` +
        (hub
          ? `<p>${hub.designs} designs, cut for ${hub.models} models across ${hub.brands.length} brands.</p>` +
            `<h2>Shop by gadget</h2>` +
            hubList(hub.gadgets.map((g) =>
              `<li><a href="${SITE}${esc(g.href)}">${esc(gadgetLabel(g.gadget) || g.gadget)} skins</a> <span>(${g.count} designs)</span></li>`)) +
            `<h2>Shop by category</h2>` +
            hubList(Object.values(CATEGORY_PAGES).map((c) =>
              `<li><a href="${SITE}${esc(c.path)}">${esc(c.heading)}</a></li>`)) +
            `<h2>Brands we cut for</h2>` +
            hubList(hub.brands.slice(0, 40).map((b) =>
              b.href
                ? `<li><a href="${SITE}${esc(b.href)}">${esc(b.brand)} skins</a> <span>(${b.models} models)</span></li>`
                : `<li>${esc(b.brand)} <span>(${b.models} models)</span></li>`))
          : "") +
        `<p><a href="${SITE}/products">Shop all skins</a> · <a href="${SITE}/devices">Supported devices</a></p>`,
    },
    {
      route: "/products",
      title: PRODUCTS_META.title,
      description: productsDescription,
      canonical: `${SITE}/products`,
      priority: "0.9",
      body:
        `<h1>Shop</h1><p>${esc(productsDescription)}</p>` +
        (hub
          ? `<p>${hub.designs} designs in stock across ${hub.gadgets.length} gadget types.</p>` +
            `<h2>Categories</h2>` +
            hubList(Object.values(CATEGORY_PAGES).map((c) =>
              `<li><a href="${SITE}${esc(c.path)}">${esc(c.heading)}</a> — ${esc(clip(c.description, 110))}</li>`)) +
            `<h2>Skins by gadget</h2>` +
            hubList(hub.gadgets.map((g) =>
              `<li><a href="${SITE}${esc(g.href)}">${esc(gadgetLabel(g.gadget) || g.gadget)} skins</a> <span>(${g.count} designs)</span></li>`))
          : ""),
    },
    {
      route: "/devices",
      title: "Supported Devices & Models | GoSkinly",
      description:
        "Browse all phone, laptop, tablet, and gadget models supported by GoSkinly. Find your device and shop custom-cut vinyl skins starting ₹149. Free shipping above ₹499.",
      canonical: `${SITE}/devices`,
      priority: "0.9",
      body:
        `<h1>Supported devices</h1>` +
        (hub
          ? `<p>Every skin is printed and cut for one model. We cut for ${hub.models} models across ` +
            `${hub.brands.length} brands — pick yours and the listing narrows to what fits it.</p>` +
            `<h2>By brand</h2>` +
            hubList(hub.brands.map((b) =>
              b.href
                ? `<li><a href="${SITE}${esc(b.href)}">${esc(b.brand)} skins</a> <span>(${b.models} models)</span></li>`
                : `<li>${esc(b.brand)} <span>(${b.models} models)</span></li>`)) +
            `<h2>By gadget</h2>` +
            hubList(hub.gadgets.map((g) =>
              `<li><a href="${SITE}${esc(g.href)}">${esc(gadgetLabel(g.gadget) || g.gadget)} skins</a> <span>(${g.count} designs)</span></li>`))
          : ""),
    },
    policy("privacy", "Privacy Policy | GoSkinly",
      "Read GoSkinly's privacy policy. We are committed to protecting your personal information and data privacy."),
    policy("terms", "Terms of Service | GoSkinly",
      "Read GoSkinly's terms of service. Understand your rights and our policies when shopping for vinyl device skins."),
    policy("shipping", "Shipping Policy | GoSkinly",
      "GoSkinly shipping policy — delivery across India, free shipping above ₹499. Learn about delivery times and order tracking."),
    policy("returns", "Returns & Refund Policy | GoSkinly",
      "GoSkinly returns and refund policy. Easy returns, hassle-free refunds on vinyl device skins."),
  ];
}

function magnetoPage(products, variantsByProduct) {
  const p = products.find((x) => x.slug === "magneto-x-type-c-ssd-enclosure-with-m-2-nvme-support");
  const prices = p ? (variantsByProduct.get(p._id) || []).map((v) => Number(v.price)).filter((n) => n > 0) : [];
  const from = prices.length ? Math.min(...prices) : null;
  const description =
    `Magneto X — a Type-C SSD enclosure that takes M.2 NVMe drives up to 4TB.` +
    (from ? ` From ₹${from}.` : "") +
    " Free shipping above ₹499.";
  return {
    route: "/magneto-x",
    title: "Magneto X Type-C SSD Enclosure (M.2 NVMe, up to 4TB) | GoSkinly",
    description,
    canonical: `${SITE}/magneto-x`,
    image: p ? (p.images || []).map((i) => i?.url).find(liveImage) : undefined,
    priority: "0.8",
    body: `<h1>Magneto X</h1><p>${esc(description)}</p>${p ? `<p><a href="${SITE}/products/${esc(p.slug)}">Buy Magneto X</a></p>` : ""}`,
  };
}

/**
 * @param links  where this design can also be read about: the landing pages
 *   whose device it fits, and a few designs like it. Both were absent, which
 *   left every one of 1,717 product pages with three links on it — home, its
 *   category, and a query-string filter Google does not index.
 */
/**
 * The star rating Google shows beside a result, from reviews people wrote.
 *
 * Only real ones: a rating emitted for a product nobody reviewed is a
 * structured-data violation, and the markup has to agree with what the page
 * itself displays. So this returns nothing at all until a product has a
 * review, and the numbers come from the same `reviews` rows the product page
 * renders.
 */
function ratingFor(reviews) {
  const rated = (reviews || []).filter((r) => Number(r.rating) >= 1 && Number(r.rating) <= 5);
  if (!rated.length) return {};
  const mean = rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length;
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Math.round(mean * 10) / 10,
      reviewCount: rated.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: rated
      .filter((r) => String(r.comment || "").trim())
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, 5)
      .map((r) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: String(r.userName || "Verified buyer").slice(0, 60) },
        reviewBody: clip(stripHtml(r.comment), 400),
        ...(isoDate(r.createdAt) ? { datePublished: isoDate(r.createdAt).slice(0, 10) } : {}),
      })),
  };
}

function productPage(p, variants, categoryNames, shipping, links = {}, reviews = []) {
  const url = `${SITE}/products/${p.slug}`;
  const priced = variants.filter((v) => Number(v.price) > 0);
  const stock = (v) => Number(v.inventoryQuantity ?? v.inventory_quantity ?? 0);
  const inStock = priced.filter((v) => stock(v) > 0);
  const price = inStock.length
    ? Math.min(...inStock.map((v) => Number(v.price)))
    : priced.length
      ? Math.min(...priced.map((v) => Number(v.price)))
      : 0;
  const image = [...(p.images || []).map((i) => (typeof i === "string" ? i : i?.url))].find(liveImage);

  const plain = stripHtml(p.description);
  const title = productSeoTitle(p);
  const description = p.metaDescription || clip(plain || `Shop ${p.title} at GoSkinly.`, 155);

  // Same trail the product page draws (src/lib/product-breadcrumb.ts).
  const trail = [{ name: "Home", url: `${SITE}/` }];
  const cat = p.productCategory;
  if (cat) {
    trail.push({
      name: categoryNames[cat] || CATEGORY_FALLBACK[cat] || titleCase(cat),
      url: `${SITE}/products?productType=${encodeURIComponent(cat)}`,
    });
    if (cat === "skin" && p.gadgetCategory && p.gadgetCategory !== "accessory") {
      trail.push({
        name: titleCase(p.gadgetCategory),
        url: `${SITE}/products?productType=skin&gadget=${encodeURIComponent(p.gadgetCategory)}`,
      });
    }
  } else {
    trail.push({ name: "Shop", url: `${SITE}/products` });
  }
  trail.push({ name: p.title, url });

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.metaDescription || clip(plain, 500) || description,
    ...(image ? { image } : {}),
    ...(variants[0]?.sku ? { sku: variants[0].sku } : {}),
    brand: { "@type": "Brand", name: "GoSkinly" },
    ...ratingFor(reviews),
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "INR",
      availability: inStock.length ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@type": "Organization", name: "GoSkinly" },
      ...offerShippingAndReturns(price, shipping),
    },
  };

  return {
    route: `/products/${p.slug}`,
    title,
    description,
    canonical: url,
    ogType: "product",
    image,
    extraMeta: [
      ["product:price:amount", String(price)],
      ["product:price:currency", "INR"],
      ...(inStock.length ? [["product:availability", "in stock"]] : []),
    ],
    jsonLd: [product, breadcrumbLd(trail)],
    lastmod: p.updatedAt || p._creationTime,
    images: (p.images || []).map((i) => (typeof i === "string" ? i : i?.url)).filter(liveImage).slice(0, 5),
    title_: p.title,
    priority: "0.8",
    body:
      crumbLinks(trail) +
      `<h1>${esc(p.title)}</h1>` +
      (price ? `<p>Price: ₹${price}</p>` : "") +
      (plain ? `<p>${esc(clip(plain, 1200))}</p>` : "") +
      /*
       * "Also cut for…" is the honest headline as well as the useful one: one
       * design really is sold for every device it fits, and saying so links a
       * product to the pages that rank for those devices. This is the biggest
       * link surface the site has — 1,717 designs times the models each fits —
       * and none of it existed.
       */
      (links.fits?.length
        ? `<h2>Also cut for</h2><ul>${links.fits
            .map((f) => `<li><a href="${SITE}/${esc(f.slug)}">${esc(f.title)}</a></li>`)
            .join("")}</ul>`
        : "") +
      (links.similar?.length
        ? `<h2>More designs like this</h2><ul>${links.similar
            .map((q) => `<li><a href="${SITE}/products/${esc(q.slug)}">${esc(q.title)}</a></li>`)
            .join("")}</ul>`
        : ""),
  };
}

/**
 * Every theme and finish page, with what sits behind it.
 *
 * 58 of these could be reached from nowhere. A brand page links down to its
 * models and across to its own gadgets, and a product page links back to the
 * pages that sell it — but nothing in the site listed a theme, so /abstract-
 * skins with its 870 designs, /minimalist-skins with 409 and /blue-skins with
 * 330 were reachable only from the sitemap. This is the list that fixes that,
 * used twice: as a hub on /skins, and as the row of themes on every page that
 * is about one gadget.
 */
function themeIndex(seoDocs, seoInfo) {
  const rows = [];
  for (const doc of seoDocs) {
    const info = seoInfo.get(doc.slug);
    if (!info || info.empty || !info.total) continue;
    const t = info.target || {};
    const isTheme =
      t.kind === "theme" || t.kind === "finish" ||
      (t.kind === "keyword" && ((t.collections || []).length || (t.titleWords || []).length));
    if (!isTheme) continue;
    rows.push({
      slug: doc.slug,
      name: tidyHeading(doc.h1Heading || doc.metaTitle || titleCase(doc.slug)),
      gadget: t.gadget || null,
      total: info.total,
      // What the page shows, so three URLs of one page can be spotted.
      sig: (info.products || []).slice(0, 8).map((x) => x._id).join(","),
    });
  }

  /*
   * One link per page, not one per URL.
   *
   * /abstract-skins, /patterned-geometric-skins and /abstract-patterns-skins
   * are the Abstract collection three times over — same 870 designs, same
   * products, three slugs. Linking all three from the hub would hand Google
   * three copies of one page with a link each, which is the opposite of the
   * point. The shortest slug wins, being the one closest to what somebody
   * types; the others stay live and unlinked until they are merged properly.
   */
  const best = new Map();
  for (const r of rows) {
    const key = r.sig || r.slug;
    const seen = best.get(key);
    if (!seen || r.slug.length < seen.slug.length) best.set(key, r);
  }
  // Biggest first: the page with 870 designs behind it is the one worth
  // finding, and a list nobody scrolls should put it at the top.
  return [...best.values()].sort((a, b) => b.total - a.total);
}

/**
 * "Matte Phone Skins Skins & Wraps" → "Matte Phone Skins".
 *
 * The headings were generated from collection names that already ended in
 * "Skins", the same way the slugs were, and these are the pages that predate
 * the fix. The stored heading is left alone; only the link text is tidied.
 */
const tidyHeading = (raw) =>
  String(raw || "")
    .replace(/\s*&\s*wraps?\s*$/i, "")
    .replace(/\b(skins?)\b(\s+\1\b)+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();

const themeLinks = (rows) =>
  rows
    .map((r) => `<li><a href="${SITE}/${esc(r.slug)}">${esc(r.name)}</a> <span>(${r.total} designs)</span></li>`)
    .join("");

function seoPage(s, info, knownPaths, themes = []) {
  const url = `${SITE}/${s.slug}`;
  const h1 = s.h1Heading || s.metaTitle || titleCase(s.slug);
  const trail = [
    { name: "Home", url: SITE },
    { name: h1, url },
  ];
  const faqs = Array.isArray(s.faqs) ? s.faqs.filter((f) => f?.question && f?.answer) : [];
  const jsonLdList = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: h1,
      // The live description (counts, finishes, today's lowest price) the
      // build writes from the catalogue; the stored one is only a fallback.
      description: info?.description || s.metaDescription,
      url,
      provider: { "@type": "Organization", name: "GoSkinly", url: SITE },
    },
    breadcrumbLd(trail),
  ];
  if (faqs.length) {
    jsonLdList.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }
  /*
   * A page that matches everything matched nothing.
   *
   * "plaid tartan" is not a brand, a gadget, a finish or a collection this
   * catalogue knows, so the target resolved to a bare keyword and the filters
   * had nothing to filter on — leaving a page that lists all 1,654 designs.
   * Several such pages carry identical content under different URLs, which is
   * the duplicate-content case Google penalises rather than ignores.
   *
   * The page stays for people who reach it; it simply stops asking to be
   * ranked. Giving it a real meaning is a job for the admin: add the model to
   * Supported Models, or name the collection the page is about.
   */
  const t = info?.target || {};
  const unresolved =
    t.kind === "keyword" && !t.brand && !t.gadget && !t.finish
    && !(t.collections || []).length && !(t.titleWords || []).length;
  /*
   * A model we do not carry, under a brand we do.
   *
   * The page still fills with that brand's products, which is right for the
   * person who landed on it — but 7 Samsung pages named after 7 models we do
   * not list all show the same 362 designs, so to Google they are one page
   * under seven URLs. It asks to be ranked again by itself: the day the model
   * is added to Supported Models the target resolves to `model`, and this
   * flag clears on the next build.
   */
  const unlisted = t.kind === "unlisted";

  const text = stripHtml(s.contentHTML);
  // The same copy, with its headings, lists and internal links intact.
  const richText = clipHtml(safeHtml(s.contentHTML, knownPaths), 12000);
  const empty = info && info.total === 0;
  const productLinks = (info?.products || [])
    .slice(0, 24)
    .map((p) => `<li><a href="${SITE}/products/${esc(p.slug)}">${esc(p.title)}</a></li>`)
    .join("");
  /*
   * The models this page covers, as links.
   *
   * `info.models` has been computed all along — each one already carries the
   * href of its own landing page where it has one — and it was going only to
   * the client-side page. In the prerendered HTML these are what join 265
   * landing pages into a graph instead of leaving them 265 islands that only
   * the sitemap knows about. A page that links to its siblings passes them
   * weight; a page that links to nothing passes nothing.
   */
  /*
   * The hub row: this brand's own gadget pages, before the model list.
   *
   * Only the ones that have a page of their own — a link to a query string is
   * a link Google will not follow anywhere useful, and the hub is here to pass
   * weight down the brand's own chain.
   */
  const gadgetLinks = (info?.brandGadgets || [])
    .filter((g) => g.slug)
    .map((g) => `<li><a href="${SITE}/${esc(g.slug)}">${esc(brandGadgetLabel(info.target?.brand, g.gadget, true))} skins</a> <span>(${g.count} models)</span></li>`)
    .join("");

  const modelLinks = (info?.models || [])
    .filter((m) => m.href && m.href.startsWith("/") && !m.href.startsWith("/products?"))
    .map((m) => `<li><a href="${SITE}${esc(m.href)}">${esc(`${m.brand} ${m.model}`)} skins</a></li>`)
    .join("");

  /*
   * The styles somebody on this page can actually buy for this gadget.
   *
   * A Vivo phone page and an abstract phone page are about the same designs
   * from two directions, and nothing joined them: a shopper who wanted a
   * pattern rather than a brand had to go back to the shop and start again,
   * and Google saw two topics where there is one. Themes cut to this page's
   * gadget come first — "Abstract phone skins" beats "Abstract skins" for
   * somebody holding a phone — and the broad ones fill the rest.
   *
   * Never on a theme page itself: a list of themes on a theme page is a ring
   * of pages linking to each other, which is a pattern rather than a help.
   */
  const ownGadget = info?.target?.gadget;
  const isThemePage = ["theme", "finish"].includes(info?.target?.kind);
  const themeRow = isThemePage || !themes.length
    ? []
    : [
        ...themes.filter((t) => ownGadget && t.gadget === ownGadget),
        ...themes.filter((t) => !t.gadget),
      ].filter((t) => t.slug !== s.slug).slice(0, 12);
  return {
    route: `/${s.slug}`,
    seed: {
      slug: s.slug,
      // The stored page as the app would read it, minus bookkeeping it never
      // draws. Timestamps are plain numbers here, as they are everywhere else
      // the app reads this collection.
      page: Object.fromEntries(Object.entries(s).filter(([k]) =>
        !["generationLog", "aiPrompt", "rawResponse", "embedding"].includes(k))),
    },
    title: info?.title || s.metaTitle || `${h1} | GoSkinly`,
    description: info?.description || s.metaDescription || clip(text, 155),
    // Nothing to sell here right now: keep the page for people, not for search.
    robots: empty || unresolved || unlisted ? "noindex, follow" : undefined,
    empty: empty || unresolved || unlisted,
    canonical: url,
    image: liveImage(s.heroImageUrl) ? s.heroImageUrl : undefined,
    jsonLd: jsonLdList,
    lastmod: s.updatedAt,
    priority: s.pageType === "device" || s.pageType === "brand" ? "0.8" : "0.7",
    body:
      crumbLinks(trail) +
      `<h1>${esc(h1)}</h1>` +
      (richText || (text ? `<p>${esc(clip(text, 3000))}</p>` : "")) +
      (productLinks ? `<ul>${productLinks}</ul>` : "") +
      (gadgetLinks ? `<h2>More from ${esc(info?.target?.brand || "this brand")}</h2><ul>${gadgetLinks}</ul>` : "") +
      (modelLinks ? `<h2>Skins for other ${esc(info?.target?.brand || "")} models</h2><ul>${modelLinks}</ul>`.replace("other  models", "other models") : "") +
      (themeRow.length ? `<h2>Browse by style</h2><ul>${themeLinks(themeRow)}</ul>` : "") +
      faqs.map((f) => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join(""),
  };
}

// ─── sitemaps and .htaccess ───────────────────────────────────────────────────

const isoDate = (t) => {
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : undefined;
};

function urlset(pages, withImages) {
  const rows = pages.map((p) => {
    const lm = isoDate(p.lastmod);
    const imgs = withImages
      ? (p.images || [])
          .map(
            (u) =>
              `\n    <image:image><image:loc>${esc(u)}</image:loc><image:title>${esc(p.title_ || p.title)}</image:title></image:image>`,
          )
          .join("")
      : "";
    return `  <url>\n    <loc>${esc(p.canonical)}</loc>${lm ? `\n    <lastmod>${lm}</lastmod>` : ""}\n    <priority>${p.priority || "0.5"}</priority>${imgs}\n  </url>`;
  });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}>\n` +
    rows.join("\n") +
    `\n</urlset>\n`
  );
}

/**
 * How many URLs go in one sitemap file.
 *
 * The spec allows fifty thousand, and one file of 1,717 products with their
 * images came to just under a megabyte — which Cloudflare kept answering with
 * a 525 after fourteen seconds, so Search Console reported "sitemap could not
 * be read" and the product URLs went undiscovered. Nothing was wrong with the
 * file; a megabyte was simply more than the origin would reliably hand over.
 *
 * Five hundred keeps each file around a quarter of a megabyte, and the index
 * already supports as many children as it needs.
 */
const SITEMAP_CHUNK = 500;

async function writeSitemaps(pagesList, productList) {
  const now = new Date().toISOString();
  const files = [["sitemap-pages.xml", urlset(pagesList, false)]];
  for (let i = 0; i < productList.length; i += SITEMAP_CHUNK) {
    const part = productList.slice(i, i + SITEMAP_CHUNK);
    const n = Math.floor(i / SITEMAP_CHUNK) + 1;
    // The first file keeps its old name, so the URL Search Console already
    // knows stays valid instead of turning into a 404.
    files.push([n === 1 ? "sitemap-products.xml" : `sitemap-products-${n}.xml`, urlset(part, true)]);
  }
  for (const [name, xml] of files) await fs.writeFile(path.join(DIST, name), xml);
  const index =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    files.map(([name]) => `  <sitemap>\n    <loc>${SITE}/${name}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  await fs.writeFile(path.join(DIST, "sitemap.xml"), index);
}

/*
 * IndexNow: tell Bing, Yandex, Naver and Seznam what changed, tonight.
 *
 * Google does not participate, so this changes nothing there — but the other
 * engines move from "whenever they next crawl a 2,000-URL site" to minutes,
 * for one HTTP request per build. The protocol is a shared secret only in
 * form: ownership is proved by serving the key back at a public URL, which is
 * why the key is written into dist rather than kept out of the repo.
 *
 * Only what actually changed is submitted. Sending all 2,000 URLs every night
 * is what gets a host throttled, and the nightly rebuild exists to refresh
 * data, not to claim every page is new.
 */
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "05da6902fa7d4e47f5084f259923eb63";
const INDEXNOW_WINDOW_MS = 48 * 60 * 60 * 1000;

async function submitIndexNow(pages) {
  const cutoff = Date.now() - INDEXNOW_WINDOW_MS;
  const fresh = pages
    .filter((p) => p.canonical && Number(p.lastmod) > cutoff)
    .map((p) => p.canonical);
  // The homepage always goes, so a build that changed only data still tells
  // the engines the site moved.
  const urlList = [...new Set([`${SITE}/`, ...fresh])].slice(0, 10000);
  if (urlList.length <= 1) {
    log("IndexNow: nothing changed in the last 48h");
    return;
  }
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "goskinly.com",
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    // 200 and 202 both mean accepted; 422 means the key file did not check out.
    log(`IndexNow: submitted ${urlList.length} URLs, HTTP ${res.status}`);
  } catch (err) {
    // A search engine being unreachable is not a reason to fail a deploy.
    log(`IndexNow: submission failed (${err?.message || err})`);
  }
}

/*
 * public/.htaccess ships with a catch-all between these markers, so a build
 * where this script could not run still serves the app everywhere. Once every
 * page is written, the catch-all becomes real routing: prerendered file,
 * then app route, then 404.
 */
const STRICT_ROUTING = `# Prerendered pages: /products/x -> /products/x.html
${`# The last segment of the resolved file must be the last segment of the URL.
# Without this, /magneto-x/anything resolves to magneto-x plus path-info,
# finds magneto-x.html, and rewrites itself in a loop until the server 500s.
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteCond %{REQUEST_FILENAME}#$1 ^.*/([^/]+)#(?:.*/)?\\1$
RewriteRule ^(.+)$ /$1.html [L]`}

# Routes the app renders but that are never prerendered (and are not indexed)
RewriteRule ^(account|auth|backend-skinly|admin|cart|checkout|orders|payment|mock-payment|products/detail)(/.*)?$ /app.html [L]

# Anything else is not a page. 404.html is the app shell with noindex, so a
# product or SEO page created after this build still renders for people; it
# just is not reported to crawlers as a page until the next build.
RewriteRule ^ - [R=404,L]`;

/**
 * Old entry-bundle names, redirected to this build's.
 *
 * Every deploy renames the hashed bundles and deletes the old ones, while
 * Cloudflare may go on handing out the previous HTML for a few minutes. That
 * page asked for files that were gone, reloaded itself to fetch fresh HTML,
 * and a reload landing mid-deploy failed outright: PageSpeed and GTmetrix
 * both reported a client-side redirect to chrome-error:// on the day of ten
 * deploys. The page only needs its entry script, its stylesheet and the
 * vendor chunks it preloads, so any missing name of those shapes now
 * redirects (302, so no edge keeps the new file under the old name) to the
 * current one. Route chunks are left alone: a tab already running old code
 * must not mix in new modules, and it recovers by reloading as before.
 */
async function staleAssetRules() {
  const files = await fs.readdir(path.join(DIST, "assets"));
  const rules = [];
  for (const f of files) {
    const m = f.match(/^(index|vendor-[a-z]+)-[A-Za-z0-9_-]{8}\.(js|css)$/);
    if (!m) continue;
    const [, prefix, ext] = m;
    const same = files.filter((g) => new RegExp(`^${prefix}-[A-Za-z0-9_-]{8}\\.${ext}$`).test(g));
    if (same.length !== 1) continue; // ambiguous: leave it to the 404
    rules.push(`RewriteRule ^assets/${prefix}-[A-Za-z0-9_-]{8}\\.${ext}$ /assets/${f} [R=302,L]`);
  }
  return rules.join("\n");
}

async function writeHtaccess(strict, retired = []) {
  const file = path.join(DIST, ".htaccess");
  let src = await fs.readFile(file, "utf8");
  const sa = src.indexOf("# >>> stale assets");
  const se = src.indexOf("# <<< stale assets");
  if (sa !== -1 && se !== -1) {
    const rules = await staleAssetRules();
    src = src.slice(0, sa) +
      `# >>> stale assets (written by scripts/prerender.mjs)\n` +
      (rules
        ? "# Each only when the file asked for is not on disk.\n" +
          rules.split("\n").map((r) => `RewriteCond %{REQUEST_FILENAME} !-f\n${r}`).join("\n") + "\n"
        : "") +
      src.slice(se);
    await fs.writeFile(file, src);
  }
  const start = src.indexOf("# >>> routing");
  const end = src.indexOf("# <<< routing");
  if (start === -1 || end === -1) throw new Error(".htaccess is missing its routing markers");
  if (!strict) return;
  // Retired listings: their old URL moves permanently to the replacement.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const moves = retired.length
    ? `# Retired listings -> their replacements\n${retired
        .map((p) => `RewriteRule ^products/${esc(p.slug)}$ ${SITE}${p.redirectTo} [R=301,L]`)
        .join("\n")}\n\n`
    : "";
  const out = src.slice(0, start) + `# >>> routing (written by scripts/prerender.mjs)\n${moves}${STRICT_ROUTING}\n` + src.slice(end);
  await fs.writeFile(file, out);
}

// ─── storefront catalogue ─────────────────────────────────────────────────────

/**
 * /data/catalogue.json: every active product with the fields the listing, tag
 * rows, related rows and search use, and its variants. See src/lib/catalogue.ts.
 */
/** "One Plus", "OnePlus", "oneplus-skins" all key to "oneplus". */
const brandKey = (s) => String(s || "").toLowerCase().replace(/-skins$/, "").replace(/[^a-z0-9]+/g, "");

/**
 * The brand logos an admin has put in the homepage's "Explore by Brand"
 * section, keyed by brand, with where each links. Product cards use them as
 * the badge on brand listings, so a logo changed there changes everywhere.
 */
function brandLogos(sections, cards) {
  const ids = new Set(sections.filter((s) => /brand/i.test(String(s.sectionType || s.type || ""))).map((s) => s._id));
  const out = {};
  for (const c of cards) {
    if (!ids.has(c.sectionId) || c.isActive === false) continue;
    const link = String(c.linkUrl || c.link || "");
    const fromPath = /\/([a-z0-9-]+)-skins\/?$/i.exec(link)?.[1];
    const fromQuery = /[?&]brand=([^&]+)/i.exec(link)?.[1];
    const key = brandKey(c.title || fromPath || (fromQuery && decodeURIComponent(fromQuery)) || "");
    if (!key) continue;
    const href = link.replace(/^https?:\/\/(www\.)?goskinly\.com/i, "") || `/${key}-skins`;
    const image = String(c.imageUrl || "");
    out[key] = { href, ...(image && liveImage(image) ? { image } : {}), ...(c.title ? { name: c.title } : {}) };
  }
  return out;
}

// ─── Google Merchant Center feed ──────────────────────────────────────────────

/**
 * /merchant-feed.xml: every sellable listing in Google's product-feed format,
 * for free listings in the Shopping tab and image results.
 *
 * Price and availability are worked out exactly as the product page's Product
 * schema does (cheapest in-stock variant, else cheapest priced one), because
 * Merchant Center compares the feed with the page and disapproves items that
 * disagree. Listings without a live picture or a price are left out; Google
 * rejects those anyway. Shipping (free above ₹499) is set in the Merchant
 * Center account, not here.
 */
const GOOGLE_CATEGORY = {
  phone: "Electronics > Communications > Telephony > Mobile Phone Accessories",
  tablet: "Electronics > Computers > Tablet Computers",
  laptop: "Electronics > Computers > Laptops",
};
async function writeMerchantFeed(active, variantsByProduct) {
  const x = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const stock = (v) => Number(v.inventoryQuantity ?? v.inventory_quantity ?? 0);
  const items = [];
  for (const p of active) {
    const variants = variantsByProduct.get(p._id) || [];
    const priced = variants.filter((v) => Number(v.price) > 0);
    if (!priced.length) continue;
    const inStock = priced.filter((v) => stock(v) > 0);
    const price = Math.min(...(inStock.length ? inStock : priced).map((v) => Number(v.price)));
    const images = (p.images || []).map((i) => (typeof i === "string" ? i : i?.url)).filter(liveImage).map((u) => u.replace(/ /g, "%20"));
    if (!images.length) continue;
    const title = productSeoTitle(p).replace(/\s*\|\s*GoSkinly$/, "");
    const desc = clip(stripHtml(p.description) || p.metaDescription || `${title}, printed and cut for your exact device.`, 4900);
    const type = [p.productCategory === "skin" ? "Skins" : titleCase(p.productCategory || "Accessories"), p.gadgetCategory && titleCase(p.gadgetCategory)].filter(Boolean).join(" > ");
    const gcat = p.productCategory === "skin" ? GOOGLE_CATEGORY[p.gadgetCategory] : null;
    items.push(
      `<item>` +
      `<g:id>${x(p._id)}</g:id>` +
      `<g:title>${x(title.slice(0, 150))}</g:title>` +
      `<g:description>${x(desc)}</g:description>` +
      `<g:link>${x(`${SITE}/products/${p.slug}`)}</g:link>` +
      `<g:image_link>${x(images[0])}</g:image_link>` +
      images.slice(1, 10).map((u) => `<g:additional_image_link>${x(u)}</g:additional_image_link>`).join("") +
      `<g:availability>${inStock.length ? "in_stock" : "out_of_stock"}</g:availability>` +
      `<g:price>${price.toFixed(2)} INR</g:price>` +
      `<g:brand>GoSkinly</g:brand>` +
      `<g:condition>new</g:condition>` +
      `<g:identifier_exists>no</g:identifier_exists>` +
      (gcat ? `<g:google_product_category>${x(gcat)}</g:google_product_category>` : "") +
      (type ? `<g:product_type>${x(type)}</g:product_type>` : "") +
      `</item>`
    );
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>` +
    `<title>GoSkinly</title><link>${SITE}</link><description>GoSkinly product feed</description>\n` +
    items.join("\n") + `\n</channel></rss>\n`;
  await fs.writeFile(path.join(DIST, "merchant-feed.xml"), xml);
  return items.length;
}

async function writeCatalogue(active, variantsByProduct, logos = {}, themes = []) {
  const tagsOf = (t) =>
    (Array.isArray(t) ? t : typeof t === "string" ? t.split(",") : []).map((x) => String(x).trim()).filter(Boolean);
  const products = active.map((p) => ({
    _id: p._id,
    slug: p.slug,
    title: p.title || "",
    status: p.status,
    productCategory: p.productCategory,
    gadgetCategory: p.gadgetCategory,
    gadgetTypeId: p.gadgetTypeId,
    finishType: p.finishType,
    ...(Array.isArray(p.modelBrands) && p.modelBrands.length ? { modelBrands: p.modelBrands } : {}),
    ...(Array.isArray(p.modelBrandsExclude) && p.modelBrandsExclude.length ? { modelBrandsExclude: p.modelBrandsExclude } : {}),
    finishTypeId: p.finishTypeId,
    tags: tagsOf(p.tags),
    // One image — cards show the first — and never a dead Cloudinary link.
    images: (p.images || [])
      .map((i) => (typeof i === "string" ? { url: i } : i))
      .filter((i) => i && liveImage(i.url))
      .slice(0, 1)
      .map((i) => ({ url: i.url })),
    _creationTime: Number(p._creationTime || p.createdAt || 0),
    variants: (variantsByProduct.get(p._id) || []).map((v) => ({
      _id: v._id,
      title: v.title || "",
      price: Number(v.price) || 0,
      ...(v.compareAtPrice ? { compareAtPrice: Number(v.compareAtPrice) } : {}),
      ...(v.sku ? { sku: v.sku } : {}),
      inventoryQuantity: Number(v.inventoryQuantity ?? v.inventory_quantity ?? 0),
    })),
  }));
  // Tags repeat across hundreds of products; store each once and refer to it
  // by index. src/lib/catalogue.ts expands them again on load.
  const tagIndex = new Map();
  const tagList = [];
  for (const p of products) {
    p.tags = p.tags.map((t) => {
      if (!tagIndex.has(t)) { tagIndex.set(t, tagList.length); tagList.push(t); }
      return tagIndex.get(t);
    });
  }
  await fs.mkdir(path.join(DIST, "data"), { recursive: true });
  /*
   * Every style page, biggest first.
   *
   * Kept here rather than hard-coded in a component so nothing can outlive
   * the pages it links to. The footer takes the first six — a footer is a few
   * well-chosen links on every page, not a directory — and /skins shows them
   * all, which is the page a reader lands on when the footer says "All
   * styles".
   */
  const themeRows = themes.map((t) => ({ slug: t.slug, name: t.name, total: t.total, gadget: t.gadget || null }));
  const body = JSON.stringify({ builtAt: Date.now(), tagList, products, brandLogos: logos, themes: themeRows });
  await fs.writeFile(path.join(DIST, "data", "catalogue.json"), body);
  return body.length;
}

/**
 * /data/models.json: every active supported model, for the storefront's model
 * search and pickers (each of which read all ~3,500 documents per use).
 */
async function writeModels(models) {
  // Grouped by brand, one [name, category, created-seconds] row per model; no
  // document ids, which were most of the file and which nothing here needs.
  const brands = {};
  let count = 0;
  for (const m of models) {
    if (m.isActive === false || !m.brandName || !m.modelName) continue;
    (brands[m.brandName] ||= []).push([
      m.modelName,
      m.category || "",
      Math.floor(Number(m._creationTime || m.createdAt || 0) / 1000),
    ]);
    count++;
  }
  await fs.mkdir(path.join(DIST, "data"), { recursive: true });
  const body = JSON.stringify({ builtAt: Date.now(), brands });
  await fs.writeFile(path.join(DIST, "data", "models.json"), body);
  return { count, bytes: body.length };
}

// ─── category listings ────────────────────────────────────────────────────────

function categoryPages(products, variantsByProduct, themes = []) {
  const stock = (v) => Number(v.inventoryQuantity ?? v.inventory_quantity ?? 0);
  return Object.entries(CATEGORY_PAGES).map(([category, meta]) => {
    const rows = products
      .filter((p) => p.productCategory === category)
      .map((p) => {
        const vs = (variantsByProduct.get(p._id) || []).filter((v) => Number(v.price) > 0);
        return { p, vs, inStock: vs.some((v) => stock(v) > 0) };
      })
      .filter((r) => r.vs.length)
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.p._creationTime || 0) - Number(a.p._creationTime || 0));
    const links = rows
      .slice(0, 60)
      .map(({ p }) => `<li><a href="${SITE}/products/${esc(p.slug)}">${esc(p.title)}</a></li>`)
      .join("");
    const url = `${SITE}${meta.path}`;
    return {
      route: meta.path,
      title: meta.title,
      description: meta.description,
      canonical: url,
      priority: "0.9",
      empty: rows.length === 0,
      robots: rows.length === 0 ? "noindex, follow" : undefined,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: meta.heading,
          description: meta.description,
          url,
          provider: { "@type": "Organization", name: "GoSkinly", url: SITE },
        },
        breadcrumbLd([
          { name: "Home", url: `${SITE}/` },
          { name: meta.heading, url },
        ]),
      ],
      body:
        `<h1>${esc(meta.heading)}</h1><p>${esc(meta.description)}</p>` +
        (links ? `<ul>${links}</ul>` : "") +
        /*
         * The theme hub, and the only page that has one.
         *
         * Skins are what the themes are about, so this is where the list
         * belongs — and one good inbound link is what an orphan needs, not
         * the same block repeated on three hundred pages, which is the
         * boilerplate Google discounts. The whole list, uncapped: fifty-odd
         * links on the page that exists to list them is a directory, not a
         * wall.
         */
        (category === "skin" && themes.length
          ? `<h2>Skins by style</h2><ul>${themeLinks(themes)}</ul>`
          : ""),
    };
  });
}

// ─── SEO page data ────────────────────────────────────────────────────────────

/**
 * What each SEO page shows: its device or theme, the products that belong on
 * it (with that device's mockups on model pages), and its title. Written to
 * dist/seo-data/<slug>.json, which the page loads instead of reading the whole
 * catalogue from Firestore on every visit.
 */
async function seoPageData(project, seoDocs, data, variantsByProduct) {
  const collectionName = new Map(data.collections.map((c) => [c._id, c.name]));
  const collectionsByProduct = new Map();
  for (const r of data.memberships) {
    const name = collectionName.get(r.collectionId);
    if (!name || !r.productId) continue;
    if (!collectionsByProduct.has(r.productId)) collectionsByProduct.set(r.productId, new Set());
    collectionsByProduct.get(r.productId).add(name);
  }

  const resolved = seoDocs.map((s) => ({ s, target: resolveSeoTarget(s, data.models, data.collections.map((c) => c.name)) }));

  // A device's own SEO page, so brand pages can link models to it.
  const pageForModel = new Map();
  const pageForBrandGadget = new Map();
  for (const { s, target } of resolved) {
    if (target.kind === "model") pageForModel.set(`${target.brand}|${target.model}`, s.slug);
    // A brand page that is about one gadget — "dell laptop skins" — is where
    // a brand hub should send someone who wants that gadget.
    if (target.kind === "brand" && target.brand && target.gadget) {
      pageForBrandGadget.set(`${target.brand}|${target.gadget}`, s.slug);
    }
  }

  await fs.mkdir(path.join(DIST, "seo-data"), { recursive: true });
  const out = new Map();
  await pool(resolved, 8, async ({ s, target }) => {
    const sel = selectSeoProducts(target, data.products, variantsByProduct, collectionsByProduct);
    const copy = seoCopy(s, target, sel);

    /*
     * Forty-eight designs, not forty-eight rows of the same few.
     *
     * A design is a row per gadget and brand it fits — R-01 alone is 54 of
     * them — so the first forty-eight products on a phone page were about
     * eighteen designs, each shown two or three times under a different
     * brand's name. Folding them here rather than in the browser keeps the
     * page's data file the same size while filling it with distinct designs,
     * and the brand the page is about picks which copy of each survives.
     */
    let products = oneRowPerDesign(sel.products, target.brand).slice(0, 48);
    let mockups = 0;
    if (target.kind === "model") {
      try {
        const rows = (await readMockups(project, target.brand, target.model)).filter((m) => mockupUrl(m));
        products = products.map((p) => {
          const sku = p.variants[0]?.sku;
          const m = sku && rows.find((r) => skuMatches(r.sku, sku));
          if (m) mockups++;
          return m ? { ...p, mockupUrl: mockupUrl(m) } : p;
        });
        // Designs pictured on this device first, within the in-stock order.
        products.sort((a, b) => Number(b.variants.some((v) => v.available)) - Number(a.variants.some((v) => v.available)) ||
          Number(!!b.mockupUrl) - Number(!!a.mockupUrl));
      } catch (err) {
        log(`mockups for ${target.brand} ${target.model} unavailable (${err?.message || err})`);
      }
    }

    // Models with their own page first, then the page's own kind of gadget,
    // then highest model number first ("Redmi Note 13" before "Redmi Note 8").
    const ranked = [...(target.models || [])].sort(
      (a, b) =>
        Number(pageForModel.has(`${b.brand}|${b.model}`)) - Number(pageForModel.has(`${a.brand}|${a.model}`)) ||
        Number(b.category === target.gadget) - Number(a.category === target.gadget) ||
        b.model.localeCompare(a.model, "en", { numeric: true, sensitivity: "base" }),
    );
    /*
     * Every model, not a sample of them.
     *
     * The list was cut at eighty, which on Dell's 366 laptops hid four in
     * five. A long list is the point: it is the proof that the catalogue
     * really does cover the reader's device, and it is how a page reaches the
     * ones beneath it. Capped high rather than not at all — past a few hundred
     * links a page starts spreading itself too thin to help any of them.
     */
    const models = ranked.slice(0, 300).map((m) => {
      const slug = pageForModel.get(`${m.brand}|${m.model}`);
      const q = new URLSearchParams({ productType: "skin", gadget: m.category || target.gadget || "phone", brand: m.brand, model: m.model });
      return { brand: m.brand, model: m.model.replace(/\s+/g, " ").trim(), href: slug ? `/${slug}` : `/products?${q.toString()}` };
    });

    /*
     * The brand's other shelves.
     *
     * A brand page shows one gadget — whichever that brand mostly makes — so
     * Samsung's page is phones and its 74 tablets are nowhere on it. Without
     * this a visitor who wants a tablet skin is offered the entire brand grid
     * instead, every competitor's name included, and the charger page nobody
     * can reach from anywhere is never reached.
     */
    const brandGadgets = target.brand
      ? Object.entries(
          (data.models || [])
            .filter((m) => m && m.isActive !== false && m.brandName === target.brand && m.category)
            .reduce((acc, m) => ({ ...acc, [m.category]: (acc[m.category] || 0) + 1 }), {}),
        )
          .map(([gadget, count]) => ({
            gadget,
            count,
            slug: pageForBrandGadget.get(`${target.brand}|${gadget}`) || null,
            href:
              pageForBrandGadget.get(`${target.brand}|${gadget}`)
                ? `/${pageForBrandGadget.get(`${target.brand}|${gadget}`)}`
                : `/products?${new URLSearchParams({ productType: "skin", gadget, brand: target.brand }).toString()}`,
          }))
          .sort((a, b) => b.count - a.count)
      : [];

    const info = {
      slug: s.slug,
      target: { ...target, models: undefined },
      brandGadgets,
      title: copy.title,
      description: copy.description,
      listing: copy.listing,
      total: sel.total,
      inStock: sel.inStock,
      minPrice: sel.minPrice,
      finishes: sel.finishes,
      mockups,
      models,
      products,
      builtAt: Date.now(),
    };
    await fs.writeFile(path.join(DIST, "seo-data", `${s.slug}.json`), JSON.stringify(info));
    out.set(s.slug, info);
  });
  return out;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const template = await fs.readFile(path.join(DIST, "index.html"), "utf8");
  if (!template.includes("<!--seo-head-->")) {
    log("index.html has no <!--seo-head--> placeholder; nothing to do");
    return;
  }

  // The shells first: nothing below may leave the site without them.
  const shell = template.replace(/\s*<link rel="preload" as="image" data-hero[^>]*>/g, "");
  await fs.writeFile(
    path.join(DIST, "app.html"),
    shell.replace("<!--seo-head-->", "").replace("<!--seo-body-->", ""),
  );
  await fs.writeFile(
    path.join(DIST, "404.html"),
    shell
      .replace("<!--seo-head-->", '<meta name="robots" content="noindex" />')
      .replace("<!--seo-body-->", ""),
  );

  const project = await projectId();
  let data = null;
  try {
    const [products, variants, seoPages, categories, shipping, models, collections, memberships] = await Promise.all([
      readCollection(project, "products"),
      readCollection(project, "variants"),
      readCollection(project, "seoPages"),
      readCollection(project, "productCategoriesConfig").catch(() => []),
      readCollection(project, "settings")
        .then((rows) => rows.find((r) => r._id === "shipping") || null)
        .catch(() => null),
      readCollection(project, "supportedModels"),
      readCollection(project, "collections"),
      readCollection(project, "collectionProducts"),
    ]);
    const [sections, sectionCards, heroSlides] = await Promise.all([
      readCollection(project, "homepageSections").catch(() => []),
      readCollection(project, "homepageSectionCards").catch(() => []),
      readCollection(project, "heroSlides").catch(() => []),
    ]);
    // Ratings for the Product markup. A separate read because a site with no
    // reviews yet must still build.
    const reviews = await readCollection(project, "reviews").catch(() => []);
    data = { products, variants, seoPages, categories, shipping, models, collections, memberships, sections, sectionCards, reviews, heroSlides };
  } catch (err) {
    log(`Firestore unreachable (${err?.message || err}); writing static pages only`);
  }

  if (!data) {
    // Firestore is unreachable: the three hub pages ship with their heads and
    // headings and without the catalogue they would otherwise list.
    const bare = staticPages(null);
    for (const p of bare) await writePage(p.route, render(template, p));
    await writeSitemaps(bare, []);
    await writeHtaccess(false);
    return;
  }

  const variantsByProduct = new Map();
  for (const v of data.variants) {
    if (!v.productId) continue;
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    variantsByProduct.get(v.productId).push(v);
  }
  const categoryNames = Object.fromEntries(
    data.categories.filter((c) => c.slug && c.name).map((c) => [c.slug, c.name]),
  );

  const active = data.products.filter((p) => p.status === "active" && p.slug && !/[/?#\s]/.test(p.slug));

  /*
   * A catalogue that came back empty is a bad read, not an empty shop.
   *
   * On the night the admin's "Delete all products" took 1,938 products with
   * it, this script ran happily against the hole it left: it wrote 358 landing
   * pages with nothing to sell, no product pages at all, and a sitemap that
   * dropped 1,997 URLs. The deploy that followed would have handed Google a
   * site where every product page 404s — a far more expensive failure than the
   * deletion, which was fixable in minutes.
   *
   * The shop has had products since the day it opened, so zero of them beside
   * a full set of SEO pages and models can only mean the read failed. Stopping
   * leaves the previous build in place, which is exactly right: yesterday's
   * pages are worth more than today's empty ones.
   */
  if (!active.length && (data.seoPages.length || data.models.length)) {
    log(`refusing to build: 0 products, but ${data.seoPages.length} SEO pages and ${data.models.length} models were read`);
    log("the previous deploy stays live; check the catalogue before rebuilding");
    throw Object.assign(new Error("empty catalogue"), { fatal: true });
  }

  const productSlugs = new Set(active.map((p) => p.slug));
  const seoDocs = data.seoPages
    .filter((s) => s.isPublished && s.slug && /^[a-z0-9][a-z0-9-]*$/.test(s.slug))
    .filter((s) => !REDIRECTED_SLUGS.has(s.slug) && !RESERVED.has(s.slug) && !productSlugs.has(s.slug));
  /*
   * The SEO pages are worked out before the product pages now, because a
   * product page wants to link to the pages its design is sold on and those
   * are decided here. Nothing else about the order changed.
   */
  /*
   * Written now rather than before the catalogue was read, because these three
   * are what the hub links come from. Their routes are fixed either way, so
   * `knownPaths` below is unaffected by the move.
   */
  // What the homepage's two first queries will return, shaped exactly as
  // firebase-hooks shapes them: active rows in order, section config parsed
  // from the JSON string some sections store it as.
  const asObject = (c) => { if (typeof c !== "string") return c; try { return JSON.parse(c); } catch { return {}; } };
  const liveSlides = (data.heroSlides || [])
    .filter((x) => x.isActive === true)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const liveSections = (data.sections || [])
    .filter((x) => x.isActive === true)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((x) => ({ ...x, config: asObject(x.config) }));
  const heroLocal = liveSlides.length ? await localHero(liveSlides[0]) : {};
  const home = liveSlides.length ? {
    seed: {
      "homepage.getActiveHeroSlides": liveSlides,
      "homepage.getActiveHomepageSections": liveSections,
      heroLocal,
    },
    shell: homeShell(liveSlides[0], heroLocal),
  } : null;
  {
    // The copy's counts (src/lib/category-paths.mjs) may undersell, never oversell.
    const modelsNow = (data.models || []).filter((m) => m.isActive !== false).length;
    const designsNow = new Set(active.filter((p) => p.productCategory === "skin")
      .flatMap((p) => (variantsByProduct.get(p._id) || []).map((v) => String(v.sku || "").toUpperCase().match(/^([A-Z]{1,3})-?(\d{1,4})/))
      .filter(Boolean).map((m) => `${m[1]}-${Number(m[2])}`))).size;
    const tag = (claimed, now, what) => now < claimed
      ? console.warn(`[prerender] WARNING: copy claims ${claimed}+ ${what} but the catalogue has ${now}; lower CATALOGUE_CLAIMS`)
      : now >= claimed * 1.25 && console.log(`[prerender] note: ${now} ${what} now, copy says ${claimed}+; CATALOGUE_CLAIMS can go up`);
    tag(CATALOGUE_CLAIMS.models, modelsNow, "models");
    tag(CATALOGUE_CLAIMS.designs, designsNow, "designs");
  }
  const statics = staticPages(siteHub(active, data.models, new Set(seoDocs.map((d) => d.slug))), home);
  for (const p of statics) await writePage(p.route, render(template, p));

  const seoInfo = await seoPageData(project, seoDocs, data, variantsByProduct);
  /*
   * Every path this build actually writes, so a link in the generated copy
   * that points anywhere else is dropped rather than shipped as a 404.
   */
  const knownPaths = new Set([
    "/", "/products", "/devices", "/magneto-x",
    ...statics.map((p) => p.route),
    ...seoDocs.map((d) => `/${d.slug}`),
    ...active.map((p) => `/products/${p.slug}`),
  ]);
  const themes = themeIndex(seoDocs, seoInfo);
  if (themes.length) log(`themes: ${themes.length} style pages, now linked from /skins and from every gadget page`);
  const seo = seoDocs.map((s) => seoPage(s, seoInfo.get(s.slug), knownPaths, themes));
  if (safeHtml.dead) log(`dropped ${safeHtml.dead} generated links pointing at pages that do not exist`);
  for (const p of seo) await writePage(p.route, render(template, p));

  /*
   * Which landing pages each design appears on, by turning the page → products
   * index the other way up. A design fits hundreds of devices, so the list is
   * capped: twelve links a shopper might follow, not a wall nobody reads and
   * Google discounts.
   */
  const pagesForProduct = new Map();
  for (const info of seoInfo.values()) {
    if (!info || info.total === 0) continue;
    for (const prod of info.products || []) {
      if (!prod?._id) continue;
      const list = pagesForProduct.get(prod._id) || [];
      // `info.listing` is a query-string URL, not a name — using it here put
      // "/products?productType=skin&brand=Samsung…" in the link text.
      if (list.length < 12) list.push({ slug: info.slug, title: info.title || info.slug });
      pagesForProduct.set(prod._id, list);
    }
  }

  // Designs like this one: same gadget and same finish, which is what a
  // shopper who did not want this pattern is actually looking for.
  const siblings = new Map();
  for (const p of active) {
    const key = `${p.gadgetCategory || ""}|${p.finishType || ""}`;
    siblings.set(key, [...(siblings.get(key) || []), p]);
  }

  const reviewsByProduct = new Map();
  for (const r of data.reviews || []) {
    if (!r?.productId) continue;
    reviewsByProduct.set(r.productId, [...(reviewsByProduct.get(r.productId) || []), r]);
  }
  if (reviewsByProduct.size) log(`reviews: ${data.reviews.length} across ${reviewsByProduct.size} products`);

  const productPages = active.map((p) =>
    productPage(p, variantsByProduct.get(p._id) || [], categoryNames, data.shipping, {
      fits: pagesForProduct.get(p._id) || [],
      similar: (siblings.get(`${p.gadgetCategory || ""}|${p.finishType || ""}`) || [])
        .filter((q) => q._id !== p._id)
        .slice(0, 8)
        .map((q) => ({ slug: q.slug, title: q.title })),
    }, reviewsByProduct.get(p._id) || []),
  );
  for (const p of productPages) await writePage(p.route, render(template, p));

  const magneto = magnetoPage(active, variantsByProduct);
  await writePage(magneto.route, render(template, magneto));

  const catalogueBytes = await writeCatalogue(active, variantsByProduct, brandLogos(data.sections || [], data.sectionCards || []), themes);
  const feedItems = await writeMerchantFeed(active, variantsByProduct);
  console.log(`[prerender] merchant feed: ${feedItems} items`);
  log(`catalogue: ${active.length} products, ${Math.round(catalogueBytes / 1024)} KB`);
  const modelFile = await writeModels(data.models);
  log(`models: ${modelFile.count} active, ${Math.round(modelFile.bytes / 1024)} KB`);

  const categories = categoryPages(active, variantsByProduct, themes);
  for (const p of categories) await writePage(p.route, render(template, p));

  // The listing points skins-for-one-gadget at these pages; say so if one is gone.
  const published = new Set(seo.map((p) => p.route));
  for (const [gadget, route] of Object.entries(GADGET_PAGES)) {
    if (!published.has(route)) log(`warning: ${gadget} listings canonicalise to ${route}, which is not a published SEO page`);
  }

  const indexable = [...statics, magneto, ...categories.filter((p) => !p.empty), ...seo.filter((p) => !p.empty)];
  await writeSitemaps(indexable, productPages);
  await fs.writeFile(path.join(DIST, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
  await submitIndexNow([...indexable, ...productPages]);
  const retired = data.products.filter((p) =>
    p.status === "archived" && p.slug && /^[a-z0-9][a-z0-9-]*$/.test(p.slug) && !productSlugs.has(p.slug) &&
    typeof p.redirectTo === "string" && /^\/[a-z0-9/-]*$/.test(p.redirectTo)
  );
  await writeHtaccess(true, retired);
  if (retired.length) log(`redirects: ${retired.length} retired listings`);
  const kinds = {};
  for (const i of seoInfo.values()) kinds[i.target.kind] = (kinds[i.target.kind] || 0) + 1;
  log(`wrote ${statics.length + 1} static, ${categories.length} category, ${productPages.length} product and ${seo.length} SEO pages`);
  log(`SEO pages by kind ${JSON.stringify(kinds)}; ${seo.filter((p) => p.empty).length} with nothing to sell (noindex)`);
}

main().catch(async (err) => {
  // Never fail the build over this; the catch-all in .htaccess still serves the app.
  console.error("[prerender] failed:", err);
  try {
    await fs.access(path.join(DIST, "app.html"));
  } catch {
    const t = await fs.readFile(path.join(DIST, "index.html"), "utf8").catch(() => "");
    if (t) await fs.writeFile(path.join(DIST, "app.html"), t);
  }
  /*
   * One exception to "never fail the build".
   *
   * Everything else here degrades to the app shell, which still serves every
   * page — slower for a crawler, fine for a person. An empty catalogue is
   * different: shipping it replaces a site of 2,000 indexed pages with a shell
   * that has nothing to render. Failing the build is what keeps the previous
   * deploy, and the previous deploy is the correct site.
   */
  if (err?.fatal) process.exit(1);
});
