import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ExistingListing, ExistingVariant } from "@/lib/launch-plan.ts";

/** Every listing whose variants carry this design code, with its variants. */
export async function loadDesignListings(code: string): Promise<ExistingListing[]> {
  const gts = await getDocs(collection(db, "gadgetTypes"));
  const gadgetName = Object.fromEntries(gts.docs.map((g) => [g.id, String((g.data() as any).name || "").toLowerCase()]));
  const [range, bare] = await Promise.all([
    getDocs(query(collection(db, "variants"), where("sku", ">=", `${code}-`), where("sku", "<", `${code}-`))),
    getDocs(query(collection(db, "variants"), where("sku", "==", code))),
  ]);
  const byProduct = new Map<string, ExistingVariant[]>();
  for (const d of [...range.docs, ...bare.docs]) {
    const v = d.data() as any;
    if (!v.productId) continue;
    const list = byProduct.get(v.productId) || [];
    if (!list.some((x) => x.id === d.id)) {
      list.push({
        id: d.id,
        sku: String(v.sku || ""),
        title: String(v.title || ""),
        price: Number(v.price) || 0,
        materialMultiplier: Number(v.materialMultiplier) || 1,
        inventoryQuantity: Number(v.inventoryQuantity) || 0,
      });
    }
    byProduct.set(v.productId, list);
  }
  const out: ExistingListing[] = [];
  for (const [id, variants] of byProduct) {
    const p = await getDoc(doc(db, "products", id));
    if (!p.exists()) continue;
    const d = p.data() as any;
    // A variant whose SKU only starts with this code may belong to a longer
    // design code (R-1 vs R-10): the range query is exact on the dash, so this
    // is already excluded; the product's own design wins where it says one.
    if (d.createdFromDesign && String(d.createdFromDesign).toUpperCase() !== code.toUpperCase()) continue;
    out.push({
      id,
      title: String(d.title || ""),
      slug: String(d.slug || ""),
      status: String(d.status || ""),
      gadget: gadgetName[d.gadgetTypeId] || String(d.gadgetCategory || ""),
      listingKind: String(d.listingKind || ""),
      imageUrls: (Array.isArray(d.images) ? d.images : []).map((i: any) => String(typeof i === "string" ? i : i?.url || "")).filter(Boolean),
      variants,
    });
  }
  return out;
}

