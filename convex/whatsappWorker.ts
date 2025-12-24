"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const RATE_LIMIT_DELAY = 1000; // 1 second between messages

// ============================================================================
// HELPER: Clean phone number
// ============================================================================

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s+\-()]/g, "");
}

// ============================================================================
// HELPER: Extract 10-digit mobile number for AuthKey
// ============================================================================

function extractMobileNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  
  // If starts with 91 and has 12 digits, remove the country code
  if (digitsOnly.startsWith("91") && digitsOnly.length === 12) {
    return digitsOnly.substring(2); // Return last 10 digits
  }
  
  // If already 10 digits, return as is
  if (digitsOnly.length === 10) {
    return digitsOnly;
  }
  
  // Otherwise return the digits (fallback)
  return digitsOnly;
}

// ============================================================================
// ACTION: Process a single message
// ============================================================================

export const processMessage = action({
  args: {
    queueId: v.id("whatsappQueue"),
    messageId: v.id("whatsappMessages"),
    message: v.object({
      usecaseKey: v.string(),
      recipientPhone: v.string(),
      providerTemplateId: v.string(),
      templateName: v.string(),
      variables: v.optional(v.record(v.string(), v.string())),
      retryCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let debugLogData = {
      messageId: args.messageId,
      usecaseKey: args.message.usecaseKey,
      recipientPhone: args.message.recipientPhone,
      templateId: args.message.providerTemplateId,
      requestUrl: "",
      requestParams: "",
      requestVariables: "",
      responseStatus: 0,
      responseBody: "",
      success: false,
      errorType: undefined as string | undefined,
      errorMessage: undefined as string | undefined,
      suggestedFix: undefined as string | undefined,
      createdAt: now,
    };

    try {
      // Get provider settings
      const providerSettings = await ctx.runQuery(
        internal.whatsappWorkerInternal.getProviderSettings,
        {}
      );

      if (!providerSettings || !providerSettings.authKey) {
        debugLogData.errorType = "provider_not_configured";
        debugLogData.errorMessage = "WhatsApp provider not configured";
        debugLogData.suggestedFix = "Configure AuthKey API credentials in WhatsApp settings";
        throw new Error("WhatsApp provider not configured");
      }

      // Get template variables order for AuthKey numbered format
      const templateVariables = await ctx.runQuery(
        internal.whatsappWorkerInternal.getTemplateVariables,
        { providerTemplateId: args.message.providerTemplateId }
      );

      // Clean phone number for storage
      const cleanedPhone = cleanPhoneNumber(args.message.recipientPhone);
      
      // Extract 10-digit mobile number for AuthKey API
      const mobileNumber = extractMobileNumber(args.message.recipientPhone);

      // Convert named variables to AuthKey numbered format (1, 2, 3, etc.)
      const numberedVariables: Record<string, string> = {};
      if (args.message.variables && templateVariables.length > 0) {
        templateVariables.forEach((varName: string, index: number) => {
          const value = args.message.variables?.[varName];
          if (value !== undefined) {
            numberedVariables[`${index + 1}`] = value;
          }
        });
      }

      console.log("Variable conversion:", {
        templateVariables,
        inputVariables: args.message.variables,
        numberedVariables,
      });

      // Prepare API request
      const baseUrl = providerSettings.apiEndpoint || "https://console.authkey.io/restapi/request.php";
      
      const params = new URLSearchParams({
        authkey: providerSettings.authKey,
        mobile: mobileNumber, // Send only 10-digit number
        country_code: "91", // Default to India
        wid: args.message.providerTemplateId,
        ...numberedVariables, // Use numbered format (1, 2, 3)
      });

      const url = `${baseUrl}?${params.toString()}`;
      const maskedUrl = url.replace(providerSettings.authKey, "***AUTHKEY***");

      // Store request details
      debugLogData.requestUrl = maskedUrl;
      debugLogData.requestParams = JSON.stringify({
        mobile: mobileNumber,
        country_code: "91",
        wid: args.message.providerTemplateId,
        ...numberedVariables,
      });
      debugLogData.requestVariables = JSON.stringify({
        named: args.message.variables,
        numbered: numberedVariables,
      });

      // Send message
      const response = await fetch(url, {
        method: "GET",
      });

      const responseText = await response.text();
      debugLogData.responseStatus = response.status;
      debugLogData.responseBody = responseText;
      
      // Parse response
      let responseData: { 
        message_id?: string; 
        msg_id?: string; 
        success?: boolean;
        error?: string;
        message?: string;
        status?: string;
      };
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { message_id: undefined };
      }

      // Parse AuthKey response for errors
      const responseBodyLower = responseText.toLowerCase();
      
      if (!response.ok || responseBodyLower.includes("error") || responseBodyLower.includes("fail")) {
        // Detect specific error types
        if (responseBodyLower.includes("invalid") && responseBodyLower.includes("authkey")) {
          debugLogData.errorType = "invalid_authkey";
          debugLogData.errorMessage = "Invalid AuthKey API credentials";
          debugLogData.suggestedFix = "Check your AuthKey API key in secrets/settings";
        } else if (responseBodyLower.includes("template") && (responseBodyLower.includes("not found") || responseBodyLower.includes("not approved"))) {
          debugLogData.errorType = "template_not_found";
          debugLogData.errorMessage = "Template not found or not approved";
          debugLogData.suggestedFix = "Verify template ID is correct and approved in AuthKey dashboard";
        } else if (responseBodyLower.includes("invalid") && responseBodyLower.includes("mobile")) {
          debugLogData.errorType = "invalid_phone";
          debugLogData.errorMessage = "Invalid phone number format";
          debugLogData.suggestedFix = "Check phone number format (should be 10 digits)";
        } else if (responseBodyLower.includes("balance") || responseBodyLower.includes("insufficient")) {
          debugLogData.errorType = "insufficient_balance";
          debugLogData.errorMessage = "Insufficient balance in AuthKey account";
          debugLogData.suggestedFix = "Add balance to your AuthKey account";
        } else if (responseBodyLower.includes("rate") && responseBodyLower.includes("limit")) {
          debugLogData.errorType = "rate_limit";
          debugLogData.errorMessage = "Rate limit exceeded";
          debugLogData.suggestedFix = "Wait before sending more messages or upgrade AuthKey plan";
        } else if (responseBodyLower.includes("variable")) {
          debugLogData.errorType = "variable_mismatch";
          debugLogData.errorMessage = "Template variable count mismatch";
          debugLogData.suggestedFix = "Check that template variables match what's being sent";
        } else {
          debugLogData.errorType = "unknown_error";
          debugLogData.errorMessage = responseData.error || responseData.message || response.statusText;
          debugLogData.suggestedFix = "Check AuthKey dashboard or response details for more info";
        }

        console.error("AuthKey API error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
          errorType: debugLogData.errorType,
          url: maskedUrl,
        });

        // Save debug log before throwing
        await ctx.runMutation(internal.whatsappWorkerInternal.createDebugLog, debugLogData);

        throw new Error(debugLogData.errorMessage || `AuthKey API error: ${response.statusText}`);
      }

      // Success
      debugLogData.success = true;

      // Extract message ID from response
      const providerMessageId = 
        (responseData.message_id as string | undefined) ?? 
        (responseData.msg_id as string | undefined) ?? 
        undefined;

      // Save debug log
      await ctx.runMutation(internal.whatsappWorkerInternal.createDebugLog, debugLogData);

      // Mark as sent
      await ctx.runMutation(internal.whatsappWorkerInternal.markAsSent, {
        queueId: args.queueId,
        messageId: args.messageId,
        providerMessageId,
      });

      console.log(`Message sent successfully:`, {
        messageId: args.messageId,
        usecaseKey: args.message.usecaseKey,
        providerMessageId,
      });

      return { success: true, providerMessageId };
    } catch (error) {
      console.error("Failed to send message:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // If debug log wasn't created yet, create it now
      if (!debugLogData.errorType) {
        debugLogData.errorType = "unknown_error";
        debugLogData.errorMessage = errorMessage;
        debugLogData.suggestedFix = "Check error details and AuthKey dashboard";
        await ctx.runMutation(internal.whatsappWorkerInternal.createDebugLog, debugLogData);
      }

      // Mark as failed (will retry if under max attempts)
      await ctx.runMutation(internal.whatsappWorkerInternal.markAsFailed, {
        queueId: args.queueId,
        messageId: args.messageId,
        errorMessage,
        attempts: args.message.retryCount + 1,
      });

      return { success: false, error: errorMessage };
    }
  },
});

// ============================================================================
// ACTION: Worker - Process queue
// ============================================================================

export const processQueue = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 10;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      for (let i = 0; i < batchSize; i++) {
        // Get next message
        const next = await ctx.runQuery(
          internal.whatsappWorkerInternal.getNextPendingMessage,
          {}
        );

        if (!next) {
          // No more messages
          break;
        }

        // Mark as processing
        await ctx.runMutation(internal.whatsappWorkerInternal.markAsProcessing, {
          queueId: next.queueId,
        });

        // Process message
        const result = await ctx.runAction(api.whatsappWorker.processMessage, {
          queueId: next.queueId,
          messageId: next.messageId,
          message: {
            usecaseKey: next.message.usecaseKey,
            recipientPhone: next.message.recipientPhone,
            providerTemplateId: next.message.providerTemplateId,
            templateName: next.message.templateName,
            variables: next.message.variables,
            retryCount: next.message.retryCount,
          },
        });

        processed++;
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }

        // Rate limiting - wait between messages
        if (i < batchSize - 1) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
      }

      return {
        processed,
        succeeded,
        failed,
      };
    } catch (error) {
      console.error("Worker error:", error);
      return {
        processed,
        succeeded,
        failed,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});


