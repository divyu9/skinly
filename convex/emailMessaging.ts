import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// ============================================================================
// INTERNAL MUTATION: Queue a test message (bypasses usecase checks)
// ============================================================================

export const queueTestMessage = internalMutation({
  args: {
    recipientEmail: v.string(),
    msg91TemplateId: v.string(),
    templateName: v.string(),
    subject: v.optional(v.string()),
    variables: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create message record with a special "test_message" usecase
    const messageId = await ctx.db.insert("emailMessages", {
      usecaseKey: "test_message",
      recipientEmail: args.recipientEmail,
      recipientUserId: undefined,
      msg91TemplateId: args.msg91TemplateId,
      templateName: args.templateName,
      subject: args.subject,
      variables: args.variables,
      status: "pending",
      retryCount: 0,
      createdAt: now,
    });

    // Add to queue with high priority
    const queueId = await ctx.db.insert("emailQueue", {
      messageId,
      priority: 10, // Highest priority for test messages
      scheduledFor: now, // Send immediately
      attempts: 0,
      status: "pending",
    });

    console.log(`Test email queued:`, {
      messageId,
      queueId,
      recipientEmail: args.recipientEmail,
      templateName: args.templateName,
    });

    // Schedule worker to process the queue immediately
    await ctx.scheduler.runAfter(
      500, // Process after 500ms
      api.emailWorker.processQueue,
      { batchSize: 1 }
    );

    return {
      queued: true,
      messageId,
      queueId,
    };
  },
});

// ============================================================================
// MUTATION: Queue an email message
// ============================================================================

export const queueMessage = mutation({
  args: {
    usecaseKey: v.string(), // Which use-case (e.g., "order_confirmed")
    recipientEmail: v.string(), // Email address
    recipientUserId: v.optional(v.id("users")), // User ID if available
    variables: v.optional(v.record(v.string(), v.string())), // Variables to substitute
    priority: v.optional(v.number()), // Priority (1-10, default 5)
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the use-case configuration
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .unique();

    if (!usecase) {
      throw new ConvexError({
        message: `Email use-case '${args.usecaseKey}' not found`,
        code: "NOT_FOUND",
      });
    }

    // Check if use-case is enabled
    if (!usecase.enabled) {
      console.log(`Email use-case '${args.usecaseKey}' is disabled, skipping`);
      return { queued: false, reason: "use_case_disabled" };
    }

    // Check if template is configured
    if (!usecase.msg91TemplateId) {
      console.log(`Email use-case '${args.usecaseKey}' has no MSG91 template ID, skipping`);
      return { queued: false, reason: "template_not_configured" };
    }

    // Validate email address
    if (!args.recipientEmail || !args.recipientEmail.includes("@")) {
      throw new ConvexError({
        message: "Invalid email address",
        code: "BAD_REQUEST",
      });
    }

    // Create message record
    const messageId = await ctx.db.insert("emailMessages", {
      usecaseKey: args.usecaseKey,
      recipientEmail: args.recipientEmail,
      recipientUserId: args.recipientUserId,
      msg91TemplateId: usecase.msg91TemplateId,
      templateName: usecase.templateName || args.usecaseKey,
      subject: undefined, // MSG91 template handles subject
      variables: args.variables,
      status: "pending",
      retryCount: 0,
      createdAt: now,
    });

    // Add to queue
    const queueId = await ctx.db.insert("emailQueue", {
      messageId,
      priority: args.priority ?? 5, // Default priority: 5
      scheduledFor: now, // Send immediately
      attempts: 0,
      status: "pending",
    });

    console.log(`Email queued:`, {
      messageId,
      queueId,
      usecaseKey: args.usecaseKey,
      recipientEmail: args.recipientEmail,
    });

    // Schedule worker to process the queue
    await ctx.scheduler.runAfter(
      2000, // Process after 2 seconds
      api.emailWorker.processQueue,
      { batchSize: 5 }
    );

    return {
      queued: true,
      messageId,
      queueId,
    };
  },
});

// ============================================================================
// MUTATION: Queue delayed email (for scheduled sends)
// ============================================================================

export const queueDelayedMessage = mutation({
  args: {
    usecaseKey: v.string(),
    recipientEmail: v.string(),
    recipientUserId: v.optional(v.id("users")),
    variables: v.optional(v.record(v.string(), v.string())),
    delayMs: v.number(), // Delay in milliseconds
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const scheduledFor = now + args.delayMs;

    // Get the use-case configuration
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .unique();

    if (!usecase) {
      throw new ConvexError({
        message: `Email use-case '${args.usecaseKey}' not found`,
        code: "NOT_FOUND",
      });
    }

    // Check if use-case is enabled
    if (!usecase.enabled) {
      console.log(`Email use-case '${args.usecaseKey}' is disabled, skipping`);
      return { queued: false, reason: "use_case_disabled" };
    }

    // Check if template is configured
    if (!usecase.msg91TemplateId) {
      console.log(`Email use-case '${args.usecaseKey}' has no MSG91 template ID, skipping`);
      return { queued: false, reason: "template_not_configured" };
    }

    // Create message record
    const messageId = await ctx.db.insert("emailMessages", {
      usecaseKey: args.usecaseKey,
      recipientEmail: args.recipientEmail,
      recipientUserId: args.recipientUserId,
      msg91TemplateId: usecase.msg91TemplateId,
      templateName: usecase.templateName || args.usecaseKey,
      subject: undefined,
      variables: args.variables,
      status: "pending",
      retryCount: 0,
      createdAt: now,
    });

    // Add to queue with scheduled time
    const queueId = await ctx.db.insert("emailQueue", {
      messageId,
      priority: args.priority ?? 5,
      scheduledFor,
      attempts: 0,
      status: "pending",
    });

    console.log(`Delayed email queued:`, {
      messageId,
      queueId,
      usecaseKey: args.usecaseKey,
      recipientEmail: args.recipientEmail,
      scheduledFor: new Date(scheduledFor).toISOString(),
    });

    // Schedule worker to process at the scheduled time
    await ctx.scheduler.runAt(
      scheduledFor,
      api.emailWorker.processQueue,
      { batchSize: 5 }
    );

    return {
      queued: true,
      messageId,
      queueId,
      scheduledFor,
    };
  },
});
