import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { ConvexError } from "convex/values";

// Get all orders for admin (not restricted to current user)
export const getAllOrders = query({
  args: {
    status: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can access admin panel

    let ordersQuery = ctx.db.query("orders").order("desc");

    const allOrders = await ordersQuery.collect();

    // Filter by status if provided
    let filteredOrders = allOrders;
    if (args.status && args.status !== "all") {
      filteredOrders = filteredOrders.filter(
        (order) => order.status === args.status
      );
    }

    // Filter by payment status if provided
    if (args.paymentStatus && args.paymentStatus !== "all") {
      filteredOrders = filteredOrders.filter(
        (order) => order.paymentStatus === args.paymentStatus
      );
    }

    // Fetch user info for each order
    const ordersWithUsers = await Promise.all(
      filteredOrders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        return {
          ...order,
          user: user
            ? {
                name: user.name,
                email: user.email,
              }
            : null,
        };
      })
    );

    return ordersWithUsers;
  },
});

// Search orders by order number, customer name, or phone
export const searchOrders = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allOrders = await ctx.db.query("orders").order("desc").collect();

    const searchLower = args.searchTerm.toLowerCase();

    const filteredOrders = allOrders.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(searchLower) ||
        order.shippingAddress.fullName.toLowerCase().includes(searchLower) ||
        order.shippingAddress.phone.includes(args.searchTerm)
    );

    // Fetch user info for each order
    const ordersWithUsers = await Promise.all(
      filteredOrders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        return {
          ...order,
          user: user
            ? {
                name: user.name,
                email: user.email,
              }
            : null,
        };
      })
    );

    return ordersWithUsers;
  },
});

// Update shipping information
export const updateShippingInfo = mutation({
  args: {
    orderId: v.id("orders"),
    awbNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    shippingStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { orderId, ...updates } = args;

    await ctx.db.patch(orderId, updates);

    return { success: true };
  },
});

// Update order status (admin version - doesn't require ownership)
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.patch(args.orderId, { status: args.status });

    return { success: true };
  },
});

// Update payment status (admin only)
export const updateOrderPaymentStatus = mutation({
  args: {
    orderId: v.id("orders"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.patch(args.orderId, { paymentStatus: args.paymentStatus });

    return { success: true };
  },
});

// Get order statistics
export const getOrderStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allOrders = await ctx.db.query("orders").collect();

    const stats = {
      total: allOrders.length,
      pending: allOrders.filter((o) => o.status === "pending").length,
      confirmed: allOrders.filter((o) => o.status === "confirmed").length,
      processing: allOrders.filter((o) => o.status === "processing").length,
      shipped: allOrders.filter((o) => o.status === "shipped").length,
      delivered: allOrders.filter((o) => o.status === "delivered").length,
      cancelled: allOrders.filter((o) => o.status === "cancelled").length,
      totalRevenue: allOrders
        .filter((o) => o.paymentStatus === "success")
        .reduce((sum, o) => sum + o.total, 0),
      pendingPayments: allOrders.filter(
        (o) => o.paymentStatus === "pending" || !o.paymentStatus
      ).length,
      successfulPayments: allOrders.filter((o) => o.paymentStatus === "success")
        .length,
      failedPayments: allOrders.filter((o) => o.paymentStatus === "failed")
        .length,
    };

    return stats;
  },
});

// Get single order details (admin version - no user restriction)
export const getOrderDetails = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    const user = await ctx.db.get(order.userId);

    return {
      ...order,
      user: user
        ? {
            name: user.name,
            email: user.email,
          }
        : null,
    };
  },
});
