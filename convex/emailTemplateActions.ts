"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api.js";

/**
 * Send a test email to admin with preview template
 */
export const sendTestEmail = action({
  args: {
    templateId: v.id("emailTemplates"),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError({
          message: "User not logged in",
          code: "UNAUTHENTICATED",
        });
      }

      // Get the template via internal query
      const template = await ctx.runQuery(internal.emailActionsInternal.getTemplateById, {
        templateId: args.templateId,
      });

      if (!template) {
        throw new ConvexError({
          message: "Template not found",
          code: "NOT_FOUND",
        });
      }

      // Get Resend API key
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        throw new ConvexError({
          message: "RESEND_API_KEY not configured",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Replace variables with sample data
      const sampleVariables: Record<string, string> = {
        customer_name: "John Doe",
        order_id: "k1234567890",
        order_number: "ORD-12345",
        order_date: new Date().toLocaleDateString("en-IN"),
        order_total: "₹999.00",
        items_list:
          "iPhone 14 Pro Skin (Matte Black) - Qty: 1 - ₹899.00<br>MacBook Pro Skin (Carbon Fiber) - Qty: 1 - ₹100.00",
        shipping_address:
          "John Doe<br>123 Main Street<br>Apartment 4B<br>Mumbai, Maharashtra 400001",
        payment_method: "PhonePe",
        tracking_link: "https://tracking.example.com/AWB123456",
        tracking_number: "AWB123456",
        courier_name: "DTDC Surface",
        estimated_delivery: "3-5 business days",
        delivery_date: new Date().toLocaleDateString("en-IN"),
        review_link: "https://skinly.com/orders/k1234567890",
        cancellation_reason: "Customer request",
        refund_amount: "₹999.00",
        refund_method: "Original payment method",
        payment_amount: "₹999.00",
        failure_reason: "Insufficient funds",
        retry_link: "https://skinly.com/orders/k1234567890/payment",
      };

      let processedSubject = template.subject;
      let processedHtml = template.htmlContent;

      // Replace all variables
      for (const [key, value] of Object.entries(sampleVariables)) {
        const regex = new RegExp(`{{${key}}}`, "g");
        processedSubject = processedSubject.replace(regex, value);
        processedHtml = processedHtml.replace(regex, value);
      }

      // Send test email via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Skinly <orders@skinly.com>",
          to: [args.recipientEmail],
          subject: `[TEST] ${processedSubject}`,
          html: processedHtml,
        }),
      });

      const responseData: { id?: string; message?: string } =
        await response.json();

      if (!response.ok) {
        throw new ConvexError({
          message: `Resend API error: ${responseData.message || response.statusText}`,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      console.log("Test email sent successfully:", {
        templateId: args.templateId,
        recipientEmail: args.recipientEmail,
        messageId: responseData.id,
      });

      return { success: true, messageId: responseData.id };
    } catch (error) {
      console.error("Failed to send test email:", error);

      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError({
        message: error instanceof Error ? error.message : "Unknown error",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});
