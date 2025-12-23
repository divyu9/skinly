import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation that runs the variant mode migration
 */
export const runMigration = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 500;
    
    console.log("Starting variant mode migration...");
    
    // Get all products
    const products = await ctx.db.query("products").take(batchSize);
    
    let singleVariantCount = 0;
    let multiVariantCount = 0;
    let alreadyMigratedCount = 0;
    
    for (const product of products) {
      // Skip if already migrated
      if (product.hasMultipleVariants !== undefined) {
        alreadyMigratedCount++;
        continue;
      }
      
      // Get all variants for this product
      const variants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      
      const variantCount = variants.length;
      
      if (variantCount === 0) {
        console.warn(`Product ${product._id} has no variants, skipping...`);
        continue;
      }
      
      if (variantCount === 1) {
        // Single variant product
        await ctx.db.patch(product._id, {
          hasMultipleVariants: false,
        });
        
        // Mark the single variant as default variant
        await ctx.db.patch(variants[0]._id, {
          isDefaultVariant: true,
        });
        
        singleVariantCount++;
        console.log(`✓ Product ${product._id} (${product.title}) -> Single variant`);
      } else {
        // Multiple variant product
        await ctx.db.patch(product._id, {
          hasMultipleVariants: true,
        });
        
        multiVariantCount++;
        console.log(`✓ Product ${product._id} (${product.title}) -> Multiple variants (${variantCount})`);
      }
    }
    
    const result = {
      totalProcessed: products.length,
      singleVariantProducts: singleVariantCount,
      multiVariantProducts: multiVariantCount,
      alreadyMigrated: alreadyMigratedCount,
      skipped: products.length - singleVariantCount - multiVariantCount - alreadyMigratedCount,
    };
    
    console.log("Migration complete:", result);
    
    return result;
  },
});
