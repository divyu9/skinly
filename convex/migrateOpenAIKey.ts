import { mutation } from "./_generated/server";

// One-time migration to move openaiApiKey to OPENAI_API_KEY
export const migrateOpenAIKey = mutation({
  args: {},
  handler: async (ctx) => {
    // Get old setting
    const oldSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "openaiApiKey"))
      .first();
    
    if (!oldSetting) {
      return { success: false, message: "Old openaiApiKey setting not found" };
    }

    // Check if new setting already exists
    const newSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "OPENAI_API_KEY"))
      .first();
    
    if (newSetting) {
      // Update existing instead
      await ctx.db.patch(newSetting._id, { value: oldSetting.value });
      await ctx.db.delete(oldSetting._id);
      return { success: true, message: "Updated existing OPENAI_API_KEY and deleted old key" };
    }

    // Create new setting with correct key name
    await ctx.db.insert("settings", {
      key: "OPENAI_API_KEY",
      value: oldSetting.value,
    });

    // Delete old setting
    await ctx.db.delete(oldSetting._id);

    return { 
      success: true, 
      message: "Successfully migrated openaiApiKey to OPENAI_API_KEY"
    };
  },
});
