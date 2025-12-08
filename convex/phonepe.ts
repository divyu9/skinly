"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import crypto from "crypto";

// PhonePe API Configuration
function getPhonePeConfig() {
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
  const environment = process.env.PHONEPE_ENVIRONMENT || "PRODUCTION";

  if (!merchantId || !saltKey) {
    throw new ConvexError({
      message:
        "PhonePe credentials not configured. Please add PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY in Secrets tab.",
      code: "BAD_REQUEST",
    });
  }

  // v1 base URL for payment initiation
  const v1BaseUrl =
    environment === "PRODUCTION"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  // v2 base URL for status checks
  const v2BaseUrl =
    environment === "PRODUCTION"
      ? "https://api.phonepe.com"
      : "https://api-preprod.phonepe.com";

  return {
    merchantId,
    saltKey,
    saltIndex,
    v1BaseUrl,
    v2BaseUrl,
  };
}

// Generate X-VERIFY header for signature-based authentication
function generateXVerify(
  base64Payload: string,
  endpoint: string,
  saltKey: string,
  saltIndex: string
): string {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256Hash = crypto
    .createHash("sha256")
    .update(stringToHash)
    .digest("hex");
  return `${sha256Hash}###${saltIndex}`;
}

// Initiate payment with PhonePe Standard Checkout v1
export const initiatePayment = action({
  args: {
    orderId: v.id("orders"),
    orderNumber: v.string(),
    amount: v.number(), // in rupees
    customerPhone: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    paymentUrl: string;
    merchantTransactionId: string;
    transactionId: string;
  }> => {
    try {
      // Get order details
      const order = await ctx.runQuery(api.orders.getOrder, {
        orderId: args.orderId,
      });

      if (!order) {
        throw new ConvexError({
          message: "Order not found",
          code: "NOT_FOUND",
        });
      }

      const config = getPhonePeConfig();

      // Generate merchant transaction ID (max 38 chars)
      const timestamp = Date.now();
      const last6 = timestamp.toString().slice(-6);
      const merchantTransactionId = `${args.orderNumber}-${last6}`;

      // Convert amount to paise (minimum 100 paise = ₹1)
      const amountInPaise = Math.max(Math.round(args.amount * 100), 100);

      // Get site URL from environment variable
      const siteUrl = process.env.SITE_URL || "https://skinly.onhercules.app";

      // Build the payment request payload
      const paymentPayload: {
        merchantId: string;
        merchantTransactionId: string;
        merchantUserId: string;
        amount: number;
        redirectUrl: string;
        redirectMode: string;
        callbackUrl: string;
        mobileNumber: string;
        paymentInstrument: {
          type: string;
        };
      } = {
        merchantId: config.merchantId,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: order.userId || "GUEST_USER",
        amount: amountInPaise,
        redirectUrl: `${siteUrl}/payment/callback`,
        redirectMode: "REDIRECT",
        callbackUrl: `${siteUrl}/payment/callback`,
        mobileNumber: args.customerPhone,
        paymentInstrument: {
          type: "PAY_PAGE",
        },
      };

      // Base64 encode the payload
      const base64Payload: string = Buffer.from(
        JSON.stringify(paymentPayload)
      ).toString("base64");

      // API endpoint
      const endpoint = "/pg/v1/pay";

      // Generate X-VERIFY header
      const xVerify = generateXVerify(
        base64Payload,
        endpoint,
        config.saltKey,
        config.saltIndex
      );

      console.log("PhonePe Payment Request:", {
        merchantTransactionId,
        amount: amountInPaise,
        endpoint: `${config.v1BaseUrl}${endpoint}`,
      });

      // Make the API request
      const response: Response = await fetch(`${config.v1BaseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          accept: "application/json",
        },
        body: JSON.stringify({
          request: base64Payload,
        }),
      });

      const responseData: {
        success: boolean;
        code?: string;
        message?: string;
        data?: {
          instrumentResponse?: {
            redirectInfo?: {
              url?: string;
            };
          };
        };
      } = await response.json();

      console.log("PhonePe API Response:", {
        status: response.status,
        success: responseData.success,
        code: responseData.code,
        message: responseData.message,
      });

      if (!response.ok || !responseData.success) {
        throw new ConvexError({
          message:
            responseData.message || responseData.code || "Payment initiation failed",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const data = responseData.data;
      const paymentUrl: string | undefined =
        data?.instrumentResponse?.redirectInfo?.url;

      if (!paymentUrl) {
        throw new ConvexError({
          message: "No payment URL received from PhonePe",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Update order with payment details
      await ctx.runMutation(api.orders.updatePaymentDetails, {
        orderId: args.orderId,
        phonepeMerchantTransactionId: merchantTransactionId,
        phonepeTransactionId: merchantTransactionId,
        phonepePaymentUrl: paymentUrl,
      });

      return {
        success: true,
        paymentUrl,
        merchantTransactionId: merchantTransactionId,
        transactionId: merchantTransactionId,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to initiate PhonePe payment",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});

// Generate OAuth Bearer token for v2 API
async function getOAuthToken(
  merchantId: string,
  saltKey: string,
  saltIndex: string,
  baseUrl: string
): Promise<string> {
  // Generate token request
  const timestamp = Date.now();
  const payload = `${merchantId}${timestamp}${saltKey}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  const token = `${hash}###${saltIndex}`;
  
  return token;
}

// Check payment status using Standard Checkout v2
export const checkPaymentStatus = action({
  args: {
    merchantTransactionId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    paymentStatus: string;
    state: string;
    transactionId: string;
    responseCode: string;
  }> => {
    try {
      const config = getPhonePeConfig();

      // Get OAuth token
      const authToken = await getOAuthToken(
        config.merchantId,
        config.saltKey,
        config.saltIndex,
        config.v2BaseUrl
      );

      // Build the v2 status check endpoint
      const endpoint = `/apis/pg/checkout/v2/order/${args.merchantTransactionId}/status`;
      const fullUrl = `${config.v2BaseUrl}${endpoint}`;

      console.log("Checking payment status (v2):", {
        merchantTransactionId: args.merchantTransactionId,
        endpoint: fullUrl,
      });

      // Make the API request with v2 authentication
      const response: Response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `O-Bearer ${authToken}`,
          "X-MERCHANT-ID": config.merchantId,
          "accept": "application/json",
        },
      });

      const responseData: {
        success: boolean;
        code?: string;
        message?: string;
        data?: {
          state?: string;
          responseCode?: string;
          transactionId?: string;
          merchantTransactionId?: string;
        };
      } = await response.json();

      console.log("PhonePe v2 Status Response (Full):", {
        status: response.status,
        success: responseData.success,
        code: responseData.code,
        message: responseData.message,
        data: responseData.data,
      });

      if (!response.ok || !responseData.success) {
        const errorMessage = responseData.message 
          ? `${responseData.code}: ${responseData.message}`
          : responseData.code || "Status check failed";
        
        console.error("PhonePe v2 Status Check Failed:", {
          error: errorMessage,
          merchantTransactionId: args.merchantTransactionId,
          endpoint,
          responseStatus: response.status
        });
        
        throw new ConvexError({
          message: errorMessage,
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const data = responseData.data;
      const code = data?.responseCode || responseData.code || "UNKNOWN";

      // Map PhonePe response codes to payment status
      const paymentStatus =
        code === "PAYMENT_SUCCESS"
          ? "success"
          : code === "PAYMENT_ERROR" ||
              code === "PAYMENT_DECLINED" ||
              code === "PAYMENT_CANCELLED"
            ? "failed"
            : "pending";

      // Update order payment status in database (for success or failed, not pending)
      if (paymentStatus === "success" || paymentStatus === "failed") {
        await ctx.runMutation(api.orders.updatePaymentStatus, {
          merchantTransactionId: args.merchantTransactionId,
          paymentStatus,
        });
      }

      return {
        success: true,
        paymentStatus,
        state: data?.state || "UNKNOWN",
        transactionId: data?.transactionId || data?.merchantTransactionId || args.merchantTransactionId,
        responseCode: code,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to check payment status",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  },
});
