import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api.js";

const http = httpRouter();

// PhonePe webhook handler
http.route({
  path: "/api/phonepe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const data = JSON.parse(body);

      // Extract merchant transaction ID and payment status
      const merchantTransactionId = data.response?.transactionId;
      const state = data.response?.state;

      if (!merchantTransactionId || !state) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid webhook data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Map PhonePe state to our payment status
      const paymentStatus =
        state === "COMPLETED" || state === "SUCCESS"
          ? "success"
          : state === "FAILED"
            ? "failed"
            : "pending";

      // Update order payment status
      await ctx.runMutation(api.orders.updatePaymentStatus, {
        merchantTransactionId,
        paymentStatus,
      });

      return new Response(
        JSON.stringify({ success: true, message: "Webhook processed" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("PhonePe webhook error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : "Webhook error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
