import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { ConvexError } from "convex/values";
import { api } from "../_generated/api.js";
import {
  triggerOrderDispatchedEmail,
  triggerOrderDeliveredEmail,
  triggerOrderCancelledEmail,
} from "../emailOrderTriggers";

// Get all orders for admin (not restricted to current user)
export const getAllOrders = query({
  args: {
    status: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    showDeleted: v.optional(v.boolean()), // Whether to show deleted orders
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

    // Filter out deleted orders by default (unless showDeleted is true)
    let filteredOrders = args.showDeleted 
      ? allOrders.filter((order) => order.isDeleted === true)
      : allOrders.filter((order) => !order.isDeleted);

    // Filter by status if provided
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
        const user = order.userId ? await ctx.db.get(order.userId) : null;
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

    // Filter out deleted orders
    const nonDeletedOrders = allOrders.filter((order) => !order.isDeleted);

    const searchLower = args.searchTerm.toLowerCase();

    const filteredOrders = nonDeletedOrders.filter(
      (order) =>
        (order.orderNumber && order.orderNumber.toLowerCase().includes(searchLower)) ||
        (order.failedOrderNumber && order.failedOrderNumber.toLowerCase().includes(searchLower)) ||
        order.shippingAddress.fullName.toLowerCase().includes(searchLower) ||
        order.shippingAddress.phone.includes(args.searchTerm)
    );

    // Fetch user info for each order
    const ordersWithUsers = await Promise.all(
      filteredOrders.map(async (order) => {
        const user = order.userId ? await ctx.db.get(order.userId) : null;
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
    courierName: v.optional(v.string()),
    labelUrl: v.optional(v.string()),
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

    // Get order before update to check if AWB is new
    const order = await ctx.db.get(orderId);
    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    const isNewAWB = args.awbNumber && !order.awbNumber;

    // Auto-update status to "shipped" when AWB is added (RapidShyp flow)
    const updateData = {
      ...updates,
      ...(isNewAWB && { status: "shipped" as const }),
    };

    await ctx.db.patch(orderId, updateData);

    // Send order dispatched notification if AWB is added for first time
    if (isNewAWB && args.awbNumber) {
      try {
        const user = order.userId ? await ctx.db.get(order.userId) : null;
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "order_dispatched",
            recipientPhone: order.shippingAddress.phone,
            recipientUserId: order.userId,
            variables: {
              customer_name: order.shippingAddress.fullName || user?.name || "Customer",
              order_number: order.orderNumber || order.failedOrderNumber || "Pending",
              awb_number: args.awbNumber,
              courier_name: args.courierName || "courier partner",
              tracking_url: args.trackingUrl || "",
            },
            priority: 8,
          }
        );
        
        // Send order dispatched email
        // Get the updated order to get the latest status
        const updatedOrder = await ctx.db.get(orderId);
        if (updatedOrder) {
          await triggerOrderDispatchedEmail(ctx, updatedOrder, user);
        }
      } catch (error) {
        console.error("Failed to queue order dispatched WhatsApp:", error);
      }
    }

    return { success: true };
  },
});

// Update order status (admin version - doesn't require ownership)
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("rto")
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

    // Get order before update to check for status change
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    const oldStatus = order.status;

    await ctx.db.patch(args.orderId, { status: args.status });

    // Send WhatsApp notifications based on status change
    if (oldStatus !== args.status) {
      try {
        const user = order.userId ? await ctx.db.get(order.userId) : null;

        if (args.status === "shipped" && order.awbNumber) {
          // Order shipped
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "order_dispatched",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                awb_number: order.awbNumber,
                courier_name: order.courierName || "courier partner",
                tracking_url: order.trackingUrl || "",
              },
              priority: 8,
            }
          );
          
          // Send order dispatched email
          await triggerOrderDispatchedEmail(ctx, order, user);
        } else if (args.status === "delivered") {
          // Process cashback if not already credited
          if (!order.cashbackCredited) {
            // Get all variants to map order items to variant IDs
            const allVariants = await ctx.db.query("variants").collect();
            const allProducts = await ctx.db.query("products").collect();

            // Build items array for cashback calculation
            const itemsForCashback = order.items
              .map((item) => {
                // Find the product
                const product = allProducts.find((p) => p._id === item.productId);
                if (!product) return null;

                // Find the variant by matching productId and variant title
                const variant = allVariants.find(
                  (v) => v.productId === item.productId && v.title === item.variant
                );
                if (!variant) return null;

                // Calculate final unit price (item price is already after discounts from order creation)
                const finalPrice = item.price;

                return {
                  productId: product._id,
                  variantId: variant._id,
                  finalPrice,
                  quantity: item.quantity,
                };
              })
              .filter((item) => item !== null);

            if (itemsForCashback.length > 0) {
              // Calculate total cashback for the order
              const cashbackResult = await ctx.runQuery(api.cashbackHelpers.calculateCartCashback, {
                items: itemsForCashback,
              });

              if (cashbackResult.totalCashback > 0 && order.userId) {
                const currentBalance = user?.walletBalance || 0;
                const newBalance = currentBalance + cashbackResult.totalCashback;

                // Update user's wallet balance
                await ctx.db.patch(order.userId, {
                  walletBalance: newBalance,
                });

                // Create wallet transaction record
                await ctx.db.insert("walletTransactions", {
                  userId: order.userId,
                  transactionType: "credit",
                  amount: cashbackResult.totalCashback,
                  source: "cashback",
                  balanceBefore: currentBalance,
                  balanceAfter: newBalance,
                  description: `Cashback from order #${order.orderNumber}`,
                  relatedOrderId: order._id,
                  createdAt: Date.now(),
                });

                // Mark order as cashback credited
                await ctx.db.patch(args.orderId, {
                  cashbackAmount: cashbackResult.totalCashback,
                  cashbackCredited: true,
                });
              }
            }
          }

          // Order delivered - send delivery confirmation
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "order_delivered",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                order_total: `₹${order.total.toFixed(2)}`,
              },
              priority: 7,
            }
          );

          // Send review request after 2 hours (7200000 ms)
          await ctx.scheduler.runAfter(
            7200000,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "review_request",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                product_name: order.items[0]?.productTitle || "your order",
              },
              priority: 5,
            }
          );

          // Send review reminder after 7 days (604800000 ms)
          await ctx.scheduler.runAfter(
            604800000,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "review_reminder",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                product_name: order.items[0]?.productTitle || "your product",
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
              },
              priority: 3, // Lower priority for reminders
            }
          );
          
          // Send order delivered email
          await triggerOrderDeliveredEmail(ctx, order, user);
        } else if (args.status === "cancelled") {
          // Order cancelled
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "order_cancelled",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                order_total: `₹${order.total.toFixed(2)}`,
              },
              priority: 8,
            }
          );
          
          // Send order cancelled email
          await triggerOrderCancelledEmail(ctx, order, user, "Order was cancelled by admin");
        }
      } catch (error) {
        console.error("Failed to queue order status WhatsApp:", error);
      }
    }

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
    
    // Filter out deleted orders for stats
    const activeOrders = allOrders.filter((o) => !o.isDeleted);
    const deletedOrders = allOrders.filter((o) => o.isDeleted);

    const stats = {
      total: activeOrders.length,
      processing: activeOrders.filter((o) => o.status === "processing" && o.paymentStatus === "success").length,
      shipped: activeOrders.filter((o) => o.status === "shipped").length,
      delivered: activeOrders.filter((o) => o.status === "delivered").length,
      cancelled: activeOrders.filter((o) => o.status === "cancelled").length,
      rto: activeOrders.filter((o) => o.status === "rto").length,
      failed: activeOrders.filter((o) => o.paymentStatus === "failed").length,
      deleted: deletedOrders.length,
      totalRevenue: activeOrders
        .filter((o) => o.paymentStatus === "success")
        .reduce((sum, o) => sum + o.total, 0),
      pendingPayments: activeOrders.filter(
        (o) => o.paymentStatus === "pending" || !o.paymentStatus
      ).length,
      successfulPayments: activeOrders.filter((o) => o.paymentStatus === "success")
        .length,
      failedPayments: activeOrders.filter((o) => o.paymentStatus === "failed")
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

    const user = order.userId ? await ctx.db.get(order.userId) : null;

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

// Get variant inventory for order items
export const getOrderVariantInventory = query({
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

    // Get inventory for each SKU
    const inventoryData = await Promise.all(
      order.items.map(async (item) => {
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_sku", (q) => q.eq("sku", item.variant))
          .first();

        return {
          sku: item.variant,
          productTitle: item.productTitle,
          quantity: item.quantity,
          currentInventory: variant?.inventoryQuantity || 0,
          variantTitle: variant?.title || item.variant,
        };
      })
    );

    return inventoryData;
  },
});

