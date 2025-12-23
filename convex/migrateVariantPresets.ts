import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Public action to seed variant consumption presets.
 * Callable from admin UI.
 */
export const seedVariantPresets = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; created: number; message: string }> => {
    return await ctx.runMutation(internal.migrateVariantPresetsInternal.seedVariantPresets, {});
  },
});
