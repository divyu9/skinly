import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