// Restock inventory for cancelled orders
export const restockInventory = mutation({
  args: {
    orderId: v.id("orders"),
    itemsToRestock: v.array(v.object({
      variant: v.string(), // SKU
      quantity: v.number(),
    })),
  },
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

    // Only allow restocking for cancelled or RTO orders
    if (order.status !== "cancelled" && order.status !== "rto") {
      throw new ConvexError({
        message: "Can only restock inventory for cancelled or RTO orders",
        code: "BAD_REQUEST",
      });
    }

    const results: Array<{ sku: string; success: boolean; error?: string; oldQty?: number; newQty?: number }> = [];

    // Process each item to restock
    for (const item of args.itemsToRestock) {
      try {
        // Find the variant by SKU
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_sku", (q) => q.eq("sku", item.variant))
          .first();

        if (!variant) {
          results.push({
            sku: item.variant,
            success: false,
            error: "Variant not found",
          });
          continue;
        }

        const oldQty = variant.inventoryQuantity;
        const newQty = oldQty + item.quantity;

        // Update inventory
        await ctx.db.patch(variant._id, {
          inventoryQuantity: newQty,
        });

        results.push({
          sku: item.variant,
          success: true,
          oldQty,
          newQty,
        });
      } catch (error) {
        results.push({
          sku: item.variant,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Add to restocking history
    const restockingEntry = {
      restockedAt: Date.now(),
      restockedBy: identity.email || identity.tokenIdentifier,
      items: args.itemsToRestock.map((item) => {
        const orderItem = order.items.find((i) => i.variant === item.variant);
        return {
          productId: orderItem?.productId || "unknown",
          variantId: undefined,
          sku: item.variant,
          quantity: item.quantity,
        };
      }),
    };

    const existingHistory = order.restockingHistory || [];
    await ctx.db.patch(args.orderId, {
      restockingHistory: [...existingHistory, restockingEntry],
    });

    return {
      success: results.every((r) => r.success),
      results,
    };
  },
});

// Refund order to wallet
export const refundToWallet = mutation({
  args: {
    orderId: v.id("orders"),
    refundAmount: v.number(),
    refundReason: v.optional(v.string()),
  },
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

    // Only allow refunds for cancelled or RTO orders
    if (order.status !== "cancelled" && order.status !== "rto") {
      throw new ConvexError({
        message: "Can only refund cancelled or RTO orders",
        code: "BAD_REQUEST",
      });
    }

    // Validate refund amount
    if (args.refundAmount <= 0) {
      throw new ConvexError({
        message: "Refund amount must be greater than 0",
        code: "BAD_REQUEST",
      });
    }

    if (args.refundAmount > order.total) {
      throw new ConvexError({
        message: `Refund amount cannot exceed order total (₹${order.total})`,
        code: "BAD_REQUEST",
      });
    }

    // Check if already refunded
    if (order.refundedToWallet) {
      throw new ConvexError({
        message: "This order has already been refunded to wallet",
        code: "BAD_REQUEST",
      });
    }

    const user = order.userId ? await ctx.db.get(order.userId) : null;
    if (!user || !order.userId) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Credit wallet
    const currentBalance = user.walletBalance || 0;
    const newBalance = currentBalance + args.refundAmount;

    await ctx.db.patch(order.userId, {
      walletBalance: newBalance,
    });

    // Create wallet transaction
    await ctx.db.insert("walletTransactions", {
      userId: order.userId,
      transactionType: "credit",
      amount: args.refundAmount,
      source: "refund",
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: args.refundReason || `Refund for order #${order.orderNumber}`,
      relatedOrderId: order._id,
      adminEmail: identity.email,
      createdAt: Date.now(),
    });

    // Update order with refund info
    await ctx.db.patch(args.orderId, {
      refundedToWallet: true,
      refundAmount: args.refundAmount,
      refundedAt: Date.now(),
      refundedBy: identity.email || identity.tokenIdentifier,
      refundReason: args.refundReason,
    });

    return {
      success: true,
      refundAmount: args.refundAmount,
      newWalletBalance: newBalance,
    };
  },
});

// Record RTO action
export const recordRtoAction = mutation({
  args: {
    orderId: v.id("orders"),
    actionType: v.union(
      v.literal("restocked"),
      v.literal("resent"),
      v.literal("resolved")
    ),
    notes: v.optional(v.string()),
    newOrderNumber: v.optional(v.string()), // For "resent" action
  },
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

    // Only allow RTO actions for RTO orders
    if (order.status !== "rto") {
      throw new ConvexError({
        message: "Can only record RTO actions for RTO orders",
        code: "BAD_REQUEST",
      });
    }

    // Validate resent action requires new order number
    if (args.actionType === "resent" && !args.newOrderNumber) {
      throw new ConvexError({
        message: "New order number is required for 'resent' action",
        code: "BAD_REQUEST",
      });
    }

    // Create RTO action entry
    const rtoAction = {
      actionType: args.actionType,
      actionAt: Date.now(),
      actionBy: identity.email || identity.tokenIdentifier,
      notes: args.notes,
      newOrderNumber: args.newOrderNumber,
    };

    const existingActions = order.rtoActions || [];
    await ctx.db.patch(args.orderId, {
      rtoActions: [...existingActions, rtoAction],
    });

    return {
      success: true,
      actionType: args.actionType,
    };
  },
});

// Soft delete orders (bulk)
export const softDeleteOrders = mutation({
  args: {
    orderIds: v.array(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Soft delete all orders
    for (const orderId of args.orderIds) {
      await ctx.db.patch(orderId, {
        isDeleted: true,
        deletedAt: Date.now(),
        deletedBy: user._id,
      });
    }

    return { success: true, deletedCount: args.orderIds.length };
  },
});

// Restore deleted orders (bulk)
export const restoreOrders = mutation({
  args: {
    orderIds: v.array(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Restore all orders
    for (const orderId of args.orderIds) {
      await ctx.db.patch(orderId, {
        isDeleted: false,
        deletedAt: undefined,
        deletedBy: undefined,
      });
    }

    return { success: true, restoredCount: args.orderIds.length };
  },
});
