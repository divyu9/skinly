import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Get all coupons (admin only)
export const getAllCoupons = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    return await ctx.db.query("coupons").order("desc").collect();
  },
});

// Get single coupon (admin only)
export const getCoupon = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new ConvexError({
        message: "Coupon not found",
        code: "NOT_FOUND",
      });
    }

    return coupon;
  },
});

// Get eligible products for a coupon
export const getEligibleProducts = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new ConvexError({
        message: "Coupon not found",
        code: "NOT_FOUND",
      });
    }

    const allProducts = await ctx.db.query("products").collect();
    const allVariants = await ctx.db.query("variants").collect();

    // Group variants by product
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    const eligibleProducts = [];

    for (const product of allProducts) {
      if (product.status !== "active") continue;

      const variants = variantsByProduct.get(product._id) || [];
      const eligibleVariants = [];

      for (const variant of variants) {
        let isEligible = false;

        // Check specific variant IDs
        if (coupon.applicableVariantIds && coupon.applicableVariantIds.length > 0) {
          if (coupon.applicableVariantIds.includes(variant._id)) {
            isEligible = true;
          }
        }

        // Check collections
        if (coupon.applicableCollectionIds && coupon.applicableCollectionIds.length > 0) {
          if (product.collectionId && coupon.applicableCollectionIds.includes(product.collectionId)) {
            isEligible = true;
          }
        }

        // Check product title keywords
        if (coupon.applicableProductKeywords && coupon.applicableProductKeywords.length > 0) {
          const titleLower = product.title.toLowerCase();
          if (coupon.applicableProductKeywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
            isEligible = true;
          }
        }

        // Check min product value
        if (coupon.minProductValue && variant.price >= coupon.minProductValue) {
          isEligible = true;
        }

        // If no specific conditions are set, coupon applies to all products
        if (
          !coupon.applicableVariantIds &&
          !coupon.applicableCollectionIds &&
          !coupon.applicableProductKeywords &&
          !coupon.minProductValue
        ) {
          isEligible = true;
        }

        if (isEligible) {
          eligibleVariants.push(variant);
        }
      }

      if (eligibleVariants.length > 0) {
        eligibleProducts.push({
          ...product,
          variants: eligibleVariants,
        });
      }
    }

    return eligibleProducts;
  },
});

