"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import twilio from "twilio";

/**
 * Send abandoned cart reminder via email and WhatsApp
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

    // Send email via MSG91-based email system
    let emailSent = false;
    try {
      await ctx.runMutation(internal.abandonedCarts.triggerEmailReminder, {
        cartId: args.cartId,
        couponCode,
      });
      emailSent = true;
      console.log(`Email queued for abandoned cart ${args.cartId}`);
    } catch (error) {
      console.error("Error queuing email:", error);
    }

    // Send WhatsApp message
    let whatsappSent = false;
    if (cart.userPhone) {
      try {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const discountText = discountType === "percentage" 
          ? `${discountValue}%` 
          : `₹${discountValue}`;

        await client.messages.create({
          body: `Hi! You left items worth ₹${cart.cartTotal.toFixed(2)} in your Skinly cart 🛒\n\nComplete your order and save ${discountText} with code: ${couponCode}\n\n${process.env.VITE_SITE_URL || "https://yourdomain.onhercules.app"}/checkout`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${cart.userPhone}`,
        });
        whatsappSent = true;
      } catch (error) {
        console.error("Error sending WhatsApp:", error);
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
