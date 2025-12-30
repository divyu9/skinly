/**
 * Convex Migration Functions
 * Add this file to your convex/ folder
 * 
 * These mutations are used by the migration script to update image URLs
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Update product images with new URLs
 */
export const updateProductImages = mutation({
  args: {
    productId: v.id("products"),
    imageUpdates: v.array(
      v.object({
        index: v.number(),
        newUrl: v.string(),
        alt: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { productId, imageUpdates }) => {
    const product = await ctx.db.get(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Clone existing images array
    const images = [...(product.images || [])];

    // Apply updates
    for (const update of imageUpdates) {
      if (images[update.index]) {
        images[update.index] = {
          ...images[update.index],
          url: update.newUrl,
          alt: update.alt || images[update.index].alt,
        };
      }
    }

    // Update product
    await ctx.db.patch(productId, { images });

    return { success: true, productId };
  },
});

/**
 * Update homepage section image URLs
 */
export const updateHomepageImage = mutation({
  args: {
    sectionId: v.id("homepageSections"),
    oldUrl: v.string(),
    newUrl: v.string(),
  },
  handler: async (ctx, { sectionId, oldUrl, newUrl }) => {
    const section = await ctx.db.get(sectionId);
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    // Replace URL in config (deep replace)
    if (section.config) {
      const configStr = JSON.stringify(section.config);
      const updatedConfigStr = configStr.replaceAll(oldUrl, newUrl);
      const updatedConfig = JSON.parse(updatedConfigStr);

      await ctx.db.patch(sectionId, { config: updatedConfig });
    }

    return { success: true, sectionId };
  },
});

/**
 * Update collection image URL
 */
export const updateCollectionImage = mutation({
  args: {
    collectionId: v.id("collections"),
    newUrl: v.string(),
  },
  handler: async (ctx, { collectionId, newUrl }) => {
    const collection = await ctx.db.get(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    await ctx.db.patch(collectionId, { image: newUrl });

    return { success: true, collectionId };
  },
});

/**
 * Get all products with Shopify CDN images
 * Useful for checking before/after migration
 */
export const getShopifyImageCount = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    let shopifyCount = 0;
    let totalImages = 0;
    
    for (const product of products) {
      if (product.images) {
        for (const img of product.images) {
          totalImages++;
          if (img.url && img.url.includes("cdn.shopify.com")) {
            shopifyCount++;
          }
        }
      }
    }
    
    return {
      totalProducts: products.length,
      totalImages,
      shopifyImages: shopifyCount,
      migratedImages: totalImages - shopifyCount,
      percentMigrated: totalImages > 0 
        ? Math.round((totalImages - shopifyCount) / totalImages * 100) 
        : 100,
    };
  },
});

/**
 * Bulk update product images (faster for large migrations)
 */
export const bulkUpdateProductImages = mutation({
  args: {
    updates: v.array(
      v.object({
        productId: v.id("products"),
        images: v.array(
          v.object({
            url: v.string(),
            alt: v.optional(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { updates }) => {
    let success = 0;
    let failed = 0;
    
    for (const update of updates) {
      try {
        await ctx.db.patch(update.productId, { images: update.images });
        success++;
      } catch (e) {
        failed++;
      }
    }
    
    return { success, failed };
  },
});
