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

      // Clean phone number
      const cleanedPhone = cleanPhoneNumber(args.message.recipientPhone);

      // Prepare API request
      const baseUrl = providerSettings.apiEndpoint || "https://console.authkey.io/restapi/request.php";
      
      const params = new URLSearchParams({
        authkey: providerSettings.authKey,
        mobile: cleanedPhone,
        country_code: "91", // Default to India
        wid: args.message.providerTemplateId,
        ...(args.message.variables ?? {}), // Spread variables as query params
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


