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
    try {
      // Get provider settings
      const providerSettings = await ctx.runQuery(
        internal.whatsappWorkerInternal.getProviderSettings,
        {}
      );

      if (!providerSettings || !providerSettings.authKey) {
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

      // Send message
      const response = await fetch(url, {
        method: "GET",
      });

      const responseText = await response.text();
      
      // Parse response
      let responseData: { message_id?: string; msg_id?: string; success?: boolean };
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { message_id: undefined };
      }

      if (!response.ok) {
        console.error("AuthKey API error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
          url: url.replace(providerSettings.authKey, "***"), // Hide auth key in logs
        });

        throw new Error(`AuthKey API error: ${response.statusText}`);
      }

      // Extract message ID from response
      const providerMessageId = 
        (responseData.message_id as string | undefined) ?? 
        (responseData.msg_id as string | undefined) ?? 
        undefined;

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


