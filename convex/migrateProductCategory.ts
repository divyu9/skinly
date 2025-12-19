import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Migration to classify products into productCategory field
export const migrateProductsToProductCategory = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const product of products) {
      try {
        // Skip if already has productCategory
        if (product.productCategory) {
          skipped++;
          continue;
        }
        
        const title = product.title.toLowerCase();
        const tags = product.tags.map(t => t.toLowerCase()).join(" ");
        const combined = `${title} ${tags}`;
        
        let productCategory: "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null = null;
        
        // Rule 1: Skin
        const skinKeywords = [
          "skin for",
          "matte skin",
          "matte finish",
          "3d textured",
          "3d skin",
          "tranzy skin",
          // Gadget-specific patterns
          "phone skin",
          "laptop skin",
          "tablet skin",
          "ipad skin",
          "console skin",
          "camera skin",
          "drone skin",
          "charger skin"
        ];
        const hasSkinKeyword = skinKeywords.some(keyword => combined.includes(keyword));
        
        // Rule 2: Camera Rings
        const hasCameraRing = combined.includes("camera ring");
        
        // Rule 3: Cover & Case
        const hasCover = combined.includes("cover") || combined.includes("case");
        
        // Rule 4: Magneto & More
        const hasMagneto = combined.includes("magneto");
        
        // Rule 5: Membrane/Protectors
        const hasProtector = combined.includes("matte membrane") || 
                            combined.includes("gloss membrane") || 
                            combined.includes("autoapply");
        
        // Apply rules in priority order
        if (hasMagneto) {
          productCategory = "magneto-x";
        } else if (hasCameraRing) {
          productCategory = "camera-ring";
        } else if (hasCover) {
          productCategory = "case-cover";
        } else if (hasProtector) {
          productCategory = "glass";
        } else if (hasSkinKeyword || product.gadgetTypeId || product.gadgetCategory) {
          productCategory = "skin";
        } else {
          productCategory = "accessory";
        }
        
        if (productCategory) {
          await ctx.db.patch(product._id, { productCategory });
          migrated++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error migrating product ${product._id}:`, error);
        failed++;
      }
    }
    
    return {
      success: true,
      migrated,
      skipped,
      failed,
      message: `Migrated ${migrated} products, skipped ${skipped}, failed ${failed}`,
    };
  },
});

// Get migration preview
export const previewProductCategoryMigration = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const products = await ctx.db.query("products").take(limit);
    
    const preview = products.map(product => {
      const title = product.title.toLowerCase();
      const tags = product.tags.map(t => t.toLowerCase()).join(" ");
      const combined = `${title} ${tags}`;
      
      let suggestedCategory: "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null = null;
      
      // Rule 1: Skin
      const skinKeywords = [
        "skin for",
        "matte skin",
        "matte finish",
        "3d textured",
        "3d skin",
        "tranzy skin",
        // Gadget-specific patterns
        "phone skin",
        "laptop skin",
        "tablet skin",
        "ipad skin",
        "console skin",
        "camera skin",
        "drone skin",
        "charger skin"
      ];
      const hasSkinKeyword = skinKeywords.some(keyword => combined.includes(keyword));
      
      // Rule 2: Camera Rings
      const hasCameraRing = combined.includes("camera ring");
      
      // Rule 3: Cover & Case
      const hasCover = combined.includes("cover") || combined.includes("case");
      
      // Rule 4: Magneto & More
      const hasMagneto = combined.includes("magneto");
      
      // Rule 5: Membrane/Protectors
      const hasProtector = combined.includes("matte membrane") || 
                          combined.includes("gloss membrane") || 
                          combined.includes("autoapply");
      
      // Apply rules in priority order
      if (hasMagneto) {
        suggestedCategory = "magneto-x";
      } else if (hasCameraRing) {
        suggestedCategory = "camera-ring";
      } else if (hasCover) {
        suggestedCategory = "case-cover";
      } else if (hasProtector) {
        suggestedCategory = "glass";
      } else if (hasSkinKeyword || product.gadgetTypeId || product.gadgetCategory) {
        suggestedCategory = "skin";
      } else {
        suggestedCategory = "accessory";
      }
      
      return {
        _id: product._id,
        title: product.title,
        currentCategory: product.productCategory || null,
        suggestedCategory,
        willChange: product.productCategory !== suggestedCategory,
      };
    });
    
    return {
      preview,
      stats: {
        total: preview.length,
        willChange: preview.filter(p => p.willChange).length,
      },
    };
  },
});
