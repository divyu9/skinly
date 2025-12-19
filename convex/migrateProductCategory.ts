import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
        
        // Check for Magneto X
        if (combined.includes("magneto")) {
          productCategory = "magneto-x";
        }
        // Check for Cases & Covers
        else if (combined.includes("case") || combined.includes("cover")) {
          productCategory = "case-cover";
        }
        // Check for Camera Rings
        else if (combined.includes("camera ring") || combined.includes("camera protector")) {
          productCategory = "camera-ring";
        }
        // Check for Glasses/Screen Protectors
        else if (combined.includes("autoapply") || combined.includes("tempered glass") || combined.includes("screen protector") || combined.includes("membrane") || combined.includes("protector")) {
          productCategory = "glass";
        }
        // Check for Skins (has a gadget type like phone, laptop, etc.)
        else if (product.gadgetTypeId || product.gadgetCategory) {
          // If it has a gadget association, it's likely a skin
          // Exclude accessories
          const isAccessory = combined.includes("stand") || combined.includes("holder") || 
                             combined.includes("mount") || combined.includes("charger");
          
          if (!isAccessory) {
            productCategory = "skin";
          } else {
            productCategory = "accessory";
          }
        }
        // Fallback to accessory
        else {
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
export const previewProductCategoryMigration = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const products = await ctx.db.query("products").take(limit);
    
    const preview = products.map(product => {
      const title = product.title.toLowerCase();
      const tags = product.tags.map(t => t.toLowerCase()).join(" ");
      const combined = `${title} ${tags}`;
      
      let suggestedCategory: "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory" | null = null;
      
      if (combined.includes("magneto")) {
        suggestedCategory = "magneto-x";
      } else if (combined.includes("case") || combined.includes("cover")) {
        suggestedCategory = "case-cover";
      } else if (combined.includes("camera ring") || combined.includes("camera protector")) {
        suggestedCategory = "camera-ring";
      } else if (combined.includes("autoapply") || combined.includes("tempered glass") || combined.includes("screen protector") || combined.includes("membrane") || combined.includes("protector")) {
        suggestedCategory = "glass";
      } else if (product.gadgetTypeId || product.gadgetCategory) {
        const isAccessory = combined.includes("stand") || combined.includes("holder") || 
                           combined.includes("mount") || combined.includes("charger");
        suggestedCategory = isAccessory ? "accessory" : "skin";
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
