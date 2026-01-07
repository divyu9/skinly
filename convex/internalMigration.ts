import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Internal Mutation: Get products that need migration
 * Returns products that have "shopify" in their image URLs
 */
export const getProductsToMigrate = internalMutation({
  args: {
    limit: v.number(),
    cursor: v.optional(v.string()),
    source: v.optional(v.string()), // "shopify" or "hercules"
  },
  handler: async (ctx, args) => {
    // We iterate through all products to find ones with shopify links.
    // This is expensive but necessary for a one-time migration.
    // To optimize, we paginate through the whole table.
    
    const products = await ctx.db.query("products").paginate({ cursor: args.cursor || null, numItems: 50 });
    
    // Filter based on source
    const targetSource = args.source || "shopify";
    
    const shopifyProducts = products.page.filter(p => 
      p.images.some(img => {
        if (targetSource === "hercules") {
          return img.url.includes("hercules");
        }
        // Default to shopify
        return img.url.includes("cdn.shopify.com") || img.url.includes("shopify");
      })
    );

    // If we didn't find enough in this page, we might return fewer than 'limit'.
    // That's acceptable for a migration script; the client will just call again with the next cursor.
    // We prioritize returning *some* work to do.
    
    // Logic Fix: We return ALL matching items found in this page scan. 
    // We do NOT slice by args.limit anymore because that causes skipping items if more than limit are found in one page.
    // The batchSize is controlled by how many items we process in the action, but here we just return what we found in this "page scan".
    
    const productsToProcess = shopifyProducts;

    // Calculate approximate remaining (just checking if pagination is done)
    const hasMore = !products.isDone;

    return {
      products: productsToProcess,
      nextCursor: products.continueCursor, // This advances the global cursor correctly
      totalRemaining: hasMore ? 999 : 0, // Placeholder
      scanned: products.page.length, // Report how many raw items we scanned
    };
  },
});

/**
 * Internal Mutation: Update product images
 */
export const updateProductImages = internalMutation({
  args: {
    productId: v.id("products"),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
      phoneModel: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      images: args.images,
    });
  },
});
