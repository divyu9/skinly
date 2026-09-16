import { normalizeModelName } from "@/lib/mockups";

/**
 * Does a product come in a version for this device?
 *
 * Cases, camera rings and screen guards are stocked per model as variants
 * titled "Samsung Galaxy S24 Ultra / Black" or "iPhone 15". Their
 * `gadgetCategory` reads "accessory" (or nothing), so it cannot answer the
 * question; the variant titles can. A product with one variant or none — a
 * skin, a hub — has nothing per-model to check, so it counts as fitting.
 */
export function productFitsDevice(
  variants: Array<{ title?: string }> | undefined,
  brand: string | null | undefined,
  model: string | null | undefined,
): boolean {
  if (!brand || !model) return false;
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
