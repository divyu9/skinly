import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";

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
 * Find similar models using fuzzy matching (public - no auth required)
 * Helps users discover existing models before submitting duplicate requests
 */
export const findSimilarModels = query({
  args: {
    brandName: v.optional(v.string()),
    modelName: v.string(),
    category: v.optional(v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    )),
  },
  handler: async (ctx, args) => {
    // Only search if model name has at least 2 characters
    if (!args.modelName || args.modelName.trim().length < 2) {
      return [];
    }

    const modelSearch = args.modelName.toLowerCase().trim();
    const brandSearch = args.brandName?.toLowerCase().trim();
    
    // Get all active models
    const allModels = await ctx.db
      .query("supportedModels")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Split search terms into keywords
    const searchKeywords = modelSearch.split(/\s+/).filter(k => k.length > 1);
    
    // Find models that match the search criteria
    const matches = allModels
      .filter((model) => {
        const modelNameLower = model.modelName.toLowerCase();
        const brandNameLower = model.brandName.toLowerCase();
        
        // Filter by category if provided
        if (args.category && model.category !== args.category) {
          return false;
        }
        
        // Filter by brand if provided
        if (brandSearch && brandNameLower !== brandSearch) {
          return false;
        }
        
        // Check if all keywords appear in the model name
        const allKeywordsMatch = searchKeywords.every(keyword => 
          modelNameLower.includes(keyword)
        );
        
        return allKeywordsMatch;
      })
      .slice(0, 5); // Limit to 5 suggestions

    return matches.map(model => ({
      _id: model._id,
      brandName: model.brandName,
      modelName: model.modelName,
      category: model.category,
    }));
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
  handler: async (ctx, args): Promise<{ requestId: string; requestNumber: string }> => {
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

    // Create request first without request number
    const tempRequestId = await ctx.db.insert("modelRequests", {
      brandName: args.brandName.trim(),
      modelName: args.modelName.trim(),
      category: args.category,
      whatsappPhone: args.whatsappPhone.trim(),
      userId,
      userEmail,
      status: "pending",
      requestedAt: Date.now(),
    });

    // Generate and update with request number
    await ctx.scheduler.runAfter(
      0,
      internal.orderNumberHelpers.generateModelRequestNumber,
      {}
    );
    
    // For now, manually generate the request number to return immediately
    const existingRequests = await ctx.db.query("modelRequests").collect();
    const requestCount = existingRequests.length;
    const finalRequestNumber = `MR-${String(requestCount).padStart(2, "0")}`;
    
    // Update the request with the generated number
    await ctx.db.patch(tempRequestId, {
      requestNumber: finalRequestNumber,
    });

    // Queue WhatsApp confirmation (model_requested)
    try {
      await ctx.scheduler.runAfter(
        0,
        api.whatsappMessaging.queueMessage,
        {
          usecaseKey: "model_requested",
          recipientPhone: args.whatsappPhone.trim(),
          recipientUserId: userId,
          variables: {
            // Send combined brand + model name for single-variable template
            model_name: `${args.brandName.trim()} ${args.modelName.trim()}`,
            request_number: finalRequestNumber,
          },
          priority: 7,
        }
      );
    } catch (error) {
      console.error(`Failed to queue model request WhatsApp for ${args.whatsappPhone}:`, error);
    }

    // Queue Email confirmation (model_requested) if email available
    if (userEmail) {
      try {
        await ctx.scheduler.runAfter(
          0,
          api.emailMessaging.queueMessage,
          {
            usecaseKey: "model_requested",
            recipientEmail: userEmail,
            recipientUserId: userId,
            variables: {
              brand_name: args.brandName.trim(),
              model_name: args.modelName.trim(),
              request_number: finalRequestNumber,
            },
            priority: 7,
          }
        );
      } catch (error) {
        console.error(`Failed to queue model request email for ${userEmail}:`, error);
      }
    }

    return { requestId: tempRequestId, requestNumber: finalRequestNumber };
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

      // Send WhatsApp notification for approval
      try {
        await ctx.scheduler.runAfter(
          0,
          api.whatsappMessaging.queueMessage,
          {
            usecaseKey: "model_added",
            recipientPhone: request.whatsappPhone,
            recipientUserId: request.userId,
            variables: {
              brand_name: request.brandName,
              model_name: request.modelName,
              request_number: request.requestNumber || "MR-01",
            },
            priority: 6,
          }
        );
      } catch (error) {
        console.error(`Failed to queue model approved WhatsApp for ${request.whatsappPhone}:`, error);
      }

      // Send Email notification for approval if email available
      if (request.userEmail) {
        try {
          await ctx.scheduler.runAfter(
            0,
            api.emailMessaging.queueMessage,
            {
              usecaseKey: "model_added",
              recipientEmail: request.userEmail,
              recipientUserId: request.userId,
              variables: {
                brand_name: request.brandName,
                model_name: request.modelName,
                request_number: request.requestNumber || "MR-01",
              },
              priority: 6,
            }
          );
        } catch (error) {
          console.error(`Failed to queue model approved email for ${request.userEmail}:`, error);
        }
      }

      successCount++;
    }

    return { successCount, skipCount };
  },
});

/**
 * Update a model request (admin only - for correcting errors before approval)
 */
export const updateModelRequest = mutation({
  args: {
    requestId: v.id("modelRequests"),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("phone"),
        v.literal("tablet"),
        v.literal("laptop"),
        v.literal("console"),
        v.literal("charger"),
        v.literal("drone"),
        v.literal("camera"),
        v.literal("lens"),
        v.literal("mac-mini")
      )
    ),
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

    if (request.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Can only edit pending requests",
      });
    }

    // Build update object with only provided fields
    const updates: Record<string, string> = {};
    if (args.brandName !== undefined) {
      updates.brandName = args.brandName.trim();
    }
    if (args.modelName !== undefined) {
      updates.modelName = args.modelName.trim();
    }
    if (args.category !== undefined) {
      updates.category = args.category;
    }

    await ctx.db.patch(args.requestId, updates);

    return { success: true };
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

    // Send WhatsApp notification for rejection
    try {
      await ctx.scheduler.runAfter(
        0,
        api.whatsappMessaging.queueMessage,
        {
          usecaseKey: "model_request_rejected",
          recipientPhone: request.whatsappPhone,
          recipientUserId: request.userId,
          variables: {
            brand_name: request.brandName,
            model_name: request.modelName,
            request_number: request.requestNumber || "MR-01",
          },
          priority: 6,
        }
      );
    } catch (error) {
      console.error(`Failed to queue model rejected WhatsApp for ${request.whatsappPhone}:`, error);
    }

    // Send Email notification for rejection if email available
    if (request.userEmail) {
      try {
        await ctx.scheduler.runAfter(
          0,
          api.emailMessaging.queueMessage,
          {
            usecaseKey: "model_request_rejected",
            recipientEmail: request.userEmail,
            recipientUserId: request.userId,
            variables: {
              brand_name: request.brandName,
              model_name: request.modelName,
              request_number: request.requestNumber || "MR-01",
            },
            priority: 6,
          }
        );
      } catch (error) {
        console.error(`Failed to queue model rejected email for ${request.userEmail}:`, error);
      }
    }

    return { success: true };
  },
});
