import { mutation } from "./_generated/server";

// Migration to remove old finishType field from products
// The new schema uses finishTypeId instead
export const removeOldFinishTypeField = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    let updated = 0;
    for (const product of products) {
      // Check if product has the old finishType field
      if (product.finishType !== undefined) {
        // Remove the old field by patching with undefined
        await ctx.db.patch(product._id, {
          finishType: undefined,
        });
        updated++;
      }
    }
    
    return {
      success: true,
      message: `Removed old finishType field from ${updated} products`,
      updated,
    };
  },
});
