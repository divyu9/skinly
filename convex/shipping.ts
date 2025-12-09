import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get shipping settings
export const getShippingSettings = query({
  args: {},
  handler: async (ctx) => {
    const freeThreshold = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_free_threshold"))
      .first();
    
    const flatFee = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_flat_fee"))
      .first();
    
    const includesTax = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_includes_tax"))
      .first();

    return {
      freeShippingThreshold: (freeThreshold?.value as number) ?? 500,
      flatShippingFee: (flatFee?.value as number) ?? 50,
      shippingIncludesTax: (includesTax?.value as boolean) ?? false,
    };
  },
});

// Update shipping settings
export const updateShippingSettings = mutation({
  args: {
    freeShippingThreshold: v.number(),
    flatShippingFee: v.number(),
    shippingIncludesTax: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Update or create free shipping threshold
    const existingThreshold = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_free_threshold"))
      .first();

    if (existingThreshold) {
      await ctx.db.patch(existingThreshold._id, { value: args.freeShippingThreshold });
    } else {
      await ctx.db.insert("settings", {
        key: "shipping_free_threshold",
        value: args.freeShippingThreshold,
      });
    }

    // Update or create flat shipping fee
    const existingFee = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_flat_fee"))
      .first();

    if (existingFee) {
      await ctx.db.patch(existingFee._id, { value: args.flatShippingFee });
    } else {
      await ctx.db.insert("settings", {
        key: "shipping_flat_fee",
        value: args.flatShippingFee,
      });
    }

    // Update or create shipping includes tax
    const existingIncludesTax = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_includes_tax"))
      .first();

    if (existingIncludesTax) {
      await ctx.db.patch(existingIncludesTax._id, { value: args.shippingIncludesTax });
    } else {
      await ctx.db.insert("settings", {
        key: "shipping_includes_tax",
        value: args.shippingIncludesTax,
      });
    }
  },
});

// Calculate shipping fee based on settings
export const calculateShippingFee = query({
  args: { subtotal: v.number() },
  handler: async (ctx, args) => {
    const freeThreshold = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_free_threshold"))
      .first();
    
    const flatFee = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_flat_fee"))
      .first();

    const freeShippingThreshold = (freeThreshold?.value as number) ?? 500;
    const flatShippingFee = (flatFee?.value as number) ?? 50;
    
    return args.subtotal >= freeShippingThreshold ? 0 : flatShippingFee;
  },
});
