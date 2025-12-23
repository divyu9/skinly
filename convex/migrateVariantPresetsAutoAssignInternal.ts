import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

/**
 * Smart auto-assignment of variant consumption presets.
 * Matches variant titles to preset names (case-insensitive, exact match).
 */
export const autoAssignPresets = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    matched: number;
    unmatched: number;
    skipped: number;
    unmatchedVariants: Array<{
      productId: string;
      variantTitle: string;
      gadgetType: string;
    }>;
  }> => {
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const unmatchedVariants: Array<{
      productId: string;
      variantTitle: string;
      gadgetType: string;
    }> = [];

    // Get all products with gadgetTypeId (eligible for roll management)
    const products = await ctx.db.query("products").collect();
    const productsWithGadgetType = products.filter((p) => p.gadgetTypeId);

    console.log(`Found ${productsWithGadgetType.length} products with gadget types`);

    for (const product of productsWithGadgetType) {
      if (!product.gadgetTypeId) continue;

      // Get gadget type details
      const gadgetType = await ctx.db.get(product.gadgetTypeId);
      if (!gadgetType) continue;

      // Get active presets for this gadget type
      const presets = await ctx.db
        .query("variantConsumptionPresets")
        .withIndex("by_gadget_type_and_active", (q) =>
          q.eq("gadgetTypeId", product.gadgetTypeId!).eq("isActive", true)
        )
        .collect();

      if (presets.length === 0) {
        console.log(`No presets found for ${gadgetType.displayName}`);
        continue;
      }

      // Create a map of lowercase preset names to preset IDs
      const presetMap = new Map<string, Id<"variantConsumptionPresets">>();
      for (const preset of presets) {
        presetMap.set(preset.name.toLowerCase().trim(), preset._id);
      }

      // Get all variants for this product
      const variants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();

      for (const variant of variants) {
        // Skip if already has a preset or custom multiplier
        if (variant.consumptionPresetId || variant.customMultiplier) {
          skipped++;
          continue;
        }

        // Try to match variant title to preset name
        const variantTitleLower = variant.title.toLowerCase().trim();
        const matchingPresetId = presetMap.get(variantTitleLower);

        if (matchingPresetId) {
          // Match found! Assign preset
          await ctx.db.patch(variant._id, {
            consumptionPresetId: matchingPresetId,
          });
          matched++;
          console.log(
            `Matched: ${gadgetType.displayName} - "${variant.title}" → preset`
          );
        } else {
          // No match
          unmatched++;
          unmatchedVariants.push({
            productId: product._id,
            variantTitle: variant.title,
            gadgetType: gadgetType.displayName,
          });
          console.log(
            `No match: ${gadgetType.displayName} - "${variant.title}"`
          );
        }
      }
    }

    return {
      success: true,
      matched,
      unmatched,
      skipped,
      unmatchedVariants,
    };
  },
});
