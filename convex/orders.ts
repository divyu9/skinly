import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { calculateGST } from "./gst";
import { internal, api } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel.d.ts";
import {
  triggerOrderConfirmedEmail,
  triggerPaymentFailedEmail,
} from "./emailOrderTriggers";

// Create a new order (supports both authenticated and guest checkout)
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
    customerEmail: v.optional(v.string()),
    paymentMethod: v.string(),
    codFee: v.optional(v.number()),
    prepaidAmount: v.optional(v.number()),
    codAmount: v.optional(v.number()),
    walletAmount: v.optional(v.number()),
    couponId: v.optional(v.id("coupons")),
    couponDiscount: v.optional(v.number()),
    sessionId: v.optional(v.string()), // For guest checkout
    guestEmail: v.optional(v.string()), // Required for guest checkout
  },
  handler: async (ctx, args): Promise<{ orderId: Id<"orders">; orderNumber?: string; remainingAmount: number; trackingToken?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    const isGuest = !identity;
    
    let user: { _id: Id<"users">; name?: string; email?: string; walletBalance?: number } | null = null;
    let cartItems: Doc<"cart">[] = [];

    if (isGuest) {
      // Guest checkout - require email and sessionId
      if (!args.guestEmail) {
        throw new ConvexError({
          message: "Email is required for guest checkout",
          code: "BAD_REQUEST",
        });
      }
      
      if (!args.sessionId) {
        throw new ConvexError({
          message: "Session ID is required for guest checkout",
          code: "BAD_REQUEST",
        });
      }

      // Get guest cart items by sessionId
      cartItems = await ctx.db
        .query("cart")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect();
    } else {
      // Authenticated checkout
      user = await ctx.db
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

      // Get authenticated cart items
      cartItems = await ctx.db
        .query("cart")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
        .collect();
    }

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
    // Get shipping settings from database
    const freeThresholdSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_free_threshold"))
      .first();
    const flatFeeSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "shipping_flat_fee"))
      .first();
    
    const freeShippingThreshold = (freeThresholdSetting?.value as number) ?? 500;
    const flatShippingFee = (flatFeeSetting?.value as number) ?? 50;
    const shippingFee = subtotal >= freeShippingThreshold ? 0 : flatShippingFee;
    
    // Apply coupon discount
    const couponDiscount = args.couponDiscount || 0;
    let total = Math.max(0, subtotal + shippingFee - couponDiscount);

    // Handle wallet payment (only for authenticated users)
    let walletAmountUsed = 0;
    if (!isGuest && args.walletAmount && args.walletAmount > 0 && user) {
      // Validate wallet amount
      const walletBalance = user.walletBalance || 0;
      
      if (args.walletAmount > walletBalance) {
        throw new ConvexError({
          message: `Insufficient wallet balance. Available: ₹${walletBalance}`,
          code: "BAD_REQUEST",
        });
      }

      // Get wallet settings to validate max usage
      const walletSettings = await ctx.db.query("walletSettings").first();
      
      if (walletSettings && !walletSettings.walletEnabled) {
        throw new ConvexError({
          message: "Wallet payments are currently disabled",
          code: "BAD_REQUEST",
        });
      }

      // Calculate max allowed wallet usage
      let maxAllowedUsage = walletBalance;
      
      if (walletSettings && walletSettings.maxUsageType !== "unlimited") {
        if (walletSettings.maxUsageType === "percentage") {
          maxAllowedUsage = Math.min(
            walletBalance,
            (total * walletSettings.maxUsageValue) / 100
          );
        } else if (walletSettings.maxUsageType === "fixed") {
          maxAllowedUsage = Math.min(walletBalance, walletSettings.maxUsageValue);
        }
      }

      if (args.walletAmount > maxAllowedUsage) {
        throw new ConvexError({
          message: `Maximum wallet usage exceeded. Max allowed: ₹${maxAllowedUsage.toFixed(2)}`,
          code: "BAD_REQUEST",
        });
      }

      // Don't allow wallet to pay more than order total
      walletAmountUsed = Math.min(args.walletAmount, total);

      // Deduct from wallet
      const newWalletBalance = walletBalance - walletAmountUsed;
      await ctx.db.patch(user!._id, {
        walletBalance: newWalletBalance,
      });

      // Record wallet transaction
      await ctx.db.insert("walletTransactions", {
        userId: user!._id,
        transactionType: "debit",
        amount: walletAmountUsed,
        source: "order_payment",
        balanceBefore: walletBalance,
        balanceAfter: newWalletBalance,
        description: `Payment for order`,
        createdAt: Date.now(),
      });

      // Reduce total by wallet amount
      total = total - walletAmountUsed;
    }

    // Calculate GST breakdown (tax-inclusive pricing)
    const gstCalculation = calculateGST(total + walletAmountUsed, args.shippingAddress.state);

    // Store original total for notifications (before wallet and coupon deductions)
    const originalTotal = subtotal + shippingFee - couponDiscount;

    // Determine if we should generate order number now
    // Generate immediately for: COD orders, wallet-fully-paid orders
    // Don't generate for: online payment orders (will be assigned when payment succeeds)
    const shouldGenerateOrderNumber = 
      (args.paymentMethod === "cod") || 
      (walletAmountUsed >= originalTotal);
    
    let orderNumber: string | undefined;
    if (shouldGenerateOrderNumber) {
      orderNumber = await ctx.runMutation(internal.orderNumberHelpers.generateOrderNumber);
    }

    // Generate tracking token for guest orders (secure random string)
    const trackingToken = isGuest 
      ? `TRK-${Date.now()}-${Math.random().toString(36).substr(2, 20)}-${Math.random().toString(36).substr(2, 20)}`
      : undefined;

    // Create order
    const orderId = await ctx.db.insert("orders", {
      userId: user?._id,
      isGuest,
      guestEmail: isGuest ? args.guestEmail : undefined,
      trackingToken,
      orderNumber,
      customerEmail: args.customerEmail || args.guestEmail,
      status: "processing",
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
      total: originalTotal, // Store original total (for display)
      shippingAddress: args.shippingAddress,
      paymentMethod: args.paymentMethod,
      paymentStatus: walletAmountUsed >= originalTotal ? "success" : "pending", // If fully paid by wallet, mark as success
      // Wallet fields
      walletAmountUsed,
      // Coupon fields
      couponId: args.couponId,
      couponDiscount,
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

    // Update wallet transaction with order ID (authenticated users only)
    if (!isGuest && walletAmountUsed > 0 && user) {
      const walletTransaction = await ctx.db
        .query("walletTransactions")
        .withIndex("by_user_and_created", (q) => q.eq("userId", user!._id))
        .order("desc")
        .first();
      
      if (walletTransaction) {
        await ctx.db.patch(walletTransaction._id, {
          relatedOrderId: orderId,
          description: `Payment for order ${orderNumber}`,
        });
      }
    }

    // Clear cart
    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    // Track coupon usage (only for authenticated users, guests can't use coupons yet)
    if (!isGuest && user && args.couponId && couponDiscount > 0) {
      await ctx.runMutation(api.coupons.incrementCouponUsage, {
        couponId: args.couponId,
        userId: user._id,
        userEmail: user.email || args.customerEmail || "",
        orderId,
        discountAmount: couponDiscount,
      });
    }

    // Mark any abandoned carts as recovered (authenticated users only)
    if (!isGuest && user) {
      const abandonedCarts = await ctx.db
        .query("abandonedCarts")
        .withIndex("by_user", (q) => q.eq("userId", user!._id))
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
    }

    // Send WhatsApp notifications based on payment method
    try {
      if (args.paymentMethod === "cod") {
        if (args.prepaidAmount && args.prepaidAmount > 0) {
          // Partial COD - send partial COD notification
          // User needs to make prepaid payment, so this notification will be sent after payment
          // We'll handle this in the payment success handler
        } else {
          // Full COD - check if cod_confirmation is enabled
          const codUsecase = await ctx.db
            .query("whUsecaseTemplates")
            .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "cod_confirmation"))
            .first();

          if (codUsecase?.enabled && codUsecase.providerTemplateId) {
            // Send COD confirmation if enabled
            await ctx.scheduler.runAfter(
              0,
              api.whatsappMessaging.queueMessage,
              {
                usecaseKey: "cod_confirmation",
                recipientPhone: args.shippingAddress.phone,
                recipientUserId: user?._id,
                variables: {
                  customer_name: args.shippingAddress.fullName || user?.name || "Customer",
                  order_number: orderNumber || "Pending",
                  order_total: `₹${total.toFixed(2)}`,
                  cod_amount: `₹${(args.codAmount || total).toFixed(2)}`,
                  cod_fee: `₹${(args.codFee || 0).toFixed(2)}`,
                },
                priority: 8,
              }
            );
          } else {
            // Fallback to order_received
            await ctx.scheduler.runAfter(
              0,
              api.whatsappMessaging.queueMessage,
              {
                usecaseKey: "order_received",
                recipientPhone: args.shippingAddress.phone,
                recipientUserId: user?._id,
                variables: {
                  customer_name: args.shippingAddress.fullName || user?.name || "Customer",
                  order_number: orderNumber || "Pending",
                  product_name: cartItems.map(item => item.productTitle).join(", "),
                },
                priority: 8,
              }
            );
          }
        }
      } else {
        // Prepaid orders - send order received notification
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "order_received",
            recipientPhone: args.shippingAddress.phone,
            recipientUserId: user?._id,
            variables: {
              customer_name: args.shippingAddress.fullName || user?.name || "Customer",
              order_number: orderNumber || "Pending",
              product_name: cartItems.map(item => item.productTitle).join(", "),
            },
            priority: 8,
          }
        );
      }
    } catch (error) {
      console.error("Failed to queue order WhatsApp notification:", error);
      // Don't fail order creation if WhatsApp fails
    }

    // Send admin notification
    try {
      // Get admin notification settings
      const adminSettings = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "whatsapp_admin_notifications"))
        .unique();

      if (adminSettings) {
        const config = typeof adminSettings.value === "string"
          ? JSON.parse(adminSettings.value)
          : adminSettings.value;

        if (config.enabled && config.adminPhone) {
          // Format products list
          const productsList = cartItems
            .map((item) => {
              const coverage = item.coverage === "full_body_wrap" 
                ? "Full Body" 
                : item.coverage === "only_back" 
                  ? "Only Back" 
                  : "";
              const model = item.phoneModel || item.phoneBrand || "";
              const details = coverage && model 
                ? `${model} - ${coverage}` 
                : coverage || model;
              return `${item.productTitle}${details ? ` (${details})` : ""}`;
            })
            .join(", ");

          // Format payment type
          let paymentType = args.paymentMethod.toUpperCase();
          if (args.paymentMethod === "cod") {
            if (args.prepaidAmount && args.prepaidAmount > 0) {
              paymentType = "Partial COD";
            } else {
              paymentType = "COD";
            }
          } else if (args.paymentMethod === "phonepe") {
            paymentType = "PhonePe";
          }

          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "admin_new_order",
              recipientPhone: config.adminPhone,
              variables: {
                order_number: orderNumber || "Pending",
                order_amount: `₹${total.toFixed(2)}`,
                payment_type: paymentType,
                products: productsList,
                city: args.shippingAddress.city,
                coupon_code: "", // TODO: Add coupon support
              },
              priority: 9, // High priority for admin notifications
            }
          );
        }
      }
    } catch (error) {
      console.error("Failed to queue admin WhatsApp notification:", error);
      // Don't fail order creation if admin WhatsApp fails
    }

    // If order is fully paid by wallet, keep it in processing and deduct inventory immediately
    if (walletAmountUsed >= originalTotal) {
      await ctx.db.patch(orderId, {
        status: "processing",
      });

      // Deduct roll inventory
      const allVariants = await ctx.db.query("variants").collect();
      const items = cartItems
        .map((item) => {
          const variant = allVariants.find(
            (v) => v.productId === item.productId && v.title === item.variant
          );
          if (!variant) return null;
          return {
            variantId: variant._id,
            quantity: item.quantity,
          };
        })
        .filter((item) => item !== null);

      if (items.length > 0) {
        await ctx.scheduler.runAfter(0, internal.rollsManagement.deductRollInventory, {
          items,
        });
      }

      // Send order received notification
      try {
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "order_received",
            recipientPhone: args.shippingAddress.phone,
            recipientUserId: user?._id,
            variables: {
              customer_name: args.shippingAddress.fullName || user?.name || "Customer",
              order_number: orderNumber || "Pending",
              product_name: cartItems.map(item => item.productTitle).join(", "),
            },
            priority: 8,
          }
        );
      } catch (error) {
        console.error("Failed to queue WhatsApp notification:", error);
      }
    }

    // Send email notification (order confirmed) for COD and wallet-paid orders
    // For prepaid orders, email will be sent after payment success
    if (args.paymentMethod === "cod" || walletAmountUsed >= originalTotal) {
      try {
        // Get the created order
        const createdOrder = await ctx.db.get(orderId);
        if (createdOrder) {
          await triggerOrderConfirmedEmail(ctx, createdOrder, user);
        }
      } catch (error) {
        console.error("Failed to trigger order confirmed email:", error);
        // Don't fail order creation if email fails
      }
    }

    return { 
      orderId, 
      orderNumber, 
      remainingAmount: total,
      trackingToken: isGuest ? trackingToken : undefined,
    };
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

    // Get the order to check its current state
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    // Update order status
    await ctx.db.patch(args.orderId, { status: args.status });

    // If status is now "delivered" and cashback hasn't been credited yet, process cashback
    if (args.status === "delivered" && !order.cashbackCredited) {
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
          // Get the user (only for authenticated orders)
          const user = await ctx.db.get(order.userId);
          if (user) {
            const currentBalance = user.walletBalance || 0;
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
    }
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
    
    // Handle order numbering based on payment status
    let orderNumberUpdate: string | undefined = order.orderNumber;
    let failedOrderNumberUpdate: string | undefined = order.failedOrderNumber;
    
    if (args.paymentStatus === "success" && !order.orderNumber) {
      // Payment succeeded and no order number yet - generate one
      orderNumberUpdate = await ctx.runMutation(internal.orderNumberHelpers.generateOrderNumber);
    } else if (args.paymentStatus === "failed" && oldPaymentStatus !== "failed" && !order.failedOrderNumber) {
      // Payment failed for the first time - generate failed order number
      failedOrderNumberUpdate = await ctx.runMutation(internal.orderNumberHelpers.generateFailedOrderNumber);
    }
    // If payment fails on retry (oldPaymentStatus was already "failed"), keep existing numbers
    
    // Set order status based on payment outcome:
    // - success → processing
    // - failed → cancelled (including retries - keep it in cancelled)
    // - pending → keep current status
    const newStatus = 
      args.paymentStatus === "success" 
        ? "processing" 
        : args.paymentStatus === "failed"
          ? "cancelled"
          : order.status;

    await ctx.db.patch(order._id, {
      paymentStatus: args.paymentStatus,
      status: newStatus,
      orderNumber: orderNumberUpdate,
      failedOrderNumber: failedOrderNumberUpdate,
    });

    // If payment failed and user had used wallet, refund the wallet amount
    if (args.paymentStatus === "failed" && oldPaymentStatus !== "failed") {
      const walletAmountToRefund = order.walletAmountUsed || 0;
      
      if (walletAmountToRefund > 0 && order.userId) {
        const user = await ctx.db.get(order.userId);
        if (user) {
          const currentBalance = user.walletBalance || 0;
          const newBalance = currentBalance + walletAmountToRefund;

          // Refund to wallet
          await ctx.db.patch(order.userId, {
            walletBalance: newBalance,
          });

          // Record wallet transaction
          await ctx.db.insert("walletTransactions", {
            userId: order.userId,
            transactionType: "credit",
            amount: walletAmountToRefund,
            source: "refund",
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            description: `Refund for failed payment on order ${order.orderNumber}`,
            relatedOrderId: order._id,
            createdAt: Date.now(),
          });
        }
      }
    }

    // Send WhatsApp notifications based on payment status change
    if (oldPaymentStatus !== args.paymentStatus) {
      try {
        // Get user info for notification (only for authenticated users)
        const user = order.userId ? await ctx.db.get(order.userId) : null;
        
        if (args.paymentStatus === "success") {
          // Check if this is a partial COD order
          const isPartialCod = order.paymentMethod === "cod" && 
                              order.prepaidAmount && 
                              order.prepaidAmount > 0;
          
          if (isPartialCod) {
            // Partial COD - check if partial_cod usecase is enabled
            const partialCodUsecase = await ctx.db
              .query("whUsecaseTemplates")
              .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "partial_cod"))
              .first();

            if (partialCodUsecase?.enabled && partialCodUsecase.providerTemplateId) {
              // Send partial COD notification if enabled
              await ctx.scheduler.runAfter(
                0,
                api.whatsappMessaging.queueMessage,
                {
                  usecaseKey: "partial_cod",
                  recipientPhone: order.shippingAddress.phone,
                  recipientUserId: order.userId,
                  variables: {
                    customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                    order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                    order_total: `₹${order.total.toFixed(2)}`,
                    prepaid_amount: `₹${(order.prepaidAmount || 0).toFixed(2)}`,
                    cod_amount: `₹${(order.codAmount || 0).toFixed(2)}`,
                    cod_fee: `₹${(order.codFee || 0).toFixed(2)}`,
                  },
                  priority: 8,
                }
              );
            } else {
              // Fallback to order_received
              await ctx.scheduler.runAfter(
                0,
                api.whatsappMessaging.queueMessage,
                {
                  usecaseKey: "order_received",
                  recipientPhone: order.shippingAddress.phone,
                  recipientUserId: order.userId,
                  variables: {
                    customer_name: order.shippingAddress.fullName || user?.name || "Customer",
                    order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                    product_name: order.items.map(item => item.productTitle).join(", "),
                  },
                  priority: 8,
                }
              );
            }
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
                  order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                  product_name: order.items.map(item => item.productTitle).join(", "),
                },
                priority: 8,
              }
            );
          }
          
          // Send order confirmed email for successful payment
          await triggerOrderConfirmedEmail(ctx, order, user);
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
                order_number: order.orderNumber || order.failedOrderNumber || "Pending",
                order_total: `₹${order.total.toFixed(2)}`,
                payment_method: order.paymentMethod === "cod" ? "Partial COD" : "Prepaid",
              },
              priority: 8,
            }
          );
          
          // Send payment failed email
          await triggerPaymentFailedEmail(ctx, order, user, "Payment could not be processed. Please try again.");
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

