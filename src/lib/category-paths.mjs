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
export const HOME_META = {
  title: `Mobile Back Skins & Device Skins for ${claim(C.models)} Models | GoSkinly`,
  description: `Mobile, laptop, tablet, console & camera skins cut for ${claim(C.models)} models across ${C.brands} brands. ${claim(C.designs)} designs in matte & 3D textured finishes. Free shipping above ₹499.`,
  heading: "GoSkinly — mobile skins and device skins cut for your exact model",
};
/*
 * The business, as search engines should know it: one name, one address, one
 * phone, the same everywhere. Merchant Center, the site footer and the
 * policies all say this address (it moved from Noida, then Khandari Road);
 * mismatched contact details are something Merchant Center reviews for.
 */
export const BUSINESS = {
  name: "GoSkinly",
  street: "603, Bibhab Grande, Fatehabad Road",
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
  url: SITE,
  logo: `${SITE}/logo.webp`,
  description: `Vinyl skins cut to fit ${claim(CATALOGUE_CLAIMS.models)} phones, laptops, consoles, cameras and more.`,
  address: {
    "@type": "PostalAddress",
    streetAddress: BUSINESS.street,
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
  description: `Browse ${claim(C.designs)} skin designs for ${claim(C.models)} phones, laptops, tablets, consoles and cameras, plus cases and accessories. Free shipping above ₹499.`,
};

export const CATEGORY_PAGES = {
  skin: {
    path: "/skins",
    title: `Device & Mobile Skins – ${claim(CATALOGUE_CLAIMS.designs)} Designs, ${claim(CATALOGUE_CLAIMS.models)} Models | GoSkinly`,
    description:
      "Vinyl skins for phones, laptops, consoles, cameras and more, each printed and cut for your exact model. Matte, 3D textured and transparent finishes from ₹149. Free shipping above ₹499.",
    heading: "Skins",
  },
  "case-cover": {
    path: "/cases-covers",
    title: "Phone Cases & Covers – MagSafe & Clear Cases | GoSkinly",
    description:
      "MagSafe, transparent and titanium-finish cases for iPhone and Samsung models. Pick your phone for an exact fit. Free shipping above ₹499.",
    heading: "Cases & Covers",
  },
  "camera-ring": {
    path: "/camera-rings",
    title: "Camera Lens Rings for iPhone & Samsung | GoSkinly",
    description:
      "Camera lens protector rings for iPhone and Samsung models, in multiple colours. Pick your phone for an exact fit. Free shipping above ₹499.",
    heading: "Camera Rings",
  },
  glass: {
    path: "/screen-protectors",
    title: "Screen Protectors – AutoApply Tempered Glass | GoSkinly",
    description:
      "AutoApply tempered glass screen guards with a bubble-free applicator, cut for your exact phone model. Free shipping above ₹499.",
    heading: "Screen Protectors",
  },
  accessory: {
    path: "/accessories",
    title: "Gadget Accessories | GoSkinly",
    description:
      "Membranes, open-box review gadgets and accessories for your devices, shipped across India. Free shipping above ₹499.",
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
