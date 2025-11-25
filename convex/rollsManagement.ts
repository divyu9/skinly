import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Gadget Consumption Queries and Mutations

export const getGadgetConsumption = query({
  args: {},
  handler: async (ctx) => {
    const gadgets = await ctx.db.query("gadgetConsumption").collect();
    return gadgets;
  },
});

export const addGadgetConsumption = mutation({
  args: {
    categoryName: v.string(),
    lengthCm: v.number(),
    widthCm: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("gadgetConsumption", {
      categoryName: args.categoryName,
      lengthCm: args.lengthCm,
      widthCm: args.widthCm,
      notes: args.notes,
    });
    return id;
  },
});

export const updateGadgetConsumption = mutation({
  args: {
    id: v.id("gadgetConsumption"),
    categoryName: v.string(),
    lengthCm: v.number(),
    widthCm: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      categoryName: args.categoryName,
      lengthCm: args.lengthCm,
      widthCm: args.widthCm,
      notes: args.notes,
    });
  },
});

export const deleteGadgetConsumption = mutation({
  args: { id: v.id("gadgetConsumption") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Roll Inventory Queries and Mutations

export const getRollInventory = query({
  args: {},
  handler: async (ctx) => {
    const rolls = await ctx.db.query("rollInventory").collect();
    return rolls;
  },
});

export const addRollInventory = mutation({
  args: {
    rNumber: v.string(),
    designName: v.string(),
    isContinuous: v.boolean(),
    metersAvailable: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("rollInventory", {
      rNumber: args.rNumber,
      designName: args.designName,
      isContinuous: args.isContinuous,
      metersAvailable: args.metersAvailable,
      notes: args.notes,
    });
    return id;
  },
});

export const updateRollInventory = mutation({
  args: {
    id: v.id("rollInventory"),
    rNumber: v.string(),
    designName: v.string(),
    isContinuous: v.boolean(),
    metersAvailable: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      rNumber: args.rNumber,
      designName: args.designName,
      isContinuous: args.isContinuous,
      metersAvailable: args.metersAvailable,
      notes: args.notes,
    });
  },
});

export const deleteRollInventory = mutation({
  args: { id: v.id("rollInventory") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Helper function to calculate optimal units from a vinyl sheet
// Vinyl sheet: 29.5cm (fixed width) × meters (variable length)
// For continuous designs: Can rotate pieces for optimal nesting
// For non-continuous: Must maintain orientation

export const calculateUnitsFromRoll = query({
  args: {
    gadgetLengthCm: v.number(),
    gadgetWidthCm: v.number(),
    metersAvailable: v.number(),
    isContinuous: v.boolean(),
  },
  handler: async (ctx, args) => {
    const ROLL_WIDTH_CM = 29.5;
    const rollLengthCm = args.metersAvailable * 100; // Convert meters to cm
    
    const totalAreaCm2 = ROLL_WIDTH_CM * rollLengthCm;
    const gadgetAreaCm2 = args.gadgetLengthCm * args.gadgetWidthCm;
    
    if (args.isContinuous) {
      // Continuous design: Use area-based calculation for optimal nesting
      const optimalUnits = Math.floor(totalAreaCm2 / gadgetAreaCm2);
      return {
        units: optimalUnits,
        calculationType: "continuous",
        wastePercentage: ((totalAreaCm2 - (optimalUnits * gadgetAreaCm2)) / totalAreaCm2) * 100,
      };
    } else {
      // Non-continuous: Must respect orientation
      // Try both orientations and pick the better one
      
      // Orientation 1: gadget length along roll length
      const units1Width = Math.floor(ROLL_WIDTH_CM / args.gadgetWidthCm);
      const units1Length = Math.floor(rollLengthCm / args.gadgetLengthCm);
      const totalUnits1 = units1Width * units1Length;
      
      // Orientation 2: gadget length along roll width (if it fits)
      let totalUnits2 = 0;
      if (args.gadgetLengthCm <= ROLL_WIDTH_CM) {
        const units2Width = Math.floor(ROLL_WIDTH_CM / args.gadgetLengthCm);
        const units2Length = Math.floor(rollLengthCm / args.gadgetWidthCm);
        totalUnits2 = units2Width * units2Length;
      }
      
      const bestUnits = Math.max(totalUnits1, totalUnits2);
      const usedArea = bestUnits * gadgetAreaCm2;
      
      return {
        units: bestUnits,
        calculationType: "non-continuous",
        wastePercentage: ((totalAreaCm2 - usedArea) / totalAreaCm2) * 100,
      };
    }
  },
});

// SKU Mapping Functions

/**
 * Extract R-number from SKU
 * Only extracts R-numbers from SKUs that explicitly start with "R-"
 * Examples: "R-59-MM" → "R-59", "R-174" → "R-174", "M-12" → null
 */
function extractRNumber(sku: string): string | null {
  if (!sku) return null;
  
  const normalizedSku = sku.toUpperCase().trim();
  
  // Only match SKUs that start with R-
  const rPattern = /^R-(\d+)/i;
  const rMatch = normalizedSku.match(rPattern);
  if (rMatch) {
    return `R-${rMatch[1]}`;
  }
  
  // No match - M-, L-, T- and other prefixes are NOT related to R-numbers
  return null;
}

export const getProductsByRNumber = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const variants = await ctx.db.query("variants").collect();
    
    // Group variants by R-number
    const rNumberGroups: Record<string, Array<{
      variantId: string;
      productId: string;
      productTitle: string;
      sku: string;
      variantTitle: string;
      isManual: boolean;
    }>> = {};
    
    const unmapped: Array<{
      variantId: string;
      productId: string;
      productTitle: string;
      sku: string;
      variantTitle: string;
    }> = [];
    
    for (const variant of variants) {
      const product = products.find((p) => p._id === variant.productId);
      if (!product) continue;
      
      // Use manual R-number if set, otherwise auto-detect
      const rNumber = variant.rNumber || extractRNumber(variant.sku);
      
      const item = {
        variantId: variant._id,
        productId: product._id,
        productTitle: product.title,
        sku: variant.sku,
        variantTitle: variant.title,
        isManual: !!variant.rNumber,
      };
      
      if (rNumber) {
        if (!rNumberGroups[rNumber]) {
          rNumberGroups[rNumber] = [];
        }
        rNumberGroups[rNumber].push(item);
      } else {
        unmapped.push(item);
      }
    }
    
    return {
      groups: rNumberGroups,
      unmapped,
    };
  },
});

export const assignRNumber = mutation({
  args: {
    variantId: v.id("variants"),
    rNumber: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.variantId, {
      rNumber: args.rNumber,
    });
  },
});

