import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import {
  triggerOrderDispatchedEmail,
  triggerOrderDeliveredEmail,
  triggerOrderCancelledEmail,
} from "./emailOrderTriggers";

// Internal mutation to process RapidShyp webhook updates
export const processWebhookUpdate = internalMutation({
  args: {
    awbNumber: v.string(),
    shipmentStatus: v.optional(v.string()),
    statusCode: v.optional(v.string()),
    statusDesc: v.optional(v.string()),
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
    console.log("Shipment Status:", args.shipmentStatus);
    console.log("Status Code:", args.statusCode);
    console.log("Status Desc:", args.statusDesc);
    console.log("Current order status:", order.status);

    // Update shipping status if provided
    if (args.statusDesc || args.shipmentStatus) {
      await ctx.db.patch(order._id, {
        shippingStatus: args.statusDesc || args.shipmentStatus || order.shippingStatus,
      });
    }

    // Map RapidShyp status code to order status
    // Using official RapidShyp status codes from their API
    if (args.statusCode || args.shipmentStatus) {
      const statusCode = args.statusCode || "";
      const shipmentStatus = (args.shipmentStatus || "").toUpperCase();
      let newOrderStatus = order.status;
      let shouldUpdateStatus = false;

      // RapidShyp Status Code Mapping
      // Status codes: PSH (Pickup Scheduled), PUC (Picked Up), SPD (Booked), INT (In Transit),
      // RAD (Reached Destination), OFD (Out For Delivery), DEL (Delivered),
      // UND (Undelivered/NDR), RTO (RTO Initiated), RTO_INT (RTO In Transit),
      // RTO_OFD (RTO Out For Delivery), RTO_DEL (RTO Delivered)
      
      if (
        statusCode === "PSH" ||
        statusCode === "NA" ||
        shipmentStatus.includes("PICKUP")
      ) {
        // Pickup scheduled - keep as processing
        newOrderStatus = "processing";
        shouldUpdateStatus = order.status !== "processing";
      } else if (
        statusCode === "PUC" ||
        statusCode === "SPD" ||
        statusCode === "INT" ||
        statusCode === "RAD" ||
        shipmentStatus.includes("TRANSIT") ||
        shipmentStatus.includes("BOOKED")
      ) {
        // Picked up / In Transit - move to shipped
        newOrderStatus = "shipped";
        shouldUpdateStatus = order.status === "processing";
      } else if (
        statusCode === "OFD" ||
        shipmentStatus.includes("OUT_FOR_DELIVERY")
      ) {
        // Out for delivery - keep as shipped
        newOrderStatus = "shipped";
        shouldUpdateStatus = order.status === "processing";
      } else if (
        statusCode === "DEL" ||
        shipmentStatus === "DELIVERED"
      ) {
        // Delivered successfully
        newOrderStatus = "delivered";
        shouldUpdateStatus = order.status !== "delivered";
      } else if (
        statusCode === "RTO" ||
        statusCode === "RTO_INT" ||
        statusCode === "RTO_OFD" ||
        shipmentStatus.includes("RTO") && !shipmentStatus.includes("RTO_DELIVERED")
      ) {
        // RTO in progress - return to origin
        newOrderStatus = "rto";
        shouldUpdateStatus = order.status !== "rto" && order.status !== "cancelled";
      } else if (
        statusCode === "RTO_DEL" ||
        shipmentStatus === "RTO_DELIVERED"
      ) {
        // RTO Delivered - update to rto
        newOrderStatus = "rto";
        shouldUpdateStatus = order.status !== "rto";
      } else if (
        statusCode === "UND" ||
        shipmentStatus.includes("UNDELIVERED")
      ) {
        // Undelivered/NDR - keep current status, just log
        console.log("Undelivered/NDR event - keeping current status");
      } else if (
        shipmentStatus.includes("CANCELLED") ||
        shipmentStatus.includes("CANCEL")
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
        if (newOrderStatus === "delivered" && !order.cashbackCredited && order.cashbackAmount && order.userId) {
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

        // Handle delivered status - credit wallet credit coupon if not already done
        if (newOrderStatus === "delivered" && !order.walletCreditCredited && order.walletCreditCouponAmount && order.userId) {
          const user = await ctx.db.get(order.userId);
          if (user) {
            const currentBalance = user.walletBalance || 0;
            const newBalance = currentBalance + order.walletCreditCouponAmount;

            await ctx.db.patch(order.userId, {
              walletBalance: newBalance,
            });

            await ctx.db.insert("walletTransactions", {
              userId: order.userId,
              transactionType: "credit",
              amount: order.walletCreditCouponAmount,
              source: "coupon_credit",
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              description: `Wallet credit from coupon on order #${order.orderNumber}`,
              relatedOrderId: order._id,
              relatedCouponId: order.couponId,
              createdAt: Date.now(),
            });

            await ctx.db.patch(order._id, {
              walletCreditCredited: true,
            });

            console.log(`Credited wallet credit from coupon: ₹${order.walletCreditCouponAmount} to user`);
          }
        }
        
        // Send email notifications based on status change
        try {
          const user = order.userId ? await ctx.db.get(order.userId) : null;
          
          if (newOrderStatus === "shipped") {
            await triggerOrderDispatchedEmail(ctx, order, user);
          } else if (newOrderStatus === "delivered") {
            await triggerOrderDeliveredEmail(ctx, order, user);
          } else if (newOrderStatus === "cancelled") {
            await triggerOrderCancelledEmail(ctx, order, user);
          }
        } catch (error) {
          console.error("Failed to trigger email notification:", error);
          // Don't fail webhook processing if email fails
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
