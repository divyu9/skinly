import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel.d.ts";

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

    // TODO: Add admin role check once role system is in place
    // For now, any authenticated user can view

    const usecases = await ctx.db.query("whUsecaseTemplates").collect();

    return usecases.map((usecase) => ({
      usecaseKey: usecase.usecaseKey,
      displayName: usecase.displayName,
      enabled: usecase.enabled,
      templateName: usecase.templateName ?? null,
      providerTemplateId: usecase.providerTemplateId ?? null,
      isTransactional: usecase.isTransactional,
      requireConsent: usecase.requireConsent,
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
    providerTemplateId: v.optional(v.string()),
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

    // TODO: Add admin role check once role system is in place
    // For now, any authenticated user can update

    // Get the admin email for audit
    const adminEmail = args.updatedBy ?? identity.email ?? "unknown";

    // Find the use-case
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
    if (
      args.templateName !== undefined &&
      args.templateName !== usecase.templateName
    ) {
      changes.push({
        field: "template_name",
        oldValue: usecase.templateName ?? null,
        newValue: args.templateName ?? null,
      });
    }

    // Update the use-case
    const updates: Partial<Doc<"whUsecaseTemplates">> = {
      lastUpdatedBy: adminEmail,
      lastUpdatedAt: Date.now(),
    };

    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }

    if (args.templateName !== undefined) {
      updates.templateName = args.templateName;
    }

    if (args.providerTemplateId !== undefined) {
      updates.providerTemplateId = args.providerTemplateId;
    }

    await ctx.db.patch(usecase._id, updates);

    // Insert audit records
    for (const change of changes) {
      await ctx.db.insert("whUsecaseAudit", {
        usecaseKey: args.usecaseKey,
        fieldChanged: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
        changedBy: adminEmail,
        changedAt: Date.now(),
      });
    }

    // Check for warnings
    const complianceWarning =
      args.enabled &&
      !usecase.isTransactional &&
      usecase.requireConsent;

    // Fetch updated record
    const updated = await ctx.db.get(usecase._id);

    return {
      ...updated,
      complianceWarning,
    };
  },
});

// ============================================================================
// BULK UPDATE USE-CASES
// ============================================================================

export const bulkUpdateUsecases = mutation({
  args: {
    keys: v.array(v.string()),
    enabled: v.boolean(),
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

    // TODO: Add admin role check once role system is in place

    const adminEmail = args.updatedBy ?? identity.email ?? "unknown";
    const timestamp = Date.now();

    let updated = 0;

    for (const key of args.keys) {
      const usecase = await ctx.db
        .query("whUsecaseTemplates")
        .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", key))
        .unique();

      if (!usecase) continue;

      // Only update if value is different
      if (usecase.enabled !== args.enabled) {
        await ctx.db.patch(usecase._id, {
          enabled: args.enabled,
          lastUpdatedBy: adminEmail,
          lastUpdatedAt: timestamp,
        });

        // Insert audit record
        await ctx.db.insert("whUsecaseAudit", {
          usecaseKey: key,
          fieldChanged: "enabled",
          oldValue: usecase.enabled ? "true" : "false",
          newValue: args.enabled ? "true" : "false",
          changedBy: adminEmail,
          changedAt: timestamp,
        });

        updated++;
      }
    }

    return {
      success: true,
      updated,
      message: `Updated ${updated} use-case${updated !== 1 ? "s" : ""}`,
    };
  },
});

// ============================================================================
// GET APPROVED TEMPLATES
// ============================================================================

export const getApprovedTemplates = query({
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

    // Get all active templates
    const templates = await ctx.db
      .query("whApprovedTemplates")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return templates.map((template) => ({
      templateName: template.templateName,
      providerTemplateId: template.providerTemplateId,
      type: template.templateType,
      templateBody: template.templateBody ?? null,
      variables: template.variables ?? [],
      language: template.language ?? "en",
    }));
  },
});

// ============================================================================
// GET AUDIT HISTORY FOR A USE-CASE
// ============================================================================

export const getUsecaseAuditHistory = query({
  args: {
    usecaseKey: v.string(),
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

    const limit = args.limit ?? 50;

    const audits = await ctx.db
      .query("whUsecaseAudit")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", args.usecaseKey))
      .order("desc")
      .take(limit);

    return audits;
  },
});

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

// Create a new template
export const createTemplate = mutation({
  args: {
    templateName: v.string(),
    providerTemplateId: v.string(),
    templateType: v.union(v.literal("transactional"), v.literal("marketing")),
    templateBody: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
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

    // Check if provider template ID already exists
    const existing = await ctx.db
      .query("whApprovedTemplates")
      .withIndex("by_provider_id", (q) =>
        q.eq("providerTemplateId", args.providerTemplateId)
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        message: `Template with provider ID '${args.providerTemplateId}' already exists`,
        code: "CONFLICT",
      });
    }

    // Create the template
    const templateId = await ctx.db.insert("whApprovedTemplates", {
      templateName: args.templateName,
      providerTemplateId: args.providerTemplateId,
      templateType: args.templateType,
      templateBody: args.templateBody,
      variables: args.variables,
      language: args.language ?? "en",
      status: "active",
      approvedAt: Date.now(),
    });

    return { id: templateId, success: true };
  },
});

// Update an existing template
export const updateTemplate = mutation({
  args: {
    templateId: v.id("whApprovedTemplates"),
    templateName: v.optional(v.string()),
    providerTemplateId: v.optional(v.string()),
    templateType: v.optional(
      v.union(v.literal("transactional"), v.literal("marketing"))
    ),
    templateBody: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
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

    // Get the template
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    // If provider template ID is being changed, check for duplicates
    if (
      args.providerTemplateId !== undefined &&
      args.providerTemplateId !== template.providerTemplateId
    ) {
      const existing = await ctx.db
        .query("whApprovedTemplates")
        .withIndex("by_provider_id", (q) =>
          q.eq("providerTemplateId", args.providerTemplateId!)
        )
        .unique();

      if (existing && existing._id !== args.templateId) {
        throw new ConvexError({
          message: `Template with provider ID '${args.providerTemplateId}' already exists`,
          code: "CONFLICT",
        });
      }
    }

    // Update the template
    const updates: Partial<Doc<"whApprovedTemplates">> = {};

    if (args.templateName !== undefined) updates.templateName = args.templateName;
    if (args.providerTemplateId !== undefined)
      updates.providerTemplateId = args.providerTemplateId;
    if (args.templateType !== undefined) updates.templateType = args.templateType;
    if (args.templateBody !== undefined) updates.templateBody = args.templateBody;
    if (args.variables !== undefined) updates.variables = args.variables;
    if (args.language !== undefined) updates.language = args.language;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.templateId, updates);

    return { success: true };
  },
});

// Delete a template
export const deleteTemplate = mutation({
  args: {
    templateId: v.id("whApprovedTemplates"),
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

    // Get the template
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError({
        message: "Template not found",
        code: "NOT_FOUND",
      });
    }

    // Check if template is in use by any use-case
    const usecasesUsingTemplate = await ctx.db
      .query("whUsecaseTemplates")
      .filter((q) =>
        q.eq(q.field("providerTemplateId"), template.providerTemplateId)
      )
      .collect();

    if (usecasesUsingTemplate.length > 0) {
      const usecaseNames = usecasesUsingTemplate
        .map((uc) => uc.displayName)
        .join(", ");
      throw new ConvexError({
        message: `Cannot delete template. It is currently assigned to: ${usecaseNames}`,
        code: "CONFLICT",
      });
    }

    // Delete the template
    await ctx.db.delete(args.templateId);

    return { success: true };
  },
});
