"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import { Resend } from "resend";
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

    // Send email
    let emailSent = false;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const itemsList = cart.items
        .map(
          (item: { quantity: number; productTitle: string; variant: string; price: number }) =>
            `<li>${item.quantity}x ${item.productTitle} - ${item.variant} (₹${item.price})</li>`
        )
        .join("");

      await resend.emails.send({
        from: "Skinly <onboarding@resend.dev>",
        to: [cart.userEmail],
        subject: "You left something in your cart! 🎁",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">Don't Miss Out!</h1>
            <p>Hi there! 👋</p>
            <p>We noticed you left some awesome items in your cart:</p>
            <ul style="list-style: none; padding: 0;">
              ${itemsList}
            </ul>
            <p style="font-size: 18px; font-weight: bold;">
              Cart Total: ₹${cart.cartTotal.toFixed(2)}
            </p>
            <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="color: #16a34a; margin-top: 0;">Special Offer Just for You! 🎉</h2>
              <p style="font-size: 16px;">Use code <strong style="font-size: 20px; color: #16a34a;">${couponCode}</strong> to get <strong>15% OFF</strong> your order!</p>
              <p style="font-size: 14px; color: #666;">Valid for 7 days</p>
            </div>
            <a href="${process.env.VITE_SITE_URL || "https://yourdomain.onhercules.app"}/checkout" 
               style="display: inline-block; background-color: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
              Complete Your Order
            </a>
            <p style="color: #666; font-size: 14px;">Questions? Reply to this email or contact our support.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (error) {
      console.error("Error sending email:", error);
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
