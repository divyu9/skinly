"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Migration: Link gadgetConsumption to gadgetTypes and seed missing data
 * 
 * This migration:
 * 1. Links existing gadgetConsumption entries to matching gadgetTypes by name
 * 2. Creates missing consumption entries for gadget types without data
 * 3. Uses sensible defaults based on typical device dimensions
 */
export const linkAndSeedConsumption = action({
  args: {},
  handler: async (ctx): Promise<{
    success: boolean;
    linked: number;
    created: number;
    skipped: number;
    message: string;
  }> => {
    return await ctx.runMutation(internal.migrateGadgetConsumptionInternal.linkAndSeedConsumption);
  },
});
