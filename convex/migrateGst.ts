/**
 * Migration script to backfill GST fields for existing orders
 * 
 * Run this once to add GST calculations to all existing orders
 */

import { mutation, query } from "./_generated/server";
import { calculateGST } from "./gst";

// Get all orders that don't have GST data
export const getOrdersWithoutGst = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("orders")
      .collect();
    
    // Filter orders that don't have GST fields
    const ordersWithoutGst = orders.filter(order => !order.totalGstAmount);
    
    return ordersWithoutGst.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      total: order.total,
      state: order.shippingAddress.state,
    }));
  },
});

// Backfill GST data for a single order
export const backfillOrderGst = mutation({
  args: {},
  handler: async (ctx) => {
    // Get first order without GST
    const orders = await ctx.db
      .query("orders")
      .collect();
    
    const order = orders.find(o => !o.totalGstAmount);
    
    if (!order) {
      return { done: true, message: "All orders have GST data" };
    }
    
    // Calculate GST
    const gstCalculation = calculateGST(order.total, order.shippingAddress.state);
    
    // Update order
    await ctx.db.patch(order._id, {
      taxableAmount: gstCalculation.taxableAmount,
      gstRate: gstCalculation.gstRate,
      cgstRate: gstCalculation.cgstRate,
      sgstRate: gstCalculation.sgstRate,
      igstRate: gstCalculation.igstRate,
      cgstAmount: gstCalculation.cgstAmount,
      sgstAmount: gstCalculation.sgstAmount,
      igstAmount: gstCalculation.igstAmount,
      totalGstAmount: gstCalculation.totalGstAmount,
    });
    
    return {
      done: false,
      message: `Updated order ${order.orderNumber}`,
      orderNumber: order.orderNumber,
    };
  },
});
