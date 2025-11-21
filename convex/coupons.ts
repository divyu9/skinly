import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get all active coupons
export const getActiveCoupons = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const coupons = await ctx.db
      .query("coupons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter by date range
    const activeCoupons = coupons.filter(
      (coupon) => coupon.startDate <= now && coupon.endDate >= now
    );
    
    return activeCoupons;
  },
});

// Validate and get coupon by code
export const validateCoupon = query({
  args: { code: v.string(), cartTotal: v.number() },
  handler: async (ctx, args) => {
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    
    if (!coupon) {
      throw new ConvexError({
        message: "Invalid coupon code",
        code: "NOT_FOUND",
      });
    }
    
    const now = Date.now();
    
    // Check if coupon is active
    if (!coupon.isActive) {
      throw new ConvexError({
        message: "This coupon is not active",
        code: "BAD_REQUEST",
      });
    }
    
    // Check date range
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new ConvexError({
        message: "This coupon has expired",
        code: "BAD_REQUEST",
      });
    }
    
    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new ConvexError({
        message: "This coupon has reached its usage limit",
        code: "BAD_REQUEST",
      });
    }
    
    // Check minimum purchase
    if (coupon.minPurchase && args.cartTotal < coupon.minPurchase) {
      throw new ConvexError({
        message: `Minimum purchase of ₹${coupon.minPurchase} required`,
        code: "BAD_REQUEST",
      });
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (args.cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }
    
    return {
      coupon,
      discountAmount,
    };
  },
});

// Create coupon (admin only)
export const createCoupon = mutation({
  args: {
    code: v.string(),
    description: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    minPurchase: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    usageLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    // Check if code already exists
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();
    
    if (existing) {
      throw new ConvexError({
        message: "A coupon with this code already exists",
        code: "CONFLICT",
      });
    }
    
    const couponId = await ctx.db.insert("coupons", {
      code: args.code.toUpperCase(),
      description: args.description,
      discountType: args.discountType,
      discountValue: args.discountValue,
      minPurchase: args.minPurchase,
      maxDiscount: args.maxDiscount,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.isActive,
      usageLimit: args.usageLimit,
      usageCount: 0,
    });
    
    return couponId;
  },
});

// Increment coupon usage
export const incrementCouponUsage = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new ConvexError({
        message: "Coupon not found",
        code: "NOT_FOUND",
      });
    }
    
    await ctx.db.patch(args.couponId, {
      usageCount: coupon.usageCount + 1,
    });
  },
});
