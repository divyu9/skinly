import * as admin from "firebase-admin";

/**
 * What an order earns back, worked out where it can be trusted.
 *
 * The product page and the cart both promise cashback — "earn ₹40 back" — and
 * both worked it out in the browser, for display, and threw the figure away.
 * Nothing ever wrote it onto the order and nothing ever paid it, so every one
 * of those promises was decoration. The same was true of a wallet-credit
 * coupon: checkout said "₹100 wallet credit on delivery" and `placeOrder`
 * recorded only that a coupon worth ₹0 off had been used.
 *
 * So the figure is settled here, on the server, at the moment the order is
 * written — not recomputed at delivery, because the rules will have changed by
 * then and the customer was promised today's.
 */

export interface CashbackLine {
  productId: string;
  variantId?: string;
  perUnit: number;
  quantity: number;
  total: number;
}

/**
 * The cashback rules that apply to these lines, and what they add up to.
 *
 * Mirrors calculateCartCashback in the browser shim, which is what the shopper
 * was shown: the best single rule per line wins rather than every rule
 * stacking, and a rule's cart-value window is measured against the items
 * total before any discount.
 */
export async function cashbackForLines(
  db: admin.firestore.Firestore,
  lines: Array<{ productId: string; variantId?: string; unitPrice: number; quantity: number }>,
  cartTotal: number
): Promise<{ total: number; lines: CashbackLine[] }> {
  if (!lines.length) return { total: 0, lines: [] };

  const snap = await db.collection("cashbackRules").where("isActive", "==", true).get();
  const rules = snap.docs.map((d) => ({ _id: d.id, ...(d.data() as any) }));
  if (!rules.length) return { total: 0, lines: [] };

  // Only pay for the collection lookup when a rule actually targets one.
  const collectionsOf = new Map<string, string[]>();
  if (rules.some((r) => r.targetType === "collection")) {
    const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const cp = await db.collection("collectionProducts").where("productId", "in", chunk).get();
      cp.docs.forEach((d) => {
        const row = d.data() as any;
        const key = String(row.productId);
        collectionsOf.set(key, [...(collectionsOf.get(key) || []), String(row.collectionId)]);
      });
    }
  }

  const out: CashbackLine[] = [];
  for (const line of lines) {
    const inCollections = collectionsOf.get(line.productId) || [];
    const applicable = rules.filter((r) => {
      const hits =
        (r.targetType === "variant" && line.variantId && r.targetId === line.variantId) ||
        (r.targetType === "product" && r.targetId === line.productId) ||
        (r.targetType === "collection" && inCollections.includes(String(r.targetId)));
      if (!hits) return false;
      const min = r.minCartValue === undefined ? -Infinity : Number(r.minCartValue);
      const max = r.maxCartValue === undefined ? Infinity : Number(r.maxCartValue);
      return cartTotal >= min && cartTotal <= max;
    });

    const perUnit = applicable.reduce((best, r) => {
      const amount = Math.round(
        r.cashbackType === "fixed"
          ? Number(r.cashbackValue) || 0
          : (line.unitPrice * (Number(r.cashbackValue) || 0)) / 100
      );
      return amount > best ? amount : best;
    }, 0);

    if (perUnit > 0) {
      out.push({
        productId: line.productId,
        ...(line.variantId ? { variantId: line.variantId } : {}),
        perUnit,
        quantity: line.quantity,
        total: perUnit * line.quantity,
      });
    }
  }

  return { total: out.reduce((s, l) => s + l.total, 0), lines: out };
}
