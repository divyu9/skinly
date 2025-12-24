import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get all cashback rules
export const getAllCashbackRules = query({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("cashbackRules").collect();
    return rules;
  },
});

// Get cashback rules by target type
export const getCashbackRulesByType = query({
  args: { 
    targetType: v.union(v.literal("variant"), v.literal("product"), v.literal("collection"))
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("cashbackRules")
      .filter((q) => q.eq(q.field("targetType"), args.targetType))
      .collect();
    return rules;
  },
});

// Get active cashback rules for a specific target
export const getActiveCashbackRulesForTarget = query({
  args: {
    targetType: v.union(v.literal("variant"), v.literal("product"), v.literal("collection")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const rules = await ctx.db
      .query("cashbackRules")
      .withIndex("by_target_and_active", (q) => 
        q.eq("targetType", args.targetType)
         .eq("targetId", args.targetId)
         .eq("isActive", true)
      )
      .collect();
    return rules;
  },
});

// Get cashback rule by ID
export const getCashbackRule = query({
  args: { ruleId: v.id("cashbackRules") },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new ConvexError({
        message: "Cashback rule not found",
        code: "NOT_FOUND",
      });
    }
    return rule;
  },
});

// Create cashback rule
export const createCashbackRule = mutation({
  args: {
    targetType: v.union(v.literal("variant"), v.literal("product"), v.literal("collection")),
    targetId: v.string(),
    cashbackType: v.union(v.literal("fixed"), v.literal("percentage")),
    cashbackValue: v.number(),
    minCartValue: v.optional(v.number()),
    maxCartValue: v.optional(v.number()),
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

    // Validate cashback value
    if (args.cashbackValue <= 0) {
      throw new ConvexError({
        message: "Cashback value must be greater than 0",
        code: "BAD_REQUEST",
      });
    }

    // For percentage, validate it's not more than 100%
    if (args.cashbackType === "percentage" && args.cashbackValue > 100) {
      throw new ConvexError({
        message: "Percentage cashback cannot exceed 100%",
        code: "BAD_REQUEST",
      });
    }

    // Validate cart value filters
    if (args.minCartValue !== undefined && args.minCartValue < 0) {
      throw new ConvexError({
        message: "Minimum cart value cannot be negative",
        code: "BAD_REQUEST",
      });
    }

    if (args.maxCartValue !== undefined && args.maxCartValue < 0) {
      throw new ConvexError({
        message: "Maximum cart value cannot be negative",
        code: "BAD_REQUEST",
      });
    }

    if (
      args.minCartValue !== undefined &&
      args.maxCartValue !== undefined &&
      args.minCartValue > args.maxCartValue
    ) {
      throw new ConvexError({
        message: "Minimum cart value cannot exceed maximum cart value",
        code: "BAD_REQUEST",
      });
    }

    const ruleId = await ctx.db.insert("cashbackRules", {
      targetType: args.targetType,
      targetId: args.targetId,
      cashbackType: args.cashbackType,
      cashbackValue: args.cashbackValue,
      minCartValue: args.minCartValue,
      maxCartValue: args.maxCartValue,
      isActive: args.isActive !== undefined ? args.isActive : true,
      createdAt: Date.now(),
      createdBy: identity.email,
    });

    return ruleId;
  },
});

// Update cashback rule
export const updateCashbackRule = mutation({
  args: {
    ruleId: v.id("cashbackRules"),
    cashbackType: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
    cashbackValue: v.optional(v.number()),
    minCartValue: v.optional(v.union(v.number(), v.null())),
    maxCartValue: v.optional(v.union(v.number(), v.null())),
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

    const { ruleId, ...rawUpdates } = args;

    // Convert null to undefined for optional fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (value !== undefined) {
        updates[key] = value === null ? undefined : value;
      }
    }

    // Validate cashback value if provided
    if (updates.cashbackValue !== undefined && typeof updates.cashbackValue === "number" && updates.cashbackValue <= 0) {
      throw new ConvexError({
        message: "Cashback value must be greater than 0",
        code: "BAD_REQUEST",
      });
    }

    // For percentage, validate it's not more than 100%
    if (updates.cashbackType === "percentage" && updates.cashbackValue !== undefined && typeof updates.cashbackValue === "number" && updates.cashbackValue > 100) {
      throw new ConvexError({
        message: "Percentage cashback cannot exceed 100%",
        code: "BAD_REQUEST",
      });
    }

    // Validate cart value filters if provided
    if (updates.minCartValue !== undefined && typeof updates.minCartValue === "number" && updates.minCartValue < 0) {
      throw new ConvexError({
        message: "Minimum cart value cannot be negative",
        code: "BAD_REQUEST",
      });
    }

    if (updates.maxCartValue !== undefined && typeof updates.maxCartValue === "number" && updates.maxCartValue < 0) {
      throw new ConvexError({
        message: "Maximum cart value cannot be negative",
        code: "BAD_REQUEST",
      });
    }

    // Get existing rule to validate min/max relationship
    const existingRule = await ctx.db.get(ruleId);
    if (existingRule) {
      const finalMinCartValue = updates.minCartValue !== undefined 
        ? (typeof updates.minCartValue === "number" ? updates.minCartValue : existingRule.minCartValue)
        : existingRule.minCartValue;
      
      const finalMaxCartValue = updates.maxCartValue !== undefined
        ? (typeof updates.maxCartValue === "number" ? updates.maxCartValue : existingRule.maxCartValue)
        : existingRule.maxCartValue;

      if (
        finalMinCartValue !== undefined &&
        finalMaxCartValue !== undefined &&
        finalMinCartValue > finalMaxCartValue
      ) {
        throw new ConvexError({
          message: "Minimum cart value cannot exceed maximum cart value",
          code: "BAD_REQUEST",
        });
      }
    }

    await ctx.db.patch(ruleId, {
      ...updates,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });
  },
});

// Delete cashback rule
export const deleteCashbackRule = mutation({
  args: { ruleId: v.id("cashbackRules") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.ruleId);
  },
});

// Toggle cashback rule active status
export const toggleCashbackRule = mutation({
  args: { 
    ruleId: v.id("cashbackRules"),
    isActive: v.boolean()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.patch(args.ruleId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });
  },
});
