import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

type GadgetCategory = "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory";
type FinishType = "matte" | "embossed" | "transparent";

// Helper function to determine gadget category from title
function determineGadgetCategory(title: string): GadgetCategory | null {
  const titleLower = title.toLowerCase();
  
  // PRIORITY 1: Check for SKIN products first
  if (titleLower.includes("skin")) {
    // Check specific device types (most specific to least specific)
    
    // Mac Mini skins
    if (titleLower.includes("mac mini")) {
      return "mac-mini";
    }
    
    // Laptop skins
    if (titleLower.includes("laptop") || titleLower.includes("macbook")) {
      return "laptop";
    }
    
    // iPad/Tablet skins
    if (titleLower.includes("ipad") || titleLower.includes("tablet") || 
        titleLower.includes("for ipad") || titleLower.includes("for tablet")) {
      return "tablet";
    }
    
    // Drone skins
    if (titleLower.includes("drone")) {
      return "drone";
    }
    
    // Camera skins
    if (titleLower.includes("camera skin")) {
      return "camera";
    }
    
    // Lens skins
    if (titleLower.includes("lens skin")) {
      return "lens";
    }
    
    // Charger skins
    if (titleLower.includes("charger") || titleLower.includes("for charger")) {
      return "charger";
    }
    
    // Controller skins
    if (titleLower.includes("controller")) {
      return "console";
    }
    
    // Console skins (PS5, Xbox, PlayStation, Nintendo, Switch)
    if (titleLower.includes("ps5") || titleLower.includes("ps4") || 
        titleLower.includes("playstation") || titleLower.includes("play station") ||
        titleLower.includes("xbox") || titleLower.includes("nintendo") || 
        titleLower.includes("switch")) {
      return "console";
    }
    
    // All other skins are phone skins (iPhone, Samsung, OnePlus, generic phone skins, etc.)
    return "phone";
  }
  
  // PRIORITY 2: Check for NON-SKIN products
  
  // Covers and Cases
  if (titleLower.includes("cover") || 
      titleLower.includes("case") || 
      titleLower.includes("magsafe cover") || 
      titleLower.includes("autoapply guard")) {
    return "cover";
  }
  
  // Accessories (without "skin" keyword)
  if (titleLower.includes("ring") || 
      titleLower.includes("stand") || 
      titleLower.includes("holder") || 
      titleLower.includes("charger") ||
      titleLower.includes("wireless charger") ||
      titleLower.includes("airpod") ||
      titleLower.includes("earbud")) {
    return "accessory";
  }
  
  return null;
}

// Helper function to determine finish type from title
function determineFinishType(title: string): FinishType | null {
  const titleLower = title.toLowerCase();
  
  // Check for embossed first (more specific)
  if (titleLower.includes("3d embossed") || 
      titleLower.includes("3d textured") || 
      titleLower.includes("textured")) {
    return "embossed";
  }
  
  // Check for transparent
  if (titleLower.includes("tranzy") || titleLower.includes("transparent")) {
    return "transparent";
  }
  
  // Check for matte
  if (titleLower.includes("matte")) {
    return "matte";
  }
  
  return null;
}

export const migrateProductFields = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    let categoriesAssigned = 0;
    let finishesAssigned = 0;
    let alreadyHadCategory = 0;
    let alreadyHadFinish = 0;
    const unmatchedProducts: string[] = [];
    
    for (const product of products) {
      const updates: {
        gadgetCategory?: GadgetCategory;
        finishType?: FinishType;
      } = {};
      
      // Only assign category if not already set
      if (!product.gadgetCategory) {
        const category = determineGadgetCategory(product.title);
        if (category) {
          updates.gadgetCategory = category;
          categoriesAssigned++;
        } else {
          unmatchedProducts.push(product.title);
        }
      } else {
        alreadyHadCategory++;
      }
      
      // Only assign finish if not already set
      if (!product.finishType) {
        const finish = determineFinishType(product.title);
        if (finish) {
          updates.finishType = finish;
          finishesAssigned++;
        }
      } else {
        alreadyHadFinish++;
      }
      
      // Update if we have any changes
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(product._id, updates);
      }
    }
    
    return {
      totalProducts: products.length,
      categoriesAssigned,
      finishesAssigned,
      alreadyHadCategory,
      alreadyHadFinish,
      unmatchedProducts: unmatchedProducts.slice(0, 20), // Limit to first 20
      unmatchedCount: unmatchedProducts.length,
    };
  },
});

// Force recategorization of ALL products (fixes wrong categories)
export const forceRecategorizeAllProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    // Track before/after counts by category
    const beforeCounts: Record<string, number> = {};
    const afterCounts: Record<string, number> = {};
    
    let categoriesChanged = 0;
    let categoriesUnchanged = 0;
    let finishesAssigned = 0;
    const unmatchedProducts: string[] = [];
    const changedProducts: Array<{title: string; before: string; after: string}> = [];
    
    for (const product of products) {
      const oldCategory = product.gadgetCategory || "none";
      beforeCounts[oldCategory] = (beforeCounts[oldCategory] || 0) + 1;
      
      const updates: {
        gadgetCategory?: GadgetCategory;
        finishType?: FinishType;
      } = {};
      
      // Always determine category (even if already set)
      const newCategory = determineGadgetCategory(product.title);
      if (newCategory) {
        afterCounts[newCategory] = (afterCounts[newCategory] || 0) + 1;
        
        if (newCategory !== oldCategory) {
          updates.gadgetCategory = newCategory;
          categoriesChanged++;
          changedProducts.push({
            title: product.title,
            before: oldCategory,
            after: newCategory
          });
        } else {
          categoriesUnchanged++;
        }
      } else {
        unmatchedProducts.push(product.title);
        afterCounts["unmatched"] = (afterCounts["unmatched"] || 0) + 1;
      }
      
      // Assign finish if not already set
      if (!product.finishType) {
        const finish = determineFinishType(product.title);
        if (finish) {
          updates.finishType = finish;
          finishesAssigned++;
        }
      }
      
      // Update if we have any changes
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(product._id, updates);
      }
    }
    
    return {
      totalProducts: products.length,
      categoriesChanged,
      categoriesUnchanged,
      finishesAssigned,
      beforeCounts,
      afterCounts,
      unmatchedProducts: unmatchedProducts.slice(0, 20),
      unmatchedCount: unmatchedProducts.length,
      changedSamples: changedProducts.slice(0, 10)
    };
  },
});
