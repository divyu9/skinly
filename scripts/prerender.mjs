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
import { resolveSeoTarget, selectSeoProducts, seoCopy } from "../src/lib/seo-pages.mjs";

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
]);

/** First path segments the app owns; an SEO page may not shadow them. */
const RESERVED = new Set([
  "", "account", "auth", "backend-skinly", "admin", "cart", "checkout", "orders",
  "payment", "mock-payment", "products", "devices", "policies", "magneto-x",
  "assets", "magneto", "app", "404", "index", "sitemap", "robots",
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

function render(template, p) {
  let html = template.replace(/<title>[\s\S]*?<\/title>\s*/, "");
  html = html.replace("<!--seo-head-->", headFor(p));
  html = html.replace("<!--seo-body-->", noscriptFor(p));
  // The hero image is only the LCP on the homepage; anywhere else the preload
  // is a wasted download on the most constrained connection.
  if (!p.keepHero) html = html.replace(/\s*<link rel="preload" as="image" data-hero[^>]*>/g, "");
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

function staticPages() {
  const homeDescription =
    "Shop premium vinyl skins for phones, laptops, tablets & more. 1000+ models supported, each skin cut for your exact device. Free shipping above ₹499. Starting ₹149.";
  const productsDescription =
    "Browse 500+ unique phone skins and gadget accessories. Premium quality, perfect fit, bubble-free application. Starting ₹149. Free shipping above ₹499.";
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
      title: "GoSkinly - Premium Device Skins & Accessories | Starting ₹149",
      description: homeDescription,
      canonical: `${SITE}/`,
      keepHero: true,
      priority: "1.0",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "GoSkinly",
          url: SITE,
          // A stable URL, identical to the one Index.tsx gives Helmet.
          logo: `${SITE}/logo.webp`,
          description: "Vinyl skins cut to fit 1000+ phones, laptops, consoles, cameras and more.",
        },
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
      body: `<h1>GoSkinly — premium device skins</h1><p>${esc(homeDescription)}</p><p><a href="${SITE}/products">Shop all skins</a> · <a href="${SITE}/devices">Supported devices</a></p>`,
    },
    {
      route: "/products",
      title: "Shop Premium Phone Skins & Gadget Accessories | GoSkinly",
      description: productsDescription,
      canonical: `${SITE}/products`,
      priority: "0.9",
      body: `<h1>Shop</h1><p>${esc(productsDescription)}</p>`,
    },
    {
      route: "/devices",
      title: "Supported Devices & Models | GoSkinly",
      description:
        "Browse all phone, laptop, tablet, and gadget models supported by GoSkinly. Find your device and shop custom-cut vinyl skins starting ₹149. Free shipping above ₹499.",
      canonical: `${SITE}/devices`,
      priority: "0.9",
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

function productPage(p, variants, categoryNames, shipping) {
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
  const title = p.metaTitle || `${p.title} | GoSkinly`;
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
      (plain ? `<p>${esc(clip(plain, 1200))}</p>` : ""),
  };
}

function seoPage(s, info) {
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
      description: s.metaDescription,
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
  const text = stripHtml(s.contentHTML);
  const empty = info && info.total === 0;
  const productLinks = (info?.products || [])
    .slice(0, 24)
    .map((p) => `<li><a href="${SITE}/products/${esc(p.slug)}">${esc(p.title)}</a></li>`)
    .join("");
  return {
    route: `/${s.slug}`,
    title: info?.title || s.metaTitle || `${h1} | GoSkinly`,
    description: info?.description || s.metaDescription || clip(text, 155),
    // Nothing to sell here right now: keep the page for people, not for search.
    robots: empty ? "noindex, follow" : undefined,
    empty,
    canonical: url,
    image: liveImage(s.heroImageUrl) ? s.heroImageUrl : undefined,
    jsonLd: jsonLdList,
    lastmod: s.updatedAt,
    priority: s.pageType === "device" || s.pageType === "brand" ? "0.8" : "0.7",
    body:
      crumbLinks(trail) +
      `<h1>${esc(h1)}</h1>` +
      (text ? `<p>${esc(clip(text, 3000))}</p>` : "") +
      (productLinks ? `<ul>${productLinks}</ul>` : "") +
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

async function writeSitemaps(pagesList, productList) {
  const now = new Date().toISOString();
  const files = [["sitemap-pages.xml", urlset(pagesList, false)]];
  if (productList.length) files.push(["sitemap-products.xml", urlset(productList, true)]);
  for (const [name, xml] of files) await fs.writeFile(path.join(DIST, name), xml);
  const index =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    files.map(([name]) => `  <sitemap>\n    <loc>${SITE}/${name}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  await fs.writeFile(path.join(DIST, "sitemap.xml"), index);
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

async function writeHtaccess(strict) {
  const file = path.join(DIST, ".htaccess");
  const src = await fs.readFile(file, "utf8");
  const start = src.indexOf("# >>> routing");
  const end = src.indexOf("# <<< routing");
  if (start === -1 || end === -1) throw new Error(".htaccess is missing its routing markers");
  if (!strict) return;
  const out = src.slice(0, start) + `# >>> routing (written by scripts/prerender.mjs)\n${STRICT_ROUTING}\n` + src.slice(end);
  await fs.writeFile(file, out);
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

  const resolved = seoDocs.map((s) => ({ s, target: resolveSeoTarget(s, data.models) }));

  // A device's own SEO page, so brand pages can link models to it.
  const pageForModel = new Map();
  for (const { s, target } of resolved) {
    if (target.kind === "model") pageForModel.set(`${target.brand}|${target.model}`, s.slug);
  }

  await fs.mkdir(path.join(DIST, "seo-data"), { recursive: true });
  const out = new Map();
  await pool(resolved, 8, async ({ s, target }) => {
    const sel = selectSeoProducts(target, data.products, variantsByProduct, collectionsByProduct);
    const copy = seoCopy(s, target, sel);

    let products = sel.products.slice(0, 48);
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
    const models = ranked.slice(0, 80).map((m) => {
      const slug = pageForModel.get(`${m.brand}|${m.model}`);
      const q = new URLSearchParams({ productType: "skin", gadget: m.category || target.gadget || "phone", brand: m.brand, model: m.model });
      return { brand: m.brand, model: m.model.replace(/\s+/g, " ").trim(), href: slug ? `/${slug}` : `/products?${q.toString()}` };
    });

    const info = {
      slug: s.slug,
      target: { ...target, models: undefined },
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
    data = { products, variants, seoPages, categories, shipping, models, collections, memberships };
  } catch (err) {
    log(`Firestore unreachable (${err?.message || err}); writing static pages only`);
  }

  const statics = staticPages();
  for (const p of statics) await writePage(p.route, render(template, p));

  if (!data) {
    await writeSitemaps(statics, []);
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
  const productPages = active.map((p) => productPage(p, variantsByProduct.get(p._id) || [], categoryNames, data.shipping));
  for (const p of productPages) await writePage(p.route, render(template, p));

  const productSlugs = new Set(active.map((p) => p.slug));
  const seoDocs = data.seoPages
    .filter((s) => s.isPublished && s.slug && /^[a-z0-9][a-z0-9-]*$/.test(s.slug))
    .filter((s) => !REDIRECTED_SLUGS.has(s.slug) && !RESERVED.has(s.slug) && !productSlugs.has(s.slug));
  const seoInfo = await seoPageData(project, seoDocs, data, variantsByProduct);
  const seo = seoDocs.map((s) => seoPage(s, seoInfo.get(s.slug)));
  for (const p of seo) await writePage(p.route, render(template, p));

  const magneto = magnetoPage(active, variantsByProduct);
  await writePage(magneto.route, render(template, magneto));

  await writeSitemaps([...statics, magneto, ...seo.filter((p) => !p.empty)], productPages);
  await writeHtaccess(true);
  const kinds = {};
  for (const i of seoInfo.values()) kinds[i.target.kind] = (kinds[i.target.kind] || 0) + 1;
  log(`wrote ${statics.length + 1} static, ${productPages.length} product and ${seo.length} SEO pages`);
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
});