export const removeRNumberAssignment = mutation({
  args: {
    variantId: v.id("variants"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.variantId, {
      rNumber: undefined,
    });
  },
});

// Real-time Stock Calculation

/**
 * Calculate available stock for all variants based on roll inventory
 * Returns: { variantId: availableUnits }
 */
export const getStockLevels = query({
  args: {},
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").collect();
    const products = await ctx.db.query("products").collect();
    const rolls = await ctx.db.query("rollInventory").collect();
    const gadgets = await ctx.db.query("gadgetConsumption").collect();
    
    // Build maps for quick lookup
    const productsMap = new Map<string, typeof products[0]>();
    for (const product of products) {
      productsMap.set(product._id, product);
    }
    
    const rollsMap = new Map<string, typeof rolls[0]>();
    for (const roll of rolls) {
      rollsMap.set(roll.rNumber, roll);
    }
    
    // Build gadget dimensions map by category name
    const gadgetsMap = new Map<string, typeof gadgets[0]>();
    for (const gadget of gadgets) {
      gadgetsMap.set(gadget.categoryName.toLowerCase(), gadget);
    }
    
    // Calculate stock for each variant
    const stockLevels: Record<string, {
      availableUnits: number;
      rollMeters: number;
      rNumber: string | null;
      designName: string | null;
    }> = {};
    
    for (const variant of variants) {
      const product = productsMap.get(variant.productId);
      if (!product) continue;
      
      // Get R-number (manual or auto-detected)
      const rNumber = variant.rNumber || extractRNumber(variant.sku);
      
      if (!rNumber) {
        // No R-number means infinite stock (accessories, etc.)
        stockLevels[variant._id] = {
          availableUnits: 999999,
          rollMeters: 0,
          rNumber: null,
          designName: null,
        };
        continue;
      }
      
      // Get roll inventory for this R-number
      const roll = rollsMap.get(rNumber);
      
      if (!roll || roll.metersAvailable <= 0) {
        // No roll or out of stock
        stockLevels[variant._id] = {
          availableUnits: 0,
          rollMeters: 0,
          rNumber,
          designName: roll?.designName || null,
        };
        continue;
      }
      
      // Detect gadget category from product title
      let gadgetCategory: string | null = null;
      const titleLower = product.title.toLowerCase();
      
      if (titleLower.includes("phone skin") || titleLower.includes("mobile skin")) {
        gadgetCategory = "phone skin";
      } else if (titleLower.includes("laptop")) {
        gadgetCategory = "laptop skin";
      } else if (titleLower.includes("tablet") || titleLower.includes("ipad")) {
        gadgetCategory = "tablet skin";
      } else if (titleLower.includes("camera")) {
        gadgetCategory = "camera skin";
      } else if (titleLower.includes("mac mini")) {
        gadgetCategory = "mac mini skin";
      } else if (titleLower.includes("console") || titleLower.includes("playstation") || titleLower.includes("ps5") || titleLower.includes("xbox")) {
        gadgetCategory = "console skin";
      } else if (titleLower.includes("lens")) {
        gadgetCategory = "camera lens skin";
      } else if (titleLower.includes("drone")) {
        gadgetCategory = "drone skin";
      } else if (titleLower.includes("charger")) {
        gadgetCategory = "charger skin";
      }
      
      if (!gadgetCategory) {
        // Unknown category, assume infinite stock
        stockLevels[variant._id] = {
          availableUnits: 999999,
          rollMeters: roll.metersAvailable,
          rNumber,
          designName: roll.designName,
        };
        continue;
      }
      
      // Get gadget dimensions
      const gadget = gadgetsMap.get(gadgetCategory);
      
      if (!gadget) {
        // No dimensions defined, assume infinite stock
        stockLevels[variant._id] = {
          availableUnits: 999999,
          rollMeters: roll.metersAvailable,
          rNumber,
          designName: roll.designName,
        };
        continue;
      }
      
      // Calculate units from roll
      const ROLL_WIDTH_CM = 29.5;
      const rollLengthCm = roll.metersAvailable * 100;
      const totalAreaCm2 = ROLL_WIDTH_CM * rollLengthCm;
      const gadgetAreaCm2 = gadget.lengthCm * gadget.widthCm;
      
      let availableUnits = 0;
      
      if (roll.isContinuous) {
        // Continuous design: area-based calculation
        availableUnits = Math.floor(totalAreaCm2 / gadgetAreaCm2);
      } else {
        // Non-continuous: orientation-based calculation
        const units1Width = Math.floor(ROLL_WIDTH_CM / gadget.widthCm);
        const units1Length = Math.floor(rollLengthCm / gadget.lengthCm);
        const totalUnits1 = units1Width * units1Length;
        
        let totalUnits2 = 0;
        if (gadget.lengthCm <= ROLL_WIDTH_CM) {
          const units2Width = Math.floor(ROLL_WIDTH_CM / gadget.lengthCm);
          const units2Length = Math.floor(rollLengthCm / gadget.widthCm);
          totalUnits2 = units2Width * units2Length;
        }
        
        availableUnits = Math.max(totalUnits1, totalUnits2);
      }
      
      stockLevels[variant._id] = {
        availableUnits,
        rollMeters: roll.metersAvailable,
        rNumber,
        designName: roll.designName,
      };
    }
    
    return stockLevels;
  },
});

