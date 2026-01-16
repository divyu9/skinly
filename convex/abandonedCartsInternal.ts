import { v } from "convex/values";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

/**
 * Internal functions for abandoned cart automation
 * These are called by cron jobs and cannot be called directly from the client
 */

/**
 * Get all users with items in their cart (internal)
 */
export const getAllUsersWithCarts = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all cart items grouped by user
    const allCartItems = await ctx.db.query("cart").collect();

    // Get unique user IDs that have items in their cart
    const userIds = new Set<Id<"users">>();
    const cartItemsByUser = new Map<
      Id<"users">,
      {
        items: typeof allCartItems;
        oldestItemTime: number;
      }
    >();

    for (const item of allCartItems) {
      if (item.userId) {
        userIds.add(item.userId);

        const existing = cartItemsByUser.get(item.userId);
        if (existing) {
          existing.items.push(item);
          // Track the oldest item in the cart (earliest _creationTime)
          if (item._creationTime < existing.oldestItemTime) {
            existing.oldestItemTime = item._creationTime;
          }
        } else {
          cartItemsByUser.set(item.userId, {
            items: [item],
            oldestItemTime: item._creationTime,
          });
        }
      }
    }

    // Get user details for each user with cart items
    const users = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const user = await ctx.db.get(userId);
        const cartData = cartItemsByUser.get(userId);
        return {
          user,
          cartItems: cartData?.items || [],
          oldestItemTime: cartData?.oldestItemTime || Date.now(),
        };
      })
    );

    return users.filter((u) => u.user !== null);
  },
});

/**
 * Track abandoned cart with correct timestamp (internal)
 */
export const trackAbandonedCartInternal = internalMutation({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
    userPhone: v.optional(v.string()),
    oldestCartItemTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Get user's cart items
    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (cartItems.length === 0) {
      return null;
    }

    // Calculate cart total
    const cartTotal = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Check if there's already an abandoned cart record for this user
    const existing = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existing) {
      // Only update if cart contents changed
      const existingItemsHash = JSON.stringify(
        existing.items.map((i) => `${i.productId}:${i.variant}:${i.quantity}`)
      );
      const newItemsHash = JSON.stringify(
        cartItems.map((i) => `${i.productId}:${i.variant}:${i.quantity}`)
      );

      if (existingItemsHash !== newItemsHash) {
        // Cart contents changed - update but keep original abandonedAt
        await ctx.db.patch(existing._id, {
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
          cartTotal,
          // Keep original abandonedAt - don't update to current time
        });
      }
      return existing._id;
    } else {
      // Create new abandoned cart record
      // Use the oldest cart item's creation time as the abandonedAt timestamp
      const id = await ctx.db.insert("abandonedCarts", {
        userId: args.userId,
        userEmail: args.userEmail,
        userPhone: args.userPhone,
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
        cartTotal,
        abandonedAt: args.oldestCartItemTime, // Use actual cart item creation time
        status: "pending",
      });
      return id;
    }
  },
});

/**
 * Get settings for abandoned cart (internal)
 */
export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const DEFAULT_SETTINGS = {
      delayHours: 1,
      couponDiscountType: "percentage" as const,
      couponDiscountValue: 15,
      couponValidityDays: 7,
      couponPrefix: "COMEBACK",
    };

    const settings = await ctx.db.query("settings").collect();
    const settingsMap: Record<string, string | number | boolean> = {};

    for (const setting of settings) {
      if (setting.key.startsWith("abandoned_cart_")) {
        settingsMap[setting.key] = setting.value;
      }
    }

    return {
      delayHours:
        (settingsMap.abandoned_cart_delay_hours as number) ??
        DEFAULT_SETTINGS.delayHours,
      couponDiscountType:
        (settingsMap.abandoned_cart_coupon_discount_type as string) ??
        DEFAULT_SETTINGS.couponDiscountType,
      couponDiscountValue:
        (settingsMap.abandoned_cart_coupon_discount_value as number) ??
        DEFAULT_SETTINGS.couponDiscountValue,
      couponValidityDays:
        (settingsMap.abandoned_cart_coupon_validity_days as number) ??
        DEFAULT_SETTINGS.couponValidityDays,
      couponPrefix:
        (settingsMap.abandoned_cart_coupon_prefix as string) ??
        DEFAULT_SETTINGS.couponPrefix,
    };
  },
});

