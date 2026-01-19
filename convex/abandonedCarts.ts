import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { ConvexError } from "convex/values";
import { triggerAbandonedCartEmail } from "./emailAbandonedCartTriggers";

/**
 * Track when a user abandons their cart (has items but didn't checkout)
 */
export const trackAbandonedCart = mutation({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
    userPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user's cart items
    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (cartItems.length === 0) {
      return null; // No items to track
    }

    // Calculate cart total
    const cartTotal = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Check if there's already an abandoned cart record for this user
    const existing = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) {
      // Update existing abandoned cart
      await ctx.db.patch(existing._id, {
        items: cartItems.map((item) => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productImage: item.productImage,
          variant: item.variant,
          price: item.price,
          quantity: item.quantity,
          phoneModel: item.phoneModel,
          phoneBrand: item.phoneBrand,
          coverage: item.coverage,
        })),
        cartTotal,
        abandonedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new abandoned cart record
      const id = await ctx.db.insert("abandonedCarts", {
        userId: args.userId,
        userEmail: args.userEmail,
        userPhone: args.userPhone,
        items: cartItems.map((item) => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productImage: item.productImage,
          variant: item.variant,
          price: item.price,
          quantity: item.quantity,
          phoneModel: item.phoneModel,
          phoneBrand: item.phoneBrand,
          coverage: item.coverage,
        })),
        cartTotal,
        abandonedAt: Date.now(),
        status: "pending",
      });
      return id;
    }
  },
});

/**
 * Get all abandoned carts that need reminders sent
 * Uses configurable delay from settings (default 1 hour)
 */
export const getCartsNeedingReminders = query({
  args: {
    delayHours: v.optional(v.number()), // Optional override for delay
  },
  handler: async (ctx, args) => {
    // Default to 1 hour if not specified
    const delayHours = args.delayHours ?? 1;
    const delayMs = delayHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - delayMs;

    const abandonedCarts = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("abandonedAt"), cutoffTime))
      .collect();

    return abandonedCarts;
  },
});

/**
 * Mark abandoned cart as reminded (internal)
 */
export const markAsReminded = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    couponCode: v.string(),
  },
  handler: async (ctx, args) => {
    const cart = await ctx.db.get(args.cartId);
    if (!cart) return;

    const currentCount = cart.reminderCount || 0;

    await ctx.db.patch(args.cartId, {
      status: "reminded",
      reminderSentAt: Date.now(),
      reminderCount: currentCount + 1,
      couponCode: args.couponCode,
    });
  },
});

/**
 * Get a single abandoned cart by ID (internal)
 */
export const getCart = internalQuery({
  args: {
    cartId: v.id("abandonedCarts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cartId);
  },
});

/**
 * Mark abandoned cart as recovered (when user completes checkout)
 */
export const markAsRecovered = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const abandonedCarts = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "reminded"))
      )
      .collect();

    for (const cart of abandonedCarts) {
      await ctx.db.patch(cart._id, {
        status: "recovered",
      });
    }
  },
});

/**
 * Get all abandoned carts for admin dashboard
 */
export const getAllAbandonedCarts = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("reminded"),
        v.literal("recovered"),
        v.literal("expired")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    if (args.status) {
      const carts = await ctx.db
        .query("abandonedCarts")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(100);
      return carts;
    } else {
      const carts = await ctx.db
        .query("abandonedCarts")
        .order("desc")
        .take(100);
      return carts;
    }
  },
});

/**
 * Get abandoned cart statistics
 */
export const getAbandonedCartStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allCarts = await ctx.db.query("abandonedCarts").collect();

    const stats = {
      total: allCarts.length,
      pending: allCarts.filter((c) => c.status === "pending").length,
      reminded: allCarts.filter((c) => c.status === "reminded").length,
      recovered: allCarts.filter((c) => c.status === "recovered").length,
      expired: allCarts.filter((c) => c.status === "expired").length,
      totalValue: allCarts.reduce((sum, c) => sum + c.cartTotal, 0),
      recoveredValue: allCarts
        .filter((c) => c.status === "recovered")
        .reduce((sum, c) => sum + c.cartTotal, 0),
    };

    return stats;
  },
});

/**
 * Trigger email reminder for abandoned cart (internal)
 */
export const triggerEmailReminder = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    couponCode: v.string(),
  },
  handler: async (ctx, args) => {
    const cart = await ctx.db.get(args.cartId);
    
    if (!cart) {
      throw new ConvexError({
        message: "Cart not found",
        code: "NOT_FOUND",
      });
    }

    // Trigger email via the email system
    await triggerAbandonedCartEmail(ctx, cart, args.couponCode);
  },
});
