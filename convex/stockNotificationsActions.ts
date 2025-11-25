"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import twilio from "twilio";

/**
 * Send WhatsApp notifications when a product is back in stock
 */
export const sendRestockNotifications = action({
  args: {
    variantId: v.id("variants"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    failed?: number;
    errors?: Array<{ phoneNumber: string; error: string }>;
  }> => {
    // Get all waiting notifications for this variant
    const notifications: Array<{
      phoneNumber: string;
      productTitle: string;
      variantTitle: string;
    }> = await ctx.runQuery(api.stockNotifications.getWaitingNotifications, {
      variantId: args.variantId,
    });

    if (notifications.length === 0) {
      return { success: true, sent: 0 };
    }

    // Get variant and product info from first notification
    const firstNotification = notifications[0];

    // Initialize Twilio client
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    let sentCount = 0;
    const errors: Array<{ phoneNumber: string; error: string }> = [];

    // Send WhatsApp message to each subscriber
    for (const notification of notifications) {
      try {
        await client.messages.create({
          body: `Great news! ${notification.productTitle} - ${notification.variantTitle} is back in stock! 🎉\n\nOrder now: ${process.env.VITE_SITE_URL || "https://yourdomain.onhercules.app"}/products`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${notification.phoneNumber}`,
        });
        sentCount++;
      } catch (error) {
        console.error(
          `Error sending WhatsApp to ${notification.phoneNumber}:`,
          error
        );
        errors.push({
          phoneNumber: notification.phoneNumber,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Mark all notifications as sent
    await ctx.runMutation(api.stockNotifications.markNotificationsAsSent, {
      variantId: args.variantId,
    });

    return {
      success: true,
      sent: sentCount,
      failed: errors.length,
      errors,
    };
  },
});
