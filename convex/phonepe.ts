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
  const saltIndex = process.env.PHONEPE_SALT_INDEX;
  const environment = process.env.PHONEPE_ENVIRONMENT || "SANDBOX";

  if (!merchantId || !saltKey || !saltIndex) {
    throw new ConvexError({
      message:
        "PhonePe credentials not configured. Please add PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY, and PHONEPE_SALT_INDEX in Secrets tab.",
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
    saltIndex: parseInt(saltIndex),
    baseUrl,
  };
}

// Generate X-VERIFY header
function generateXVerifyHeader(
  base64Payload: string,
  endpoint: string,
  saltKey: string,
  saltIndex: number
): string {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256Hash = crypto
    .createHash("sha256")
    .update(stringToHash)
    .digest("hex");
  return `${sha256Hash}###${saltIndex}`;
}

// Initiate payment with PhonePe REST API
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

      // Generate merchant transaction ID (max 38 chars)
      // Format: orderNumber + last 6 digits of timestamp
      const timestamp = Date.now().toString().slice(-6);
      const merchantTransactionId = `${args.orderNumber}-${timestamp}`;

      // Convert amount to paise (minimum 100 paise = ₹1)
      const amountInPaise = Math.max(Math.round(args.amount * 100), 100);

      // Get site URL from environment variable
      const siteUrl = process.env.SITE_URL || "https://skinly.onhercules.app";

      // Build the payment request payload
      const payload = {
        merchantId: config.merchantId,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: args.customerPhone.replace("+", ""),
        amount: amountInPaise,
        redirectUrl: `${siteUrl}/payment/callback`,
        redirectMode: "POST",
        callbackUrl: `${siteUrl}/payment/callback`,
        mobileNumber: args.customerPhone.replace("+", ""),
        paymentInstrument: {
          type: "PAY_PAGE",
        },
      };

      // Base64 encode the payload
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
        "base64"
      );

      // Generate X-VERIFY header
      const endpoint = "/checkout/v2/pay";
      const xVerify = generateXVerifyHeader(
        base64Payload,
        endpoint,
        config.saltKey,
        config.saltIndex
      );

      console.log("PhonePe Payment Request:", {
        merchantId: config.merchantId,
        merchantTransactionId,
        amount: amountInPaise,
        endpoint: `${config.baseUrl}${endpoint}`,
      });

      // Make the API request
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
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

      const responseData = await response.json();

      console.log("PhonePe API Response:", {
        status: response.status,
        success: responseData.success,
        code: responseData.code,
        message: responseData.message,
      });

      if (!response.ok || !responseData.success) {
        throw new ConvexError({
          message: responseData.message || "Failed to initiate payment",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const data = responseData.data;
      const paymentUrl = data.instrumentResponse?.redirectInfo?.url;

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
        merchantTransactionId,
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

// Check payment status using REST API
export const checkPaymentStatus = action({
  args: {
    merchantTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const config = getPhonePeConfig();

      // Build the status check endpoint
      const endpoint = `/checkout/v2/order/${config.merchantId}/${args.merchantTransactionId}/status`;

      // Generate X-VERIFY header (for status check, no payload)
      const xVerify = generateXVerifyHeader(
        "",
        endpoint,
        config.saltKey,
        config.saltIndex
      );

      // Make the API request
      const response = await fetch(`${config.baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
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
