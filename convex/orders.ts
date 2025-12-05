import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { calculateGST } from "./gst";
import { internal, api } from "./_generated/api";

// Create a new order
export const createOrder = mutation({
  args: {
    shippingAddress: v.object({
      fullName: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
    }),
    paymentMethod: v.string(),
    codFee: v.optional(v.number()),
    prepaidAmount: v.optional(v.number()),
    codAmount: v.optional(v.number()),
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
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Get cart items
    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (cartItems.length === 0) {
      throw new ConvexError({
        message: "Cart is empty",
        code: "BAD_REQUEST",
      });
    }

    // Calculate totals
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shippingFee = subtotal > 500 ? 0 : 50; // Free shipping over ₹500
    const total = subtotal + shippingFee;

    // Calculate GST breakdown (tax-inclusive pricing)
    const gstCalculation = calculateGST(total, args.shippingAddress.state);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      orderNumber,
      status: "pending",
      items: cartItems.map((item) => ({
        productId: item.productId,
        productTitle: item.productTitle,
        productImage: item.productImage,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity,
        phoneModel: item.phoneModel,
        phoneBrand: item.phoneBrand,
        coverage: item.coverage,
      })),
      subtotal,
      shippingFee,
      total,
      shippingAddress: args.shippingAddress,
      paymentMethod: args.paymentMethod,
      paymentStatus: "pending",
      // COD fields
      codFee: args.codFee,
      prepaidAmount: args.prepaidAmount,
      codAmount: args.codAmount,
      // GST fields
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

    // Clear cart
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    // Mark any abandoned carts as recovered
    const abandonedCarts = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "reminded")
        )
      )
      .collect();

    for (const cart of abandonedCarts) {
      await ctx.db.patch(cart._id, {
        status: "recovered",
      });
    }

    // Send WhatsApp notifications based on payment method
    try {
      if (args.paymentMethod === "cod") {
        if (args.prepaidAmount && args.prepaidAmount > 0) {
          // Partial COD - send partial COD notification
          // User needs to make prepaid payment, so this notification will be sent after payment
          // We'll handle this in the payment success handler
        } else {
          // Full COD - send COD confirmation notification
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "cod_confirmation",
              recipientPhone: args.shippingAddress.phone,
              recipientUserId: user._id,
              variables: {
                customer_name: args.shippingAddress.fullName || user.name || "Customer",
                order_number: orderNumber,
                order_total: `₹${total.toFixed(2)}`,
                cod_amount: `₹${(args.codAmount || total).toFixed(2)}`,
                cod_fee: `₹${(args.codFee || 0).toFixed(2)}`,
              },
              priority: 8,
            }
          );
        }
      } else {
        // Prepaid orders - send order received notification
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "order_received",
            recipientPhone: args.shippingAddress.phone,
            recipientUserId: user._id,
            variables: {
              customer_name: args.shippingAddress.fullName || user.name || "Customer",
              order_number: orderNumber,
              order_total: `₹${total.toFixed(2)}`,
              order_items: cartItems.length.toString(),
            },
            priority: 8,
          }
        );
      }
    } catch (error) {
      console.error("Failed to queue order WhatsApp notification:", error);
      // Don't fail order creation if WhatsApp fails
    }

    return { orderId, orderNumber };
  },
});

// Get all orders for the current user
export const getOrders = query({
  args: { limit: v.optional(v.number()) },
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
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");
    
    const orders = args.limit ? await ordersQuery.take(args.limit) : await ordersQuery.collect();

    return orders;
  },
});

// Get a single order by ID
export const getOrder = query({
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || order.userId !== user._id) {
      throw new ConvexError({
        message: "Unauthorized",
        code: "FORBIDDEN",
      });
    }

    return order;
  },
});

// Update order status
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
  },
});

// Update payment details
export const updatePaymentDetails = mutation({
  args: {
    orderId: v.id("orders"),
    phonepeMerchantTransactionId: v.string(),
    phonepeTransactionId: v.string(),
    phonepePaymentUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      phonepeMerchantTransactionId: args.phonepeMerchantTransactionId,
      phonepeTransactionId: args.phonepeTransactionId,
      phonepePaymentUrl: args.phonepePaymentUrl,
    });
  },
});

