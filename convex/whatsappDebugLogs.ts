import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";

/**
 * Get debug logs with pagination and filters
 */
export const getDebugLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    usecaseKey: v.optional(v.string()),
    success: v.optional(v.boolean()),
    errorType: v.optional(v.string()),
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

    // Apply filters and get results
    let result;
    
    if (args.usecaseKey) {
      const usecaseKey = args.usecaseKey;
      result = await ctx.db
        .query("whatsappDebugLogs")
        .withIndex("by_usecase", (q) => q.eq("usecaseKey", usecaseKey))
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.success !== undefined) {
      const success = args.success;
      result = await ctx.db
        .query("whatsappDebugLogs")
        .withIndex("by_success", (q) => q.eq("success", success))
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.errorType) {
      const errorType = args.errorType;
      result = await ctx.db
        .query("whatsappDebugLogs")
        .withIndex("by_error_type", (q) => q.eq("errorType", errorType))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      result = await ctx.db
        .query("whatsappDebugLogs")
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return result;
  },
});

/**
 * Get a single debug log by ID
 */
export const getDebugLog = query({
  args: {
    logId: v.id("whatsappDebugLogs"),
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

    const log = await ctx.db.get(args.logId);

    if (!log) {
      throw new ConvexError({
        message: "Debug log not found",
        code: "NOT_FOUND",
      });
    }

    // Get related message for additional context
    const message = await ctx.db.get(log.messageId);

    return {
      log,
      message,
    };
  },
});

/**
 * Get debug log statistics
 */
export const getDebugStats = query({
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

    // Get logs from last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = await ctx.db
      .query("whatsappDebugLogs")
      .withIndex("by_created_at")
      .filter((q) => q.gte(q.field("createdAt"), oneDayAgo))
      .collect();

    const totalLogs = recentLogs.length;
    const successLogs = recentLogs.filter((log) => log.success).length;
    const failedLogs = recentLogs.filter((log) => !log.success).length;

    // Group errors by type
    const errorsByType: Record<string, number> = {};
    recentLogs
      .filter((log) => !log.success && log.errorType)
      .forEach((log) => {
        const errorType = log.errorType!;
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });

    // Group by use case
    const logsByUsecase: Record<string, { total: number; success: number; failed: number }> = {};
    recentLogs.forEach((log) => {
      if (!logsByUsecase[log.usecaseKey]) {
        logsByUsecase[log.usecaseKey] = { total: 0, success: 0, failed: 0 };
      }
      logsByUsecase[log.usecaseKey].total++;
      if (log.success) {
        logsByUsecase[log.usecaseKey].success++;
      } else {
        logsByUsecase[log.usecaseKey].failed++;
      }
    });

    return {
      totalLogs,
      successLogs,
      failedLogs,
      successRate: totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0,
      errorsByType,
      logsByUsecase,
    };
  },
});

/**
 * Get all unique use cases that have debug logs
 */
export const getUsecasesWithLogs = query({
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

    const logs = await ctx.db.query("whatsappDebugLogs").collect();
    const usecaseKeys = [...new Set(logs.map((log) => log.usecaseKey))];

    // Get use case details
    const usecases = await Promise.all(
      usecaseKeys.map(async (key) => {
        const usecase = await ctx.db
          .query("whUsecaseTemplates")
          .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", key))
          .first();
        return {
          key,
          displayName: usecase?.displayName || key,
        };
      })
    );

    return usecases;
  },
});

/**
 * Get all unique error types from debug logs
 */
export const getErrorTypes = query({
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

    const logs = await ctx.db
      .query("whatsappDebugLogs")
      .withIndex("by_success", (q) => q.eq("success", false))
      .collect();

    const errorTypes = [
      ...new Set(logs.map((log) => log.errorType).filter((type) => type !== undefined)),
    ] as string[];

    return errorTypes.map((type) => ({
      value: type,
      label: type
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    }));
  },
});
