import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

/**
 * Get all variant consumption presets grouped by gadget type
 */
export const listAll = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    gadgetType: Doc<"gadgetTypes">;
    presets: Array<Doc<"variantConsumptionPresets">>;
  }>> => {
    // Get all gadget types
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    
    // Get presets for each gadget type
    const result = [];
    for (const gadgetType of gadgetTypes) {
      const presets = await ctx.db
        .query("variantConsumptionPresets")
        .withIndex("by_gadget_type", (q) => q.eq("gadgetTypeId", gadgetType._id))
        .collect();
      
      result.push({
        gadgetType,
        presets,
      });
    }
    
    return result;
  },
});

/**
 * Get presets for a specific gadget type (active only)
 */
export const listByGadgetType = query({
  args: { gadgetTypeId: v.id("gadgetTypes") },
  handler: async (ctx, args): Promise<Array<Doc<"variantConsumptionPresets">>> => {
    return await ctx.db
      .query("variantConsumptionPresets")
      .withIndex("by_gadget_type_and_active", (q) => 
        q.eq("gadgetTypeId", args.gadgetTypeId).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Get a single preset by ID
 */
export const getById = query({
  args: { presetId: v.id("variantConsumptionPresets") },
  handler: async (ctx, args): Promise<Doc<"variantConsumptionPresets"> | null> => {
    return await ctx.db.get(args.presetId);
  },
});

/**
 * Create a new variant consumption preset
 */
export const create = mutation({
  args: {
    gadgetTypeId: v.id("gadgetTypes"),
    name: v.string(),
    multiplier: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"variantConsumptionPresets">> => {
    const identity = await ctx.auth.getUserIdentity();
    
    return await ctx.db.insert("variantConsumptionPresets", {
      gadgetTypeId: args.gadgetTypeId,
      name: args.name,
      multiplier: args.multiplier,
      description: args.description,
      isActive: true,
      createdAt: Date.now(),
      createdBy: identity?.email,
    });
  },
});

/**
 * Update an existing preset
 */
export const update = mutation({
  args: {
    presetId: v.id("variantConsumptionPresets"),
    name: v.optional(v.string()),
    multiplier: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { presetId, ...updates } = args;
    
    // Remove undefined fields
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    await ctx.db.patch(presetId, cleanUpdates);
  },
});

/**
 * Delete a preset
 */
export const remove = mutation({
  args: { presetId: v.id("variantConsumptionPresets") },
  handler: async (ctx, args): Promise<void> => {
    // Check if any variants are using this preset
    const variantsUsingPreset = await ctx.db
      .query("variants")
      .withIndex("by_preset", (q) => q.eq("consumptionPresetId", args.presetId))
      .first();
    
    if (variantsUsingPreset) {
      throw new Error("Cannot delete preset: it is currently in use by one or more variants");
    }
    
    await ctx.db.delete(args.presetId);
  },
});

/**
 * Toggle preset active status
 */
export const toggleActive = mutation({
  args: {
    presetId: v.id("variantConsumptionPresets"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.presetId, {
      isActive: args.isActive,
    });
  },
});