/**
 * Deduct roll inventory when order is confirmed
 */
export const deductRollInventory = internalMutation({
  args: {
    items: v.array(v.object({
      variantId: v.id("variants"),
      quantity: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const variants = await ctx.db.query("variants").collect();
    const products = await ctx.db.query("products").collect();
    const rolls = await ctx.db.query("rollInventory").collect();
    const gadgets = await ctx.db.query("gadgetConsumption").collect();
    
    // Build maps
    const variantsMap = new Map<string, typeof variants[0]>();
    for (const variant of variants) {
      variantsMap.set(variant._id, variant);
    }
    
    const productsMap = new Map<string, typeof products[0]>();
    for (const product of products) {
      productsMap.set(product._id, product);
    }
    
    const rollsMap = new Map<string, typeof rolls[0]>();
    for (const roll of rolls) {
      rollsMap.set(roll.rNumber, roll);
    }
    
    const gadgetsMap = new Map<string, typeof gadgets[0]>();
    for (const gadget of gadgets) {
      gadgetsMap.set(gadget.categoryName.toLowerCase(), gadget);
    }
    
    // Calculate total meters needed per R-number
    const metersNeeded = new Map<string, { rollId: Id<"rollInventory">; meters: number }>();
    
    for (const item of args.items) {
      const variant = variantsMap.get(item.variantId);
      if (!variant) continue;
      
      const product = productsMap.get(variant.productId);
      if (!product) continue;
      
      // Get R-number
      const rNumber = variant.rNumber || extractRNumber(variant.sku);
      if (!rNumber) continue; // Skip non-material products
      
      const roll = rollsMap.get(rNumber);
      if (!roll) continue; // Skip if no roll exists
      
      // Detect category
      let gadgetCategory: string | null = null;
      const titleLower = product.title.toLowerCase();
      
      if (titleLower.includes("phone skin") || titleLower.includes("mobile skin")) {
        gadgetCategory = "phone skin";
      } else if (titleLower.includes("laptop")) {
        gadgetCategory = "laptop skin";
      } else if (titleLower.includes("tablet") || titleLower.includes("ipad")) {
        gadgetCategory = "tablet skin";
      } else if (titleLower.includes("camera")) {
        gadgetCategory = "camera skin";
      } else if (titleLower.includes("mac mini")) {
        gadgetCategory = "mac mini skin";
      } else if (titleLower.includes("console") || titleLower.includes("playstation") || titleLower.includes("ps5") || titleLower.includes("xbox")) {
        gadgetCategory = "console skin";
      } else if (titleLower.includes("lens")) {
        gadgetCategory = "camera lens skin";
      } else if (titleLower.includes("drone")) {
        gadgetCategory = "drone skin";
      } else if (titleLower.includes("charger")) {
        gadgetCategory = "charger skin";
      }
      
      if (!gadgetCategory) continue;
      
      const gadget = gadgetsMap.get(gadgetCategory);
      if (!gadget) continue;
      
      // Calculate meters needed for this quantity
      const ROLL_WIDTH_CM = 29.5;
      const gadgetAreaCm2 = gadget.lengthCm * gadget.widthCm;
      const totalAreaNeeded = gadgetAreaCm2 * item.quantity;
      
      // Convert area to meters (roll width is constant 29.5cm)
      const metersForThisItem = totalAreaNeeded / (ROLL_WIDTH_CM * 100);
      
      // Add to total for this R-number
      const existing = metersNeeded.get(rNumber);
      if (existing) {
        existing.meters += metersForThisItem;
      } else {
        metersNeeded.set(rNumber, {
          rollId: roll._id,
          meters: metersForThisItem,
        });
      }
    }
    
    // Deduct meters from rolls
    const deductions: Array<{ rNumber: string; meters: number }> = [];
    
    for (const [rNumber, data] of metersNeeded) {
      const roll = await ctx.db.get(data.rollId);
      if (!roll || !("metersAvailable" in roll)) continue; // Type guard for rollInventory
      
      const newMeters = Math.max(0, roll.metersAvailable - data.meters);
      await ctx.db.patch(data.rollId, {
        metersAvailable: newMeters,
      });
      
      deductions.push({
        rNumber,
        meters: data.meters,
      });
    }
    
    return { deductions };
  },
});

/**
 * Get low stock alerts
 * Returns R-numbers with less than 10 units available
 */
export const getLowStockAlerts = query({
  args: {},
  handler: async (ctx) => {
    const rolls = await ctx.db.query("rollInventory").collect();
    const gadgets = await ctx.db.query("gadgetConsumption").collect();
    
    const alerts: Array<{
      rNumber: string;
      designName: string;
      metersAvailable: number;
      estimatedUnits: number;
      categories: string[];
    }> = [];
    
    for (const roll of rolls) {
      if (roll.metersAvailable <= 0) continue;
      
      // Calculate estimated units for phone skins (most common)
      const phoneGadget = gadgets.find(g => g.categoryName.toLowerCase() === "phone skin");
      
      if (!phoneGadget) continue;
      
      const ROLL_WIDTH_CM = 29.5;
      const rollLengthCm = roll.metersAvailable * 100;
      const totalAreaCm2 = ROLL_WIDTH_CM * rollLengthCm;
      const gadgetAreaCm2 = phoneGadget.lengthCm * phoneGadget.widthCm;
      
      let estimatedUnits = 0;
      if (roll.isContinuous) {
        estimatedUnits = Math.floor(totalAreaCm2 / gadgetAreaCm2);
      } else {
        const units1Width = Math.floor(ROLL_WIDTH_CM / phoneGadget.widthCm);
        const units1Length = Math.floor(rollLengthCm / phoneGadget.lengthCm);
        estimatedUnits = units1Width * units1Length;
      }
      
      // Alert if less than 10 units or less than 1 meter
      if (estimatedUnits < 10 || roll.metersAvailable < 1) {
        alerts.push({
          rNumber: roll.rNumber,
          designName: roll.designName,
          metersAvailable: roll.metersAvailable,
          estimatedUnits,
          categories: ["Phone Skin"], // Could expand to calculate for all categories
        });
      }
    }
    
    return alerts.sort((a, b) => a.estimatedUnits - b.estimatedUnits);
  },
});
