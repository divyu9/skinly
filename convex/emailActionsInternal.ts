import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get order details for email
 */
export const getOrderForEmail = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    return order;
  },
});

/**
 * Internal query to get active email template
 */
export const getActiveTemplate = internalQuery({
  args: {
    templateType: v.union(
      v.literal("order_confirmed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled"),
      v.literal("payment_failed")
    ),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("emailTemplates")
      .withIndex("by_type_and_active", (q) =>
        q.eq("templateType", args.templateType).eq("isActive", true)
      )
      .first();

    return template;
  },
});

/**
 * Internal query to get email template by ID
 */
export const getTemplateById = internalQuery({
  args: { templateId: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    return template;
  },
});

/**
 * Internal mutation to log successful email send
 */
export const logEmailSent = internalMutation({
  args: {
    orderId: v.id("orders"),
    recipientEmail: v.string(),
    emailType: v.union(
      v.literal("order_confirmed"),
      v.literal("payment_failed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled")
    ),
    subject: v.string(),
    providerMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    // For now, just log to console since table may not exist yet
    console.log("Email sent:", args);
    
    // TODO: Uncomment when emailNotifications table is added to schema
    // await ctx.db.insert("emailNotifications", {
    //   orderId: args.orderId,
    //   recipientEmail: args.recipientEmail,
    //   emailType: args.emailType,
    //   subject: args.subject,
    //   status: "sent",
    //   sentAt: Date.now(),
    //   providerMessageId: args.providerMessageId,
    //   createdAt: Date.now(),
    // });
  },
});

/**
 * Internal mutation to log failed email send
 */
export const logEmailFailed = internalMutation({
  args: {
    orderId: v.id("orders"),
    emailType: v.union(
      v.literal("order_confirmed"),
      v.literal("payment_failed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled")
    ),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // For now, just log to console since table may not exist yet
    console.log("Email failed:", args);
    
    // TODO: Uncomment when emailNotifications table is added to schema
    // const order = await ctx.db.get(args.orderId);
    // await ctx.db.insert("emailNotifications", {
    //   orderId: args.orderId,
    //   recipientEmail: order?.customerEmail || "unknown",
    //   emailType: args.emailType,
    //   subject: `Email notification - ${args.emailType}`,
    //   status: "failed",
    //   errorMessage: args.errorMessage,
    //   createdAt: Date.now(),
    // });
  },
});
