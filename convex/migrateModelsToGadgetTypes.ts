import { mutation } from "./_generated/server";

/**
 * Migrate supportedModels from category string to gadgetTypeId reference
 * This makes gadgetTypes the single source of truth for device categories
 */
export const migrateModelsToGadgetTypes = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all gadget types
    const gadgetTypes = await ctx.db.query("gadgetTypes").collect();
    const categoryToIdMap = new Map(
      gadgetTypes.map((gt) => [gt.name.toLowerCase(), gt._id])
    );

    // Get all models
    const models = await ctx.db.query("supportedModels").collect();

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const failedCategories = new Set<string>();

    for (const model of models) {
      // Skip if already has gadgetTypeId
      if (model.gadgetTypeId) {
        skipped++;
        continue;
      }

      // Find matching gadget type ID (case-insensitive)
      const gadgetTypeId = categoryToIdMap.get(model.category.toLowerCase());

      if (gadgetTypeId) {
        await ctx.db.patch(model._id, { gadgetTypeId });
        migrated++;
      } else {
        failed++;
        failedCategories.add(model.category);
      }
    }

    const failedList = Array.from(failedCategories).join(", ");

    let message = "";
    if (migrated === 0 && skipped > 0 && failed === 0) {
      message = `✓ All ${skipped} models already migrated!`;
    } else if (migrated > 0) {
      message = `✓ Migrated ${migrated} models, skipped ${skipped}, failed ${failed}${
        failed > 0 ? ` (categories not found: ${failedList})` : ""
      }`;
    } else {
      message = `Migrated ${migrated} models, skipped ${skipped}, failed ${failed}${
        failed > 0 ? ` (categories not found: ${failedList})` : ""
      }`;
    }

    return {
      success: true,
      migrated,
      skipped,
      failed,
      message,
      failedCategories: Array.from(failedCategories),
    };
  },
});
