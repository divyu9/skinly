import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

/**
 * Subscribe to stock notification for a variant
 */
export const subscribeToNotification = mutation({
  args: {
    variantId: v.id("variants"),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Get variant details
    const variant = await ctx.db.get(args.variantId);
    if (!variant) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    // Get product details
    const product = await ctx.db.get(variant.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    // Check if already subscribed
    const existing = await ctx.db
      .query("stockNotifications")
      .withIndex("by_variant_and_status", (q) =>
        q.eq("variantId", args.variantId).eq("status", "waiting")
      )
      .filter((q) => q.eq(q.field("phoneNumber"), args.phoneNumber))
      .first();

    if (existing) {
      return { success: true, alreadySubscribed: true };
    }

    // Create subscription
    await ctx.db.insert("stockNotifications", {
      variantId: args.variantId,
      productId: product._id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      phoneNumber: args.phoneNumber,
      subscribedAt: Date.now(),
      status: "waiting",
    });

    return { success: true, alreadySubscribed: false };
  },
});

/**
 * Get all stock notifications waiting for a variant
 */
export const getWaitingNotifications = query({
  args: {
    variantId: v.optional(v.id("variants")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    if (args.variantId) {
      return await ctx.db
        .query("stockNotifications")
        .withIndex("by_variant_and_status", (q) =>
          q.eq("variantId", args.variantId!).eq("status", "waiting")
        )
        .collect();
    } else {
      return await ctx.db
        .query("stockNotifications")
        .withIndex("by_status", (q) => q.eq("status", "waiting"))
        .collect();
    }
  },
});

/**
 * Get stock notification statistics grouped by product
 */
export const getNotificationStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allNotifications = await ctx.db
      .query("stockNotifications")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    // Group by product
    const productMap = new Map<
      string,
      {
        productId: string;
        productTitle: string;
        variants: Map<
          string,
          { variantId: string; variantTitle: string; sku: string; count: number }
        >;
        totalCount: number;
      }
    >();

    for (const notification of allNotifications) {
      if (!productMap.has(notification.productId)) {
        productMap.set(notification.productId, {
          productId: notification.productId,
          productTitle: notification.productTitle,
          variants: new Map(),
          totalCount: 0,
        });
      }

      const product = productMap.get(notification.productId)!;
      product.totalCount++;

      if (!product.variants.has(notification.variantId)) {
        product.variants.set(notification.variantId, {
          variantId: notification.variantId,
          variantTitle: notification.variantTitle,
          sku: notification.sku,
          count: 0,
        });
      }

      product.variants.get(notification.variantId)!.count++;
    }

    // Convert to array
    return Array.from(productMap.values()).map((product) => ({
      ...product,
      variants: Array.from(product.variants.values()),
    }));
  },
});

/**
 * Mark notifications as sent (internal)
 */
export const markNotificationsAsSent = mutation({
  args: {
    variantId: v.id("variants"),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("stockNotifications")
      .withIndex("by_variant_and_status", (q) =>
        q.eq("variantId", args.variantId).eq("status", "waiting")
      )
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        status: "notified",
        notifiedAt: Date.now(),
      });
    }

    return { count: notifications.length };
  },
});
