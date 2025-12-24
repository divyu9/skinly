/**
 * Order export queries for tax compliance and CA reporting
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

export const getOrdersForExport = query({
  args: {
    startDate: v.optional(v.number()), // timestamp
    endDate: v.optional(v.number()), // timestamp
    orderIds: v.optional(v.array(v.id("orders"))), // specific orders
  },
  handler: async (ctx, args) => {
    let ordersQuery = ctx.db.query("orders");

    // If specific order IDs provided, fetch only those
    if (args.orderIds && args.orderIds.length > 0) {
      const orders = [];
      for (const orderId of args.orderIds) {
        const order = await ctx.db.get(orderId);
        if (order) {
          orders.push(order);
        }
      }
      return orders;
    }

    // Otherwise fetch all orders in date range
    const allOrders = await ordersQuery.order("desc").collect();

    // Filter by date range if provided
    let filteredOrders = allOrders;
    if (args.startDate !== undefined || args.endDate !== undefined) {
      filteredOrders = allOrders.filter((order) => {
        const orderDate = order._creationTime;
        if (args.startDate !== undefined && orderDate < args.startDate) {
          return false;
        }
        if (args.endDate !== undefined && orderDate > args.endDate) {
          return false;
        }
        return true;
      });
    }

    return filteredOrders;
  },
});

// Get order summary stats for a date range
export const getExportStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allOrders = await ctx.db.query("orders").order("desc").collect();

    // Filter by date range
    const filteredOrders = allOrders.filter((order) => {
      const orderDate = order._creationTime;
      if (args.startDate !== undefined && orderDate < args.startDate) {
        return false;
      }
      if (args.endDate !== undefined && orderDate > args.endDate) {
        return false;
      }
      return true;
    });

    // Calculate stats
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalGst = filteredOrders.reduce(
      (sum, order) => sum + (order.totalGstAmount || 0),
      0
    );
    const totalCgst = filteredOrders.reduce(
      (sum, order) => sum + (order.cgstAmount || 0),
      0
    );
    const totalSgst = filteredOrders.reduce(
      (sum, order) => sum + (order.sgstAmount || 0),
      0
    );
    const totalIgst = filteredOrders.reduce(
      (sum, order) => sum + (order.igstAmount || 0),
      0
    );
    const totalTaxableAmount = filteredOrders.reduce(
      (sum, order) => sum + (order.taxableAmount || 0),
      0
    );

    return {
      totalOrders,
      totalRevenue,
      totalGst,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTaxableAmount,
    };
  },
});
