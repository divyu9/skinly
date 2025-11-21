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
  args: { 
    code: v.string(), 
    cartTotal: v.number(),
    cartItems: v.optional(v.array(v.object({
      productTitle: v.string(),
      price: v.number(),
      quantity: v.number(),
    }))),
  },
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
    
    // Check product restrictions
    if (coupon.applicableProductKeywords && coupon.applicableProductKeywords.length > 0) {
      if (!args.cartItems || args.cartItems.length === 0) {
        throw new ConvexError({
          message: "This coupon requires specific products in your cart",
          code: "BAD_REQUEST",
        });
      }
      
      const hasMatchingProduct = args.cartItems.some((item) =>
        coupon.applicableProductKeywords!.some((keyword) =>
          item.productTitle.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (!hasMatchingProduct) {
        throw new ConvexError({
          message: `This coupon is only valid for ${coupon.applicableProductKeywords.join(", ")} products`,
          code: "BAD_REQUEST",
        });
      }
      
      // Calculate eligible total (only products matching keywords)
      const eligibleTotal = args.cartItems
        .filter((item) =>
          coupon.applicableProductKeywords!.some((keyword) =>
            item.productTitle.toLowerCase().includes(keyword.toLowerCase())
          )
        )
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      // Check minimum purchase against eligible items only
      if (coupon.minPurchase && eligibleTotal < coupon.minPurchase) {
        throw new ConvexError({
          message: `Minimum purchase of ₹${coupon.minPurchase} required for eligible products`,
          code: "BAD_REQUEST",
        });
      }
      
      // Calculate discount on eligible items only
      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
        discountAmount = (eligibleTotal * coupon.discountValue) / 100;
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
    }
    
    // Check minimum purchase for non-restricted coupons
    if (coupon.minPurchase && args.cartTotal < coupon.minPurchase) {
      throw new ConvexError({
        message: `Minimum purchase of ₹${coupon.minPurchase} required`,
        code: "BAD_REQUEST",
      });
    }
    
    // Calculate discount on full cart for non-restricted coupons
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
    applicableProductKeywords: v.optional(v.array(v.string())),
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
      applicableProductKeywords: args.applicableProductKeywords,
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

// Update coupon dates (admin only)
export const updateCouponDates = mutation({
  args: {
    couponId: v.id("coupons"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    await ctx.db.patch(args.couponId, {
      startDate: args.startDate,
      endDate: args.endDate,
    });
  },
});
