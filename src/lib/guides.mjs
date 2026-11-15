/**
 * Guides: the articles at /guides/<slug>, and how every one of them is drawn.
 *
 * An article comes from one of two places: the hand-written ones in
 * src/content/guides.mjs, and the ones the every-other-day writer makes
 * (functions/src/guidesAuto.ts), which live in Firestore's `guides`
 * collection. Both have the same shape, so one renderer serves the
 * prerendered HTML that crawlers read (scripts/prerender.mjs) and the page
 * people see (src/pages/guides/article.tsx), and the two can never say
 * different things.
 *
 * The shape:
 *   { slug, title, metaTitle, description, cluster, updated (YYYY-MM-DD),
 *     answer,            the two-to-three-line reply an answer engine quotes
 *     sections: [{ id, h2, blocks }],
 *     faqs: [{ q, a }],
 *     related: [slug],   sibling guides
 *     shop: [{ label, href }],
 *     images: { key: { alt, caption?, prompt, src? } }, cover?: key }
 *
 * A block is a string (a paragraph) or one of
 *   { ul: [..] } { ol: [..] } { h3: ".." } { tip: ".." } { note: ".." }
 *   { table: { head: [..], rows: [[..]] } } { img: key } { cta: { text, href } }
 *
 * Text may carry two marks and nothing else: **bold** and [label](/path).
 * Plain JS: shared by the app and scripts/prerender.mjs.
 */

export const GUIDE_SITE = "https://goskinly.com";

/** The /guides hub's head, shared by the build and the app. */
export const GUIDES_META = {
  title: "Skin Guides — Finishes, Fit, Care & Device Guides | GoSkinly",
  description: "Plain answers about device skins: matte vs 3D vs Tranzy, skin vs cover, finding your exact model, MacBook, iPad, camera and console skins, and care.",
};

/** The groups on /guides, in the order they are shown. */
export const GUIDE_CLUSTERS = [
  { id: "finishes", name: "Finishes explained", blurb: "Matte, 3D textured, Tranzy and leather — what each one looks and feels like." },
  { id: "choosing", name: "Choosing the right skin", blurb: "Skin or cover, full body or back only, and getting the exact model right." },
  { id: "gadgets", name: "Skins by gadget", blurb: "MacBooks, iPads, cameras, consoles and the rest — what is covered and what isn't." },
  { id: "living", name: "Living with a skin", blurb: "Heat, charging, warranty, cleaning, and taking it off cleanly." },
];

const escHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Splits text into its pieces: plain text, **bold**, and [label](href).
 * Returned as data so the app can make <Link>s and the build can make <a>s.
 */
