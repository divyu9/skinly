import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";

// Internal mutation to process RapidShyp webhook updates
export const processWebhookUpdate = internalMutation({
  args: {
    awbNumber: v.string(),
    status: v.optional(v.string()),
    trackingUpdate: v.optional(v.string()),
    rawPayload: v.string(),
  },
  handler: async (ctx, args) => {
    // Find order by AWB number
    const allOrders = await ctx.db.query("orders").collect();
    const order = allOrders.find((o) => o.awbNumber === args.awbNumber);

    if (!order) {
      console.error(`Order not found for AWB: ${args.awbNumber}`);
      throw new ConvexError({
        message: "Order not found for AWB number",
        code: "NOT_FOUND",
      });
    }

    // Log webhook for debugging
    console.log("=== RapidShyp Webhook Processing ===");
    console.log("Order:", order.orderNumber);
    console.log("AWB:", args.awbNumber);
    console.log("Status from webhook:", args.status);
    console.log("Current order status:", order.status);

    // Update shipping status if provided
    if (args.status || args.trackingUpdate) {
      await ctx.db.patch(order._id, {
        shippingStatus: args.status || args.trackingUpdate || order.shippingStatus,
      });
    }

    // Map RapidShyp status to order status
    if (args.status) {
      const statusLower = args.status.toLowerCase();
      let newOrderStatus = order.status;
      let shouldUpdateStatus = false;

      // RapidShyp status mapping based on their webhook documentation
      // Common statuses: "Pickup Scheduled", "Picked Up", "In Transit", "Out For Delivery", 
      // "Delivered", "RTO Initiated", "RTO In Transit", "RTO Delivered", "Cancelled"
      
      if (
        statusLower.includes("pickup scheduled") ||
        statusLower.includes("pickup pending") ||
        statusLower.includes("manifest")
      ) {
        // Pickup scheduled - keep as processing
        newOrderStatus = "processing";
        shouldUpdateStatus = order.status !== "processing";
      } else if (
        statusLower.includes("picked") ||
        statusLower.includes("pickup") ||
        statusLower.includes("forward")
      ) {
        // Picked up - move to shipped
        newOrderStatus = "shipped";
        shouldUpdateStatus = order.status === "processing";
      } else if (
        statusLower.includes("in transit") ||
        statusLower.includes("shipped") ||
        statusLower.includes("intransit")
      ) {
        // In transit - ensure shipped
        newOrderStatus = "shipped";
        shouldUpdateStatus = order.status === "processing";
      } else if (
        statusLower.includes("out for delivery") ||
        statusLower.includes("reached destination") ||
        statusLower.includes("delivery")
      ) {
        // Out for delivery - keep as shipped
        newOrderStatus = "shipped";
        shouldUpdateStatus = order.status === "processing";
      } else if (
        statusLower.includes("delivered") ||
        statusLower.includes("complete")
      ) {
        // Delivered successfully
        newOrderStatus = "delivered";
        shouldUpdateStatus = order.status !== "delivered";
      } else if (
        statusLower.includes("rto") ||
        statusLower.includes("return") ||
        statusLower.includes("return to origin") ||
        statusLower.includes("undelivered")
      ) {
        // RTO - return to origin
        newOrderStatus = "rto";
        shouldUpdateStatus = order.status !== "rto" && order.status !== "cancelled";
      } else if (
        statusLower.includes("cancelled") ||
        statusLower.includes("cancel")
      ) {
        // Shipment cancelled
        newOrderStatus = "cancelled";
        shouldUpdateStatus = order.status !== "cancelled" && order.status !== "rto";
      }

      // Update order status if it should change
      if (shouldUpdateStatus && newOrderStatus !== order.status) {
        console.log(`Updating order status from ${order.status} to ${newOrderStatus}`);
        await ctx.db.patch(order._id, { status: newOrderStatus });

        // Handle delivered status - credit cashback if not already done
        if (newOrderStatus === "delivered" && !order.cashbackCredited && order.cashbackAmount) {
          const user = await ctx.db.get(order.userId);
          if (user) {
            const currentBalance = user.walletBalance || 0;
            const newBalance = currentBalance + order.cashbackAmount;

            await ctx.db.patch(order.userId, {
              walletBalance: newBalance,
            });

            await ctx.db.insert("walletTransactions", {
              userId: order.userId,
              transactionType: "credit",
              amount: order.cashbackAmount,
              source: "cashback",
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              description: `Cashback from order #${order.orderNumber}`,
              relatedOrderId: order._id,
              createdAt: Date.now(),
            });

            await ctx.db.patch(order._id, {
              cashbackCredited: true,
            });

            console.log(`Credited cashback: ₹${order.cashbackAmount} to user`);
          }
        }
      } else {
        console.log(`No status update needed. Status remains: ${order.status}`);
      }
    }

    return {
      success: true,
      orderNumber: order.orderNumber,
      previousStatus: order.status,
    };
  },
});
