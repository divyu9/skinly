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

// RapidShyp webhook handler for tracking updates
http.route({
  path: "/api/rapidshyp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const data = JSON.parse(body);

      // Extract tracking information
      // Note: Adjust field names based on actual RapidShyp webhook payload
      const awbNumber = data.awb_number || data.tracking_number;
      const status = data.status || data.shipment_status;
      const trackingUpdate = data.tracking_update || data.scan_details;

      if (!awbNumber) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid webhook data" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Find order by AWB number
      const orders = await ctx.runQuery(api.admin.orders.getAllOrders, {});
      const order = orders.find((o) => o.awbNumber === awbNumber);

      if (!order) {
        return new Response(
          JSON.stringify({ success: false, message: "Order not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Update shipping status
      await ctx.runMutation(api.admin.orders.updateShippingInfo, {
        orderId: order._id,
        shippingStatus: status || trackingUpdate,
      });

      // Auto-update order status based on shipping status
      if (status) {
        const statusLower = status.toLowerCase();
        let newOrderStatus = order.status;

        if (statusLower.includes("picked") || statusLower.includes("pickup")) {
          newOrderStatus = "processing";
        } else if (
          statusLower.includes("in transit") ||
          statusLower.includes("shipped")
        ) {
          newOrderStatus = "shipped";
        } else if (
          statusLower.includes("out for delivery") ||
          statusLower.includes("delivery")
        ) {
          newOrderStatus = "shipped";
        } else if (
          statusLower.includes("delivered") ||
          statusLower.includes("complete")
        ) {
          newOrderStatus = "delivered";
        }

        if (newOrderStatus !== order.status) {
          await ctx.runMutation(api.admin.orders.updateOrderStatus, {
            orderId: order._id,
            status: newOrderStatus,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Webhook processed" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("RapidShyp webhook error:", error);
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
