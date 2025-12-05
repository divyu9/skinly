"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

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
    const templateData = template.find((t) => t._id === args.templateId);

    if (!templateData) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    // Get provider settings
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

    // Clean phone number (remove spaces, +, etc.)
    const cleanedPhone = args.testPhoneNumber.replace(/[\s+\-()]/g, "");

    // Build test variable values
    const testVariables: Record<string, string> = {};
    if (templateData.variables && templateData.variables.length > 0) {
      templateData.variables.forEach((varName, index) => {
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

    // Prepare AuthKey API request
    // Using GET-style request (as shown in AuthKey docs)
    const baseUrl = providerSettings.apiEndpoint || "https://console.authkey.io/restapi/request.php";
    
    const params = new URLSearchParams({
      authkey: providerSettings.authKey,
      mobile: cleanedPhone,
      country_code: "91", // Default to India
      wid: templateData.providerTemplateId, // WhatsApp template ID
      ...testVariables, // Add all test variables
    });

    const url = `${baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
      });

      const responseText = await response.text();
      
      // AuthKey returns various response formats
      // Success typically includes "success":true or status 200
      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        // If not JSON, treat as plain text
        responseData = { message: responseText };
      }

      if (!response.ok) {
        console.error("AuthKey API error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
        });

        throw new ConvexError({
          message: `AuthKey API error: ${response.statusText}. Response: ${JSON.stringify(responseData)}`,
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
        message: "Test message sent successfully!",
        response: responseData,
        testVariables,
      };
    } catch (error) {
      console.error("Failed to send test message:", error);

      // If it's already a ConvexError, rethrow it
      if (error instanceof ConvexError) {
        throw error;
      }

      throw new ConvexError({
        message: `Failed to send test message: ${error instanceof Error ? error.message : "Unknown error"}`,
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});
