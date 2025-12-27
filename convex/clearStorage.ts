import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const clearAllStorage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { page, isDone, continueCursor } = await ctx.db.system
      .query("_storage")
      .paginate({ cursor: args.cursor, numItems: 500 });

    for (const file of page) {
      await ctx.storage.delete(file._id);
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.clearStorage.clearAllStorage, {
        cursor: continueCursor,
      });
    }

    return { deleted: page.length, isDone };
  },
});
