import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ==========================================
// CORE MIGRATION FUNCTION
// ==========================================

/**
 * Downloads an image from Cloudinary and uploads it to R2
 */
export const migrateImageToR2 = internalAction({
  args: {
    cloudinaryUrl: v.string(),
    r2Key: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ publicUrl: string; key: string }> => {
    try {
      // 1. Download from Cloudinary
      console.log(`Downloading from Cloudinary: ${args.cloudinaryUrl}`);
      const response = await fetch(args.cloudinaryUrl);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      // 2. Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // 3. Upload to R2
      console.log(`Uploading to R2: ${args.r2Key}`);
      const uploadResult = await ctx.runAction(api.r2.uploadToR2, {
        fileBase64: base64,
        key: args.r2Key,
        contentType: args.contentType || response.headers.get("content-type") || "image/webp",
      });

      if (!uploadResult.success || !uploadResult.url || !uploadResult.key) {
        throw new Error(`R2 upload failed: ${uploadResult.error || 'Unknown error'}`);
      }

      console.log(`Successfully migrated: ${args.r2Key}`);
      return { publicUrl: uploadResult.url!, key: uploadResult.key! };
    } catch (error) {
      console.error(`Migration failed for ${args.r2Key}:`, error);
      throw error;
    }
  },
});

// ==========================================
// TEST R2 UPLOAD
// ==========================================

/**
 * Tests R2 upload/download functionality with a small test image
 */
