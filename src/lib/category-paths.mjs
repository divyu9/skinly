/**
 * Clean, indexable URLs for the listing.
 *
 * Every category and gadget view of the shop lived at
 * /products?productType=…&gadget=…, and all of them declared /products as
 * their canonical, so "laptop skins" or "camera rings" had no page of their
 * own to rank. Categories now have a path of their own, and a skins view
 * narrowed to one gadget points at that gadget's landing page, which lists the
 * same products.
 *
 * Plain JS: shared by the app and scripts/prerender.mjs.
 */

export const SITE = "https://goskinly.com";

/*
 * What the catalogue can honestly claim, in one place. The homepage said
 * "1000+ models", /products "500+" designs and /skins "800+ designs"; the
 * catalogue holds 3,695 models across 55 brands and 348 skin designs (by SKU
 * code). scripts/prerender.mjs counts both on every build and warns when these
 * fall behind, so they only ever undersell.
 */
export const CATALOGUE_CLAIMS = {
  models: 3600,
  designs: 340,
  brands: 55,
};
export const claim = (n) => `${Number(n).toLocaleString("en-IN")}+`;

/*
 * Homepage and /products head copy, shared by the prerendered HTML and the
 * app's Helmet so the title Google indexed does not change when the app
 * mounts. Both lead with how India searches ("mobile skins", "back skins")
 * and carry the real counts; the homepage title used to be the brand name
 * and "Premium Device Skins & Accessories".
 */
const C = CATALOGUE_CLAIMS;

/*
 * The homepage's counts come from the catalogue itself. Its meta description
 * said "3,600+ models across 55 brands" (the constants above) while the page
 * body, counted on every build, said 5,765 models. scripts/prerender.mjs now
 * counts { models, brands, designs } once (catalogueStats), writes the head
 * from them, and puts them in the homepage seed, where Index.tsx's Helmet and
 * the "Why Skinly" tiles read the same numbers. Models and designs round
 * down (to 100 and 10) so the copy never oversells between builds; brands are
 * exact. CATALOGUE_CLAIMS remains the floor when no counts are available.
 */
export const floorClaim = (n, step) => (n >= step ? Math.floor(n / step) * step : n);
export function catalogueClaims(stats) {
  if (!stats || !(Number(stats.models) > 0)) return CATALOGUE_CLAIMS;
  return {
    models: floorClaim(Number(stats.models), 100),
    designs: Number(stats.designs) > 0 ? floorClaim(Number(stats.designs), 10) : CATALOGUE_CLAIMS.designs,
    brands: Number(stats.brands) > 0 ? Number(stats.brands) : CATALOGUE_CLAIMS.brands,
  };
}
export function homeMeta(stats) {
  const c = catalogueClaims(stats);
  return {
    title: `Mobile Back Skins & Device Skins for ${claim(c.models)} Models | GoSkinly`,
    description: `Mobile, laptop, tablet, console & camera skins cut for ${claim(c.models)} models across ${c.brands} brands. ${claim(c.designs)} designs in matte & 3D textured finishes. Free shipping from ₹299.`,
    heading: "GoSkinly — mobile skins and device skins cut for your exact model",
  };
}
export const HOME_META = homeMeta(null);
/*
 * The business, as search engines should know it: one name, one city, one
 * phone, the same everywhere. The street address is a private residence, so
 * the site and its schema stop at the city and PIN; Merchant Center holds the
 * full address, which it uses for verification and does not publish.
 */
export const BUSINESS = {
  name: "GoSkinly",
  legalName: "Mad House Media",
  city: "Agra",
  region: "Uttar Pradesh",
  postalCode: "282003",
  country: "IN",
  phone: "+91-9761011121",
  email: "prgoskinly@gmail.com",
};
export const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: BUSINESS.name,
  legalName: BUSINESS.legalName,
  url: SITE,
  logo: `${SITE}/logo.webp`,
  description: `Vinyl skins cut to fit ${claim(CATALOGUE_CLAIMS.models)} phones, laptops, consoles, cameras and more.`,
  address: {
    "@type": "PostalAddress",
    addressLocality: BUSINESS.city,
    addressRegion: BUSINESS.region,
    postalCode: BUSINESS.postalCode,
    addressCountry: BUSINESS.country,
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    areaServed: "IN",
    availableLanguage: ["English", "Hindi"],
  },
};

export const PRODUCTS_META = {
  title: "Shop Mobile Skins, Laptop Skins & Gadget Accessories | GoSkinly",
  description: `Browse ${claim(C.designs)} skin designs for ${claim(C.models)} phones, laptops, tablets, consoles and cameras, plus cases and accessories. Free shipping from ₹299.`,
};

