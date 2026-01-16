import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

/**
 * Send abandoned cart reminder via email and WhatsApp
 * Uses MSG91 for email and Authkey.io for WhatsApp
 */
export const sendAbandonedCartReminder = action({
  args: {
    cartId: v.id("abandonedCarts"),
    couponPrefix: v.optional(v.string()),
    discountType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    discountValue: v.optional(v.number()),
    validityDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the abandoned cart from the database
    const cart = await ctx.runQuery(internal.abandonedCarts.getCart, {
      cartId: args.cartId,
    });

    if (!cart) {
      return { success: false, error: "Cart not found" };
    }

    // Use provided settings or defaults
    const couponPrefix = args.couponPrefix || "COMEBACK";
    const discountType = args.discountType || "percentage";
    const discountValue = args.discountValue || 15;
    const validityDays = args.validityDays || 7;

    // Generate a unique coupon code
    const couponCode = `${couponPrefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create the coupon with configured settings
    await ctx.runMutation(internal.coupons.createCouponInternal, {
      code: couponCode,
      description: `Special ${discountType === "percentage" ? discountValue + "%" : "₹" + discountValue} off for ${cart.userEmail}`,
      discountType,
      discountValue,
      startDate: Date.now(),
      endDate: Date.now() + validityDays * 24 * 60 * 60 * 1000,
      isActive: true,
      usageLimit: 1,
      allowedCustomerEmails: [cart.userEmail],
    });

    // Send email via MSG91-based email system with dynamic settings
    let emailSent = false;
    try {
      await ctx.runMutation(internal.abandonedCartsInternal.triggerEmailReminderInternal, {
        cartId: args.cartId,
        couponCode,
        discountValue,
        discountType,
        validityDays,
      });
      emailSent = true;
      console.log(`Email queued for abandoned cart ${args.cartId}`);
    } catch (error) {
      console.error("Error queuing email:", error);
    }

    // Send WhatsApp message via Authkey.io queue system
    let whatsappSent = false;
    if (cart.userPhone) {
      try {
        const discountText = discountType === "percentage"
          ? `${discountValue}%`
          : `₹${discountValue}`;

        // Queue WhatsApp message via existing messaging system
        await ctx.runMutation(internal.abandonedCartsInternal.queueWhatsAppReminder, {
          cartId: args.cartId,
          recipientPhone: cart.userPhone,
          recipientUserId: cart.userId,
          variables: {
            cart_total: `₹${cart.cartTotal.toFixed(2)}`,
            discount_text: discountText,
            coupon_code: couponCode,
            cart_link: `${process.env.VITE_SITE_URL || "https://goskinly.com"}/cart`,
          },
        });
        whatsappSent = true;
        console.log(`WhatsApp queued for abandoned cart ${args.cartId}`);
      } catch (error) {
        console.error("Error queuing WhatsApp:", error);
      }
    }

    // Mark cart as reminded
    await ctx.runMutation(internal.abandonedCarts.markAsReminded, {
      cartId: args.cartId,
      couponCode,
    });

    return {
      success: true,
      emailSent,
      whatsappSent,
      couponCode,
    };
  },
});

/**
 * Scan all active carts and track them as abandoned if they meet criteria
 * This should be run periodically (e.g., every hour) to detect new abandoned carts
 * Uses the internal function that correctly tracks cart item creation time as abandonedAt
 */
export const scanAndTrackAbandonedCarts = action({
  args: {},
  handler: async (ctx): Promise<{ tracked: number; carts: Array<{ email: string; total: number }> }> => {
    // Use the internal scanning function that correctly tracks timestamps
    const usersWithCarts = await ctx.runQuery(
      internal.abandonedCartsInternal.getAllUsersWithCarts,
      {}
    );

    const trackedCarts: Array<{ email: string; total: number }> = [];

    for (const { user, cartItems, oldestItemTime } of usersWithCarts) {
      if (!user || cartItems.length === 0) continue;

      // Get user's phone from most recent order
      const userPhone = await ctx.runQuery(
        internal.abandonedCartsInternal.getUserPhoneFromOrders,
        { userId: user._id }
      );

      // Track this cart as abandoned with correct timestamp
      try {
        await ctx.runMutation(
          internal.abandonedCartsInternal.trackAbandonedCartInternal,
          {
            userId: user._id,
            userEmail: user.email || "",
            userPhone: userPhone ?? undefined, // Convert null to undefined
            oldestCartItemTime: oldestItemTime, // Use actual cart item creation time
          }
        );

        const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        trackedCarts.push({
          email: user.email || "Unknown",
          total: cartTotal,
        });
      } catch (error) {
        console.error(`Failed to track abandoned cart for user ${user._id}:`, error);
      }
    }

    return {
      tracked: trackedCarts.length,
      carts: trackedCarts,
    };
  },
});

/**
 * Process all abandoned carts that need reminders
 */
export const processAbandonedCarts = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number; results: unknown[] }> => {
    // Get settings first
    const settings = await ctx.runQuery(api.abandonedCartSettings.getSettings, {});
    
    const cartsNeedingReminders: Array<{ _id: string }> = await ctx.runQuery(
      api.abandonedCarts.getCartsNeedingReminders,
      { delayHours: settings.delayHours }
    );

    const results: unknown[] = [];

    for (const cart of cartsNeedingReminders) {
      const result: unknown = await ctx.runAction(
        api.abandonedCartsActions.sendAbandonedCartReminder,
        {
          cartId: cart._id as Id<"abandonedCarts">,
          couponPrefix: settings.couponPrefix,
          discountType: settings.couponDiscountType as "percentage" | "fixed",
          discountValue: settings.couponDiscountValue,
          validityDays: settings.couponValidityDays,
        }
      );
      results.push(result);
    }

    return {
      processed: results.length,
      results,
    };
  },
});
