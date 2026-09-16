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

export const CATEGORY_PAGES = {
  skin: {
    path: "/skins",
    title: "Device Skins – 800+ Designs Cut for 1000+ Models | GoSkinly",
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
