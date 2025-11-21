import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Store mockup file with metadata
 * Called after file is uploaded to storage
 */
export const storeMockupFile = mutation({
  args: {
    fileId: v.string(),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse filename: Brand_Model_SKU.jpg
    const nameWithoutExt = args.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 3) {
      throw new Error(`Invalid filename format: ${args.filename}. Expected: Brand_Model_SKU.jpg`);
    }
    
    const brand = parts[0];
    const sku = parts[parts.length - 1];
    const model = parts.slice(1, -1).join(' ');
    
    // Check if mockup already exists
    const existing = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand).eq("model", model).eq("sku", sku)
      )
      .first();
    
    if (existing) {
      // Update file ID if changed
      if (existing.fileId !== args.fileId) {
        await ctx.db.patch(existing._id, { fileId: args.fileId });
        return { action: "updated", brand, model, sku };
      }
      return { action: "skipped", brand, model, sku };
    }
    
    // Insert new mockup
    await ctx.db.insert("mockups", {
      brand,
      model,
      sku,
      fileId: args.fileId,
    });
    
    return { action: "created", brand, model, sku };
  },
});
