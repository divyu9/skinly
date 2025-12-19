import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Helper function to detect gadget category from product title
function detectGadgetCategory(title: string): string | null {
  const titleLower = title.toLowerCase();
  
  // Check for accessories first (highest priority to exclude from finish type assignment)
  if (titleLower.includes("case") || 
      titleLower.includes("cover") || 
      titleLower.includes("ring") ||
      titleLower.includes("stand") ||
      titleLower.includes("holder")) {
    return "accessory";
  }
  
  // Check for specific gadget types
  if (titleLower.includes("phone skin") || 
      titleLower.includes("iphone") || 
      titleLower.includes("samsung") || 
      titleLower.includes("oneplus") ||
      titleLower.includes("realme") ||
      titleLower.includes("vivo") ||
      titleLower.includes("oppo") ||
      titleLower.includes("xiaomi") ||
      titleLower.includes("motorola") ||
      titleLower.includes("nothing") ||
      titleLower.includes("pixel") ||
      titleLower.includes("iqoo") ||
      titleLower.includes("poco")) {
    return "phone";
  }
  
  if (titleLower.includes("laptop skin") || 
      titleLower.includes("macbook") ||
      titleLower.includes("laptop")) {
    return "laptop";
  }
  
  if (titleLower.includes("camera skin") || 
      titleLower.includes("camera")) {
    return "camera";
  }
  
  if (titleLower.includes("lens skin") || 
      titleLower.includes("lens")) {
    return "lens";
  }
  
  if (titleLower.includes("tablet") || 
      titleLower.includes("ipad")) {
    return "tablet";
  }
  
  if (titleLower.includes("drone")) {
    return "drone";
  }
  
  if (titleLower.includes("mac mini")) {
    return "mac-mini";
  }
  
  if (titleLower.includes("console") || 
      titleLower.includes("playstation") || 
      titleLower.includes("xbox") ||
      titleLower.includes("ps5") ||
      titleLower.includes("ps4")) {
    return "console";
  }
  
  if (titleLower.includes("charger")) {
    return "charger";
  }
  
  return null;
}

// Helper function to detect finish type from product title
function detectFinishType(title: string): { name: string; confidence: "high" | "medium" | "low" } | null {
  const titleLower = title.toLowerCase();
  
  // Skip if it's an accessory
  if (titleLower.includes("case") || 
      titleLower.includes("cover") || 
      titleLower.includes("ring")) {
    return null;
  }
  
  // Check for 3D/Embossed (multiple variations)
  if (titleLower.includes("3d embossed") || 
      titleLower.includes("3d textured") ||
      titleLower.includes("3d emboss") ||
      titleLower.includes("embossed") ||
      titleLower.includes("3d")) {
    return { name: "embossed", confidence: "high" };
  }
  
  // Check for Transparent (using "Tranzy")
  if (titleLower.includes("tranzy") || 
      titleLower.includes("transparent")) {
    return { name: "transparent", confidence: "high" };
  }
  
  // Check for Protectors/Membranes
  if (titleLower.includes("membrane") || 
      titleLower.includes("protector") ||
      titleLower.includes("guard")) {
    return { name: "protectors", confidence: "high" };
  }
  
  // Check for Matte (should be last as it's most common)
  if (titleLower.includes("matte") || 
      titleLower.includes("mat finish")) {
    return { name: "matte", confidence: "high" };
  }
  
  return null;
}

// Preview auto-classification for all products
export const previewAutoClassification = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 1000;
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(limit);
    
    // Get all finish types for mapping
    const finishTypes = await ctx.db.query("finishTypes").collect();
    const finishTypeMap = new Map(finishTypes.map(ft => [ft.name, ft]));
    
    const results = products.map(product => {
      const detectedGadget = detectGadgetCategory(product.title);
      const detectedFinish = detectFinishType(product.title);
      
      let detectedFinishTypeId: Id<"finishTypes"> | null = null;
      let detectedFinishDisplayName: string | null = null;
      let finishConfidence: "high" | "medium" | "low" | null = null;
      
      if (detectedFinish) {
        const finishType = finishTypeMap.get(detectedFinish.name);
        if (finishType) {
          detectedFinishTypeId = finishType._id;
          detectedFinishDisplayName = finishType.displayName;
          finishConfidence = detectedFinish.confidence;
        }
      }
      
      // Determine if changes will be made
      const gadgetWillChange = detectedGadget && detectedGadget !== product.gadgetCategory;
      const finishWillChange = detectedFinishTypeId && detectedFinishTypeId !== product.finishTypeId;
      const willBeClassified = !product.gadgetCategory || !product.finishTypeId;
      
      return {
        productId: product._id,
        title: product.title,
        currentGadget: product.gadgetCategory || null,
        detectedGadget,
        currentFinishTypeId: product.finishTypeId || null,
        detectedFinishTypeId,
        detectedFinishDisplayName,
        finishConfidence,
        gadgetWillChange,
        finishWillChange,
        willBeClassified,
        isAccessory: detectedGadget === "accessory",
      };
    });
    
    // Calculate summary stats
    const stats = {
      total: results.length,
      willBeClassified: results.filter(r => r.willBeClassified).length,
      gadgetChanges: results.filter(r => r.gadgetWillChange).length,
      finishChanges: results.filter(r => r.finishWillChange).length,
      accessories: results.filter(r => r.isAccessory).length,
      undetected: results.filter(r => !r.detectedGadget).length,
    };
    
    return { results, stats };
  },
});

