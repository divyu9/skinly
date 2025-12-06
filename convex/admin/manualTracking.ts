import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { ConvexError } from "convex/values";

// Save manual tracking details and auto-update status to "shipped"
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

    // Get order before update
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    // Update order with manual tracking details and auto-update status to "shipped"
    await ctx.db.patch(args.orderId, {
      manualTrackingNumber: args.trackingNumber,
      manualCourierCompany: args.courierCompany,
      status: "shipped",
    });

    return { success: true };
  },
});
