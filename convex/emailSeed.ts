import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// SEED EMAIL USE-CASES
// ============================================================================

const DEFAULT_EMAIL_USECASES = [
  {
    usecaseKey: "order_confirmed",
    displayName: "Order Confirmed",
    description: "Sent immediately after customer places an order",
    isTransactional: true,
    variables: ["customer_name", "order_number", "order_total", "items_list", "shipping_address", "payment_method"],
  },
  {
    usecaseKey: "order_dispatched",
    displayName: "Order Dispatched",
    description: "Sent when order is marked as shipped with tracking details",
    isTransactional: true,
    variables: ["customer_name", "order_number", "tracking_number", "tracking_link", "courier_name", "estimated_delivery"],
  },
  {
    usecaseKey: "order_delivered",
    displayName: "Order Delivered",
    description: "Sent when order is marked as delivered to customer",
    isTransactional: true,
    variables: ["customer_name", "order_number", "delivery_date", "review_link"],
  },
  {
    usecaseKey: "order_cancelled",
    displayName: "Order Cancelled",
    description: "Sent when an order is cancelled by admin or customer",
    isTransactional: true,
    variables: ["customer_name", "order_number", "cancellation_reason", "refund_amount", "refund_method"],
  },
  {
    usecaseKey: "payment_failed",
    displayName: "Payment Failed",
    description: "Sent when payment fails during checkout",
    isTransactional: true,
    variables: ["customer_name", "order_number", "payment_amount", "failure_reason", "retry_link"],
  },
  {
    usecaseKey: "abandoned_cart",
    displayName: "Abandoned Cart Reminder",
    description: "Sent to remind customers about items left in their cart",
    isTransactional: false,
    variables: ["customer_name", "cart_items", "cart_total", "cart_link"],
  },
  {
    usecaseKey: "back_in_stock",
    displayName: "Back in Stock Alert",
    description: "Sent when requested product comes back in stock",
    isTransactional: true,
    variables: ["customer_name", "product_name", "product_link"],
  },
  {
    usecaseKey: "model_requested",
    displayName: "Model Request Received",
    description: "Sent when customer requests a phone model not yet available",
    isTransactional: true,
    variables: ["customer_name", "model_name"],
  },
  {
    usecaseKey: "model_added",
    displayName: "Requested Model Added",
    description: "Sent when admin adds a previously requested phone model",
    isTransactional: true,
    variables: ["customer_name", "brand_name", "model_name", "shop_link"],
  },
];

/**
 * Seed email use-cases (safe to run multiple times - only creates missing ones)
 */
export const seedEmailUsecases = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let createdCount = 0;
    let skippedCount = 0;

    for (const usecase of DEFAULT_EMAIL_USECASES) {
      // Check if usecase already exists
      const existing = await ctx.db
        .query("emailUsecaseTemplates")
        .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", usecase.usecaseKey))
        .first();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Create new usecase with placeholder template ID
      await ctx.db.insert("emailUsecaseTemplates", {
        usecaseKey: usecase.usecaseKey,
        displayName: usecase.displayName,
        description: usecase.description,
        enabled: false, // Disabled by default until admin adds MSG91 template ID
        templateName: undefined,
        msg91TemplateId: undefined, // To be filled by admin
        templateId: undefined,
        variableMapping: undefined,
        isTransactional: usecase.isTransactional,
        lastUpdatedBy: "system_seed",
        lastUpdatedAt: now,
      });

      createdCount++;
    }

    return {
      success: true,
      created: createdCount,
      skipped: skippedCount,
      total: DEFAULT_EMAIL_USECASES.length,
    };
  },
});

/**
 * Get all seeded use-cases with their required variables
 */
export const getEmailUsecaseVariables = mutation({
  args: {},
  handler: async () => {
    return DEFAULT_EMAIL_USECASES.map((uc) => ({
      usecaseKey: uc.usecaseKey,
      displayName: uc.displayName,
      description: uc.description,
      variables: uc.variables,
      isTransactional: uc.isTransactional,
    }));
  },
});

/**
 * Reset all email use-cases (DANGEROUS - only for development)
 */
export const resetEmailUsecases = mutation({
  args: {
    confirmReset: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.confirmReset) {
      throw new Error("Must confirm reset");
    }

    // Delete all existing use-cases
    const allUsecases = await ctx.db.query("emailUsecaseTemplates").collect();
    for (const usecase of allUsecases) {
      await ctx.db.delete(usecase._id);
    }

    // Re-seed
    const now = Date.now();
    let createdCount = 0;

    for (const usecase of DEFAULT_EMAIL_USECASES) {
      await ctx.db.insert("emailUsecaseTemplates", {
        usecaseKey: usecase.usecaseKey,
        displayName: usecase.displayName,
        description: usecase.description,
        enabled: false,
        templateName: undefined,
        msg91TemplateId: undefined,
        templateId: undefined,
        variableMapping: undefined,
        isTransactional: usecase.isTransactional,
        lastUpdatedBy: "system_seed",
        lastUpdatedAt: now,
      });
      createdCount++;
    }

    return {
      deleted: allUsecases.length,
      created: createdCount,
      success: true,
    };
  },
});
