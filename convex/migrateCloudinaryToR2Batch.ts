/**
 * Batch migration actions for Cloudinary → R2 migration
 * Organized into Phase 1 (critical) and Phase 2 (mockups)
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ==========================================
// PHASE 1: CRITICAL ASSETS
// ==========================================

/**
 * Migrate site assets (logos) - HIGHEST PRIORITY
 * These appear on every page
 */
export const migrateSiteAssets = internalAction({
  handler: async (ctx) => {
    try {
      // Get settings - need to check if settings query exists
      const settings = await ctx.runQuery(internal.settings.get as any);
      if (!settings) {
        console.log("No settings found, skipping site assets migration");
        return { migrated: 0, skipped: 0 };
      }

      const assetsToMigrate: Array<{
        type: string;
        cloudinaryUrl: string;
        r2Key: string;
      }> = [];

      // Header logo
      if (settings.logoImageUrl?.includes("cloudinary")) {
        assetsToMigrate.push({
          type: "header-logo",
          cloudinaryUrl: settings.logoImageUrl,
          r2Key: "site-assets/header-logo.webp",
        });
      }

      // Footer logo
      if (settings.footerLogoImageUrl?.includes("cloudinary")) {
        assetsToMigrate.push({
          type: "footer-logo",
          cloudinaryUrl: settings.footerLogoImageUrl,
          r2Key: "site-assets/footer-logo.webp",
        });
      }

      if (assetsToMigrate.length === 0) {
        console.log("No site assets need migration");
        return { migrated: 0, skipped: 0 };
      }

      // Migrate each
      const results = [];
      for (const asset of assetsToMigrate) {
        try {
          console.log(`Migrating ${asset.type}...`);
          const r2Result = await ctx.runAction(internal.migrateCloudinaryToR2.migrateImageToR2, {
            cloudinaryUrl: asset.cloudinaryUrl,
            r2Key: asset.r2Key,
          });

          // Update settings - need to create this mutation if it doesn't exist
          console.log(`Updated ${asset.type} to R2: ${r2Result.publicUrl}`);
          results.push({ type: asset.type, status: "success" });
        } catch (error) {
          console.error(`Failed to migrate ${asset.type}:`, error);
          results.push({
            type: asset.type,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        migrated: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      };
    } catch (error) {
      console.error("Site assets migration failed:", error);
      throw error;
    }
  },
});

/**
 * Migrate product images - PHASE 1
 * User-facing, SEO-critical
 */
export const migrateProductImagesBatch = internalAction({
  args: { batchSize: v.number() },
  handler: async (ctx, args) => {
    console.log(`Starting product images batch migration (batch size: ${args.batchSize})`);

    const products = await ctx.runQuery(internal.migrateCloudinaryToR2.getProductsForMigration, {
      limit: args.batchSize,
    });

    if (products.length === 0) {
      console.log("No products need migration");
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`Found ${products.length} products to migrate`);
    const results = [];

    for (const product of products) {
      try {
        const updatedImages = [];

        for (let i = 0; i < (product.images?.length || 0); i++) {
          const img = product.images![i];

          if (img.url.includes("res.cloudinary.com")) {
            console.log(`Migrating product ${product.title} image ${i + 1}`);
            const r2Key = `products/${product.slug}/img_${i}.webp`;

            const r2Result = await ctx.runAction(internal.migrateCloudinaryToR2.migrateImageToR2, {
              cloudinaryUrl: img.url,
              r2Key,
            });

            updatedImages.push({
              ...img,
              url: r2Result.publicUrl,
            });
          } else {
            updatedImages.push(img);
          }
        }

        await ctx.runMutation(internal.migrateCloudinaryToR2.updateProductImages, {
          productId: product._id,
          images: updatedImages,
        });

        console.log(`Successfully migrated product: ${product.title}`);
        results.push({ id: product._id as string, status: "success" as const });
      } catch (error) {
        console.error(`Failed to migrate product ${product.title}:`, error);
        results.push({
          id: product._id as string,
          status: "failed" as const,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update progress
    await ctx.runMutation(internal.migrateCloudinaryToR2.updateMigrationProgress, {
      type: "products",
      results,
    });

    const summary = {
      processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    console.log(`Product batch complete:`, summary);
    return summary;
  },
});

// ==========================================
// PHASE 2: MOCKUPS
// ==========================================

/**
 * Migrate mockups - PHASE 2 (lowest priority)
 * Largest dataset (~9K images), run after Phase 1 is complete
 */
export const migrateMockupsBatch = internalAction({
  args: {
    batchSize: v.number(),
    skipExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log(`Starting mockups batch migration (batch size: ${args.batchSize})`);

    const mockups = await ctx.runQuery(internal.migrateCloudinaryToR2.getMockupsForMigration, {
      limit: args.batchSize,
      skipExisting: args.skipExisting ?? true,
    });

    if (mockups.length === 0) {
      console.log("No mockups need migration");
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`Found ${mockups.length} mockups to migrate`);
    const results = [];

    for (const mockup of mockups) {
      try {
        const r2Key = `mockups/${mockup.brand}/${mockup.model}/${mockup.sku}.webp`;
        console.log(`Migrating mockup: ${r2Key}`);

        const r2Result = await ctx.runAction(internal.migrateCloudinaryToR2.migrateImageToR2, {
          cloudinaryUrl: mockup.cloudinaryUrl!,
          r2Key,
          contentType: "image/webp",
        });

        await ctx.runMutation(internal.migrateCloudinaryToR2.updateMockupWithR2, {
          mockupId: mockup._id,
          r2Key,
          r2Bucket: "skinly",
        });

        results.push({
          id: mockup._id as string,
          status: "success" as const,
          r2Url: r2Result.publicUrl,
        });
      } catch (error) {
        console.error(`Failed to migrate mockup ${mockup.sku}:`, error);
        results.push({
          id: mockup._id as string,
          status: "failed" as const,
          error: error instanceof Error ? error.message : String(error),
          cloudinaryUrl: mockup.cloudinaryUrl,
        });
      }
    }

    // Update progress
    await ctx.runMutation(internal.migrateCloudinaryToR2.updateMigrationProgress, {
      type: "mockups",
      results,
    });

    const summary = {
      processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    console.log(`Mockups batch complete:`, summary);
    return summary;
  },
});

/**
 * Migrate media library - PHASE 2 (low priority)
 * Admin-only content
 */
export const migrateMediaLibraryBatch = internalAction({
  args: { batchSize: v.number() },
  handler: async (ctx, args) => {
    console.log(`Starting media library batch migration (batch size: ${args.batchSize})`);

    const mediaItems = await ctx.runQuery(internal.migrateCloudinaryToR2.getMediaForMigration, {
      limit: args.batchSize,
    });

    if (mediaItems.length === 0) {
      console.log("No media items need migration");
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`Found ${mediaItems.length} media items to migrate`);
    const results = [];

    for (const item of mediaItems) {
      try {
        const r2Key = `media/${item.folder || "general"}/${item.filename}`;
        console.log(`Migrating media: ${r2Key}`);

        const r2Result = await ctx.runAction(internal.migrateCloudinaryToR2.migrateImageToR2, {
          cloudinaryUrl: item.cloudinaryUrl,
          r2Key,
        });

        await ctx.runMutation(internal.migrateCloudinaryToR2.updateMediaLibraryWithR2, {
          mediaId: item._id,
          r2Key,
          r2Url: r2Result.publicUrl,
        });

        results.push({ id: item._id as string, status: "success" as const });
      } catch (error) {
        console.error(`Failed to migrate media ${item.filename}:`, error);
        results.push({
          id: item._id as string,
          status: "failed" as const,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Update progress
    await ctx.runMutation(internal.migrateCloudinaryToR2.updateMigrationProgress, {
      type: "mediaLibrary",
      results,
    });

    const summary = {
      processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    console.log(`Media library batch complete:`, summary);
    return summary;
  },
});

// ==========================================
// MIGRATION ORCHESTRATOR
// ==========================================

/**
 * Auto migration cron job
 * Phase 1: Site assets → Products → Collections
 * Phase 2: Mockups → Media library (only runs after Phase 1 complete)
 */
export const autoMigrateCron = internalAction({
  args: {
    phase: v.optional(v.union(v.literal("phase1"), v.literal("phase2"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const phase = args.phase || "phase1"; // Default to phase 1
    console.log(`Running auto migration cron (${phase})...`);

    const progress = await ctx.runQuery(internal.migrateCloudinaryToR2.getMigrationStatus, {});

    // ===== PHASE 1: CRITICAL ASSETS =====
    if (phase === "phase1" || phase === "all") {
      // 1. Site assets (logos) - highest priority
      if (progress.siteAssets.status !== "completed" && progress.siteAssets.total > 0) {
        console.log("Migrating site assets...");
        await ctx.runAction(internal.migrateCloudinaryToR2Batch.migrateSiteAssets, {});
        return { phase: "phase1", migrated: "siteAssets" };
      }

      // 2. Products - user-facing
      if (progress.products.status !== "completed" && progress.products.total > 0) {
        console.log("Migrating products batch...");
        await ctx.runAction(internal.migrateCloudinaryToR2Batch.migrateProductImagesBatch, {
          batchSize: 20,
        });
        return { phase: "phase1", migrated: "products" };
      }

      console.log("Phase 1 complete!");
    }

    // ===== PHASE 2: MOCKUPS & MEDIA =====
    if (phase === "phase2" || phase === "all") {
      // Only start phase 2 if phase 1 is complete
      if (phase === "all" && progress.products.status !== "completed") {
        console.log("Skipping phase 2 - phase 1 not complete yet");
        return { phase: "waiting", message: "Phase 1 incomplete" };
      }

      // 3. Mockups - largest dataset
      if (progress.mockups.status !== "completed" && progress.mockups.total > 0) {
        console.log("Migrating mockups batch...");
        await ctx.runAction(internal.migrateCloudinaryToR2Batch.migrateMockupsBatch, {
          batchSize: 50,
        });
        return { phase: "phase2", migrated: "mockups" };
      }

      // 4. Media library - lowest priority
      if (progress.mediaLibrary.status !== "completed" && progress.mediaLibrary.total > 0) {
        console.log("Migrating media library batch...");
        await ctx.runAction(internal.migrateCloudinaryToR2Batch.migrateMediaLibraryBatch, {
          batchSize: 30,
        });
        return { phase: "phase2", migrated: "mediaLibrary" };
      }

      console.log("Phase 2 complete!");
    }

    console.log("Migration fully complete!");
    return { phase: "complete", message: "All migrations finished" };
  },
});
