// src/config/productConfig.ts

/**
 * Single source of truth for all product-related business logic.
 * UI components MUST NOT contain conditional business rules.
 */

export type ProductCategory = "skins" | "accessories";
export type FinishType = "matte" | "glossy" | "transparent";

interface CategoryConfig {
  requiresFinish: boolean;
  availableFinishes: FinishType[];
}

export const PRODUCT_CONFIG: Record<ProductCategory, CategoryConfig> = {
  skins: {
    requiresFinish: true,
    availableFinishes: ["matte", "glossy", "transparent"],
  },
  accessories: {
    requiresFinish: false,
    availableFinishes: [],
  },
};

/**
 * Returns whether finish selector should be shown
 */
export function requiresFinish(category: ProductCategory | null): boolean {
  if (!category) return false;
  return PRODUCT_CONFIG[category]?.requiresFinish ?? false;
}

/**
 * Returns allowed finishes for a category
 */
export function getAvailableFinishes(
  category: ProductCategory | null
): FinishType[] {
  if (!category) return [];
  return PRODUCT_CONFIG[category]?.availableFinishes ?? [];
}

/**
 * Safety check used by backend or frontend
 */
export function isFinishAllowed(
  category: ProductCategory,
  finish: FinishType
): boolean {
  return PRODUCT_CONFIG[category].availableFinishes.includes(finish);
}