// Get active coupons for a specific product
export const getCouponsForProduct = query({
  args: { 
    productId: v.id("products"),
    variantId: v.optional(v.id("variants")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const allCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter by date range
    const activeCoupons = allCoupons.filter(
      (coupon) => coupon.startDate <= now && coupon.endDate >= now
    );

    // Filter by usage limit
    const availableCoupons = activeCoupons.filter(
      (coupon) => !coupon.usageLimit || coupon.usageCount < coupon.usageLimit
    );

    const product = await ctx.db.get(args.productId);
    if (!product) return [];

    const applicableCoupons = [];

    for (const coupon of availableCoupons) {
      let isApplicable = false;

      // Check specific variant
      if (args.variantId && coupon.applicableVariantIds && coupon.applicableVariantIds.length > 0) {
        if (coupon.applicableVariantIds.includes(args.variantId)) {
          isApplicable = true;
        }
      }

      // Check collection
      if (coupon.applicableCollectionIds && coupon.applicableCollectionIds.length > 0) {
        if (product.collectionId && coupon.applicableCollectionIds.includes(product.collectionId)) {
          isApplicable = true;
        }
      }

      // Check product title
      if (coupon.applicableProductKeywords && coupon.applicableProductKeywords.length > 0) {
        const titleLower = product.title.toLowerCase();
        if (coupon.applicableProductKeywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
          isApplicable = true;
        }
      }

      // Check min product value
      if (coupon.minProductValue && args.variantId) {
        const variant = await ctx.db.get(args.variantId);
        if (variant && variant.price >= coupon.minProductValue) {
          isApplicable = true;
        }
      }

      // If no specific conditions, coupon applies to all products
      if (
        !coupon.applicableVariantIds &&
        !coupon.applicableCollectionIds &&
        !coupon.applicableProductKeywords &&
        !coupon.minProductValue
      ) {
        isApplicable = true;
      }

      if (isApplicable) {
        applicableCoupons.push(coupon);
      }
    }

    return applicableCoupons;
  },
});

// Validate coupon
export const validateCoupon = query({
  args: { 
    code: v.string(), 
    cartTotal: v.number(),
    userEmail: v.optional(v.string()),
    cartItems: v.optional(v.array(v.object({
      variantId: v.id("variants"),
      productId: v.id("products"),
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
        message: "This coupon has expired or is not yet active",
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

    // Check customer email restrictions
    if (coupon.allowedCustomerEmails && coupon.allowedCustomerEmails.length > 0) {
      if (!args.userEmail) {
        throw new ConvexError({
          message: "This coupon is only available for specific customers",
          code: "BAD_REQUEST",
        });
      }
      const emailLower = args.userEmail.toLowerCase();
      const allowed = coupon.allowedCustomerEmails.some((email) => email.toLowerCase() === emailLower);
      if (!allowed) {
        throw new ConvexError({
          message: "This coupon is not available for your account",
          code: "BAD_REQUEST",
        });
      }
    }

    // Check minimum cart value
    if (coupon.minCartValue && args.cartTotal < coupon.minCartValue) {
      throw new ConvexError({
        message: `Minimum cart value of ₹${coupon.minCartValue} required`,
        code: "BAD_REQUEST",
      });
    }

    // Check if cart has eligible items
    if (!args.cartItems || args.cartItems.length === 0) {
      throw new ConvexError({
        message: "Cart is empty",
        code: "BAD_REQUEST",
      });
    }

    // Determine eligible items
    const eligibleItems = [];
    for (const item of args.cartItems) {
      let isEligible = false;

      // Check specific variants
      if (coupon.applicableVariantIds && coupon.applicableVariantIds.length > 0) {
        if (coupon.applicableVariantIds.includes(item.variantId)) {
          isEligible = true;
        }
      }

      // Check collections
      if (coupon.applicableCollectionIds && coupon.applicableCollectionIds.length > 0) {
        const product = await ctx.db.get(item.productId);
        if (product?.collectionId && coupon.applicableCollectionIds.includes(product.collectionId)) {
          isEligible = true;
        }
      }

      // Check product title
      if (coupon.applicableProductKeywords && coupon.applicableProductKeywords.length > 0) {
        const titleLower = item.productTitle.toLowerCase();
        if (coupon.applicableProductKeywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
          isEligible = true;
        }
      }

      // Check min product value
      if (coupon.minProductValue && item.price >= coupon.minProductValue) {
        isEligible = true;
      }

      // If no specific conditions, all items are eligible
      if (
        !coupon.applicableVariantIds &&
        !coupon.applicableCollectionIds &&
        !coupon.applicableProductKeywords &&
        !coupon.minProductValue
      ) {
        isEligible = true;
      }

      if (isEligible) {
        eligibleItems.push(item);
      }
    }

    if (eligibleItems.length === 0) {
      throw new ConvexError({
        message: "No items in your cart are eligible for this coupon",
        code: "BAD_REQUEST",
      });
    }

    // Calculate eligible total
    const eligibleTotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Check minimum purchase against eligible items
    if (coupon.minPurchase && eligibleTotal < coupon.minPurchase) {
      throw new ConvexError({
        message: `Minimum purchase of ₹${coupon.minPurchase} required for eligible products`,
        code: "BAD_REQUEST",
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (eligibleTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, eligibleTotal);
    }
    
    return {
      coupon,
      discountAmount,
      eligibleItemsCount: eligibleItems.length,
    };
  },
});

// Create coupon
export const createCoupon = mutation({
  args: {
    code: v.string(),
    description: v.string(),
    effectType: v.optional(v.union(v.literal("discount"), v.literal("wallet_credit"))),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    minPurchase: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    usageLimit: v.optional(v.number()),
    applicableVariantIds: v.optional(v.array(v.id("variants"))),
    applicableCollectionIds: v.optional(v.array(v.id("collections"))),
    applicableProductKeywords: v.optional(v.array(v.string())),
    minCartValue: v.optional(v.number()),
    minProductValue: v.optional(v.number()),
    allowedCustomerEmails: v.optional(v.array(v.string())),
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
      applicableVariantIds: args.applicableVariantIds,
      applicableCollectionIds: args.applicableCollectionIds,
      applicableProductKeywords: args.applicableProductKeywords,
      minCartValue: args.minCartValue,
      minProductValue: args.minProductValue,
      allowedCustomerEmails: args.allowedCustomerEmails?.map((e) => e.toLowerCase()),
    });
    
    return couponId;
  },
});

// Create coupon (internal - for automated systems like abandoned cart recovery)
export const createCouponInternal = internalMutation({
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
    applicableVariantIds: v.optional(v.array(v.id("variants"))),
    applicableCollectionIds: v.optional(v.array(v.id("collections"))),
    applicableProductKeywords: v.optional(v.array(v.string())),
    minCartValue: v.optional(v.number()),
    minProductValue: v.optional(v.number()),
    allowedCustomerEmails: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
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
      applicableVariantIds: args.applicableVariantIds,
      applicableCollectionIds: args.applicableCollectionIds,
      applicableProductKeywords: args.applicableProductKeywords,
      minCartValue: args.minCartValue,
      minProductValue: args.minProductValue,
      allowedCustomerEmails: args.allowedCustomerEmails?.map((e) => e.toLowerCase()),
    });
    
    return couponId;
  },
});

// Update coupon
export const updateCoupon = mutation({
  args: {
    couponId: v.id("coupons"),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    effectType: v.optional(v.union(v.literal("discount"), v.literal("wallet_credit"))),
    discountType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    discountValue: v.optional(v.number()),
    minPurchase: v.optional(v.union(v.number(), v.null())),
    maxDiscount: v.optional(v.union(v.number(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    usageLimit: v.optional(v.union(v.number(), v.null())),
    applicableVariantIds: v.optional(v.union(v.array(v.id("variants")), v.null())),
    applicableCollectionIds: v.optional(v.union(v.array(v.id("collections")), v.null())),
    applicableProductKeywords: v.optional(v.union(v.array(v.string()), v.null())),
    minCartValue: v.optional(v.union(v.number(), v.null())),
    minProductValue: v.optional(v.union(v.number(), v.null())),
    allowedCustomerEmails: v.optional(v.union(v.array(v.string()), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { couponId, ...rawUpdates } = args;

    // Build clean updates object, converting null to undefined
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (value !== undefined) {
        updates[key] = value === null ? undefined : value;
      }
    }

    // If updating code, check for conflicts
    if (updates.code && typeof updates.code === "string") {
      const upperCode = updates.code.toUpperCase();
      const existing = await ctx.db
        .query("coupons")
        .withIndex("by_code", (q) => q.eq("code", upperCode))
        .first();
      
      if (existing && existing._id !== couponId) {
        throw new ConvexError({
          message: "A coupon with this code already exists",
          code: "CONFLICT",
        });
      }
      updates.code = upperCode;
    }

    // Normalize emails
    if (updates.allowedCustomerEmails && Array.isArray(updates.allowedCustomerEmails)) {
      updates.allowedCustomerEmails = (updates.allowedCustomerEmails as string[]).map((e) => e.toLowerCase());
    }

    await ctx.db.patch(couponId, updates);
  },
});

// Delete coupon
export const deleteCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.couponId);
  },
});

// Redeem wallet credit coupon
export const redeemWalletCreditCoupon = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Find coupon
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

    // Validate it's a wallet credit coupon
    if (coupon.effectType !== "wallet_credit") {
      throw new ConvexError({
        message: "This coupon is not a wallet credit coupon. Use it at checkout instead.",
        code: "BAD_REQUEST",
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
        message: "This coupon has expired or is not yet active",
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

    // Check customer email restrictions
    if (coupon.allowedCustomerEmails && coupon.allowedCustomerEmails.length > 0) {
      const emailLower = (user.email || "").toLowerCase();
      const allowed = coupon.allowedCustomerEmails.some((email) => email.toLowerCase() === emailLower);
      if (!allowed) {
        throw new ConvexError({
          message: "This coupon is not available for your account",
          code: "BAD_REQUEST",
        });
      }
    }

    // Check if user has already used this coupon
    const existingUsage = await ctx.db
      .query("couponUsage")
      .withIndex("by_coupon_and_user", (q) => 
        q.eq("couponId", coupon._id).eq("userId", user._id)
      )
      .first();

    if (existingUsage) {
      throw new ConvexError({
        message: "You have already redeemed this coupon",
        code: "BAD_REQUEST",
      });
    }

    // Calculate credit amount
    let creditAmount = 0;
    if (coupon.discountType === "fixed") {
      creditAmount = coupon.discountValue;
    } else {
      throw new ConvexError({
        message: "Percentage-based wallet credit coupons are not supported",
        code: "BAD_REQUEST",
      });
    }

    // Add credit to wallet
    const currentBalance = user.walletBalance || 0;
    const newBalance = currentBalance + creditAmount;

    await ctx.db.patch(user._id, {
      walletBalance: newBalance,
    });

    // Create wallet transaction
    await ctx.db.insert("walletTransactions", {
      userId: user._id,
      transactionType: "credit",
      amount: creditAmount,
      source: "coupon_credit",
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: `Coupon: ${coupon.code} - ${coupon.description}`,
      relatedCouponId: coupon._id,
      createdAt: now,
    });

    // Increment usage count
    await ctx.db.patch(coupon._id, {
      usageCount: coupon.usageCount + 1,
    });

    // Track usage (no orderId for wallet credit coupons)
    await ctx.db.insert("couponUsage", {
      couponId: coupon._id,
      userId: user._id,
      userEmail: (user.email || "").toLowerCase(),
      discountAmount: creditAmount,
      usedAt: now,
    });

    return {
      success: true,
      creditAmount,
      newBalance,
      couponCode: coupon.code,
    };
  },
});

// Increment coupon usage (called when order is placed)
export const incrementCouponUsage = mutation({
  args: { 
    couponId: v.id("coupons"),
    userId: v.id("users"),
    userEmail: v.string(),
    orderId: v.id("orders"),
    discountAmount: v.number(),
  },
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

    // Track usage
    await ctx.db.insert("couponUsage", {
      couponId: args.couponId,
      userId: args.userId,
      userEmail: args.userEmail.toLowerCase(),
      orderId: args.orderId,
      discountAmount: args.discountAmount,
      usedAt: Date.now(),
    });
  },
});

// Get coupon usage stats
export const getCouponUsageStats = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usages = await ctx.db
      .query("couponUsage")
      .withIndex("by_coupon", (q) => q.eq("couponId", args.couponId))
      .collect();

    const totalDiscount = usages.reduce((sum, usage) => sum + usage.discountAmount, 0);
    const uniqueUsers = new Set(usages.map((u) => u.userEmail)).size;

    return {
      totalUsages: usages.length,
      totalDiscount,
      uniqueUsers,
      recentUsages: usages.slice(-10).reverse(),
    };
  },
});
