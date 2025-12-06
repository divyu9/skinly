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
 * Replace template variables with actual values
 */
function replaceTemplateVariables(
  template: string,
  order: Doc<"orders">,
  emailData: {
    orderNumber: string;
    customerName: string;
    items: Doc<"orders">["items"];
    subtotal: number;
    shippingFee: number;
    total: number;
    shippingAddress: Doc<"orders">["shippingAddress"];
    trackingUrl?: string;
    awbNumber?: string;
  }
): string {
  const variables: Record<string, string> = {
    customer_name: emailData.customerName,
    order_id: order._id,
    order_number: emailData.orderNumber,
    order_date: new Date(order._creationTime).toLocaleDateString("en-IN"),
    order_total: `₹${emailData.total.toFixed(2)}`,
    items_list: emailData.items
      .map(
        (item) =>
          `${item.productTitle} (${item.variant}) - Qty: ${item.quantity} - ₹${item.price.toFixed(2)}`
      )
      .join("<br>"),
    shipping_address: `${emailData.shippingAddress.fullName}<br>${emailData.shippingAddress.addressLine1}<br>${emailData.shippingAddress.addressLine2 || ""}<br>${emailData.shippingAddress.city}, ${emailData.shippingAddress.state} ${emailData.shippingAddress.pincode}`,
    payment_method: order.paymentMethod,
    tracking_link: emailData.trackingUrl || "Not available yet",
    tracking_number: emailData.awbNumber || "Not assigned yet",
    courier_name: order.courierName || "Not assigned yet",
    estimated_delivery: "3-5 business days",
    delivery_date: new Date().toLocaleDateString("en-IN"),
    review_link: `https://skinly.com/orders/${order._id}`,
    cancellation_reason: "As per your request",
    refund_amount: `₹${emailData.total.toFixed(2)}`,
    refund_method: order.paymentMethod === "COD" ? "Wallet credit" : "Original payment method",
    payment_amount: `₹${emailData.total.toFixed(2)}`,
    failure_reason: "Payment gateway error",
    retry_link: `https://skinly.com/orders/${order._id}/payment`,
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  }

  return result;
}

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

      // Check for custom active template first
      const customTemplate = await ctx.runQuery(internal.emailActionsInternal.getActiveTemplate, {
        templateType: args.emailType,
      });

      // Generate email based on type
      let emailContent: { subject: string; html: string };
      
      if (customTemplate) {
        // Use custom template and replace variables
        emailContent = {
          subject: replaceTemplateVariables(customTemplate.subject, order, emailData),
          html: replaceTemplateVariables(customTemplate.htmlContent, order, emailData),
        };
      } else {
        // Fall back to default hardcoded templates
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
