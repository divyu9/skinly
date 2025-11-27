import { mutation } from "./_generated/server";

// Safety migration to ensure all products have a gadgetCategory
// This must be run before making gadgetCategory required in the schema
export const ensureAllProductsHaveCategory = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    let updated = 0;
    let alreadySet = 0;
    
    for (const product of products) {
      if (!product.gadgetCategory) {
        // Default to "phone" for products without a category
        // This is a safe default since most products are phone skins
        await ctx.db.patch(product._id, {
          gadgetCategory: "phone",
        });
        updated++;
      } else {
        alreadySet++;
      }
    }
    
    return {
      total: products.length,
      updated,
      alreadySet,
      message: `Updated ${updated} products to have gadgetCategory. ${alreadySet} already had it set.`,
    };
  },
});