/**
 * Get carts needing reminders (internal)
 */
export const getCartsNeedingRemindersInternal = internalQuery({
  args: {
    delayHours: v.number(),
  },
  handler: async (ctx, args) => {
    const delayMs = args.delayHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - delayMs;

    const abandonedCarts = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("abandonedAt"), cutoffTime))
      .collect();

    return abandonedCarts;
  },
});

/**
 * Get user's phone from recent orders (internal)
 */
export const getUserPhoneFromOrders = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(1);

    return recentOrders.length > 0
      ? recentOrders[0].shippingAddress?.phone
      : undefined;
  },
});

/**
 * Scheduled action to scan for abandoned carts
 * Called by cron every 30 minutes
 */
export const scheduledScanAbandonedCarts = internalAction({
  args: {},
  handler: async (ctx): Promise<{ tracked: number }> => {
    console.log("[Cron] Starting scheduled abandoned cart scan...");

    // Get all users with cart items
    const usersWithCarts = await ctx.runQuery(
      internal.abandonedCartsInternal.getAllUsersWithCarts,
      {}
    );

    let trackedCount = 0;

    for (const { user, cartItems, oldestItemTime } of usersWithCarts) {
      if (!user || cartItems.length === 0) continue;

      // Get user's phone from recent orders
      const userPhone = await ctx.runQuery(
        internal.abandonedCartsInternal.getUserPhoneFromOrders,
        { userId: user._id }
      );

      try {
        await ctx.runMutation(
          internal.abandonedCartsInternal.trackAbandonedCartInternal,
          {
            userId: user._id,
            userEmail: user.email || "",
            userPhone: userPhone ?? undefined, // Convert null to undefined
            oldestCartItemTime: oldestItemTime,
          }
        );
        trackedCount++;
      } catch (error) {
        console.error(
          `[Cron] Failed to track abandoned cart for user ${user._id}:`,
          error
        );
      }
    }

    console.log(`[Cron] Abandoned cart scan complete. Tracked: ${trackedCount}`);
    return { tracked: trackedCount };
  },
});

/**
 * Send reminder for a single abandoned cart (internal)
 */
