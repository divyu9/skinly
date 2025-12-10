import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// ============================================================================
// INTERNAL QUERY: Get next pending message from queue
// ============================================================================

export const getNextPendingMessage = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get next pending message that's ready to send
    const queueItem = await ctx.db
      .query("emailQueue")
      .withIndex("by_status_and_scheduled", (q) =>
        q.eq("status", "pending")
      )
      .filter((q) => q.lte(q.field("scheduledFor"), now))
      .order("asc") // FIFO
      .first();

    if (!queueItem) {
      return null;
    }

    // Get the message details
    const message = await ctx.db.get(queueItem.messageId);
    
    if (!message) {
      // Message was deleted - will be cleaned up in mutation
      return null;
    }

    return {
      queueId: queueItem._id,
      messageId: message._id,
      message,
    };
  },
});

// ============================================================================
// INTERNAL MUTATION: Mark queue item as processing
// ============================================================================

export const markAsProcessing = internalMutation({
  args: {
    queueId: v.id("emailQueue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "processing",
      lastAttemptAt: Date.now(),
    });
  },
});

// ============================================================================
// INTERNAL MUTATION: Mark message as sent
// ============================================================================

export const markAsSent = internalMutation({
  args: {
    queueId: v.id("emailQueue"),
    messageId: v.id("emailMessages"),
    providerMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Update queue
    await ctx.db.patch(args.queueId, {
      status: "completed",
    });

    // Update message
    await ctx.db.patch(args.messageId, {
      status: "sent",
      providerMessageId: args.providerMessageId,
      sentAt: now,
    });
  },
});

// ============================================================================
// INTERNAL MUTATION: Mark message as failed (with retry)
// ============================================================================

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRY_DELAY = 300000; // 5 minutes

function calculateRetryDelay(attemptNumber: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attemptNumber);
  return Math.min(delay, MAX_RETRY_DELAY);
}

export const markAsFailed = internalMutation({
  args: {
    queueId: v.id("emailQueue"),
    messageId: v.id("emailMessages"),
    errorMessage: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if we should retry
    if (args.attempts < MAX_RETRIES) {
      // Schedule retry
      const retryDelay = calculateRetryDelay(args.attempts);
      const nextRetryAt = now + retryDelay;
      
      await ctx.db.patch(args.queueId, {
        status: "pending",
        attempts: args.attempts + 1,
        nextRetryAt,
        scheduledFor: nextRetryAt,
        errorMessage: args.errorMessage,
      });

      await ctx.db.patch(args.messageId, {
        retryCount: args.attempts,
        errorMessage: args.errorMessage,
      });
    } else {
      // Max retries reached, mark as permanently failed
      await ctx.db.patch(args.queueId, {
        status: "failed",
        errorMessage: args.errorMessage,
      });

      await ctx.db.patch(args.messageId, {
        status: "failed",
        retryCount: args.attempts,
        errorMessage: args.errorMessage,
      });
    }
  },
});

// ============================================================================
// INTERNAL QUERY: Get MSG91 settings
// ============================================================================

export const getMSG91Settings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "msg91_email_config"))
      .unique();

    if (!setting) {
      return null;
    }

    return typeof setting.value === "string"
      ? JSON.parse(setting.value)
      : setting.value;
  },
});

// ============================================================================
// INTERNAL QUERY: Get template variables
// ============================================================================

export const getTemplateVariables = internalQuery({
  args: {
    msg91TemplateId: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("emailTemplates")
      .withIndex("by_msg91_id", (q) => q.eq("msg91TemplateId", args.msg91TemplateId))
      .first();

    if (!template || !template.variables) {
      return [];
    }

    return template.variables;
  },
});

// ============================================================================
// INTERNAL MUTATION: Create debug log entry
// ============================================================================

export const createDebugLog = internalMutation({
  args: {
    messageId: v.id("emailMessages"),
    usecaseKey: v.string(),
    recipientEmail: v.string(),
    templateId: v.string(),
    requestUrl: v.string(),
    requestBody: v.string(),
    requestVariables: v.string(),
    responseStatus: v.number(),
    responseBody: v.string(),
    success: v.boolean(),
    errorType: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailDebugLogs", {
      messageId: args.messageId,
      usecaseKey: args.usecaseKey,
      recipientEmail: args.recipientEmail,
      templateId: args.templateId,
      requestUrl: args.requestUrl,
      requestBody: args.requestBody,
      requestVariables: args.requestVariables,
      responseStatus: args.responseStatus,
      responseBody: args.responseBody,
      success: args.success,
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      createdAt: args.createdAt,
    });
  },
});
