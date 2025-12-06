"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api.js";

// ============================================================================
// TEST TEMPLATE - Send a test message to verify template works
// ============================================================================

export const testTemplate = action({
  args: {
    templateId: v.id("whApprovedTemplates"),
    testPhoneNumber: v.string(), // Phone number to send test message to
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get the template
    const template = await ctx.runQuery(api.whatsapp.getAllTemplates, {});
    const templateData = template.find((t: { _id: string }) => t._id === args.templateId);

    if (!templateData) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    // Get provider settings to verify it's configured
    const providerSettings = await ctx.runQuery(
      api.whatsapp.getWhatsAppProviderSettings,
      {}
    );

    if (!providerSettings || !providerSettings.authKey) {
      throw new ConvexError({
        message: "WhatsApp provider not configured. Please set up provider settings first.",
        code: "NOT_FOUND",
      });
    }

    // Build test variable values
    const testVariables: Record<string, string> = {};
    if (templateData.variables && templateData.variables.length > 0) {
      templateData.variables.forEach((varName: string, index: number) => {
        // Provide sensible test values for common variable names
        if (varName.toLowerCase().includes("name")) {
          testVariables[varName] = "Test User";
        } else if (varName.toLowerCase().includes("order")) {
          testVariables[varName] = "TEST123";
        } else if (varName.toLowerCase().includes("amount") || varName.toLowerCase().includes("price")) {
          testVariables[varName] = "₹999";
        } else if (varName.toLowerCase().includes("date")) {
          testVariables[varName] = new Date().toLocaleDateString("en-IN");
        } else if (varName.toLowerCase().includes("time")) {
          testVariables[varName] = new Date().toLocaleTimeString("en-IN");
        } else if (varName.toLowerCase().includes("otp") || varName.toLowerCase().includes("code")) {
          testVariables[varName] = "123456";
        } else {
          testVariables[varName] = `TestValue${index + 1}`;
        }
      });
    }

    // Queue the test message through the proper system
    const result: {
      queued: boolean;
      messageId?: string;
      queueId?: string;
    } = await ctx.runMutation(internal.whatsappMessaging.queueTestMessage, {
      recipientPhone: args.testPhoneNumber,
      providerTemplateId: templateData.providerTemplateId,
      templateName: templateData.templateName,
      variables: testVariables,
    });

    if (!result.queued) {
      throw new ConvexError({
        message: "Failed to queue test message",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }

    // Update template verification status
    await ctx.runMutation(api.whatsapp.updateTemplate, {
      templateId: args.templateId,
      status: "active",
    });

    return {
      success: true,
      message: "Test message queued! Check /admin/whatsapp/messages to track delivery.",
      messageId: result.messageId,
      testVariables,
    };
  },
});
