// src/hooks/useProductFlow.ts

import { useState } from "react";
import { requiresFinish } from "@/productConfig";
import type { ProductCategory, FinishType } from "@/productConfig";

/**
 * Centralized product selection state.
 * Prevents scattered useState across components.
 */
export function useProductFlow() {
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [finish, setFinish] = useState<FinishType | null>(null);

  function selectCategory(nextCategory: ProductCategory) {
    setCategory(nextCategory);

    // Reset finish only if new category does not support it
    if (!requiresFinish(nextCategory)) {
      setFinish(null);
    }
  }

  return {
    category,
    finish,
    setFinish,
    selectCategory,
  };
}
// helpers for URL sync
export type ProductURLState = {
  productType?: string | null;
  gadget?: string | null;
  brand?: string | null;
  model?: string | null;
  finish?: string | null;
};

export function readProductURL(params: URLSearchParams): ProductURLState {
  return {
    productType: params.get("productType"),
    gadget: params.get("gadget"),
    brand: params.get("brand"),
    model: params.get("model"),
    finish: params.get("finish"),
  };
}

export function writeProductURL(
  navigate: (to: string, opts?: any) => void,
  params: URLSearchParams,
  updates: Partial<ProductURLState>,
  opts: { replace?: boolean } = { replace: true }
) {
  const next = new URLSearchParams(params);
  Object.entries(updates).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") next.delete(k);
    else next.set(k, String(v));
  });
  navigate(`?${next.toString()}`, { replace: opts.replace });
}
