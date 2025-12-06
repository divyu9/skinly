import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Available variables for each template type
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  order_confirmed: [
    "customer_name",
    "order_id",
    "order_number",
    "order_date",
    "order_total",
    "items_list",
    "shipping_address",
    "payment_method",
    "tracking_link",
  ],
  order_dispatched: [
    "customer_name",
    "order_id",
    "order_number",
    "tracking_number",
    "tracking_link",
    "courier_name",
    "estimated_delivery",
  ],
  order_delivered: [
    "customer_name",
    "order_id",
    "order_number",
    "delivery_date",
    "review_link",
  ],
  order_cancelled: [
    "customer_name",
    "order_id",
    "order_number",
    "cancellation_reason",
    "refund_amount",
    "refund_method",
  ],
  payment_failed: [
    "customer_name",
    "order_id",
    "order_number",
    "payment_amount",
    "failure_reason",
    "retry_link",
  ],
};

// Get all email templates
export const getAllTemplates = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const templates = await ctx.db.query("emailTemplates").collect();
    return templates;
  },
});

// Get templates by type
export const getTemplatesByType = query({
  args: { templateType: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const templates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_type", (q) => q.eq("templateType", args.templateType as "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled" | "payment_failed"))
      .collect();

    return templates;
  },
});

// Get active template for a specific type
export const getActiveTemplate = query({
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

// Get available variables for a template type
export const getTemplateVariables = query({
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
    return TEMPLATE_VARIABLES[args.templateType] || [];
  },
});

// Create new email template
export const createTemplate = mutation({
  args: {
    templateType: v.union(
      v.literal("order_confirmed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled"),
      v.literal("payment_failed")
    ),
    templateName: v.string(),
    subject: v.string(),
    htmlContent: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // If setting as active, deactivate other templates of the same type
    if (args.isActive) {
      const existingTemplates = await ctx.db
        .query("emailTemplates")
        .withIndex("by_type_and_active", (q) =>
          q.eq("templateType", args.templateType).eq("isActive", true)
        )
        .collect();

      for (const template of existingTemplates) {
        await ctx.db.patch(template._id, { isActive: false });
      }
    }

    const templateId = await ctx.db.insert("emailTemplates", {
      templateType: args.templateType,
      templateName: args.templateName,
      subject: args.subject,
      htmlContent: args.htmlContent,
      isActive: args.isActive,
      variables: TEMPLATE_VARIABLES[args.templateType] || [],
      createdBy: identity.email || identity.name || "Unknown Admin",
      createdAt: Date.now(),
      lastActivatedAt: args.isActive ? Date.now() : undefined,
    });

    return templateId;
  },
});

// Update email template
export const updateTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
    templateName: v.optional(v.string()),
    subject: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    // If activating this template, deactivate others of the same type
    if (args.isActive === true && !template.isActive) {
      const existingTemplates = await ctx.db
        .query("emailTemplates")
        .withIndex("by_type_and_active", (q) =>
          q.eq("templateType", template.templateType).eq("isActive", true)
        )
        .collect();

      for (const existingTemplate of existingTemplates) {
        await ctx.db.patch(existingTemplate._id, { isActive: false });
      }
    }

    const updateData: {
      templateName?: string;
      subject?: string;
      htmlContent?: string;
      isActive?: boolean;
      updatedAt: number;
      lastActivatedAt?: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.templateName !== undefined) updateData.templateName = args.templateName;
    if (args.subject !== undefined) updateData.subject = args.subject;
    if (args.htmlContent !== undefined) updateData.htmlContent = args.htmlContent;
    if (args.isActive !== undefined) {
      updateData.isActive = args.isActive;
      if (args.isActive) {
        updateData.lastActivatedAt = Date.now();
      }
    }

    await ctx.db.patch(args.templateId, updateData);

    return args.templateId;
  },
});

// Delete email template
export const deleteTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.templateId);

    return { success: true };
  },
});

// Toggle template active status
export const toggleTemplateActive = mutation({
  args: {
    templateId: v.id("emailTemplates"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    const newActiveState = !template.isActive;

    // If activating, deactivate other templates of the same type
    if (newActiveState) {
      const existingTemplates = await ctx.db
        .query("emailTemplates")
        .withIndex("by_type_and_active", (q) =>
          q.eq("templateType", template.templateType).eq("isActive", true)
        )
        .collect();

      for (const existingTemplate of existingTemplates) {
        await ctx.db.patch(existingTemplate._id, { isActive: false });
      }
    }

    await ctx.db.patch(args.templateId, {
      isActive: newActiveState,
      updatedAt: Date.now(),
      lastActivatedAt: newActiveState ? Date.now() : template.lastActivatedAt,
    });

    return { isActive: newActiveState };
  },
});
