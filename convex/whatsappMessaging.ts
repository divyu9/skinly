import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.d.ts";

// ============================================================================
// HELPER: Clean phone number
// ============================================================================

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s+\-()]/g, "");
}



// ============================================================================
// MUTATION: Queue a WhatsApp message
// ============================================================================

export const queueMessage = mutation({
  args: {
    usecaseKey: v.string(), // Which use-case (e.g., "order_received")
    recipientPhone: v.string(), // Phone number
    recipientUserId: v.optional(v.id("users")), // User ID if available
    variables: v.optional(v.record(v.string(), v.string())), // Variables to substitute
    priority: v.optional(v.number()), // Priority (1-10, default 5)
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the use-case configuration
    const usecase = await ctx.db
      .query("whUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .unique();

    if (!usecase) {
      throw new ConvexError({
        message: `Use-case '${args.usecaseKey}' not found`,
        code: "NOT_FOUND",
      });
    }

    // Check if use-case is enabled
    if (!usecase.enabled) {
      console.log(`Use-case '${args.usecaseKey}' is disabled, skipping message`);
      return { queued: false, reason: "disabled" };
    }

    // Check if template is assigned
    if (!usecase.providerTemplateId || !usecase.templateName) {
      console.log(`Use-case '${args.usecaseKey}' has no template assigned, skipping message`);
      return { queued: false, reason: "no_template" };
    }

    // Clean phone number
    const cleanedPhone = cleanPhoneNumber(args.recipientPhone);

    // Check consent
    const consent = await ctx.db
      .query("whatsappConsent")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", cleanedPhone))
      .unique();

    let hasConsent = false;
    if (!consent) {
      // No consent record - allow transactional, deny marketing
      hasConsent = usecase.isTransactional;
    } else if (consent.consentType === "none") {
      hasConsent = false; // User opted out completely
    } else if (consent.consentType === "transactional_only" && !usecase.isTransactional) {
      hasConsent = false; // User only wants transactional
    } else {
      hasConsent = true; // "all" consent or transactional message to transactional_only user
    }

    if (!hasConsent) {
      console.log(`User ${cleanedPhone} has not consented to ${usecase.isTransactional ? 'transactional' : 'marketing'} messages`);
      return { queued: false, reason: "no_consent" };
    }

    // Create message record
    const messageId = await ctx.db.insert("whatsappMessages", {
      usecaseKey: args.usecaseKey,
      recipientPhone: cleanedPhone,
      recipientUserId: args.recipientUserId,
      providerTemplateId: usecase.providerTemplateId,
      templateName: usecase.templateName,
      variables: args.variables,
      status: "pending",
      retryCount: 0,
      createdAt: now,
    });

    // Add to queue
    const queueId = await ctx.db.insert("whatsappQueue", {
      messageId,
      priority: args.priority ?? 5,
      scheduledFor: now, // Send immediately
      attempts: 0,
      status: "pending",
    });

    console.log(`Message queued:`, {
      messageId,
      queueId,
      usecaseKey: args.usecaseKey,
      recipientPhone: cleanedPhone,
    });

    // Schedule worker to process the queue (runs after 2 seconds to batch messages)
    await ctx.scheduler.runAfter(
      2000,
      api.whatsappWorker.processQueue,
      { batchSize: 10 }
    );

    return {
      queued: true,
      messageId,
      queueId,
    };
  },
});

// ============================================================================
// QUERY: Get message status
// ============================================================================

export const getMessageStatus = query({
  args: {
    messageId: v.id("whatsappMessages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    
    if (!message) {
      throw new ConvexError({
        message: "Message not found",
        code: "NOT_FOUND",
      });
    }

    return {
      status: message.status,
      retryCount: message.retryCount,
      errorMessage: message.errorMessage,
      sentAt: message.sentAt,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
    };
  },
});

// ============================================================================
// QUERY: Get queue statistics
// ============================================================================

export const getQueueStats = query({
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

    const pending = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const processing = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    const completed = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    const failed = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return {
      pending: pending.length,
      processing: processing.length,
      completed: completed.length,
      failed: failed.length,
      total: pending.length + processing.length + completed.length + failed.length,
    };
  },
});

// ============================================================================
// QUERY: Get message delivery statistics
// ============================================================================

export const getDeliveryStats = query({
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

    const pending = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const sent = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();

    const delivered = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_status", (q) => q.eq("status", "delivered"))
      .collect();

    const read = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_status", (q) => q.eq("status", "read"))
      .collect();

    const failed = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return {
      pending: pending.length,
      sent: sent.length,
      delivered: delivered.length,
      read: read.length,
      failed: failed.length,
      total: pending.length + sent.length + delivered.length + read.length + failed.length,
    };
  },
});

// ============================================================================
// QUERY: Get recent webhook logs
// ============================================================================

