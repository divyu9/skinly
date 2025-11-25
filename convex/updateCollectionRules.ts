import { mutation } from "./_generated/server";

// Temporary mutation to fix collection rules
export const fixCoversAndCasesCollection = mutation({
  args: {},
  handler: async (ctx) => {
    // Find the collection
    const collections = await ctx.db.query("collections").collect();
    const collection = collections.find(c => c.name === "Covers And Cases");
    
    if (!collection) {
      throw new Error("Collection not found");
    }
    
    // Update with correct rule - products have "Cover & Case" not "Cover And Case"
    await ctx.db.patch(collection._id, {
      matchLogic: "any" as const,
      rules: [
        {
          field: "productName" as const,
          condition: "contains" as const,
          value: "Magsafe Cover",
        },
        {
          field: "productName" as const,
          condition: "contains" as const,
          value: "Cover & Case",
        },
      ],
    });
    
    return { success: true, collectionId: collection._id };
  },
});
