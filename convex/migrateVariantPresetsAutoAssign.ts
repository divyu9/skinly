import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Public action to run smart auto-assignment of variant consumption presets.
 * Callable from admin UI.
 */
export const autoAssignPresets = action({
  args: {
    statusFilter: v.optional(v.union(v.literal("all"), v.literal("active"), v.literal("draft"), v.literal("archived"))),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    matched: number;
    unmatched: number;
    skipped: number;
    statusBreakdown: {
      active: number;
      draft: number;
      archived: number;
    };
    unmatchedVariants: Array<{
      productId: string;
      variantTitle: string;
      gadgetType: string;
      productStatus: string;
    }>;
  }> => {
    return await ctx.runMutation(
      internal.migrateVariantPresetsAutoAssignInternal.autoAssignPresets,
      { statusFilter: args.statusFilter }
    );
  },
});
