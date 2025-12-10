"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.d.ts";

// ============================================================================
// MSG91 EMAIL API INTEGRATION
// ============================================================================

interface MSG91SendEmailResponse {
  message: string;
  type?: string;
  request_id?: string;
}

interface MSG91ErrorResponse {
  message: string;
  type?: string;
}

/**
 * Send email via MSG91 Email API
 */
export const sendEmailViaMSG91 = action({
  args: {
    messageId: v.id("emailMessages"),
    recipientEmail: v.string(),
    msg91TemplateId: v.string(),
    subject: v.optional(v.string()),
    variables: v.optional(v.record(v.string(), v.string())),
    fromEmail: v.optional(v.string()), // Default: noreply@mail.goskinly.com
    fromName: v.optional(v.string()), // Default: Skinly
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    providerMessageId?: string;
    errorMessage?: string;
    errorType?: string;
  }> => {
    const startTime = Date.now();

    try {
      // Get MSG91 auth token from environment
      const authToken = process.env.MSG91_AUTH_TOKEN;
      if (!authToken) {
        throw new Error("MSG91_AUTH_TOKEN not configured in environment");
      }

      // Set defaults
      const fromEmail = args.fromEmail || "noreply@mail.goskinly.com";
      const fromName = args.fromName || "Skinly";

      // Build request body
      const requestBody = {
        template_id: args.msg91TemplateId,
        recipients: [
          {
            to: [
              {
                email: args.recipientEmail,
                name: args.variables?.customer_name || "",
              },
            ],
          },
        ],
        from: {
          email: fromEmail,
          name: fromName,
        },
        domain: "mail.goskinly.com",
        // Add variables if provided
        ...(args.variables && Object.keys(args.variables).length > 0
          ? { variables: args.variables }
          : {}),
      };

      const requestUrl = "https://api.msg91.com/api/v5/email/send";

      console.log(`[MSG91] Sending email to ${args.recipientEmail} with template ${args.msg91TemplateId}`);

      // Make API request
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": authToken,
        },
        body: JSON.stringify(requestBody),
      });

      const responseStatus = response.status;
      const responseBody = await response.text();
      
      let parsedResponse: MSG91SendEmailResponse | MSG91ErrorResponse;
      try {
        parsedResponse = JSON.parse(responseBody);
      } catch {
        parsedResponse = { message: responseBody };
      }

      const duration = Date.now() - startTime;

      // Log the API call for debugging
      try {
        const message = await ctx.runQuery(internal.emailWorkerInternal.getMessageById, {
          messageId: args.messageId,
        });
        
        await ctx.runMutation(internal.emailMessaging.logEmailDebug, {
          messageId: args.messageId,
          usecaseKey: message?.usecaseKey || "",
          recipientEmail: args.recipientEmail,
          templateId: args.msg91TemplateId,
          requestUrl,
          requestBody: JSON.stringify(requestBody),
          requestVariables: args.variables ? JSON.stringify(args.variables) : undefined,
          responseStatus,
          responseBody,
          success: response.ok,
          errorType: response.ok ? undefined : parseErrorType(parsedResponse, responseStatus),
          errorMessage: response.ok ? undefined : parseErrorMessage(parsedResponse),
        });
      } catch (logErr) {
        console.error("[MSG91] Failed to log debug info:", logErr);
      }

      console.log(`[MSG91] Response (${responseStatus}) in ${duration}ms:`, parsedResponse);

      // Handle success
      if (response.ok) {
        const requestId = (parsedResponse as MSG91SendEmailResponse).request_id;
        return {
          success: true,
          providerMessageId: requestId || `msg91_${Date.now()}`,
        };
      }

      // Handle errors
      const errorType = parseErrorType(parsedResponse, responseStatus);
      const errorMessage = parseErrorMessage(parsedResponse);

      console.error(`[MSG91] Error sending email:`, {
        status: responseStatus,
        errorType,
        errorMessage,
        response: parsedResponse,
      });

      return {
        success: false,
        errorType,
        errorMessage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[MSG91] Exception while sending email:`, errorMessage);

      // Log the error
      try {
        await ctx.runMutation(internal.emailMessaging.logEmailDebug, {
          messageId: args.messageId,
          usecaseKey: "",
          recipientEmail: args.recipientEmail,
          templateId: args.msg91TemplateId,
          requestUrl: "https://api.msg91.com/api/v5/email/send",
          requestBody: JSON.stringify({
            template_id: args.msg91TemplateId,
            recipient: args.recipientEmail,
          }),
          requestVariables: args.variables ? JSON.stringify(args.variables) : undefined,
          responseStatus: 0,
          responseBody: errorMessage,
          success: false,
          errorType: "network_error",
          errorMessage,
        });
      } catch (logError) {
        console.error("[MSG91] Failed to log error:", logError);
      }

      return {
        success: false,
        errorType: "network_error",
        errorMessage,
      };
    }
  },
});

/**
 * Parse error type from MSG91 response
 */
function parseErrorType(
  response: MSG91SendEmailResponse | MSG91ErrorResponse,
  statusCode: number
): string {
  // Check for specific error types in response
  if (response.type) {
    return response.type;
  }

  // Map status codes to error types
  if (statusCode === 401 || statusCode === 403) {
    return "authentication_error";
  }
  if (statusCode === 404) {
    return "template_not_found";
  }
  if (statusCode === 400) {
    return "invalid_request";
  }
  if (statusCode === 429) {
    return "rate_limit_exceeded";
  }
  if (statusCode >= 500) {
    return "server_error";
  }

  return "unknown_error";
}

/**
 * Parse error message from MSG91 response
 */
function parseErrorMessage(
  response: MSG91SendEmailResponse | MSG91ErrorResponse
): string {
  if (response.message) {
    return response.message;
  }
  return "Unknown error from MSG91";
}

/**
 * Test email template - Send a test email to verify template works
 */
export const testEmailTemplate = action({
  args: {
    usecaseKey: v.string(),
    testEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    messageId?: Id<"emailMessages">;
    testVariables: Record<string, string>;
  }> => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get the use-case configuration
    const usecase: {
      usecaseKey: string;
      displayName: string;
      enabled: boolean;
      msg91TemplateId?: string;
      templateName?: string;
    } | null = await ctx.runMutation(internal.emailMessaging.getUsecaseConfig, {
      usecaseKey: args.usecaseKey,
    });

    if (!usecase) {
      throw new ConvexError({
        message: "Use-case not found",
        code: "NOT_FOUND",
      });
    }

    if (!usecase.enabled) {
      throw new ConvexError({
        message: "Use-case is disabled",
        code: "BAD_REQUEST",
      });
    }

    if (!usecase.msg91TemplateId) {
      throw new ConvexError({
        message: "No MSG91 template ID configured for this use-case",
        code: "BAD_REQUEST",
      });
    }

    // Build test variables based on use-case
    const testVariables = buildTestVariables(args.usecaseKey);

    // Queue test email
    const result: {
      queued: boolean;
      messageId?: Id<"emailMessages">;
      queueId?: Id<"emailQueue">;
    } = await ctx.runMutation(internal.emailMessaging.queueTestEmail, {
      recipientEmail: args.testEmail,
      msg91TemplateId: usecase.msg91TemplateId,
      templateName: usecase.templateName || usecase.displayName,
      usecaseKey: args.usecaseKey,
      variables: testVariables,
    });

    if (!result.queued) {
      throw new ConvexError({
        message: "Failed to queue test email",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }

    return {
      success: true,
      message: "Test email queued! Check /backend-skinly/emails to track delivery.",
      messageId: result.messageId,
      testVariables,
    };
  },
});

/**
 * Build test variable values for a given use-case
 */
function buildTestVariables(usecaseKey: string): Record<string, string> {
  const baseVariables = {
    customer_name: "Test Customer",
    order_number: "#TEST123",
    order_total: "₹999.00",
    payment_method: "Prepaid",
  };

  switch (usecaseKey) {
    case "order_confirmed":
      return {
        ...baseVariables,
        items_list: "Carbon Fiber Skin - iPhone 15 Pro Max x1",
        shipping_address: "123 Test Street, Mumbai, Maharashtra 400001",
      };

    case "order_dispatched":
      return {
        ...baseVariables,
        tracking_number: "TEST123456789",
        tracking_link: "https://goskinly.com/track/TEST123456789",
        courier_name: "Test Courier",
        estimated_delivery: "3-5 business days",
      };

    case "order_delivered":
      return {
        ...baseVariables,
        delivery_date: new Date().toLocaleDateString("en-IN"),
        review_link: "https://goskinly.com/orders/test123",
      };

    case "order_cancelled":
      return {
        ...baseVariables,
        cancellation_reason: "Customer request",
        refund_amount: "₹999.00",
        refund_method: "Original payment method",
      };

    case "payment_failed":
      return {
        ...baseVariables,
        payment_amount: "₹999.00",
        failure_reason: "Payment gateway error",
        retry_link: "https://goskinly.com/orders/test123/payment",
      };

    case "abandoned_cart":
      return {
        customer_name: "Test Customer",
        cart_items: "Carbon Fiber Skin - iPhone 15 Pro Max x1",
        cart_total: "₹999.00",
        cart_link: "https://goskinly.com/cart",
      };

    case "back_in_stock":
      return {
        customer_name: "Test Customer",
        product_name: "Carbon Fiber Skin - iPhone 15 Pro Max",
        product_link: "https://goskinly.com/products/carbon-fiber-skin",
      };

    case "model_requested":
      return {
        customer_name: "Test Customer",
        model_name: "Samsung Galaxy S24 Ultra",
      };

    case "model_added":
      return {
        customer_name: "Test Customer",
        brand_name: "Samsung",
        model_name: "Galaxy S24 Ultra",
        shop_link: "https://goskinly.com/devices",
      };

    default:
      return baseVariables;
  }
}
