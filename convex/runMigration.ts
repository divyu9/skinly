import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

// Admin mutation to migrate order statuses from old 6-status to new 5-status system
export const runOrderStatusMigration = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const orders = await ctx.db.query("orders").collect();
    
    let updatedCount = 0;
    
    for (const order of orders) {
      const currentStatus = order.status as string;
      let newStatus = order.status;
      
      // Map old statuses to new ones
      if (currentStatus === "pending" || currentStatus === "confirmed") {
        newStatus = "processing";
        await ctx.db.patch(order._id, { status: newStatus });
        updatedCount++;
      }
    }
    
    return {
      success: true,
      totalOrders: orders.length,
      updatedOrders: updatedCount,
      message: `Successfully migrated ${updatedCount} orders from old status system to new 5-status system`,
    };
  },
});
