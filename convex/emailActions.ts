"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.d.ts";
import {
  generateOrderConfirmedEmail,
  generateOrderDispatchedEmail,
  generateOrderDeliveredEmail,
  generateOrderCancelledEmail,
  generatePaymentFailedEmail,
} from "./emailTemplates";

/**
 * Send email notification using Resend API
 */
export const sendEmailNotification = action({
  args: {
    orderId: v.id("orders"),
    emailType: v.union(
      v.literal("order_confirmed"),
      v.literal("payment_failed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled")
    ),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      // Get order details
      const order: Doc<"orders"> | null = await ctx.runQuery(internal.emailActionsInternal.getOrderForEmail, {
        orderId: args.orderId,
      });

      if (!order || !order.customerEmail) {
        console.log("No email address for order:", args.orderId);
        return { success: false, error: "No email address" };
      }

      // Get Resend API key from environment
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY not configured");
      }

      // Prepare email data
      const emailData = {
        orderNumber: order.orderNumber,
        customerName: order.shippingAddress.fullName,
        items: order.items,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        total: order.total,
        shippingAddress: order.shippingAddress,
        trackingUrl: order.trackingUrl,
        awbNumber: order.awbNumber,
      };

      // Generate email based on type
      let emailContent: { subject: string; html: string };
      switch (args.emailType) {
        case "order_confirmed":
          emailContent = generateOrderConfirmedEmail(emailData);
          break;
        case "payment_failed":
          emailContent = generatePaymentFailedEmail(emailData);
          break;
        case "order_dispatched":
          emailContent = generateOrderDispatchedEmail(emailData);
          break;
        case "order_delivered":
          emailContent = generateOrderDeliveredEmail(emailData);
          break;
        case "order_cancelled":
          emailContent = generateOrderCancelledEmail(emailData);
          break;
      }

      // Send email via Resend
      const response: Response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Skinly <orders@skinly.com>",
          to: [order.customerEmail],
          subject: emailContent.subject,
          html: emailContent.html,
        }),
      });

      const responseData: { id?: string; message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(
          `Resend API error: ${responseData.message || response.statusText}`
        );
      }

      // Log successful send
      await ctx.runMutation(internal.emailActionsInternal.logEmailSent, {
        orderId: args.orderId,
        recipientEmail: order.customerEmail,
        emailType: args.emailType,
        subject: emailContent.subject,
        providerMessageId: responseData.id || "unknown",
      });

      console.log("Email sent successfully:", {
        orderId: args.orderId,
        emailType: args.emailType,
        messageId: responseData.id,
      });

      return { success: true, messageId: responseData.id };
    } catch (error) {
      console.error("Failed to send email:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Log failed send
      await ctx.runMutation(internal.emailActionsInternal.logEmailFailed, {
        orderId: args.orderId,
        emailType: args.emailType,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});
