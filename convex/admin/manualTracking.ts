import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { ConvexError } from "convex/values";

// Save or update manual tracking details and auto-update status to "shipped" if applicable
export const saveManualTracking = mutation({
  args: {
    orderId: v.id("orders"),
    trackingNumber: v.string(),
    courierCompany: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Validate required fields
    if (!args.trackingNumber.trim()) {
      throw new ConvexError({
        message: "Tracking number is required",
        code: "BAD_REQUEST",
      });
    }

    if (!args.courierCompany.trim()) {
      throw new ConvexError({
        message: "Courier company is required",
        code: "BAD_REQUEST",
      });
    }

    // Get order before update
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    // Update order with manual tracking details
    const updates: {
      manualTrackingNumber: string;
      manualCourierCompany: string;
      status?: "shipped";
    } = {
      manualTrackingNumber: args.trackingNumber.trim(),
      manualCourierCompany: args.courierCompany.trim(),
    };

    // Only auto-update to "shipped" if order is in "processing" status
    // Don't change status if already delivered, cancelled, rto, or shipped
    if (order.status === "processing") {
      updates.status = "shipped";
    }

    await ctx.db.patch(args.orderId, updates);

    return { 
      success: true,
      statusUpdated: order.status === "processing",
    };
  },
});