export const getRecentWebhooks = query({
  args: {
    limit: v.optional(v.number()),
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

    const webhooks = await ctx.db
      .query("whatsappWebhooks")
      .withIndex("by_processed_at")
      .order("desc")
      .take(args.limit ?? 50);

    return webhooks.map((webhook) => ({
      ...webhook,
      processedAtFormatted: new Date(webhook.processedAt).toLocaleString(),
    }));
  },
});

// ============================================================================
// MUTATION: Retry failed message
// ============================================================================

export const retryMessage = mutation({
  args: {
    messageId: v.id("whatsappMessages"),
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

    const message = await ctx.db.get(args.messageId);
    
    if (!message) {
      throw new ConvexError({
        message: "Message not found",
        code: "NOT_FOUND",
      });
    }

    // Find queue item
    const queueItem = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!queueItem) {
      throw new ConvexError({
        message: "Queue item not found",
        code: "NOT_FOUND",
      });
    }

    // Reset status
    await ctx.db.patch(queueItem._id, {
      status: "pending",
      scheduledFor: Date.now(),
      attempts: 0,
      errorMessage: undefined,
    });

    await ctx.db.patch(args.messageId, {
      status: "pending",
      retryCount: 0,
      errorMessage: undefined,
    });

    return { success: true };
  },
});

// ============================================================================
// MUTATION: Manually trigger worker (admin only)
// ============================================================================

export const triggerWorker = mutation({
  args: {
    batchSize: v.optional(v.number()),
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

    // Schedule worker immediately
    await ctx.scheduler.runAfter(
      0,
      api.whatsappWorker.processQueue,
      { batchSize: args.batchSize ?? 10 }
    );

    return { success: true, message: "Worker scheduled" };
  },
});

// ============================================================================
// MUTATION: Log webhook for audit trail
// ============================================================================

export const logWebhook = mutation({
  args: {
    eventType: v.string(),
    phoneNumber: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    status: v.optional(v.string()),
    rawPayload: v.string(),
    processedAt: v.number(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const webhookId = await ctx.db.insert("whatsappWebhooks", args);
    return webhookId;
  },
});

// ============================================================================
// MUTATION: Process webhook delivery status update
// ============================================================================

export const processWebhookUpdate = mutation({
  args: {
    providerMessageId: v.optional(v.string()), // Message ID from authkey
    phoneNumber: v.optional(v.string()), // Recipient phone
    status: v.string(), // Delivery status (sent/delivered/read/failed)
    errorMessage: v.optional(v.string()), // Error details if failed
    rawPayload: v.string(), // Raw webhook payload for logging
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find message by provider message ID or phone number
    let message = null;
    
    if (args.providerMessageId) {
      message = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_provider_message_id", (q) =>
          q.eq("providerMessageId", args.providerMessageId)
        )
        .first();
    }
    
    // If not found by provider ID, try phone number (find most recent pending/sent message)
    if (!message && args.phoneNumber) {
      const cleanedPhone = cleanPhoneNumber(args.phoneNumber);
      const recentMessages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_recipient", (q) => q.eq("recipientPhone", cleanedPhone))
        .order("desc")
        .take(10);
      
      // Find first message that's not delivered/read/failed
      message = recentMessages.find(
        (m) => m.status === "pending" || m.status === "sent"
      ) ?? null;
    }

    if (!message) {
      console.log("Message not found for webhook update:", {
        providerMessageId: args.providerMessageId,
        phoneNumber: args.phoneNumber,
      });
      return { 
        success: false, 
        reason: "message_not_found",
        providerMessageId: args.providerMessageId 
      };
    }

    // Map status to our schema
    const statusMap: Record<string, "pending" | "sent" | "delivered" | "read" | "failed"> = {
      sent: "sent",
      delivered: "delivered",
      read: "read",
      failed: "failed",
      error: "failed",
      undelivered: "failed",
    };

    const mappedStatus = statusMap[args.status.toLowerCase()] ?? "sent";

    // Update message status
    const updates: Record<string, unknown> = {
      status: mappedStatus,
    };

    // Update timestamp based on status
    if (mappedStatus === "sent" && !message.sentAt) {
      updates.sentAt = now;
    } else if (mappedStatus === "delivered" && !message.deliveredAt) {
      updates.deliveredAt = now;
    } else if (mappedStatus === "read" && !message.readAt) {
      updates.readAt = now;
    }

    // Update provider message ID if provided and not set
    if (args.providerMessageId && !message.providerMessageId) {
      updates.providerMessageId = args.providerMessageId;
    }

    // Add error message if failed
    if (mappedStatus === "failed" && args.errorMessage) {
      updates.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(message._id, updates);

    console.log("Message status updated:", {
      messageId: message._id,
      oldStatus: message.status,
      newStatus: mappedStatus,
      providerMessageId: args.providerMessageId,
    });

    return {
      success: true,
      messageId: message._id,
      oldStatus: message.status,
      newStatus: mappedStatus,
    };
  },
});
