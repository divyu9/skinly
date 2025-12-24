import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

export const addShippingFieldsToProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    
    const products = await ctx.db.query("products").collect();
    
    let updated = 0;
    for (const product of products) {
      // Only update if shipping fields don't exist
      if (product.length === undefined) {
        await ctx.db.patch(product._id, {
          length: 10, // 10cm
          breadth: 10, // 10cm
          height: 2, // 2cm
          weight: 100, // 100g
          productType: "physical",
        });
        updated++;
      }
    }
    
    return {
      message: `Added shipping fields to ${updated} products`,
      totalProducts: products.length,
      updatedProducts: updated,
    };
  },
});
