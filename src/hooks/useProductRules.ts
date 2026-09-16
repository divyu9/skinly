// src/hooks/useProductRules.ts

import { useMemo } from "react";

/**
 * Centralized product rules derived from product data.
 * This file contains NO UI logic.
 * Safe to reuse across pages, admin, or future features.
 */

type GadgetCategory =
  | "phone"
  | "laptop"
  | "tablet"
  | "camera"
  | "lens"
  | "drone"
  | "console"
  | "charger"
  | "mac-mini"
  | "accessory"
  | "cover"
  | undefined;

interface ProductLike {
  title?: string;
  // Accept any string from backend for backward compatibility
  gadgetCategory?: string | undefined;
  productCategory?: string | undefined;
  finishType?: string | null;
  finishTypeId?: string | null;
}

export function useProductRules(product: ProductLike | null | undefined) {
  return useMemo(() => {
    if (!product) {
      return {
        needsDeviceSelector: false,
        isSkinProduct: false,
        isPhoneSkin: false,
      };
    }

    const titleLower = (product.title || "").toLowerCase();
    const category = product.gadgetCategory;

    // Is this a skin? `productCategory` decides whenever it is set — and every
    // active product has one. A finish alone is not enough: the transparent
    // cases, the AutoApply guards and the membranes all carry one, which put
    // "Cut to fit your exact model" and the skin feature cards on a Samsung
    // case. The finish is only a fallback for a product with no category.
    // finishType is legacy; products migrated to finishTypeId no longer carry it.
    const isSkinProduct = product.productCategory
      ? product.productCategory === "skin"
      : Boolean(product.finishType || product.finishTypeId);

    // Accessories / non-device-specific exclusions
    const isAccessory =
      category === "accessory" ||
      category === "cover" ||
      titleLower.includes("case") ||
      titleLower.includes("cover") ||
      titleLower.includes("camera ring") ||
      titleLower.includes("tempered") ||
      titleLower.includes("glass") ||
      titleLower.includes("screen guard") ||
      titleLower.includes("protector");

    // Device-specific categories that require model selection
    // Use string[] for runtime includes checks since backend may send arbitrary strings
    const deviceSpecificCategories: string[] = [
      "phone",
      "laptop",
      "tablet",
      "camera",
      "lens",
      "drone",
      "console",
      "charger",
      "mac-mini",
    ];

    const needsDeviceSelector =
      !isAccessory &&
      ((typeof category === "string" && deviceSpecificCategories.includes(category)) ||
        titleLower.includes("skin") ||
        titleLower.includes("membrane"));

    // Backward compatibility: phone skin check
    const isPhoneSkin =
      isSkinProduct &&
      needsDeviceSelector &&
      (category === "phone" || !category);

    return {
      needsDeviceSelector,
      isSkinProduct,
      isPhoneSkin,
    };
  }, [product]);
}
