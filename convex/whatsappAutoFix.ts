import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";

/**
 * Auto-link templates to use cases by matching names
 * Attempts to intelligently match template names to use case keys
 */
export const autoLinkTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usecases = await ctx.db.query("whUsecaseTemplates").collect();
    const templates = await ctx.db.query("whApprovedTemplates").collect();

    // Mapping of usecase keys to likely template provider IDs
    const mappings: Record<string, string> = {
      order_received: "ORDER_RECEIVED_V3",
      order_dispatched: "ORDER_DISPATCHED_V2",
      order_cancelled: "ORDER_CANCELLED_V1",
      cod_confirmation: "COD_CONFIRMATION_V1",
      partial_cod: "PARTIAL_COD_V1",
      order_delivered: "ORDER_DELIVERED_V1",
      review_request: "REVIEW_REQUEST_V1",
      review_reminder: "REVIEW_REMINDER_V1",
      back_in_stock: "BACK_IN_STOCK_V2",
      model_requested: "MODEL_REQUEST_V1",
      model_added: "MODEL_ADDED_V1",
      model_request_rejected: "MODEL_REJECTED_V1",
      cod_otp_verification: "COD_OTP_V1",
      out_of_stock_alert: "OUT_OF_STOCK_V1",
      otp_login: "LOGIN_OTP_V1",
      abandoned_cart: "ABANDONED_CART_V3",
      refund_initiated: "REFUND_INITIATED_V1",
      return_update: "RETURN_UPDATE_V1",
      payment_failed: "PAYMENT_FAILED_V1",
      price_drop: "PRICE_DROP_V1",
      winback_campaign: "WINBACK_V1",
      birthday_offer: "BIRTHDAY_V1",
      admin_new_order: "ADMIN_NEW_ORDER_V1",
    };

    let linked = 0;
    let skipped = 0;

    for (const usecase of usecases) {
      // Skip if already has template
      if (usecase.providerTemplateId && usecase.templateName) {
        skipped++;
        continue;
      }

      // Try to find matching template
      const suggestedTemplateId = mappings[usecase.usecaseKey];
      if (!suggestedTemplateId) {
        skipped++;
        continue;
      }

      const template = templates.find(
        (t) => t.providerTemplateId === suggestedTemplateId
      );

      if (!template) {
        skipped++;
        continue;
      }

      // Link template to use case
      await ctx.db.patch(usecase._id, {
        providerTemplateId: template.providerTemplateId,
        templateName: template.templateName,
      });

      linked++;
    }

    return {
      success: true,
      linked,
      skipped,
      message: `Linked ${linked} templates, skipped ${skipped}`,
    };
  },
});

/**
 * Enable all transactional use cases at once
 */
export const enableTransactionalUsecases = mutation({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usecases = await ctx.db.query("whUsecaseTemplates").collect();

    let enabled = 0;
    let skipped = 0;

    for (const usecase of usecases) {
      // Skip if already enabled
      if (usecase.enabled) {
        skipped++;
        continue;
      }

      // Only enable transactional use cases
      if (!usecase.isTransactional) {
        skipped++;
        continue;
      }

      // Only enable if template is assigned
      if (!usecase.providerTemplateId || !usecase.templateName) {
        skipped++;
        continue;
      }

      await ctx.db.patch(usecase._id, {
        enabled: true,
      });

      enabled++;
    }

    return {
      success: true,
      enabled,
      skipped,
      message: `Enabled ${enabled} transactional use cases, skipped ${skipped}`,
    };
  },
});

/**
 * Clear stuck and failed messages from the queue
 */
export const clearStuckQueue = mutation({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get stuck messages (processing for more than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const allProcessing = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    const stuckMessages = allProcessing.filter(
      (q) => (q.lastAttemptAt ?? q.scheduledFor) < fiveMinutesAgo
    );

    // Get all failed messages
    const failedMessages = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    let cleared = 0;

    // Reset stuck messages to pending
    for (const msg of stuckMessages) {
      await ctx.db.patch(msg._id, {
        status: "pending",
        attempts: 0,
      });
      cleared++;
    }

    // Delete old failed messages (older than 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const msg of failedMessages) {
      if (msg.scheduledFor < sevenDaysAgo) {
        await ctx.db.delete(msg._id);
        cleared++;
      }
    }

    return {
      success: true,
      cleared,
      stuckReset: stuckMessages.length,
      oldFailedDeleted: failedMessages.filter((m) => m.scheduledFor < sevenDaysAgo).length,
      message: `Cleared ${cleared} stuck/failed messages`,
    };
  },
});

/**
 * Fix a specific use case by enabling it and linking a template
 */
export const fixUsecase = mutation({
  args: {
    usecaseKey: v.string(),
    providerTemplateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usecase = await ctx.db
      .query("whUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .unique();

    if (!usecase) {
      throw new ConvexError({
        message: "Use case not found",
        code: "NOT_FOUND",
      });
    }

    const updates: {
      enabled?: boolean;
      providerTemplateId?: string;
      templateName?: string;
    } = {};

    // Enable if disabled
    if (!usecase.enabled) {
      updates.enabled = true;
    }

    // Link template if provided and not already linked
    if (args.providerTemplateId && !usecase.providerTemplateId) {
      const providedTemplateId = args.providerTemplateId;
      const template = await ctx.db
        .query("whApprovedTemplates")
        .withIndex("by_provider_id", (q) =>
          q.eq("providerTemplateId", providedTemplateId)
        )
        .unique();

      if (!template) {
        throw new ConvexError({
          message: "Template not found",
          code: "NOT_FOUND",
        });
      }

      updates.providerTemplateId = template.providerTemplateId;
      updates.templateName = template.templateName;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(usecase._id, updates);
    }

    return {
      success: true,
      message: "Use case fixed successfully",
    };
  },
});
