import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { ConvexError } from "convex/values";

/**
 * Send WhatsApp notifications when a product is back in stock
 */
export const sendRestockNotifications = mutation({
  args: {
    variantId: v.id("variants"),
  },
  handler: async (ctx, args) => {
    // Get all waiting notifications for this variant
    const notifications = await ctx.db
      .query("stockNotifications")
      .withIndex("by_variant_and_status", (q) =>
        q.eq("variantId", args.variantId).eq("status", "waiting")
      )
      .collect();

    if (notifications.length === 0) {
      return { success: true, sent: 0 };
    }

    // Get variant and product info
    const variant = await ctx.db.get(args.variantId);
    if (!variant) {
      throw new ConvexError({
        message: "Variant not found",
        code: "NOT_FOUND",
      });
    }

    const product = await ctx.db.get(variant.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    let queuedCount = 0;

    // Queue WhatsApp message for each subscriber
    for (const notification of notifications) {
      try {
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "back_in_stock",
            recipientPhone: notification.phoneNumber,
            variables: {
              product_name: `${product.title} - ${variant.title}`,
              product_url: `${process.env.VITE_SITE_URL || "https://www.goskinly.com"}/products/${product.slug}`,
              variant_name: variant.title,
            },
            priority: 6,
          }
        );
        queuedCount++;
      } catch (error) {
        console.error(
          `Failed to queue back-in-stock WhatsApp for ${notification.phoneNumber}:`,
          error
        );
      }
    }

    // Mark all notifications as sent
    for (const notification of notifications) {
      await ctx.db.patch(notification._id, {
        status: "notified",
        notifiedAt: Date.now(),
      });
    }

    return {
      success: true,
      sent: queuedCount,
      total: notifications.length,
    };
  },
});
