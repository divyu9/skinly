import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

/**
 * Check if a model already exists in supportedModels (case-insensitive)
 */
export const checkModelExists = query({
  args: {
    brandName: v.string(),
    modelName: v.string(),
  },
  handler: async (ctx, args) => {
    const brandLower = args.brandName.toLowerCase().trim();
    const modelLower = args.modelName.toLowerCase().trim();

    // Get all models and check case-insensitively
    const allModels = await ctx.db.query("supportedModels").collect();
    
    const exists = allModels.some(
      (model) =>
        model.brandName.toLowerCase().trim() === brandLower &&
        model.modelName.toLowerCase().trim() === modelLower
    );

    return { exists };
  },
});

/**
 * Create a new model request (public - no auth required)
 */
export const createModelRequest = mutation({
  args: {
    brandName: v.string(),
    modelName: v.string(),
    category: v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    ),
    whatsappPhone: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate required fields
    if (!args.brandName.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Brand name is required",
      });
    }
    if (!args.modelName.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Model name is required",
      });
    }
    if (!args.whatsappPhone.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "WhatsApp phone number is required",
      });
    }

    // Check if model already exists
    const brandLower = args.brandName.toLowerCase().trim();
    const modelLower = args.modelName.toLowerCase().trim();

    const allModels = await ctx.db.query("supportedModels").collect();
    const exists = allModels.some(
      (model) =>
        model.brandName.toLowerCase().trim() === brandLower &&
        model.modelName.toLowerCase().trim() === modelLower
    );

    if (exists) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "This model is already supported! Try searching again.",
      });
    }

    // Get user info if authenticated
    const identity = await ctx.auth.getUserIdentity();
    let userId = undefined;
    let userEmail = undefined;

    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .first();
      
      if (user) {
        userId = user._id;
        userEmail = user.email;
      }
    }

    // Create request
    const requestId = await ctx.db.insert("modelRequests", {
      brandName: args.brandName.trim(),
      modelName: args.modelName.trim(),
      category: args.category,
      whatsappPhone: args.whatsappPhone.trim(),
      userId,
      userEmail,
      status: "pending",
      requestedAt: Date.now(),
    });

    return { requestId };
  },
});

/**
 * Get all model requests filtered by status (admin only)
 */
export const getAllModelRequests = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))
    ),
  },
  handler: async (ctx, args) => {
    // Optional: Add auth check for admin users here
    
    if (args.status !== undefined) {
      return await ctx.db
        .query("modelRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("modelRequests")
      .order("desc")
      .collect();
  },
});

/**
 * Get pending model requests (admin only)
 */
export const getPendingModelRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("modelRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();
  },
});

/**
 * Approve multiple model requests and add to supportedModels (admin only)
 */
export const approveModelRequests = mutation({
  args: {
    requestIds: v.array(v.id("modelRequests")),
  },
  handler: async (ctx, args) => {
    // Optional: Add auth check for admin users here

    let successCount = 0;
    let skipCount = 0;

    for (const requestId of args.requestIds) {
      const request = await ctx.db.get(requestId);
      
      if (!request || request.status !== "pending") {
        skipCount++;
        continue;
      }

      // Check if model already exists before adding
      const allModels = await ctx.db.query("supportedModels").collect();
      const brandLower = request.brandName.toLowerCase().trim();
      const modelLower = request.modelName.toLowerCase().trim();

      const exists = allModels.some(
        (model) =>
          model.brandName.toLowerCase().trim() === brandLower &&
          model.modelName.toLowerCase().trim() === modelLower
      );

      if (!exists) {
        // Add to supportedModels
        await ctx.db.insert("supportedModels", {
          brandName: request.brandName,
          modelName: request.modelName,
          category: request.category,
          isActive: true,
        });
      }

      // Update request status
      await ctx.db.patch(requestId, {
        status: "approved",
        approvedAt: Date.now(),
      });

      successCount++;
    }

    return { successCount, skipCount };
  },
});

/**
 * Reject a model request (admin only)
 */
export const rejectModelRequest = mutation({
  args: {
    requestId: v.id("modelRequests"),
  },
  handler: async (ctx, args) => {
    // Optional: Add auth check for admin users here

    const request = await ctx.db.get(args.requestId);
    
    if (!request) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Request not found",
      });
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
    });

    return { success: true };
  },
});
