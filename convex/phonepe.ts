"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// PhonePe API Configuration
function getPhonePeConfig() {
  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const environment = process.env.PHONEPE_ENVIRONMENT || "SANDBOX";

  if (!merchantId || !saltKey) {
    throw new ConvexError({
      message:
        "PhonePe credentials not configured. Please add PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY in Secrets tab.",
      code: "BAD_REQUEST",
    });
  }

  const baseUrl =
    environment === "PRODUCTION"
      ? "https://api.phonepe.com/apis/pg"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  return {
    merchantId,
    saltKey,
    baseUrl,
  };
}

// Generate OAuth access token for Standard Checkout v2
async function getAccessToken(
  merchantId: string,
  saltKey: string,
  baseUrl: string
): Promise<string> {
  const tokenEndpoint = `${baseUrl}/v1/oauth/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: merchantId,
      clientSecret: saltKey,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.accessToken) {
    console.error("Token generation failed:", data);
    throw new ConvexError({
      message: data.message || "Failed to generate access token",
      code: "EXTERNAL_SERVICE_ERROR",
    });
  }

  return data.accessToken;
}

// Initiate payment with PhonePe Standard Checkout v2
export const initiatePayment = action({
  args: {
    orderId: v.id("orders"),
    orderNumber: v.string(),
    amount: v.number(), // in rupees
    customerPhone: v.string(),
  },
  handler: async (ctx, args) => {
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

      // Step 1: Get OAuth access token
      console.log("Getting PhonePe access token...");
      const accessToken = await getAccessToken(
        config.merchantId,
        config.saltKey,
        config.baseUrl
      );

      // Generate merchant order ID (max 63 chars for Standard Checkout)
      const merchantOrderId = args.orderNumber;

      // Convert amount to paise (minimum 100 paise = ₹1)
      const amountInPaise = Math.max(Math.round(args.amount * 100), 100);

      // Get site URL from environment variable
      const siteUrl = process.env.SITE_URL || "https://skinly.onhercules.app";

      // Step 2: Build the Standard Checkout v2 payment request
      const payload = {
        merchantOrderId: merchantOrderId,
        amount: amountInPaise,
        expireAfter: 1200, // 20 minutes expiry
        paymentFlow: {
          type: "PG_CHECKOUT",
          merchantUrls: {
            redirectUrl: `${siteUrl}/payment/callback`,
          },
        },
      };

      const endpoint = "/checkout/v2/pay";

      console.log("PhonePe Payment Request:", {
        merchantOrderId,
        amount: amountInPaise,
        endpoint: `${config.baseUrl}${endpoint}`,
      });

      // Make the API request with Bearer token
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      console.log("PhonePe API Response:", {
        status: response.status,
        success: responseData.success,
        message: responseData.message,
      });

      if (!response.ok || !responseData.success) {
        throw new ConvexError({
          message: responseData.message || "Failed to initiate payment",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const data = responseData.data;
      const paymentUrl = data.redirectUrl;

      if (!paymentUrl) {
        throw new ConvexError({
          message: "No payment URL received from PhonePe",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      // Update order with payment details
      await ctx.runMutation(api.orders.updatePaymentDetails, {
        orderId: args.orderId,
        phonepeMerchantTransactionId: merchantOrderId,
        phonepeTransactionId: merchantOrderId,
        phonepePaymentUrl: paymentUrl,
      });

      return {
        success: true,
        paymentUrl,
        merchantTransactionId: merchantOrderId,
        transactionId: merchantOrderId,
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

// Check payment status using Standard Checkout v2
export const checkPaymentStatus = action({
  args: {
    merchantTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const config = getPhonePeConfig();

      // Get OAuth access token
      const accessToken = await getAccessToken(
        config.merchantId,
        config.saltKey,
        config.baseUrl
      );

      // Build the status check endpoint
      const endpoint = `/checkout/v2/order/${args.merchantTransactionId}/status`;

      // Make the API request with Bearer token
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          accept: "application/json",
        },
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new ConvexError({
          message: responseData.message || "Failed to check payment status",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const data = responseData.data;
      const state = data.state;

      // Map PhonePe states to our payment status
      const paymentStatus =
        state === "COMPLETED" || state === "SUCCESS"
          ? "success"
          : state === "FAILED"
            ? "failed"
            : "pending";

      return {
        success: true,
        paymentStatus,
        state,
        transactionId: args.merchantTransactionId,
        responseCode: data.responseCode || state,
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
