import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

// ============================================================================
// GET ALL USE-CASES
// ============================================================================

export const getAllUsecases = query({
  args: {},
  handler: async (ctx) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usecases = await ctx.db.query("emailUsecaseTemplates").collect();

    return usecases.map((usecase) => ({
      _id: usecase._id,
      usecaseKey: usecase.usecaseKey,
      displayName: usecase.displayName,
      description: usecase.description ?? null,
      enabled: usecase.enabled,
      templateName: usecase.templateName ?? null,
      msg91TemplateId: usecase.msg91TemplateId ?? null,
      templateId: usecase.templateId ?? null,
      variableMapping: usecase.variableMapping ?? null,
      isTransactional: usecase.isTransactional,
      lastUpdatedBy: usecase.lastUpdatedBy ?? null,
      lastUpdatedAt: usecase.lastUpdatedAt ?? null,
    }));
  },
});

// ============================================================================
// UPDATE SINGLE USE-CASE
// ============================================================================

export const updateUsecase = mutation({
  args: {
    usecaseKey: v.string(),
    enabled: v.optional(v.boolean()),
    templateName: v.optional(v.string()),
    msg91TemplateId: v.optional(v.string()),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get the admin email for audit
    const adminEmail = args.updatedBy ?? identity.email ?? "unknown";

    // Find the use-case
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .unique();

    if (!usecase) {
      throw new ConvexError({
        message: `Use-case '${args.usecaseKey}' not found`,
        code: "NOT_FOUND",
      });
    }

    // Track changes for audit
    const changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    // Check if enabled changed
    if (args.enabled !== undefined && args.enabled !== usecase.enabled) {
      changes.push({
        field: "enabled",
        oldValue: usecase.enabled ? "true" : "false",
        newValue: args.enabled ? "true" : "false",
      });
    }

    // Check if template changed
    if (args.msg91TemplateId !== undefined && args.msg91TemplateId !== usecase.msg91TemplateId) {
      changes.push({
        field: "msg91_template_id",
        oldValue: usecase.msg91TemplateId ?? null,
        newValue: args.msg91TemplateId,
      });
    }

    // Check if template name changed
    if (args.templateName !== undefined && args.templateName !== usecase.templateName) {
      changes.push({
        field: "template_name",
        oldValue: usecase.templateName ?? null,
        newValue: args.templateName,
      });
    }

    // Update the use-case
    const updates: {
      enabled?: boolean;
      templateName?: string;
      msg91TemplateId?: string;
      lastUpdatedBy: string;
      lastUpdatedAt: number;
    } = {
      lastUpdatedBy: adminEmail,
      lastUpdatedAt: Date.now(),
    };

    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }
    if (args.templateName !== undefined) {
      updates.templateName = args.templateName;
    }
    if (args.msg91TemplateId !== undefined) {
      updates.msg91TemplateId = args.msg91TemplateId;
    }

    await ctx.db.patch(usecase._id, updates);

    // Create audit log entries
    for (const change of changes) {
      await ctx.db.insert("emailUsecaseAudit", {
        usecaseKey: args.usecaseKey,
        fieldChanged: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
        changedBy: adminEmail,
        changedAt: Date.now(),
      });
    }

    return {
      success: true,
      changes: changes.length,
    };
  },
});

// ============================================================================
// GET EMAIL MESSAGES (with filters)
// ============================================================================

export const getMessages = query({
  args: {
    usecaseKey: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const limit = args.limit ?? 100;
    
    let messages;
    const { usecaseKey, status } = args;
    
    if (usecaseKey !== undefined) {
      messages = await ctx.db
        .query("emailMessages")
        .withIndex("by_usecase", (q) => q.eq("usecaseKey", usecaseKey))
        .order("desc")
        .take(limit);
    } else if (status !== undefined) {
      messages = await ctx.db
        .query("emailMessages")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    } else {
      messages = await ctx.db
        .query("emailMessages")
        .order("desc")
        .take(limit);
    }

    return messages.map((msg) => ({
      _id: msg._id,
      usecaseKey: msg.usecaseKey,
      recipientEmail: msg.recipientEmail,
      recipientUserId: msg.recipientUserId ?? null,
      msg91TemplateId: msg.msg91TemplateId,
      templateName: msg.templateName,
      subject: msg.subject ?? null,
      variables: msg.variables ?? null,
      status: msg.status,
      providerMessageId: msg.providerMessageId ?? null,
      errorMessage: msg.errorMessage ?? null,
      retryCount: msg.retryCount,
      sentAt: msg.sentAt ?? null,
      deliveredAt: msg.deliveredAt ?? null,
      createdAt: msg.createdAt,
    }));
  },
});

// ============================================================================
// GET EMAIL STATS
// ============================================================================

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const allMessages = await ctx.db.query("emailMessages").collect();

    const total = allMessages.length;
    const sent = allMessages.filter(m => m.status === "sent" || m.status === "delivered").length;
    const failed = allMessages.filter(m => m.status === "failed").length;
    const pending = allMessages.filter(m => m.status === "pending").length;

    // Get recent messages (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = allMessages.filter(m => m.createdAt >= oneDayAgo);
    const recentSent = recentMessages.filter(m => m.status === "sent" || m.status === "delivered").length;
    const recentFailed = recentMessages.filter(m => m.status === "failed").length;

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? (sent / total * 100).toFixed(1) : "0.0",
      last24h: {
        total: recentMessages.length,
        sent: recentSent,
        failed: recentFailed,
      },
    };
  },
});

// ============================================================================
// GET DEBUG LOGS
// ============================================================================

export const getDebugLogs = query({
  args: {
    messageId: v.optional(v.id("emailMessages")),
    usecaseKey: v.optional(v.string()),
    success: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const limit = args.limit ?? 50;
    
    let logs;
    const { messageId, usecaseKey, success } = args;
    
    if (messageId !== undefined) {
      logs = await ctx.db
        .query("emailDebugLogs")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .order("desc")
        .take(limit);
    } else if (usecaseKey !== undefined) {
      logs = await ctx.db
        .query("emailDebugLogs")
        .withIndex("by_usecase", (q) => q.eq("usecaseKey", usecaseKey))
        .order("desc")
        .take(limit);
    } else if (success !== undefined) {
      logs = await ctx.db
        .query("emailDebugLogs")
        .withIndex("by_success", (q) => q.eq("success", success))
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db
        .query("emailDebugLogs")
        .order("desc")
        .take(limit);
    }

    return logs;
  },
});
