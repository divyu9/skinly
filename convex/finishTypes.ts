import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Get all finish types
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("finishTypes").collect();
  },
});

// Get ALL active finish types (regardless of product count)
export const listAllActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("finishTypes")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Get active finish types only (with product count > 0)
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const finishTypes = await ctx.db
      .query("finishTypes")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter to only show finish types with products
    return finishTypes.filter(ft => ft.productCount > 0);
  },
});

// Get a single finish type by ID
export const get = query({
  args: { id: v.id("finishTypes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new finish type
export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if name already exists
    const existing = await ctx.db
      .query("finishTypes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    if (existing) {
      throw new Error("A finish type with this name already exists");
    }

    const finishTypeId = await ctx.db.insert("finishTypes", {
      name: args.name,
      displayName: args.displayName,
      isActive: true,
      productCount: 0,
    });

    return finishTypeId;
  },
});

// Update a finish type
export const update = mutation({
  args: {
    id: v.id("finishTypes"),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // If updating name, check for duplicates
    if (updates.name !== undefined) {
      const existing = await ctx.db
        .query("finishTypes")
        .withIndex("by_name", (q) => q.eq("name", updates.name!))
        .first();
      
      if (existing && existing._id !== id) {
        throw new Error("A finish type with this name already exists");
      }
    }

    await ctx.db.patch(id, updates);
  },
});

// Delete a finish type
export const remove = mutation({
  args: { id: v.id("finishTypes") },
  handler: async (ctx, args) => {
    const finishType = await ctx.db.get(args.id);
    
    if (!finishType) {
      throw new Error("Finish type not found");
    }

    // Check if any products use this finish type
    if (finishType.productCount > 0) {
      throw new Error("Cannot delete finish type that is assigned to products. Please reassign products first.");
    }

    await ctx.db.delete(args.id);
  },
});

// Update product count for a finish type
export const updateProductCount = mutation({
  args: {
    finishTypeId: v.id("finishTypes"),
  },
  handler: async (ctx, args) => {
    // Count products with this finish type
    const products = await ctx.db
      .query("products")
      .withIndex("by_finish_type", (q) => q.eq("finishTypeId", args.finishTypeId))
      .collect();

    await ctx.db.patch(args.finishTypeId, {
      productCount: products.length,
    });
  },
});

// Recalculate all product counts
export const recalculateAllCounts = mutation({
  args: {},
  handler: async (ctx) => {
    const finishTypes = await ctx.db.query("finishTypes").collect();
    
    for (const finishType of finishTypes) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_finish_type", (q) => q.eq("finishTypeId", finishType._id))
        .collect();

      await ctx.db.patch(finishType._id, {
        productCount: products.length,
      });
    }
  },
});

// Seed initial finish types
export const seedInitialFinishTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if any finish types exist
    const existing = await ctx.db.query("finishTypes").first();
    if (existing) {
      return { message: "Finish types already seeded" };
    }

    // Create initial finish types
    const finishTypes = [
      { name: "matte", displayName: "Matte" },
      { name: "embossed", displayName: "3D (Embossed)" },
      { name: "transparent", displayName: "Transparent" },
      { name: "protectors", displayName: "Protectors/Membranes" },
    ];

    for (const ft of finishTypes) {
      await ctx.db.insert("finishTypes", {
        name: ft.name,
        displayName: ft.displayName,
        isActive: true,
        productCount: 0,
      });
    }

    return { message: "Initial finish types created successfully" };
  },
});
