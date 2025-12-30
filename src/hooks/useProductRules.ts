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
  finishType?: string | null;
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

    // Determine if product is a skin (backend truth preferred)
    const isSkinProduct = Boolean(product.finishType);

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
