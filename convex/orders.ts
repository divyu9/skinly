import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

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
    });

    // Clear cart
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    return { orderId, orderNumber };
  },
});

// Get all orders for the current user
export const getOrders = query({
  args: {},
  handler: async (ctx) => {
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

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

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

    await ctx.db.patch(order._id, {
      paymentStatus: args.paymentStatus,
      status: args.paymentStatus === "success" ? "confirmed" : order.status,
    });

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
