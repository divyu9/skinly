import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Public action to run smart auto-assignment of variant consumption presets.
 * Callable from admin UI.
 */
export const autoAssignPresets = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    matched: number;
    unmatched: number;
    skipped: number;
    unmatchedVariants: Array<{
      productId: string;
      variantTitle: string;
      gadgetType: string;
    }>;
  }> => {
    return await ctx.runMutation(
      internal.migrateVariantPresetsAutoAssignInternal.autoAssignPresets,
      {}
    );
  },
});
