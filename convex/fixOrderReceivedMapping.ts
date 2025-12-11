import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";

// One-time migration to add variable mapping for order_received usecase
export const fixOrderReceivedMapping = mutation({
  args: {},
  handler: async (ctx) => {
    // Check admin authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const usecase = await ctx.db
      .query("whUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "order_received"))
      .unique();
    
    if (!usecase) {
      return { error: "Usecase not found" };
    }
    
    // Update with variable mapping
    await ctx.db.patch(usecase._id, {
      variableMapping: [
        {
          templateVariable: "customer_name",
          sourceFields: ["customer_name"],
          separator: " "
        },
        {
          templateVariable: "order_number",
          sourceFields: ["order_number"],
          separator: " "
        },
        {
          templateVariable: "product_name",
          sourceFields: ["product_name"],
          separator: " "
        }
      ],
      lastUpdatedAt: Date.now()
    });
    
    return { 
      success: true,
      message: "Variable mapping added for order_received"
    };
  },
});