// Apply auto-classification to all products
export const applyAutoClassification = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    
    // Get all finish types for mapping
    const finishTypes = await ctx.db.query("finishTypes").collect();
    const finishTypeMap = new Map(finishTypes.map(ft => [ft.name, ft]));
    
    let classified = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const product of products) {
      try {
        const detectedGadget = detectGadgetCategory(product.title);
        const detectedFinish = detectFinishType(product.title);
        
        // Only update if we detected something and it's different from current value
        const updates: {
          gadgetCategory?: string;
          finishTypeId?: Id<"finishTypes">;
        } = {};
        
        if (detectedGadget && detectedGadget !== product.gadgetCategory) {
          updates.gadgetCategory = detectedGadget;
        }
        
        if (detectedFinish && detectedGadget !== "accessory") {
          const finishType = finishTypeMap.get(detectedFinish.name);
          if (finishType && finishType._id !== product.finishTypeId) {
            updates.finishTypeId = finishType._id;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          if (!args.dryRun) {
            await ctx.db.patch(product._id, updates);
          }
          classified++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error classifying product ${product._id}:`, error);
        errors++;
      }
    }
    
    // Recalculate product counts for all finish types
    if (!args.dryRun) {
      for (const finishType of finishTypes) {
        const productsWithFinish = await ctx.db
          .query("products")
          .withIndex("by_finish_type", (q) => q.eq("finishTypeId", finishType._id))
          .collect();
        
        await ctx.db.patch(finishType._id, {
          productCount: productsWithFinish.length,
        });
      }
    }
    
    return {
      success: true,
      classified,
      skipped,
      errors,
      message: args.dryRun 
        ? `Dry run: ${classified} products would be classified` 
        : `Successfully classified ${classified} products`,
    };
  },
});

// Get unclassified products
export const getUnclassifiedProducts = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    
    return products.filter(p => !p.gadgetCategory || !p.finishTypeId);
  },
});

// Get products by classification status
export const getProductsByClassification = query({
  args: {
    gadgetCategory: v.optional(v.string()), // Accept any string for dynamic gadget types
    finishTypeId: v.optional(v.id("finishTypes")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("products").filter((q) => q.eq(q.field("status"), "active"));
    
    const products = await query.collect();
    
    // Filter in memory for more flexibility
    let filtered = products;
    
    if (args.gadgetCategory) {
      filtered = filtered.filter(p => p.gadgetCategory === args.gadgetCategory);
    }
    
    if (args.finishTypeId) {
      filtered = filtered.filter(p => p.finishTypeId === args.finishTypeId);
    }
    
    return filtered;
  },
});

// Bulk update product classification
export const bulkUpdateClassification = mutation({
  args: {
    productIds: v.array(v.id("products")),
    gadgetCategory: v.optional(v.string()), // Accept any string for dynamic gadget types
    finishTypeId: v.optional(v.id("finishTypes")),
  },
  handler: async (ctx, args) => {
    if (args.productIds.length === 0) {
      throw new ConvexError({
        message: "No products selected",
        code: "BAD_REQUEST",
      });
    }
    
    const updates: Partial<{
      gadgetCategory: typeof args.gadgetCategory;
      finishTypeId: Id<"finishTypes">;
    }> = {};
    
    if (args.gadgetCategory) {
      updates.gadgetCategory = args.gadgetCategory;
    }
    
    if (args.finishTypeId) {
      updates.finishTypeId = args.finishTypeId;
    }
    
    if (Object.keys(updates).length === 0) {
      throw new ConvexError({
        message: "No updates specified",
        code: "BAD_REQUEST",
      });
    }
    
    // Update all selected products
    for (const productId of args.productIds) {
      await ctx.db.patch(productId, updates);
    }
    
    // Recalculate product counts if finish type was updated
    if (args.finishTypeId) {
      const finishTypes = await ctx.db.query("finishTypes").collect();
      for (const ft of finishTypes) {
        const productsWithFinish = await ctx.db
          .query("products")
          .withIndex("by_finish_type", (q) => q.eq("finishTypeId", ft._id))
          .collect();
        
        await ctx.db.patch(ft._id, {
          productCount: productsWithFinish.length,
        });
      }
    }
    
    return {
      success: true,
      updated: args.productIds.length,
      message: `Successfully updated ${args.productIds.length} products`,
    };
  },
});

// Update single product classification
export const updateSingleProductClassification = mutation({
  args: {
    productId: v.id("products"),
    productCategory: v.optional(v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory")
    )),
    gadgetCategory: v.optional(v.string()), // Accept any string for dynamic gadget types
    gadgetTypeId: v.optional(v.id("gadgetTypes")), // Support new gadgetTypeId field
    finishTypeId: v.optional(v.union(v.id("finishTypes"), v.null())),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }
    
    const updates: Partial<{
      productCategory: typeof args.productCategory;
      gadgetCategory: string;
      gadgetTypeId: Id<"gadgetTypes">;
      finishTypeId: Id<"finishTypes"> | undefined;
    }> = {};
    
    // Update productCategory
    if (args.productCategory !== undefined) {
      updates.productCategory = args.productCategory;
    }
    
    // Update gadgetCategory (legacy field)
    if (args.gadgetCategory !== undefined) {
      updates.gadgetCategory = args.gadgetCategory;
    }
    
    // Update gadgetTypeId (new field) - look up from gadgetCategory if provided
    if (args.gadgetTypeId !== undefined) {
      updates.gadgetTypeId = args.gadgetTypeId;
    } else if (args.gadgetCategory !== undefined) {
      // Auto-populate gadgetTypeId from gadgetCategory name
      const gadgetType = await ctx.db
        .query("gadgetTypes")
        .withIndex("by_name", (q) => q.eq("name", args.gadgetCategory!))
        .first();
      
      if (gadgetType) {
        updates.gadgetTypeId = gadgetType._id;
      }
    }
    
    if (args.finishTypeId !== undefined) {
      if (args.finishTypeId === null) {
        updates.finishTypeId = undefined;
      } else {
        updates.finishTypeId = args.finishTypeId;
      }
    }
    
    if (Object.keys(updates).length === 0) {
      throw new ConvexError({
        message: "No updates specified",
        code: "BAD_REQUEST",
      });
    }
    
    // Update the product
    await ctx.db.patch(args.productId, updates);
    
    // Recalculate product counts for affected gadget types
    const gadgetTypesToUpdate = new Set<Id<"gadgetTypes">>();
    
    if (product.gadgetTypeId) {
      gadgetTypesToUpdate.add(product.gadgetTypeId);
    }
    
    if (updates.gadgetTypeId) {
      gadgetTypesToUpdate.add(updates.gadgetTypeId);
    }
    
    const allProducts = await ctx.db.query("products").collect();
    
    for (const gadgetTypeId of gadgetTypesToUpdate) {
      const count = allProducts.filter(p => p.gadgetTypeId === gadgetTypeId).length;
      await ctx.db.patch(gadgetTypeId, { productCount: count });
    }
    
    // Recalculate product counts for affected finish types
    const finishTypesToUpdate = new Set<Id<"finishTypes">>();
    
    if (product.finishTypeId) {
      finishTypesToUpdate.add(product.finishTypeId);
    }
    
    if (args.finishTypeId && args.finishTypeId !== null) {
      finishTypesToUpdate.add(args.finishTypeId);
    }
    
    for (const finishTypeId of finishTypesToUpdate) {
      const productsWithFinish = allProducts.filter(p => p.finishTypeId === finishTypeId);
      
      await ctx.db.patch(finishTypeId, {
        productCount: productsWithFinish.length,
      });
    }
    
    return {
      success: true,
      message: "Product classification updated successfully",
    };
  },
});

// Get classification statistics
export const getClassificationStats = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    
    const total = products.length;
    const classified = products.filter(p => p.gadgetCategory && p.finishTypeId).length;
    const unclassified = total - classified;
    const partiallyClassified = products.filter(p => 
      (p.gadgetCategory && !p.finishTypeId) || (!p.gadgetCategory && p.finishTypeId)
    ).length;
    
    // Count by gadget category
    const byGadget: Record<string, number> = {};
    products.forEach(p => {
      if (p.gadgetCategory) {
        byGadget[p.gadgetCategory] = (byGadget[p.gadgetCategory] || 0) + 1;
      }
    });
    
    // Count by finish type
    const byFinish: Record<string, number> = {};
    const finishTypes = await ctx.db.query("finishTypes").collect();
    const totalFinishTypes = finishTypes.length;
    
    for (const ft of finishTypes) {
      const count = products.filter(p => p.finishTypeId === ft._id).length;
      if (count > 0) {
        byFinish[ft.displayName] = count;
      }
    }
    
    return {
      total,
      classified,
      unclassified,
      partiallyClassified,
      byGadget,
      byFinish,
      totalFinishTypes,
    };
  },
});
