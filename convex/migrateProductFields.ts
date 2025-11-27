import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

type GadgetCategory = "phone" | "laptop" | "tablet" | "camera" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | "accessory";
type FinishType = "matte" | "embossed" | "transparent";

// Helper function to determine gadget category from title
function determineGadgetCategory(title: string): GadgetCategory | null {
  const titleLower = title.toLowerCase();
  
  // Phone: Must contain "skin" or "phone skin" AND NOT contain exclusion keywords
  const hasSkin = titleLower.includes("skin") || titleLower.includes("phone skin");
  const hasExclusions = 
    titleLower.includes("cover") ||
    titleLower.includes("case") ||
    titleLower.includes("ring") ||
    titleLower.includes("charger") ||
    titleLower.includes("stand") ||
    titleLower.includes("holder") ||
    titleLower.includes("magsafe") ||
    titleLower.includes("autoapply");
  
  if (hasSkin && !hasExclusions) {
    // Check if it's laptop skin
    if (titleLower.includes("laptop") || titleLower.includes("macbook")) {
      return "laptop";
    }
    // Otherwise it's a phone skin
    return "phone";
  }
  
  // Cover/Case
  if (titleLower.includes("cover") || 
      titleLower.includes("case") || 
      titleLower.includes("magsafe cover") || 
      titleLower.includes("autoapply guard")) {
    return "cover";
  }
  
  // Accessory
  if (titleLower.includes("ring") || 
      titleLower.includes("stand") || 
      titleLower.includes("holder") || 
      titleLower.includes("charger")) {
    return "accessory";
  }
  
  // Camera
  if (titleLower.includes("camera")) {
    return "camera";
  }
  
  // Lens
  if (titleLower.includes("lens")) {
    return "lens";
  }
  
  // Drone
  if (titleLower.includes("drone")) {
    return "drone";
  }
  
  // Console
  if (titleLower.includes("console") || 
      titleLower.includes("playstation") || 
      titleLower.includes("xbox") || 
      titleLower.includes("nintendo")) {
    return "console";
  }
  
  // Mac Mini
  if (titleLower.includes("mac mini")) {
    return "mac-mini";
  }
  
  // Tablet/iPad
  if (titleLower.includes("ipad") || titleLower.includes("tablet")) {
    return "tablet";
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
