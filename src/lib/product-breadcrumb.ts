/**
 * The trail above a product: Home › Skins › Phone › <title>.
 *
 * It used to read Home › Shop › <title> for everything, with "Shop" opening
 * the whole catalogue — one tap from a phone skin landed on hubs and cases.
 * Each step now opens the listing that product actually lives in. The same
 * trail feeds the BreadcrumbList JSON-LD, so what Google reads matches what
 * the shopper sees.
 */

export interface Crumb {
  name: string;
  /** Site-relative; absent on the last crumb, which is the page itself. */
  path?: string;
}

const CATEGORY_FALLBACK: Record<string, string> = {
  skin: "Skins",
  "case-cover": "Cases & Covers",
  "camera-ring": "Camera Rings",
  "magneto-x": "Magneto X",
  glass: "Screen Protectors",
  accessory: "Accessories",
};

const titleCase = (slug: string) =>
  slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export function productBreadcrumb(
  product: { title?: string; productCategory?: string; gadgetCategory?: string } | null | undefined,
  options: {
    /** Admin names for categories, keyed by slug. */
    categoryNames?: Record<string, string>;
    /** A device the product fits, carried onto the gadget listing. */
    device?: { brand: string; model: string } | null;
  } = {},
): Crumb[] {
  const trail: Crumb[] = [{ name: "Home", path: "/" }];
  const category = product?.productCategory;

  if (category) {
    trail.push({
      name: options.categoryNames?.[category] || CATEGORY_FALLBACK[category] || titleCase(category),
      path: `/products?productType=${encodeURIComponent(category)}`,
    });
    // Skins are made per gadget, so the gadget is a real step. Cases and the
    // rest say "accessory" there, which is no step at all.
    const gadget = product?.gadgetCategory;
    if (category === "skin" && gadget && gadget !== "accessory") {
      const params = new URLSearchParams({ productType: "skin", gadget });
      if (options.device) {
        params.set("brand", options.device.brand);
        params.set("model", options.device.model);
      }
      trail.push({ name: titleCase(gadget), path: `/products?${params.toString()}` });
    }
  } else {
    trail.push({ name: "Shop", path: "/products" });
  }

  trail.push({ name: product?.title || "Product" });
  return trail;
}
