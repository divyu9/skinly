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

    return {
      freeShippingThreshold: (freeThreshold?.value as number) ?? 500,
      flatShippingFee: (flatFee?.value as number) ?? 50,
    };
  },
});

// Update shipping settings
export const updateShippingSettings = mutation({
  args: {
    freeShippingThreshold: v.number(),
    flatShippingFee: v.number(),
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
