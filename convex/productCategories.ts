import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// List all product categories with stats
export const listAllCategories = query({
  args: {},
  handler: async (ctx) => {
    // Get all products
    const products = await ctx.db.query("products").collect();
    
    // Count products by category
    const categoryCounts: Record<string, number> = {};
    products.forEach(product => {
      const category = product.productCategory || "uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    // Define available categories
    const categories = [
      { id: "skin", name: "Skin", count: categoryCounts["skin"] || 0 },
      { id: "case-cover", name: "Cover & Case", count: categoryCounts["case-cover"] || 0 },
      { id: "camera-ring", name: "Camera Rings", count: categoryCounts["camera-ring"] || 0 },
      { id: "magneto-x", name: "Magneto & More", count: categoryCounts["magneto-x"] || 0 },
      { id: "glass", name: "Membrane / Protectors", count: categoryCounts["glass"] || 0 },
      { id: "accessory", name: "Accessory", count: categoryCounts["accessory"] || 0 },
    ];
    
    return {
      categories,
      uncategorizedCount: categoryCounts["uncategorized"] || 0,
      totalProducts: products.length,
    };
  },
});

// Get products by category (paginated)
export const getProductsByCategory = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    
    let products;
    if (args.category === "uncategorized") {
      products = await ctx.db
        .query("products")
        .filter(q => q.eq(q.field("productCategory"), undefined))
        .collect();
    } else if (args.category) {
      products = await ctx.db
        .query("products")
        .filter(q => q.eq(q.field("productCategory"), args.category))
        .collect();
    } else {
      products = await ctx.db.query("products").collect();
    }
    
    return {
      products: products.slice(offset, offset + limit),
      total: products.length,
      hasMore: offset + limit < products.length,
    };
  },
});

// Get uncategorized products
export const getUncategorizedProducts = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .filter(q => q.eq(q.field("productCategory"), undefined))
      .collect();
    
    return products;
  },
});

// Update single product category
export const updateProductCategory = mutation({
  args: {
    productId: v.id("products"),
    category: v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory"),
      v.null()
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      productCategory: args.category ?? undefined,
    });
    
    return { success: true };
  },
});

// Bulk update product categories
export const bulkUpdateProductCategories = mutation({
  args: {
    productIds: v.array(v.id("products")),
    category: v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory")
    ),
  },
  handler: async (ctx, args) => {
    let updated = 0;
    
    for (const productId of args.productIds) {
      await ctx.db.patch(productId, {
        productCategory: args.category,
      });
      updated++;
    }
    
    return {
      success: true,
      updated,
      message: `Updated ${updated} products to category: ${args.category}`,
    };
  },
});

// Search products by title
export const searchProducts = query({
  args: {
    searchTerm: v.string(),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let products = await ctx.db.query("products").collect();
    
    // Filter by category if specified
    if (args.category) {
      if (args.category === "uncategorized") {
        products = products.filter(p => !p.productCategory);
      } else {
        products = products.filter(p => p.productCategory === args.category);
      }
    }
    
    // Filter by search term
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();
      products = products.filter(p =>
        p.title.toLowerCase().includes(searchLower)
      );
    }
    
    return products.slice(0, limit);
  },
});

// Get category statistics
export const getCategoryStats = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    
    const stats = {
      total: products.length,
      skin: 0,
      "case-cover": 0,
      "camera-ring": 0,
      "magneto-x": 0,
      glass: 0,
      accessory: 0,
      uncategorized: 0,
    };
    
    products.forEach(product => {
      if (!product.productCategory) {
        stats.uncategorized++;
      } else if (product.productCategory in stats) {
        stats[product.productCategory as keyof typeof stats]++;
      }
    });
    
    return stats;
  },
});
