import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

/**
 * Get current user's wallet balance
 */
export const getWalletBalance = query({
  args: {},
  handler: async (ctx) => {
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

    return {
      balance: user.walletBalance || 0,
      userId: user._id,
    };
  },
});

/**
 * Get wallet transactions for current user
 */
export const getWalletTransactions = query({
  args: {
    limit: v.optional(v.number()),
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

    const limit = args.limit || 50;
    const transactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user_and_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return transactions;
  },
});

/**
 * Get wallet statistics for current user
 */
export const getWalletStats = query({
  args: {},
  handler: async (ctx) => {
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

    // Get all transactions
    const allTransactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate lifetime earned and spent
    let lifetimeEarned = 0;
    let lifetimeSpent = 0;

    for (const txn of allTransactions) {
      if (txn.transactionType === "credit") {
        lifetimeEarned += txn.amount;
      } else if (txn.transactionType === "debit") {
        lifetimeSpent += txn.amount;
      }
    }

    return {
      currentBalance: user.walletBalance || 0,
      lifetimeEarned,
      lifetimeSpent,
      transactionCount: allTransactions.length,
    };
  },
});

/**
 * Internal: Add credit to user's wallet
 */
export const addWalletCredit = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    source: v.union(
      v.literal("refund"),
      v.literal("admin_credit"),
      v.literal("coupon_credit"),
      v.literal("referral_reward"),
      v.literal("cashback")
    ),
    description: v.string(),
    relatedOrderId: v.optional(v.id("orders")),
    relatedCouponId: v.optional(v.id("coupons")),
    adminEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const currentBalance = user.walletBalance || 0;
    const newBalance = currentBalance + args.amount;

    // Update user's wallet balance
    await ctx.db.patch(args.userId, {
      walletBalance: newBalance,
    });

    // Create transaction record
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      transactionType: "credit",
      amount: args.amount,
      source: args.source,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: args.description,
      relatedOrderId: args.relatedOrderId,
      relatedCouponId: args.relatedCouponId,
      adminEmail: args.adminEmail,
      createdAt: Date.now(),
    });

    return {
      success: true,
      newBalance,
    };
  },
});

/**
 * Internal: Deduct from user's wallet
 */
export const deductWalletBalance = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
    relatedOrderId: v.optional(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const currentBalance = user.walletBalance || 0;
    
    if (currentBalance < args.amount) {
      throw new ConvexError({
        message: "Insufficient wallet balance",
        code: "BAD_REQUEST",
      });
    }

    const newBalance = currentBalance - args.amount;

    // Update user's wallet balance
    await ctx.db.patch(args.userId, {
      walletBalance: newBalance,
    });

    // Create transaction record
    await ctx.db.insert("walletTransactions", {
      userId: args.userId,
      transactionType: "debit",
      amount: args.amount,
      source: "order_payment",
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: args.description,
      relatedOrderId: args.relatedOrderId,
      createdAt: Date.now(),
    });

    return {
      success: true,
      newBalance,
    };
  },
});

/**
 * Get wallet settings (admin)
 */
export const getWalletSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("walletSettings").first();
    
    // Return default settings if not configured
    if (!settings) {
      return {
        maxUsageType: "unlimited" as const,
        maxUsageValue: 0,
        referralRewardAmount: 100,
        referralMinOrderValue: 500,
        walletEnabled: true,
      };
    }

    return settings;
  },
});

/**
 * Save wallet settings (admin)
 */
export const saveWalletSettings = mutation({
  args: {
    maxUsageType: v.union(
      v.literal("percentage"),
      v.literal("fixed"),
      v.literal("unlimited")
    ),
    maxUsageValue: v.number(),
    referralRewardAmount: v.number(),
    referralMinOrderValue: v.number(),
    walletEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const existing = await ctx.db.query("walletSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedBy: identity.email,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("walletSettings", {
        ...args,
        updatedBy: identity.email,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Calculate maximum allowed wallet usage for an order
 */
export const calculateMaxWalletUsage = query({
  args: {
    orderTotal: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { maxUsage: 0 };
    }

    const settings = await ctx.db.query("walletSettings").first();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return { maxUsage: 0 };
    }

    const currentBalance = user.walletBalance || 0;

    // If wallet is disabled, return 0
    if (settings && !settings.walletEnabled) {
      return { maxUsage: 0 };
    }

    // Calculate max usage based on settings
    let maxUsage = currentBalance;

    if (!settings || settings.maxUsageType === "unlimited") {
      // No limit - can use entire balance
      maxUsage = Math.min(currentBalance, args.orderTotal);
    } else if (settings.maxUsageType === "percentage") {
      // Percentage limit
      const percentageLimit = (args.orderTotal * settings.maxUsageValue) / 100;
      maxUsage = Math.min(currentBalance, percentageLimit, args.orderTotal);
    } else if (settings.maxUsageType === "fixed") {
      // Fixed amount limit
      maxUsage = Math.min(currentBalance, settings.maxUsageValue, args.orderTotal);
    }

    return {
      maxUsage: Math.max(0, maxUsage),
      currentBalance,
      canUseWallet: settings?.walletEnabled !== false && currentBalance > 0,
    };
  },
});