export const sendReminderInternal = internalAction({
  args: {
    cartId: v.id("abandonedCarts"),
    couponPrefix: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    validityDays: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the abandoned cart from the database
    const cart = await ctx.runQuery(internal.abandonedCarts.getCart, {
      cartId: args.cartId,
    });

    if (!cart) {
      console.log(`[Reminder] Cart ${args.cartId} not found`);
      return { success: false, error: "Cart not found" };
    }

    // Skip if cart is not in pending status
    if (cart.status !== "pending") {
      console.log(`[Reminder] Cart ${args.cartId} is not pending (status: ${cart.status})`);
      return { success: false, error: "Cart not in pending status" };
    }

    // Generate a unique coupon code
    const couponCode = `${args.couponPrefix}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    // Create the coupon with configured settings
    try {
      await ctx.runMutation(internal.coupons.createCouponInternal, {
        code: couponCode,
        description: `Special ${
          args.discountType === "percentage"
            ? args.discountValue + "%"
            : "₹" + args.discountValue
        } off for ${cart.userEmail}`,
        discountType: args.discountType,
        discountValue: args.discountValue,
        startDate: Date.now(),
        endDate: Date.now() + args.validityDays * 24 * 60 * 60 * 1000,
        isActive: true,
        usageLimit: 1,
        allowedCustomerEmails: [cart.userEmail],
      });
    } catch (error) {
      console.error(`[Reminder] Failed to create coupon for cart ${args.cartId}:`, error);
      return { success: false, error: "Failed to create coupon" };
    }

    // Send email via MSG91-based email system
    let emailSent = false;
    try {
      await ctx.runMutation(internal.abandonedCartsInternal.triggerEmailReminderInternal, {
        cartId: args.cartId,
        couponCode,
        discountValue: args.discountValue,
        discountType: args.discountType,
        validityDays: args.validityDays,
      });
      emailSent = true;
      console.log(`[Reminder] Email queued for abandoned cart ${args.cartId}`);
    } catch (error) {
      console.error("[Reminder] Error queuing email:", error);
    }

    // Send WhatsApp message via Authkey.io queue system
    let whatsappSent = false;
    if (cart.userPhone) {
      try {
        const discountText =
          args.discountType === "percentage"
            ? `${args.discountValue}%`
            : `₹${args.discountValue}`;

        // Queue WhatsApp message via existing messaging system
        await ctx.runMutation(internal.abandonedCartsInternal.queueWhatsAppReminder, {
          cartId: args.cartId,
          recipientPhone: cart.userPhone,
          recipientUserId: cart.userId,
          variables: {
            cart_total: `₹${cart.cartTotal.toFixed(2)}`,
            discount_text: discountText,
            coupon_code: couponCode,
            cart_link: `${process.env.VITE_SITE_URL || "https://goskinly.com"}/cart`,
          },
        });
        whatsappSent = true;
        console.log(`[Reminder] WhatsApp queued for abandoned cart ${args.cartId}`);
      } catch (error) {
        console.error("[Reminder] Error queuing WhatsApp:", error);
      }
    }

    // Mark cart as reminded
    await ctx.runMutation(internal.abandonedCarts.markAsReminded, {
      cartId: args.cartId,
      couponCode,
    });

    return {
      success: true,
      emailSent,
      whatsappSent,
      couponCode,
    };
  },
});

/**
 * Queue WhatsApp reminder via Authkey.io system (internal)
 */
export const queueWhatsAppReminder = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    recipientPhone: v.string(),
    recipientUserId: v.optional(v.id("users")),
    variables: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    // Check if abandoned_cart WhatsApp usecase is enabled
    const usecase = await ctx.db
      .query("whUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "abandoned_cart"))
      .first();

    if (!usecase?.enabled || !usecase.providerTemplateId) {
      console.log("[WhatsApp] abandoned_cart usecase not enabled or no template configured");
      return { queued: false, reason: "usecase_not_enabled" };
    }

    // Queue message via the WhatsApp messaging system
    await ctx.scheduler.runAfter(0, api.whatsappMessaging.queueMessage, {
      usecaseKey: "abandoned_cart",
      recipientPhone: args.recipientPhone,
      recipientUserId: args.recipientUserId,
      variables: args.variables,
      priority: 7, // High priority for abandoned cart reminders
    });

    console.log(`[WhatsApp] Abandoned cart message queued for ${args.recipientPhone}`);
    return { queued: true };
  },
});

/**
 * Trigger email reminder with dynamic settings (internal)
 */
export const triggerEmailReminderInternal = internalMutation({
  args: {
    cartId: v.id("abandonedCarts"),
    couponCode: v.string(),
    discountValue: v.number(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    validityDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cart = await ctx.db.get(args.cartId);

    if (!cart || !cart.userEmail) {
      console.log("No cart or email for abandoned cart reminder");
      return;
    }

    // Check if usecase is enabled
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "abandoned_cart"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("abandoned_cart email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = cart.items
      .map((item) => {
        const coverage =
          item.coverage === "full_body_wrap"
            ? "Full Body Wrap"
            : item.coverage === "only_back"
              ? "Only Back"
              : "";
        const model = item.phoneModel || "";
        const details =
          coverage && model ? `${model} - ${coverage}` : coverage || model;
        return `${item.productTitle}${details ? ` (${details})` : ""} x ${item.quantity}`;
      })
      .join(", ");

    // Get user name if available
    let customerName = "Customer";
    if (cart.userId) {
      const user = await ctx.db.get(cart.userId);
      if (user?.name) {
        customerName = user.name;
      }
    }

    // Get site URL for cart link
    const siteUrl = process.env.VITE_SITE_URL || "https://goskinly.com";
    const cartLink = `${siteUrl}/cart`;

    // Format discount amount using settings
    const discountAmount =
      args.discountType === "percentage"
        ? `${args.discountValue}%`
        : `₹${args.discountValue}`;

    await ctx.scheduler.runAfter(0, api.emailMessaging.queueMessage, {
      usecaseKey: "abandoned_cart",
      recipientEmail: cart.userEmail,
      recipientUserId: cart.userId,
      variables: {
        customerName,
        cartItems: itemsList,
        cartTotal: `₹${cart.cartTotal.toFixed(2)}`,
        cartLink,
        couponCode: args.couponCode,
        discountAmount, // Dynamic from settings
        expiryDays: String(args.validityDays), // Dynamic from settings
      },
      priority: 7, // High priority for abandoned cart
    });

    console.log(`Abandoned cart email queued for ${cart.userEmail}`);
  },
});

/**
 * Scheduled action to process abandoned cart reminders
 * Called by cron every 30 minutes
 */
export const scheduledProcessReminders = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; results: unknown[] }> => {
    console.log("[Cron] Starting scheduled abandoned cart reminder processing...");

    // Get settings
    const settings = await ctx.runQuery(
      internal.abandonedCartsInternal.getSettingsInternal,
      {}
    );

    // Get carts needing reminders
    const cartsNeedingReminders = await ctx.runQuery(
      internal.abandonedCartsInternal.getCartsNeedingRemindersInternal,
      { delayHours: settings.delayHours }
    );

    console.log(
      `[Cron] Found ${cartsNeedingReminders.length} carts needing reminders`
    );

    const results: unknown[] = [];

    for (const cart of cartsNeedingReminders) {
      try {
        const result = await ctx.runAction(
          internal.abandonedCartsInternal.sendReminderInternal,
          {
            cartId: cart._id,
            couponPrefix: settings.couponPrefix,
            discountType: settings.couponDiscountType as "percentage" | "fixed",
            discountValue: settings.couponDiscountValue,
            validityDays: settings.couponValidityDays,
          }
        );
        results.push(result);
      } catch (error) {
        console.error(
          `[Cron] Failed to send reminder for cart ${cart._id}:`,
          error
        );
        results.push({ success: false, cartId: cart._id, error: String(error) });
      }
    }

    console.log(
      `[Cron] Abandoned cart reminder processing complete. Processed: ${results.length}`
    );
    return {
      processed: results.length,
      results,
    };
  },
});

/**
 * Get stats for last cron run (for admin UI)
 */
export const getLastCronRunStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all pending carts that would be processed in next run
    const settings = await ctx.db.query("settings").collect();
    const settingsMap: Record<string, string | number | boolean> = {};

    for (const setting of settings) {
      if (setting.key.startsWith("abandoned_cart_")) {
        settingsMap[setting.key] = setting.value;
      }
    }

    const delayHours = (settingsMap.abandoned_cart_delay_hours as number) ?? 1;
    const delayMs = delayHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - delayMs;

    const pendingCarts = await ctx.db
      .query("abandonedCarts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("abandonedAt"), cutoffTime))
      .collect();

    return {
      cartsAwaitingReminder: pendingCarts.length,
      totalPendingValue: pendingCarts.reduce((sum, c) => sum + c.cartTotal, 0),
      delayHours,
    };
  },
});
