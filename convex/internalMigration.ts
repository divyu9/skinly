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

/**
 * Internal Mutation: Get homepage assets that need migration
 */
export const getHomepageAssetsToMigrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assets: Array<{
      id: string;
      table: string;
      field: string;
      url: string;
      originalData: any; // For complex updates like config
    }> = [];

    // 1. Scan categoryDisplaySettings (Explore by Category/Gadget)
    const categories = await ctx.db.query("categoryDisplaySettings").collect();
    for (const cat of categories) {
      if (cat.imageUrl && cat.imageUrl.includes("hercules")) {
        assets.push({
          id: cat._id,
          table: "categoryDisplaySettings",
          field: "imageUrl",
          url: cat.imageUrl,
          originalData: cat,
        });
      }
    }

    // 2. Scan homepageSectionCards (Explore by Brand manual cards)
    const cards = await ctx.db.query("homepageSectionCards").collect();
    for (const card of cards) {
      if (card.imageUrl && card.imageUrl.includes("hercules")) {
        assets.push({
          id: card._id,
          table: "homepageSectionCards",
          field: "imageUrl",
          url: card.imageUrl,
          originalData: card,
        });
      }
    }

    // 3. Scan heroSlides
    const slides = await ctx.db.query("heroSlides").collect();
    for (const slide of slides) {
      if (slide.imageUrl && slide.imageUrl.includes("hercules")) {
        assets.push({
          id: slide._id,
          table: "heroSlides",
          field: "imageUrl",
          url: slide.imageUrl,
          originalData: slide,
        });
      }
    }

    // 4. Scan featureBanners
    const banners = await ctx.db.query("featureBanners").collect();
    for (const banner of banners) {
      if (banner.backgroundImage && banner.backgroundImage.includes("hercules")) {
        assets.push({
          id: banner._id,
          table: "featureBanners",
          field: "backgroundImage",
          url: banner.backgroundImage,
          originalData: banner,
        });
      }
    }

    // 5. Scan homepageSettings
    const settings = await ctx.db.query("homepageSettings").collect();
    for (const setting of settings) {
      if (setting.logoImageUrl && setting.logoImageUrl.includes("hercules")) {
        assets.push({
          id: setting._id,
          table: "homepageSettings",
          field: "logoImageUrl",
          url: setting.logoImageUrl,
          originalData: setting,
        });
      }
    }

    // 6. Scan homepageSections (Deep scan of config)
    const sections = await ctx.db.query("homepageSections").collect();
    for (const section of sections) {
      if (section.config) {
        const configStr = JSON.stringify(section.config);
        if (configStr.includes("hercules")) {
          // Found a Hercules link in the config object
          // We return the whole section to be processed by the action
          // The action will need to parse, find urls, upload, and send back updated config
          assets.push({
            id: section._id,
            table: "homepageSections",
            field: "config",
            url: "JSON_BLOB", // Special marker indicating complex object
            originalData: section,
          });
        }
      }
    }

    return {
      assets,
      totalFound: assets.length,
    };
  },
});

/**
 * Internal Mutation: Update a generic homepage asset
 */
export const updateHomepageAsset = internalMutation({
  args: {
    table: v.string(),
    id: v.string(),
    updates: v.any(), // Flexible payload
  },
  handler: async (ctx, args) => {
    // Cast ID to any because we know the table name but not the strict Id<Table> type at compile time
    // This is safe because we trust the table name coming from our own scanner
    const table = args.table as any;
    const id = args.id as any;
    
    await ctx.db.patch(id, args.updates);
  },
});
