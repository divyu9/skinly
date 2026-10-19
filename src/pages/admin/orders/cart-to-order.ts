import type { ManualOrderPrefill } from "./manual-order-dialog.tsx";

type CartLine = {
  productId: string; productTitle?: string; productImage?: string; variant?: string;
  price?: number; quantity?: number; phoneBrand?: string; phoneModel?: string; lensModel?: string;
  clearanceItemId?: string;
};

/**
 * A left cart as a manual order, for the customer who says "checkout gives me
 * an error, take the money directly and place it". Each line is either a
 * clearance piece or fresh stock:
 *  - clearance: the piece the cart named if it is still free, else a free
 *    piece of the same kind (it is marked sold when the order is confirmed);
 *    an older cart that did not record the piece is matched by listing and price;
 *  - fresh: today's variant price and SKU, not the price the cart remembered.
 * Lines that can no longer be sold are left out and named in `warnings`.
 */
export async function cartToOrder(src: {
  name?: string; phone?: string; email?: string;
  address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  items: CartLine[];
}): Promise<{ prefill: ManualOrderPrefill; warnings: string[] }> {
  const [{ functions }, { httpsCallable }, fs] = await Promise.all([
    import("@/lib/firebase"), import("firebase/functions"), import("@/lib/firestore-sdk"),
  ]);
  const r: any = await httpsCallable(functions, "listClearance")({ admin: true });
  const pieces: any[] = (r?.data?.items || []).filter((p: any) => p.status !== "sold");
  const used = new Set<string>();
  const free = (p: any) => p && p.buyable && !used.has(String(p.id));
  const warnings: string[] = [];
  const items: ManualOrderPrefill["items"] = [];

  for (const line of src.items || []) {
    const pid = String(line.productId || "");
    const title = String(line.productTitle || pid);
    const named = line.clearanceItemId ? pieces.find((p) => String(p.id) === String(line.clearanceItemId)) : null;
    const kindOf = named || pieces.find((p) => String(p.productId) === pid
      && (pid.startsWith("custom-") || Math.round(Number(p.price)) === Math.round(Number(line.price))));
    if (named || line.clearanceItemId || kindOf) {
      const k = named || kindOf;
      const pick = free(named) ? named : pieces.find((p) => free(p) && String(p.productId) === String(k?.productId || pid)
        && String(p.variant || "") === String(k?.variant ?? line.variant ?? "")
        && String(p.phoneModel || "") === String(k?.phoneModel ?? line.phoneModel ?? ""));
      if (!pick) { warnings.push(`${title}: no clearance piece left`); continue; }
      used.add(String(pick.id));
      items.push({
        productId: String(pick.productId), productTitle: String(pick.productTitle || title), variant: String(pick.variant || "Default"),
        sku: String(pick.sku || ""), price: Math.round(Number(pick.price) || 0), quantity: 1,
        ...(pick.phoneBrand ? { phoneBrand: String(pick.phoneBrand) } : {}),
        ...(pick.phoneModel ? { phoneModel: String(pick.phoneModel) } : {}),
        clearanceItemId: String(pick.id), clearancePersonal: pick.personal === true,
        productImage: String(pick.productImage || line.productImage || ""),
      });
      continue;
    }
    // Fresh stock: the variant as it is today.
    const vs = (await fs.getDocs(fs.query(fs.collection(fs.db, "variants"), fs.where("productId", "==", pid)))).docs.map((d) => ({ _id: d.id, ...(d.data() as any) }));
    const v = vs.find((x) => String(x.title || "").trim() === String(line.variant || "").trim());
    if (!v || !(Number(v.price) > 0)) { warnings.push(`${title} (${line.variant || "variant"}): no longer on sale`); continue; }
    items.push({
      productId: pid, productTitle: title, variant: String(v.title), sku: String(v.sku || ""),
      price: Math.round(Number(v.price)), quantity: Math.max(1, Number(line.quantity) || 1),
      ...(line.phoneBrand ? { phoneBrand: line.phoneBrand } : {}),
      ...(line.phoneModel ? { phoneModel: line.phoneModel } : {}),
      ...(line.lensModel ? { lensModel: line.lensModel } : {}),
      productImage: String(line.productImage || ""),
    });
  }

  const a = src.address || {};
  return {
    prefill: {
      customerName: src.name || "", customerPhone: String(src.phone || "").replace(/\D/g, "").slice(-10), customerEmail: src.email || "",
      addressLine1: a.line1 || "", addressLine2: a.line2 || "", city: a.city || "", state: a.state || "", pincode: a.pincode || "",
      items,
    },
    warnings,
  };
}
