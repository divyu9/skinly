import { useEffect, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "./firebase-db";
import { getDocs } from "./firebase-hooks-store";

/**
 * Which of these products can be bought right now, read from the variants.
 *
 * Model pages are built at night, so their "available" flags are as of the
 * build; stock moves during the day (an order, a roll recounted). A product is
 * in stock when any variant has a quantity above zero. Products whose
 * variants could not be read are left out of the answer (treated as unknown,
 * not as out of stock).
 */
export async function liveInStock(productIds: string[]): Promise<Map<string, boolean>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  const out = new Map<string, boolean>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const snaps = await Promise.all(chunks.map((c) => getDocs(query(collection(db, "variants"), where("productId", "in", c)))));
  snaps.forEach((snap) => snap.docs.forEach((d) => {
    const v: any = d.data();
    const qty = Number(v.inventoryQuantity ?? v.inventory_quantity ?? 0);
    const id = String(v.productId);
    out.set(id, (out.get(id) || false) || qty > 0);
  }));
  return out;
}

/** The same as a hook: undefined until read; re-read when the ids change. */
export function useLiveInStock(productIds: string[]): Map<string, boolean> | undefined {
  const key = [...new Set(productIds)].sort().join(",");
  const [stock, setStock] = useState<Map<string, boolean> | undefined>(undefined);
  useEffect(() => {
    if (!key) return;
    let live = true;
    liveInStock(key.split(",")).then((m) => { if (live) setStock(m); }).catch(() => { /* keep the build's order */ });
    return () => { live = false; };
  }, [key]);
  return stock;
}
