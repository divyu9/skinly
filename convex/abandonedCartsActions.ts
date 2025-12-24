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
  },
  handler: async (ctx, args) => {
    // Get the abandoned cart from the database
    const cart = await ctx.runQuery(internal.abandonedCarts.getCart, {
      cartId: args.cartId,
    });

    if (!cart) {
      return { success: false, error: "Cart not found" };
    }

    // Generate a unique coupon code for this user
    const couponCode = `COMEBACK${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create the coupon with 15% discount
    await ctx.runMutation(internal.coupons.createCouponInternal, {
      code: couponCode,
      description: `Special 15% off for ${cart.userEmail}`,
      discountType: "percentage",
      discountValue: 15,
      startDate: Date.now(),
      endDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // Valid for 7 days
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

        await client.messages.create({
          body: `Hi! You left items worth ₹${cart.cartTotal.toFixed(2)} in your Skinly cart 🛒\n\nComplete your order and save 15% with code: ${couponCode}\n\n${process.env.VITE_SITE_URL || "https://yourdomain.onhercules.app"}/checkout`,
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
    const cartsNeedingReminders: Array<{ _id: string }> = await ctx.runQuery(
      api.abandonedCarts.getCartsNeedingReminders
    );

    const results: unknown[] = [];

    for (const cart of cartsNeedingReminders) {
      const result: unknown = await ctx.runAction(
        api.abandonedCartsActions.sendAbandonedCartReminder,
        {
          cartId: cart._id as Id<"abandonedCarts">,
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