// Get order by tracking token (for guest order tracking)
export const getOrderByTrackingToken = query({
  args: { trackingToken: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.trackingToken))
      .unique();

    if (!order) {
      throw new ConvexError({
        message: "Order not found. Please check your tracking link.",
        code: "NOT_FOUND",
      });
    }

    return order;
  },
});

// Check inventory availability for order items
export const checkOrderInventory = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    // Get all variants to check inventory
    const allVariants = await ctx.db.query("variants").collect();
    const unavailableItems: Array<{ productTitle: string; variant: string; requested: number; available: number }> = [];

    for (const item of order.items) {
      // Find the variant by matching productId and variant title
      const variant = allVariants.find(
        (v) => v.productId === item.productId && v.title === item.variant
      );

      if (!variant) {
        unavailableItems.push({
          productTitle: item.productTitle,
          variant: item.variant,
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      // Check if variant has sufficient stock
      const availableStock = variant.inventoryQuantity || 0;
      if (availableStock < item.quantity) {
        unavailableItems.push({
          productTitle: item.productTitle,
          variant: item.variant,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    return {
      available: unavailableItems.length === 0,
      unavailableItems,
    };
  },
});

// Retry payment for failed order
export const retryPayment = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order) {
      throw new ConvexError({
        message: "Order not found",
        code: "NOT_FOUND",
      });
    }

    if (order.paymentStatus !== "failed") {
      throw new ConvexError({
        message: "Can only retry payment for failed orders",
        code: "BAD_REQUEST",
      });
    }

    // Check inventory availability before allowing retry
    const allVariants = await ctx.db.query("variants").collect();
    const unavailableItems: string[] = [];

    for (const item of order.items) {
      const variant = allVariants.find(
        (v) => v.productId === item.productId && v.title === item.variant
      );

      if (!variant || (variant.inventoryQuantity || 0) < item.quantity) {
        unavailableItems.push(`${item.productTitle} (${item.variant})`);
      }
    }

    if (unavailableItems.length > 0) {
      throw new ConvexError({
        message: `Some items are out of stock: ${unavailableItems.join(", ")}`,
        code: "BAD_REQUEST",
      });
    }

    // Reset payment status to pending to allow retry
    // Keep order in cancelled status - don't move to processing
    await ctx.db.patch(order._id, {
      paymentStatus: "pending",
    });

    // Calculate remaining amount after wallet deduction
    const walletAmountUsed = order.walletAmountUsed || 0;
    const couponDiscount = order.couponDiscount || 0;
    const subtotal = order.subtotal + order.shippingFee;
    const codFee = order.codFee || 0;
    const remainingAmount = Math.max(0, subtotal - couponDiscount - walletAmountUsed + codFee);

    // Return order data needed for payment initiation
    return {
      orderId: order._id,
      orderNumber: order.orderNumber || order.failedOrderNumber,
      remainingAmount,
      shippingPhone: order.shippingAddress.phone,
    };
  },
});