// Update payment status (called by webhook or after status check)
export const updatePaymentStatus = mutation({
  args: {
    merchantTransactionId: v.string(),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_merchant_transaction", (q) =>
        q.eq("phonepeMerchantTransactionId", args.merchantTransactionId)
      )
      .unique();

    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    // If payment successful and order was not already confirmed, deduct roll inventory
    if (args.paymentStatus === "success" && order.paymentStatus !== "success") {
      // Get all variants to map productId + variant title to variant ID
      const allVariants = await ctx.db.query("variants").collect();
      
      // Prepare items for inventory deduction by finding the variant ID
      const items = order.items
        .map((item) => {
          // Find the variant by matching productId and variant title
          const variant = allVariants.find(
            (v) => v.productId === item.productId && v.title === item.variant
          );
          
          if (!variant) {
            return null;
          }
          
          return {
            variantId: variant._id,
            quantity: item.quantity,
          };
        })
        .filter((item) => item !== null);

      // Deduct roll inventory (run asynchronously to avoid blocking order confirmation)
      if (items.length > 0) {
        await ctx.scheduler.runAfter(0, internal.rollsManagement.deductRollInventory, {
          items,
        });
      }
    }

    const oldPaymentStatus = order.paymentStatus;
    const newStatus = args.paymentStatus === "success" ? "confirmed" : order.status;

    await ctx.db.patch(order._id, {
      paymentStatus: args.paymentStatus,
      status: newStatus,
    });

    // Send WhatsApp notifications based on payment status change
    if (oldPaymentStatus !== args.paymentStatus) {
      try {
        // Get user info for notification
        const user = await ctx.db.get(order.userId);
        
        if (args.paymentStatus === "success") {
          // Check if this is a partial COD order
          const isPartialCod = order.paymentMethod === "cod" && 
                              order.prepaidAmount && 
                              order.prepaidAmount > 0;
          
          if (isPartialCod) {
            // Partial COD - send partial COD notification
            await ctx.scheduler.runAfter(
              0,
              api.whatsappMessaging.queueMessage,
              {
                usecaseKey: "partial_cod",
                recipientPhone: order.shippingAddress.phone,
                recipientUserId: order.userId,
                variables: {
                  customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                  order_number: order.orderNumber,
                  order_total: `₹${order.total.toFixed(2)}`,
                  prepaid_amount: `₹${(order.prepaidAmount || 0).toFixed(2)}`,
                  cod_amount: `₹${(order.codAmount || 0).toFixed(2)}`,
                  cod_fee: `₹${(order.codFee || 0).toFixed(2)}`,
                },
                priority: 8,
              }
            );
          } else {
            // Full prepaid payment - send order received notification
            await ctx.scheduler.runAfter(
              0,
              api.whatsappMessaging.queueMessage,
              {
                usecaseKey: "order_received",
                recipientPhone: order.shippingAddress.phone,
                recipientUserId: order.userId,
                variables: {
                  customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                  order_number: order.orderNumber,
                  order_total: `₹${order.total.toFixed(2)}`,
                  order_items: order.items.length.toString(),
                },
                priority: 8,
              }
            );
          }
        } else if (args.paymentStatus === "failed") {
          // Payment failed - send payment failed notification
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "payment_failed",
              recipientPhone: order.shippingAddress.phone,
              recipientUserId: order.userId,
              variables: {
                customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                order_number: order.orderNumber,
                order_total: `₹${order.total.toFixed(2)}`,
                payment_method: order.paymentMethod === "cod" ? "Partial COD" : "Prepaid",
              },
              priority: 8,
            }
          );
        }
      } catch (error) {
        console.error("Failed to queue payment status WhatsApp:", error);
        // Don't fail payment update if WhatsApp fails
      }
    }

    return { orderId: order._id };
  },
});

// Get order by merchant transaction ID
export const getOrderByMerchantTransaction = query({
  args: { merchantTransactionId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_merchant_transaction", (q) =>
        q.eq("phonepeMerchantTransactionId", args.merchantTransactionId)
      )
      .unique();

    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    return order;
  },
});
