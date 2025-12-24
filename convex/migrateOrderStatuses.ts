import { internalMutation } from "./_generated/server";

// Migration to update order statuses from old 6-status system to new 5-status system
// Run this once to migrate existing data
export const migrateOrderStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
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
