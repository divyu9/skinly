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
      .query("whatsappQueue")
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
    queueId: v.id("whatsappQueue"),
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
    queueId: v.id("whatsappQueue"),
    messageId: v.id("whatsappMessages"),
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
    queueId: v.id("whatsappQueue"),
    messageId: v.id("whatsappMessages"),
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
// INTERNAL QUERY: Get provider settings
// ============================================================================

export const getProviderSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "whatsapp_provider_config"))
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
// INTERNAL MUTATION: Schedule worker to run again
// ============================================================================

export const scheduleWorker = internalMutation({
  args: {
    delayMs: v.number(),
  },
  handler: async (ctx, args) => {
    // Note: This would schedule the worker, but we're triggering it on queue instead
  },
});
