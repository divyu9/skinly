"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const RATE_LIMIT_DELAY = 1000; // 1 second between emails
const MSG91_EMAIL_API_ENDPOINT = "https://control.msg91.com/api/v5/email/send";

// ============================================================================
// ACTION: Process a single email message
// ============================================================================

export const processMessage = action({
  args: {
    queueId: v.id("emailQueue"),
    messageId: v.id("emailMessages"),
    message: v.object({
      usecaseKey: v.string(),
      recipientEmail: v.string(),
      msg91TemplateId: v.string(),
      templateName: v.string(),
      subject: v.optional(v.string()),
      variables: v.optional(v.record(v.string(), v.string())),
      retryCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let debugLogData = {
      messageId: args.messageId,
      usecaseKey: args.message.usecaseKey,
      recipientEmail: args.message.recipientEmail,
      templateId: args.message.msg91TemplateId,
      requestUrl: MSG91_EMAIL_API_ENDPOINT,
      requestBody: "",
      requestVariables: "",
      responseStatus: 0,
      responseBody: "",
      success: false,
      errorType: undefined as string | undefined,
      errorMessage: undefined as string | undefined,
      createdAt: now,
    };

    try {
      // Get MSG91 auth token from environment
      const authToken = process.env.MSG91_AUTH_TOKEN;
      if (!authToken) {
        debugLogData.errorType = "provider_not_configured";
        debugLogData.errorMessage = "MSG91_AUTH_TOKEN not configured in secrets";
        throw new Error("MSG91_AUTH_TOKEN not configured");
      }

      // Get template variables (if stored)
      const templateVariables = await ctx.runQuery(
        internal.emailWorkerInternal.getTemplateVariables,
        { msg91TemplateId: args.message.msg91TemplateId }
      );

      // Prepare request body for MSG91 Email API
      const requestBody = {
        template_id: args.message.msg91TemplateId,
        recipients: [
          {
            to: [
              {
                email: args.message.recipientEmail,
                name: args.message.variables?.customer_name || "",
              }
            ],
            variables: args.message.variables || {},
          }
        ],
        from: {
          email: "noreply@mail.goskinly.com",
          name: "Skinly",
        },
        domain: "mail.goskinly.com",
        // Note: When using template_id, the subject is defined in the template
        // and should NOT be sent in the request body
      };

      // Store request details
      debugLogData.requestBody = JSON.stringify(requestBody);
      debugLogData.requestVariables = JSON.stringify(args.message.variables || {});

      console.log("Sending email via MSG91:", {
        templateId: args.message.msg91TemplateId,
        recipient: args.message.recipientEmail,
        variables: args.message.variables,
      });

      // Send email via MSG91 API
      const response = await fetch(MSG91_EMAIL_API_ENDPOINT, {
        method: "POST",
        headers: {
          "authkey": authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      debugLogData.responseStatus = response.status;
      debugLogData.responseBody = responseText;
      
      // Parse response
      let responseData: { 
        message?: string;
        type?: string;
        request_id?: string;
        error?: string;
        data?: {
          request_id?: string;
        };
      };
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {};
      }

      // Check for errors
      const responseBodyLower = responseText.toLowerCase();
      
      if (!response.ok || responseBodyLower.includes("error") || responseBodyLower.includes("fail")) {
        // Detect specific error types
        if (responseBodyLower.includes("invalid") && (responseBodyLower.includes("authkey") || responseBodyLower.includes("auth"))) {
          debugLogData.errorType = "invalid_auth_token";
          debugLogData.errorMessage = "Invalid MSG91 auth token";
        } else if (responseBodyLower.includes("template") && (responseBodyLower.includes("not found") || responseBodyLower.includes("invalid"))) {
          debugLogData.errorType = "template_not_found";
          debugLogData.errorMessage = "Template not found or not approved";
        } else if (responseBodyLower.includes("email") && responseBodyLower.includes("invalid")) {
          debugLogData.errorType = "invalid_email";
          debugLogData.errorMessage = "Invalid email address format";
        } else if (responseBodyLower.includes("balance") || responseBodyLower.includes("insufficient")) {
          debugLogData.errorType = "insufficient_balance";
          debugLogData.errorMessage = "Insufficient balance in MSG91 account";
        } else if (responseBodyLower.includes("rate") && responseBodyLower.includes("limit")) {
          debugLogData.errorType = "rate_limit";
          debugLogData.errorMessage = "Rate limit exceeded";
        } else if (responseBodyLower.includes("domain") && (responseBodyLower.includes("not verified") || responseBodyLower.includes("invalid"))) {
          debugLogData.errorType = "domain_not_verified";
          debugLogData.errorMessage = "Sending domain not verified in MSG91";
        } else {
          debugLogData.errorType = "unknown_error";
          debugLogData.errorMessage = responseData.error || responseData.message || response.statusText || "Unknown error";
        }

        console.error("MSG91 API error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
          errorType: debugLogData.errorType,
        });

        // Save debug log before throwing
        await ctx.runMutation(internal.emailWorkerInternal.createDebugLog, debugLogData);

        throw new Error(debugLogData.errorMessage || `MSG91 API error: ${response.statusText}`);
      }

      // Success
      debugLogData.success = true;

      // Extract message/request ID from response
      const providerMessageId = 
        responseData.request_id ??
        responseData.data?.request_id ??
        undefined;

      // Save debug log
      await ctx.runMutation(internal.emailWorkerInternal.createDebugLog, debugLogData);

      // Mark as sent
      await ctx.runMutation(internal.emailWorkerInternal.markAsSent, {
        queueId: args.queueId,
        messageId: args.messageId,
        providerMessageId,
      });

      console.log(`Email sent successfully:`, {
        messageId: args.messageId,
        usecaseKey: args.message.usecaseKey,
        providerMessageId,
      });

      return { success: true, providerMessageId };
    } catch (error) {
      console.error("Failed to send email:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // If debug log wasn't created yet, create it now
      if (!debugLogData.errorType) {
        debugLogData.errorType = "unknown_error";
        debugLogData.errorMessage = errorMessage;
        await ctx.runMutation(internal.emailWorkerInternal.createDebugLog, debugLogData);
      }

      // Mark as failed (will retry if under max attempts)
      await ctx.runMutation(internal.emailWorkerInternal.markAsFailed, {
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
          internal.emailWorkerInternal.getNextPendingMessage,
          {}
        );

        if (!next) {
          // No more messages
          break;
        }

        // Mark as processing
        await ctx.runMutation(internal.emailWorkerInternal.markAsProcessing, {
          queueId: next.queueId,
        });

        // Process message
        const result = await ctx.runAction(api.emailWorker.processMessage, {
          queueId: next.queueId,
          messageId: next.messageId,
          message: {
            usecaseKey: next.message.usecaseKey,
            recipientEmail: next.message.recipientEmail,
            msg91TemplateId: next.message.msg91TemplateId,
            templateName: next.message.templateName,
            subject: next.message.subject,
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
      console.error("Email worker error:", error);
      return {
        processed,
        succeeded,
        failed,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
