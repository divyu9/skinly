import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Default settings for abandoned cart recovery
 */
const DEFAULT_SETTINGS = {
  delayHours: 1, // Hours to wait before sending reminder
  couponDiscountType: "percentage", // percentage or fixed
  couponDiscountValue: 15, // 15% or ₹15
  couponValidityDays: 7, // Days before coupon expires
  couponPrefix: "COMEBACK", // Prefix for generated coupon codes
};

/**
 * Get abandoned cart settings (with defaults)
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    const settingsMap: Record<string, string | number | boolean> = {};
    
    for (const setting of settings) {
      if (setting.key.startsWith("abandoned_cart_")) {
        settingsMap[setting.key] = setting.value;
      }
    }

    return {
      delayHours: (settingsMap.abandoned_cart_delay_hours as number) ?? DEFAULT_SETTINGS.delayHours,
      couponDiscountType: (settingsMap.abandoned_cart_coupon_discount_type as string) ?? DEFAULT_SETTINGS.couponDiscountType,
      couponDiscountValue: (settingsMap.abandoned_cart_coupon_discount_value as number) ?? DEFAULT_SETTINGS.couponDiscountValue,
      couponValidityDays: (settingsMap.abandoned_cart_coupon_validity_days as number) ?? DEFAULT_SETTINGS.couponValidityDays,
      couponPrefix: (settingsMap.abandoned_cart_coupon_prefix as string) ?? DEFAULT_SETTINGS.couponPrefix,
    };
  },
});

/**
 * Update abandoned cart settings
 */
export const updateSettings = mutation({
  args: {
    delayHours: v.number(),
    couponDiscountType: v.union(v.literal("percentage"), v.literal("fixed")),
    couponDiscountValue: v.number(),
    couponValidityDays: v.number(),
    couponPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (args.delayHours < 0 || args.delayHours > 168) {
      throw new Error("Delay hours must be between 0 and 168 (1 week)");
    }
    if (args.couponDiscountValue <= 0 || args.couponDiscountValue > 100) {
      throw new Error("Discount value must be between 0 and 100");
    }
    if (args.couponValidityDays < 1 || args.couponValidityDays > 365) {
      throw new Error("Validity days must be between 1 and 365");
    }
    if (args.couponPrefix.length < 2 || args.couponPrefix.length > 20) {
      throw new Error("Coupon prefix must be between 2 and 20 characters");
    }

    // Update each setting
    const settingsToUpdate = [
      { key: "abandoned_cart_delay_hours", value: args.delayHours },
      { key: "abandoned_cart_coupon_discount_type", value: args.couponDiscountType },
      { key: "abandoned_cart_coupon_discount_value", value: args.couponDiscountValue },
      { key: "abandoned_cart_coupon_validity_days", value: args.couponValidityDays },
      { key: "abandoned_cart_coupon_prefix", value: args.couponPrefix },
    ];

    for (const setting of settingsToUpdate) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { value: setting.value });
      } else {
        await ctx.db.insert("settings", {
          key: setting.key,
          value: setting.value,
        });
      }
    }

    return { success: true };
  },
});
