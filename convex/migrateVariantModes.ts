"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Migration: Auto-detect variant mode for existing products
 * 
 * This migration scans all products and sets:
 * - hasMultipleVariants: false for products with only 1 variant
 * - hasMultipleVariants: true for products with 2+ variants
 * - isDefaultVariant: true for single-variant products
 */
export const migrateProductVariantModes = action({
  args: {
    batchSize: v.optional(v.number()), // Process in batches to avoid timeouts
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      internal.migrateVariantModesInternal.runMigration,
      { batchSize: args.batchSize ?? 500 }
    );
    return result;
  },
});
