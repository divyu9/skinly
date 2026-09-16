import { normalizeModelName } from "@/lib/mockups";

export interface FitProduct {
  variants?: Array<{ title?: string }>;
  productCategory?: string;
  gadgetCategory?: string;
}

/**
 * Does a product come in a version for this device?
 *
 * Skins are made per gadget: a PS5 skin fits no phone, however many variants
 * it has. So a skin fits only when the device is the same kind of gadget —
 * and when either side is unknown it does not, because the cost of a wrong
 * "yes" is a PS5 page captioned "Cutting for iPhone 12".
 *
 * Cases, camera rings and screen guards are stocked per model as variants
 * titled "Samsung Galaxy S24 Ultra / Black" or "iPhone 15". Their
 * `gadgetCategory` reads "accessory" (or nothing), so the variant titles
 * answer instead. A non-skin with one variant or none — a hub — has nothing
 * per-model to check, so it counts as fitting.
 */
export function productFitsDevice(
  product: FitProduct,
  brand: string | null | undefined,
  model: string | null | undefined,
  deviceCategory: string | null | undefined,
): boolean {
  if (!brand || !model) return false;

  if (product.productCategory === "skin") {
    return !!deviceCategory && !!product.gadgetCategory && product.gadgetCategory === deviceCategory;
  }

  const variants = product.variants;
  if (!Array.isArray(variants) || variants.length <= 1) return true;

  const wanted = normalizeModelName(model).toLowerCase();
  const withBrand = normalizeModelName(`${brand} ${model}`).toLowerCase();
  return variants.some((v) => {
    // "<Model> / <Colour>" — the model is the part before the slash.
    const head = normalizeModelName(String(v?.title ?? "").split("/")[0]).toLowerCase();
    if (!head) return false;
    return head === wanted || head === withBrand || head.endsWith(wanted);
  });
}
