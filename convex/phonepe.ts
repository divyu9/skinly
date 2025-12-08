"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// PhonePe SDK types (based on official docs)
interface StandardCheckoutPayResponse {
  state: string;
  redirect_url: string;
  order_id: string;
  expire_at: string;
}

interface StandardCheckoutClient {
  pay(request: unknown): Promise<StandardCheckoutPayResponse>;
  getOrderStatus(merchantOrderId: string): Promise<{
    state: string;
    order_id: string;
    amount: number;
    // ... other fields
  }>;
}

interface PhonePeSDK {
  StandardCheckoutClient: {
    getInstance(
      merchantId: string,
      saltKey: string,
      saltIndex: number,
      environment: string
    ): StandardCheckoutClient;
  };
  StandardCheckoutPayRequest: {
    build_request(): PayRequestBuilder;
  };
}

interface PayRequestBuilder {
  merchantOrderId(id: string): PayRequestBuilder;
  amount(amount: number): PayRequestBuilder;
  redirectUrl(url: string): PayRequestBuilder;
  metaInfo(info: Record<string, string>): PayRequestBuilder;
  build(): unknown;
}

// Initialize PhonePe client
function getPhonePeClient(): StandardCheckoutClient {
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

  // Dynamic import to avoid loading in V8 runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PhonePe = require("pg-sdk-node") as PhonePeSDK;
  return PhonePe.StandardCheckoutClient.getInstance(
    merchantId,
    saltKey,
    parseInt(saltIndex),
    environment
  );
}

// Initiate payment with PhonePe
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

      const client = getPhonePeClient();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PhonePe = require("pg-sdk-node") as PhonePeSDK;

      // Generate merchant transaction ID
      const merchantTransactionId = `TXN-${args.orderNumber}-${Date.now()}`;

      // Convert amount to paise (minimum 100 paise = ₹1)
      const amountInPaise = Math.max(Math.round(args.amount * 100), 100);

      // Get site URL from environment variable
      const siteUrl = process.env.SITE_URL || "https://skinly.onhercules.app";
      
      // Build payment request (using build_request as per official docs)
      const payRequest = PhonePe.StandardCheckoutPayRequest.build_request()
        .merchantOrderId(merchantTransactionId)
        .amount(amountInPaise)
        .redirectUrl(`${siteUrl}/payment/callback`)
        .build();

      // Initiate payment
      const response = await client.pay(payRequest);

      // Response structure: { state, redirect_url, order_id, expire_at }
      if (!response || !response.redirect_url) {
        throw new ConvexError({
          message: "Failed to initiate payment - no redirect URL received",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const paymentUrl = response.redirect_url;
      const orderId = response.order_id;

      // Update order with payment details
      await ctx.runMutation(api.orders.updatePaymentDetails, {
        orderId: args.orderId,
        phonepeMerchantTransactionId: merchantTransactionId,
        phonepeTransactionId: orderId,
        phonepePaymentUrl: paymentUrl,
      });

      return {
        success: true,
        paymentUrl,
        merchantTransactionId,
        transactionId: orderId,
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

// Check payment status
export const checkPaymentStatus = action({
  args: {
    merchantTransactionId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const client = getPhonePeClient();
      const response = await client.getOrderStatus(args.merchantTransactionId);

      if (!response || !response.state) {
        throw new ConvexError({
          message: "Failed to check payment status",
          code: "EXTERNAL_SERVICE_ERROR",
        });
      }

      const { state, order_id } = response;

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
        transactionId: order_id,
        responseCode: state,
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
