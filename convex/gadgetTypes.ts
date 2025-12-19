import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// List all gadget types (including inactive)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("gadgetTypes").order("asc").collect();
  },
});

// List only active gadget types
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("gadgetTypes")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
  },
});

// List all active gadget types (regardless of product count)
export const listAllActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("gadgetTypes")
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
  },
});

// Get a single gadget type by ID
export const get = query({
  args: { id: v.id("gadgetTypes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new gadget type
export const create = mutation({
  args: {
    name: v.string(), // Internal name (e.g., "phone")
    displayName: v.string(), // Display name (e.g., "Phone")
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gadgetTypes", {
      name: args.name,
      displayName: args.displayName,
      isActive: args.isActive,
      productCount: 0,
    });
  },
});

// Update an existing gadget type
export const update = mutation({
  args: {
    id: v.id("gadgetTypes"),
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const updateData: Record<string, string | boolean> = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    await ctx.db.patch(id, updateData);
    return id;
  },
});

// Delete a gadget type
export const remove = mutation({
  args: { id: v.id("gadgetTypes") },
  handler: async (ctx, args) => {
    // Check if any products are using this gadget type
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("gadgetTypeId"), args.id))
      .first();
    
    if (products) {
      throw new Error("Cannot delete gadget type that is in use by products");
    }
    
    await ctx.db.delete(args.id);
  },
});

// Recalculate product counts for all gadget types
export const recalculateProductCounts = mutation({
  args: {},
  handler: async (ctx) => {
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    
    // Fetch all products once (more efficient)
    const allProducts = await ctx.db.query("products").collect();
    
    // Count for each gadget type
    for (const gadgetType of gadgetTypes) {
      const count = allProducts.filter(p => 
        p.gadgetTypeId === gadgetType._id || p.gadgetCategory === gadgetType.name
      ).length;
      
      await ctx.db.patch(gadgetType._id, { productCount: count });
    }
    
    return { 
      success: true,
      message: `Updated counts for ${gadgetTypes.length} gadget types`,
      gadgetTypes: gadgetTypes.length,
    };
  },
});

// Migrate products from gadgetCategory (string) to gadgetTypeId (ID reference)
export const migrateProductGadgetTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all gadget types and create a case-insensitive map from name to ID
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    const nameToIdMap = new Map(gadgetTypes.map(gt => [gt.name.toLowerCase(), gt._id]));
    
    // Get all products
    const products = await ctx.db.query("products").collect();
    
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const failedCategories = new Set<string>();
    
    for (const product of products) {
      // Skip if already has gadgetTypeId
      if (product.gadgetTypeId) {
        skipped++;
        continue;
      }
      
      // Skip if no gadgetCategory
      if (!product.gadgetCategory) {
        skipped++;
        continue;
      }
      
      // Find matching gadget type ID (case-insensitive)
      const gadgetTypeId = nameToIdMap.get(product.gadgetCategory.toLowerCase());
      
      if (gadgetTypeId) {
        await ctx.db.patch(product._id, { gadgetTypeId });
        migrated++;
      } else {
        failed++;
        failedCategories.add(product.gadgetCategory);
      }
    }
    
    // Auto-sync product counts after migration
    const allProductsAfter = await ctx.db.query("products").collect();
    for (const gadgetType of gadgetTypes) {
      const count = allProductsAfter.filter(p => 
        p.gadgetTypeId === gadgetType._id || p.gadgetCategory === gadgetType.name
      ).length;
      await ctx.db.patch(gadgetType._id, { productCount: count });
    }
    
    const failedList = Array.from(failedCategories).join(", ");
    
    // Provide helpful message based on results
    let message = "";
    if (migrated === 0 && skipped > 0 && failed === 0) {
      message = `✓ All ${skipped} products already migrated! Product counts have been synced.`;
    } else if (migrated > 0) {
      message = `✓ Migrated ${migrated} products, skipped ${skipped}, failed ${failed}${failed > 0 ? ` (categories not found: ${failedList})` : ''}. Product counts synced.`;
    } else {
      message = `Migrated ${migrated} products, skipped ${skipped}, failed ${failed}${failed > 0 ? ` (categories not found: ${failedList})` : ''}`;
    }
    
    return { 
      success: true,
      migrated, 
      skipped,
      failed,
      message,
      autoSynced: true
    };
  },
});

// Seed initial gadget types
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("gadgetTypes").first();
    if (existing) {
      return { message: "Gadget types already seeded" };
    }
    
    const gadgetTypes = [
      { name: "phone", displayName: "Phone", isActive: true, productCount: 0 },
      { name: "laptop", displayName: "Laptop", isActive: true, productCount: 0 },
      { name: "tablet", displayName: "Tablet", isActive: true, productCount: 0 },
      { name: "camera", displayName: "Camera", isActive: true, productCount: 0 },
      { name: "lens", displayName: "Lens", isActive: true, productCount: 0 },
      { name: "drone", displayName: "Drone", isActive: true, productCount: 0 },
      { name: "charger", displayName: "Charger", isActive: true, productCount: 0 },
      { name: "console", displayName: "Console", isActive: true, productCount: 0 },
      { name: "mac-mini", displayName: "Mac Mini", isActive: true, productCount: 0 },
      { name: "cover", displayName: "Cover", isActive: true, productCount: 0 },
      { name: "accessory", displayName: "Accessory", isActive: true, productCount: 0 },
    ];
    
    for (const gadgetType of gadgetTypes) {
      await ctx.db.insert("gadgetTypes", gadgetType);
    }
    
    return { message: `Seeded ${gadgetTypes.length} gadget types` };
  },
});
