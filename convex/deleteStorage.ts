import { internalMutation } from "./_generated/server";

export const deleteAllFiles = internalMutation({
  handler: async (ctx) => {
    const files = await ctx.db.system.query("_storage").collect();
    let deleted = 0;
    for (const file of files) {
      await ctx.storage.delete(file._id);
      deleted++;
    }
    return { deleted };
  },
});