export function inlineParts(text) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  const s = String(text ?? "");
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "b", v: m[1] });
    else out.push({ t: "a", v: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

/** The marks taken out: what a meta description or JSON-LD answer says. */
export const plainText = (text) => inlineParts(text).map((p) => p.v).join("");

const absolute = (href) => (href.startsWith("/") ? `${GUIDE_SITE}${href}` : href);

function inlineHtml(text) {
  return inlineParts(text).map((p) =>
    p.t === "b" ? `<strong>${escHtml(p.v)}</strong>`
      : p.t === "a" ? `<a href="${escHtml(absolute(p.href))}">${escHtml(p.v)}</a>`
        : escHtml(p.v)).join("");
}

/** Every internal path an article links to, for the build's dead-link check. */
export function guideLinks(g) {
  const paths = [];
  const scan = (t) => { for (const p of inlineParts(t)) if (p.t === "a" && p.href.startsWith("/")) paths.push(p.href); };
  scan(g.answer);
  for (const s of g.sections || []) {
    for (const b of s.blocks || []) {
      if (typeof b === "string") scan(b);
      else if (b.ul || b.ol) (b.ul || b.ol).forEach(scan);
      else if (b.tip) scan(b.tip);
      else if (b.note) scan(b.note);
      else if (b.table) b.table.rows.flat().forEach(scan);
      else if (b.cta?.href?.startsWith("/")) paths.push(b.cta.href);
    }
  }
  for (const f of g.faqs || []) scan(f.a);
  for (const s of g.shop || []) if (s.href?.startsWith("/")) paths.push(s.href);
  return [...new Set(paths)];
}

/** The words of one block, whatever its kind. */
function blockText(b) {
  if (typeof b === "string") return b;
  if (b.ul || b.ol) return (b.ul || b.ol).join(" ");
  if (b.table) return [...b.table.head, ...b.table.rows.flat()].join(" ");
  return b.h3 || b.tip || b.note || b.cta?.text || "";
}

/** Every word a reader reads, marks removed. */
export function guideText(g) {
  return [g.title, g.answer, ...(g.sections || []).flatMap((s) => [s.h2, ...(s.blocks || []).map(blockText)]),
    ...(g.faqs || []).flatMap((f) => [f.q, f.a])].map(plainText).join(" ");
}

/** Rough reading time, from the words a reader actually reads. */
export function readingMinutes(g) {
  return Math.max(2, Math.round(guideText(g).split(/\s+/).filter(Boolean).length / 220));
}

/** The images an article has a file for; the rest wait for their picture. */
export const imageOf = (g, key) => {
  const img = g.images?.[key];
  return img?.src ? img : null;
};

function blockHtml(g, b) {
  if (typeof b === "string") return `<p>${inlineHtml(b)}</p>`;
  if (b.h3) return `<h3>${inlineHtml(b.h3)}</h3>`;
  if (b.ul) return `<ul>${b.ul.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ul>`;
  if (b.ol) return `<ol>${b.ol.map((x) => `<li>${inlineHtml(x)}</li>`).join("")}</ol>`;
  if (b.tip) return `<p><strong>Tip:</strong> ${inlineHtml(b.tip)}</p>`;
  if (b.note) return `<p><strong>Good to know:</strong> ${inlineHtml(b.note)}</p>`;
  if (b.table) {
    return `<table><thead><tr>${b.table.head.map((h) => `<th>${inlineHtml(h)}</th>`).join("")}</tr></thead><tbody>` +
      b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
  }
  if (b.img) {
    const img = imageOf(g, b.img);
    return img ? `<figure><img src="${escHtml(img.src)}" alt="${escHtml(img.alt)}" loading="lazy" />${img.caption ? `<figcaption>${escHtml(img.caption)}</figcaption>` : ""}</figure>` : "";
  }
  if (b.cta) return `<p><a href="${escHtml(absolute(b.cta.href))}">${escHtml(b.cta.text)}</a></p>`;
  return "";
}

/** The whole article as plain HTML: what a crawler or an AI reader gets. */
export function guideBodyHtml(g, bySlug = new Map()) {
  const crumbs = `<nav><a href="${GUIDE_SITE}/">Home</a> › <a href="${GUIDE_SITE}/guides">Guides</a></nav>`;
  const cover = g.cover ? imageOf(g, g.cover) : null;
  const related = (g.related || []).map((s) => bySlug.get(s)).filter(Boolean);
  return crumbs +
    `<article><h1>${escHtml(g.title)}</h1>` +
    `<p><em>Updated ${escHtml(g.updated)} · GoSkinly, Agra</em></p>` +
    (cover ? `<img src="${escHtml(cover.src)}" alt="${escHtml(cover.alt)}" />` : "") +
    `<p><strong>Short answer:</strong> ${inlineHtml(g.answer)}</p>` +
    (g.sections || []).map((s) => `<section><h2 id="${escHtml(s.id)}">${inlineHtml(s.h2)}</h2>${(s.blocks || []).map((b) => blockHtml(g, b)).join("")}</section>`).join("") +
    (g.faqs?.length ? `<h2>Questions people ask</h2>${g.faqs.map((f) => `<h3>${escHtml(f.q)}</h3><p>${inlineHtml(f.a)}</p>`).join("")}` : "") +
    (g.shop?.length ? `<h2>Shop</h2><ul>${g.shop.map((s) => `<li><a href="${escHtml(absolute(s.href))}">${escHtml(s.label)}</a></li>`).join("")}</ul>` : "") +
    (related.length ? `<h2>Related guides</h2><ul>${related.map((r) => `<li><a href="${GUIDE_SITE}/guides/${escHtml(r.slug)}">${escHtml(r.title)}</a> — ${escHtml(r.description)}</li>`).join("")}</ul>` : "") +
    `</article>`;
}

/** Article, FAQPage and BreadcrumbList, the same on the build and in the app. */
export function guideJsonLd(g) {
  const url = `${GUIDE_SITE}/guides/${g.slug}`;
  const cover = g.cover ? imageOf(g, g.cover) : null;
  const out = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: g.description,
      datePublished: g.published || g.updated,
      dateModified: g.updated,
      mainEntityOfPage: url,
      ...(cover ? { image: absolute(cover.src) } : {}),
      author: { "@type": "Organization", name: "GoSkinly", url: GUIDE_SITE },
      publisher: { "@type": "Organization", name: "GoSkinly", logo: { "@type": "ImageObject", url: `${GUIDE_SITE}/logo.webp` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${GUIDE_SITE}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${GUIDE_SITE}/guides` },
        { "@type": "ListItem", position: 3, name: g.title, item: url },
      ],
    },
  ];
  if (g.faqs?.length) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: g.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plainText(f.a) } })),
    });
  }
  return out;
}

/**
 * Whether an article is fit to go out — the same test for the hand-written
 * ones (the build warns) and the generated ones (the writer keeps a failing
 * one as a draft). Prices and cash on delivery stay out of the prose: prices
 * move with every sale, and the product page shows the live one.
 */
export function guideIssues(g, { minWords = 800 } = {}) {
  const issues = [];
  const text = `${g.description || ""} ${guideText(g)}`;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(g.slug || ""))) issues.push("bad slug");
  if (!g.title || g.title.length > 90) issues.push("title missing or over 90 characters");
  if (!g.description || g.description.length < 70 || g.description.length > 165) issues.push("description should be 70–165 characters");
  if (!g.answer || g.answer.length < 80) issues.push("short answer missing");
  if ((g.sections || []).length < 4) issues.push("fewer than 4 sections");
  if ((g.faqs || []).length < 3) issues.push("fewer than 3 FAQs");
  if (words < minWords) issues.push(`only ${words} words`);
  if (/₹\s?\d|rs\.?\s?\d|inr\s?\d/i.test(text)) issues.push("states a price");
  if (/cash on delivery|\bCOD\b/i.test(text)) issues.push("mentions cash on delivery");
  if (guideLinks(g).length < 3) issues.push("fewer than 3 internal links");
  return issues;
}
