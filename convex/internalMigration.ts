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
  },
  handler: async (ctx, args) => {
    // We iterate through all products to find ones with shopify links.
    // This is expensive but necessary for a one-time migration.
    // To optimize, we paginate through the whole table.
    
    const products = await ctx.db.query("products").paginate({ cursor: args.cursor || null, numItems: 50 });
    
    // Filter for Shopify images in memory
    const shopifyProducts = products.page.filter(p => 
      p.images.some(img => img.url.includes("cdn.shopify.com") || img.url.includes("shopify"))
    );

    // If we didn't find enough in this page, we might return fewer than 'limit'.
    // That's acceptable for a migration script; the client will just call again with the next cursor.
    // We prioritize returning *some* work to do.
    
    // Slice to requested limit
    const productsToProcess = shopifyProducts.slice(0, args.limit);

    // Calculate approximate remaining (just checking if pagination is done)
    const hasMore = !products.isDone || (shopifyProducts.length > args.limit);

    return {
      products: productsToProcess,
      nextCursor: products.continueCursor, // This advances the global cursor, skipping non-shopify products effectively
      totalRemaining: hasMore ? 999 : 0, // Placeholder
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