export const testR2Upload = internalAction({
  handler: async (ctx): Promise<{ success: boolean; url: string; message: string }> => {
    try {
      // 1x1 transparent PNG (base64)
      const testBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      console.log("Testing R2 upload...");
      const uploadResult = await ctx.runAction(api.r2.uploadToR2, {
        fileBase64: testBase64,
        key: "test/test-image.png",
        contentType: "image/png",
      });

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(`R2 upload failed: ${uploadResult.error || 'Unknown error'}`);
      }

      console.log("R2 upload successful, testing accessibility...");

      // 2. Verify URL is accessible
      const checkResponse = await fetch(uploadResult.url!);
      if (!checkResponse.ok) {
        throw new Error("R2 upload succeeded but image not accessible via public URL");
      }

      console.log("R2 test completed successfully!");
      return {
        success: true,
        url: uploadResult.url!,
        message: "R2 is configured correctly and working"
      };
    } catch (error) {
      console.error("R2 test failed:", error);
      throw new Error(`R2 test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// ==========================================
// MIGRATION QUERIES
// ==========================================

/**
 * Get mockups that need migration (have cloudinaryUrl but no r2Key)
 */
export const getMockupsForMigration = internalQuery({
  args: {
    limit: v.number(),
    skipExisting: v.boolean()
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("mockups")
      .filter((q) => q.neq(q.field("cloudinaryUrl"), undefined));

    if (args.skipExisting) {
      query = query.filter((q) => q.eq(q.field("r2Key"), undefined));
    }

    return await query.take(args.limit);
  },
});

/**
 * Get products that need migration (have images with cloudinary URLs)
 */
export const getProductsForMigration = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const allProducts = await ctx.db.query("products").collect();

    // Filter products that have Cloudinary images
    const productsNeedingMigration = allProducts.filter((product) =>
      product.images?.some((img) => img.url.includes("res.cloudinary.com"))
    );

    return productsNeedingMigration.slice(0, args.limit);
  },
});

/**
 * Get media library items that need migration
 */
export const getMediaForMigration = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    // Check if media library has r2Url field, if not return all items
    const mediaItems = await ctx.db.query("mediaLibrary").take(args.limit);

    // Filter items that don't have r2Url yet
    return mediaItems.filter((item: any) => !item.r2Url);
  },
});

// ==========================================
// MIGRATION MUTATIONS
// ==========================================

/**
 * Update mockup with R2 information after migration
 */
export const updateMockupWithR2 = internalMutation({
  args: {
    mockupId: v.id("mockups"),
    r2Key: v.string(),
    r2Bucket: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mockupId, {
      r2Key: args.r2Key,
      r2Bucket: args.r2Bucket,
      storageProvider: "r2",
    });
  },
});

/**
 * Update product images with R2 URLs after migration
 */
export const updateProductImages = internalMutation({
  args: {
    productId: v.id("products"),
    images: v.array(
      v.object({
        url: v.string(),
        alt: v.optional(v.string()),
        phoneModel: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      images: args.images,
    });
  },
});

/**
 * Update media library item with R2 information
 */
export const updateMediaLibraryWithR2 = internalMutation({
  args: {
    mediaId: v.id("mediaLibrary"),
    r2Key: v.string(),
    r2Url: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.mediaId, {
      r2Key: args.r2Key,
      r2Url: args.r2Url,
      storageProvider: "r2",
    } as any);
  },
});

// ==========================================
// MIGRATION PROGRESS TRACKING
// ==========================================

/**
 * Update migration progress after each batch
 */
export const updateMigrationProgress = internalMutation({
  args: {
    type: v.union(
      v.literal("mockups"),
      v.literal("products"),
      v.literal("mediaLibrary"),
      v.literal("siteAssets")
    ),
    results: v.array(
      v.object({
        id: v.string(),
        status: v.union(v.literal("success"), v.literal("failed")),
        error: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get existing progress or create new
    const existing = await ctx.db
      .query("migrationProgress")
      .withIndex("by_type", (q) => q.eq("migrationType", args.type))
      .first();

    const successCount = args.results.filter((r) => r.status === "success").length;
    const failureCount = args.results.filter((r) => r.status === "failed").length;
    const failedItems = args.results
      .filter((r) => r.status === "failed")
      .map((r) => ({
        id: r.id,
        url: "",
        error: r.error || "Unknown error",
      }));

    if (existing) {
      await ctx.db.patch(existing._id, {
        processedItems: existing.processedItems + args.results.length,
        successCount: existing.successCount + successCount,
        failureCount: existing.failureCount + failureCount,
        failedItems: [...(existing.failedItems || []), ...failedItems],
      });
    } else {
      await ctx.db.insert("migrationProgress", {
        migrationType: args.type,
        totalItems: 0, // Will be updated separately
        processedItems: args.results.length,
        successCount,
        failureCount,
        failedItems,
        startedAt: Date.now(),
        status: "in_progress",
      });
    }
  },
});

/**
 * Get current migration status for all types
 */
export const getMigrationStatus = query({
  handler: async (ctx) => {
    const types = ["mockups", "products", "mediaLibrary", "siteAssets"] as const;
    const status: any = {};

    for (const type of types) {
      const progress = await ctx.db
        .query("migrationProgress")
        .withIndex("by_type", (q) => q.eq("migrationType", type))
        .first();

      // Skip the expensive full-table scan for completed migrations.
      // All three .collect() calls combined can exceed Convex's 32K doc read limit
      // per function execution (mockups ~9K + products + mediaLibrary).
      if (progress?.status === "completed") {
        status[type] = {
          total: progress.processedItems,
          processed: progress.processedItems,
          successful: progress.successCount,
          failed: progress.failureCount,
          status: progress.status,
          failedItems: progress.failedItems || [],
        };
        continue;
      }

      // Get total count for each type (only when migration is not yet completed)
      let total = 0;
      if (type === "mockups") {
        const mockups = await ctx.db
          .query("mockups")
          .filter((q) => q.neq(q.field("cloudinaryUrl"), undefined))
          .collect();
        total = mockups.filter((m) => !m.r2Key).length;
      } else if (type === "products") {
        const products = await ctx.db.query("products").collect();
        total = products.filter((p) =>
          p.images?.some((img) => img.url.includes("res.cloudinary.com"))
        ).length;
      } else if (type === "mediaLibrary") {
        const media = await ctx.db.query("mediaLibrary").collect();
        total = media.filter((m: any) => !m.r2Url).length;
      } else if (type === "siteAssets") {
        total = 2; // Header + footer logo
      }

      status[type] = {
        total,
        processed: progress?.processedItems || 0,
        successful: progress?.successCount || 0,
        failed: progress?.failureCount || 0,
        status: progress?.status || "pending",
        failedItems: progress?.failedItems || [],
      };
    }

    return status;
  },
});