export const CATEGORY_PAGES = {
  skin: {
    path: "/skins",
    title: `Device & Mobile Skins – ${claim(CATALOGUE_CLAIMS.designs)} Designs, ${claim(CATALOGUE_CLAIMS.models)} Models | GoSkinly`,
    description:
      "Vinyl skins for phones, laptops, consoles, cameras and more, each printed and cut for your exact model. Matte, 3D textured and transparent finishes from ₹149. Free shipping from ₹299.",
    heading: "Skins",
  },
  "case-cover": {
    path: "/cases-covers",
    title: "Phone Cases & Covers – MagSafe & Clear Cases | GoSkinly",
    description:
      "MagSafe, transparent and titanium-finish cases for iPhone and Samsung models. Pick your phone for an exact fit. Free shipping from ₹299.",
    heading: "Cases & Covers",
  },
  "camera-ring": {
    path: "/camera-rings",
    title: "Camera Lens Rings for iPhone & Samsung | GoSkinly",
    description:
      "Camera lens protector rings for iPhone and Samsung models, in multiple colours. Pick your phone for an exact fit. Free shipping from ₹299.",
    heading: "Camera Rings",
  },
  glass: {
    path: "/screen-protectors",
    title: "Screen Protectors – AutoApply Tempered Glass | GoSkinly",
    description:
      "AutoApply tempered glass screen guards with a bubble-free applicator, cut for your exact phone model. Free shipping from ₹299.",
    heading: "Screen Protectors",
  },
  accessory: {
    path: "/accessories",
    title: "Gadget Accessories | GoSkinly",
    description:
      "Membranes, open-box review gadgets and accessories for your devices, shipped across India. Free shipping from ₹299.",
    heading: "Accessories",
  },
};

/** Skins for one gadget: the landing page that lists them. */
export const GADGET_PAGES = {
  phone: "/phone-skins",
  laptop: "/laptop-skins",
  camera: "/camera-skins",
  lens: "/lenses-skins",
  drone: "/drones-skins",
  charger: "/chargers-skins",
  console: "/gaming-console-skins",
  tablet: "/ipad-tablet-skins",
  "mac-mini": "/mac-mini-skins",
};

export function categoryForPath(pathname) {
  const clean = String(pathname || "").replace(/\/+$/, "");
  for (const [category, page] of Object.entries(CATEGORY_PAGES)) {
    if (page.path === clean) return category;
  }
  return null;
}

/**
 * The URL a listing state should declare as canonical: the gadget page for
 * skins narrowed to one gadget, the category page for a category, and
 * /products for everything else. Finish, collection, device and sort are
 * refinements of the same list, not pages of their own.
 */
export function canonicalListingPath(productType, gadget) {
  if (productType === "skin" && gadget && GADGET_PAGES[gadget]) return GADGET_PAGES[gadget];
  if (productType === "magneto-x") return "/magneto-x";
  if (productType && CATEGORY_PAGES[productType]) return CATEGORY_PAGES[productType].path;
  return "/products";
}

/**
 * The homepage FAQ: shown on the page (Index.tsx) and written as FAQPage
 * markup (Index.tsx's Helmet and scripts/prerender.mjs) from this one list, so
 * the markup always says what the page shows. Answer engines (ChatGPT search,
 * Perplexity, AI Overviews) lift these answers as they are — keep them true to
 * the policies pages.
 */
export const HOME_FAQS = [
  {
    question: "Will a skin fit my exact phone or laptop?",
    // No count here: CATALOGUE_CLAIMS is a deliberately low floor, and the title and
    // llms.txt carry the live figures — two different numbers would confuse answer engines.
    answer: "Yes. Every skin is printed and cut to order from the template of your exact model, with openings for the cameras, ports and buttons. We cut for thousands of phone, laptop, tablet, console and camera models — find yours on the Supported Devices page.",
  },
  {
    question: "Does a skin protect my device?",
    answer: "A skin guards the back (and sides, with full body wrap) against scratches, scuffs and daily wear. It is a thin vinyl wrap, so it does not protect against drops.",
  },
  {
    question: "Will it leave residue when I remove it?",
    answer: "No. The vinyl peels off clean, without sticky residue, when you want a new look.",
  },
  {
    question: "How long does delivery take?",
    answer: "Orders are dispatched in 2–3 business days and take about 4–6 days in transit across India. Shipping is free from ₹299; below that a flat fee applies.",
  },
  {
    question: "Is cash on delivery available?",
    answer: "Yes, where the courier offers it. You can also pay online by UPI or card.",
  },
  {
    question: "How do I apply the skin?",
    answer: "Each order comes with an install kit. Clean the device with the wipes, lift the dust, line the skin up from the bottom ports and press it down with the squeegee. The step-by-step guide and video are at goskinly.com/how-to-apply.",
  },
  {
    question: "What if my parcel arrives damaged, opened or with a wrong item?",
    answer: "Every parcel is packed on camera. If the parcel looks opened or tampered with, do not accept it. When you open it, record one complete, uncut unboxing video showing the sealed parcel and its label (your name and AWB number). Claims for a missing, wrong or damaged item are accepted within 48 hours of delivery with that video — couriers reject cut or edited videos.",
  },
  {
    question: "My device model isn't listed. What can I do?",
    answer: "Request it from the site and we add the template — you are told on WhatsApp when it is ready to order.",
  },
];

export const HOME_FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQS.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
};
