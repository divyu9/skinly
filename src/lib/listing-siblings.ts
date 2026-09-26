/**
 * The same design's listing for a particular brand.
 *
 * A design is sold as brand listings (MacBook, Samsung Galaxy, OnePlus…) and
 * catch-alls (Laptop, Android Phone…). A catch-all leaves out the brands that
 * have their own listing (functions/src/brandScope.ts keeps that list true),
 * but the model picker must not: a Samsung owner who lands on the Android
 * Phone listing and finds no Samsung simply leaves. So every brand is offered,
 * and picking one that has its own listing goes there, model chosen.
 *
 * Same design-and-gadget reading as the server, so both agree on siblings.
 */
import { brandKey } from "@/lib/catalogue";

const CATCH_ALL_KINDS: Record<string, string> = {
  laptop: "laptop", tablet: "tablet", "camera lens": "lens", charger: "charger",
  gimbal: "gimbals", "android phone": "phone", camera: "camera", drone: "drone",
};

export interface ListingLike {
  slug?: string;
  title?: string;
  listingKind?: string;
  designImageUrl?: string;
  gadgetCategory?: string;
  modelBrands?: string[];
  design?: string;
}

export function gadgetOfListing(p: ListingLike): string {
  const kind = String(p.listingKind || "").toLowerCase();
  if (CATCH_ALL_KINDS[kind]) return CATCH_ALL_KINDS[kind];
  if (/controller/.test(kind)) return "controller";
  if (/\bps5\b|xbox series|nintendo/.test(kind)) return "console";
  if (/lens/.test(kind)) return "lens";
  if (/charger/.test(kind)) return "charger";
  if (/gimbal/.test(kind)) return "gimbals";
  // Before "camera": the GoPro, DJI Osmo and Insta360 listings are action cameras.
  if (/gopro|osmo|insta360|action cam/.test(kind)) return "action-camera";
  if (/ipad|galaxy tab|\bpad\b|tab\b/.test(kind)) return "tablet";
  if (/macbook|laptop/.test(kind)) return "laptop";
  if (/camera/.test(kind)) return "camera";
  if (/drone/.test(kind)) return "drone";
  if (/mac mini/.test(kind)) return "mac-mini";
  if (p.gadgetCategory) return String(p.gadgetCategory);
  return "phone";
}

export function designKeysOf(p: ListingLike): string[] {
  const keys = new Set<string>();
  const up = /\/design-raw\/([A-Z]+-\d+)-/.exec(String(p.designImageUrl || ""))?.[1] || p.design;
  if (up) keys.add(up);
  const kind = String(p.listingKind || "").toLowerCase();
  let t = String(p.title || "").toLowerCase();
  if (kind) t = t.replace(new RegExp(`\\s*\\b${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`), "");
  t = t.replace(/\s+skins?$/, "").replace(/\bfinish\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (t && kind) keys.add(t);
  return [...keys];
}

/** The slug of `product`'s design listing made for `brand`, if there is one. */
export function siblingListingFor(product: ListingLike, brand: string, catalogue: ListingLike[]): string | null {
  const want = brandKey(brand);
  const keys = new Set(designKeysOf(product));
  if (!want || !keys.size) return null;
  const gadget = gadgetOfListing(product);
  const hit = catalogue.find((p) =>
    p.slug && p.slug !== product.slug
    && (p.modelBrands || []).some((b) => brandKey(b) === want)
    && gadgetOfListing(p) === gadget
    && designKeysOf(p).some((k) => keys.has(k)));
  return hit?.slug || null;
}
