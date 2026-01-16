import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// ============================================
// Category Config CRUD Operations
// ============================================

// List all active product categories (for dropdowns, headers, etc.)
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();

    // Sort by order
    return categories.sort((a, b) => a.order - b.order);
  },
});

// List all categories (for admin management)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("productCategoriesConfig")
      .collect();

    return categories.sort((a, b) => a.order - b.order);
  },
});

// Get a single category by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

// Get categories for homepage display
export const listForHomepage = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_show_on_homepage", (q) => q.eq("showOnHomepage", true))
      .collect();

    // Only return active ones, sorted by order
    return categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.order - b.order);
  },
});

// Create a new category (admin only)
export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    image: v.optional(v.string()),
    color: v.optional(v.string()),
    homepageImage: v.optional(v.string()),
    homepageTitle: v.optional(v.string()),
    homepageSubtitle: v.optional(v.string()),
    homepageButtonText: v.optional(v.string()),
    homepageLink: v.optional(v.string()),
    showOnHomepage: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
    requiresDevice: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if slug already exists
    const existing = await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Category with slug "${args.slug}" already exists`,
      });
    }

    // Get max order for new category
    const allCategories = await ctx.db.query("productCategoriesConfig").collect();
    const maxOrder = allCategories.reduce((max, c) => Math.max(max, c.order), -1);

    const categoryId = await ctx.db.insert("productCategoriesConfig", {
      slug: args.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: args.name,
      description: args.description,
      icon: args.icon || "Package",
      image: args.image,
      color: args.color,
      homepageImage: args.homepageImage,
      homepageTitle: args.homepageTitle,
      homepageSubtitle: args.homepageSubtitle,
      homepageButtonText: args.homepageButtonText || "Shop Now",
      homepageLink: args.homepageLink,
      showOnHomepage: args.showOnHomepage ?? true,
      isDefault: args.isDefault ?? false,
      requiresDevice: args.requiresDevice ?? false,
      isActive: args.isActive ?? true,
      order: args.order ?? maxOrder + 1,
      createdAt: Date.now(),
    });

    return { success: true, categoryId };
  },
});

// Update a category (admin only)
export const update = mutation({
  args: {
    id: v.id("productCategoriesConfig"),
    slug: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    image: v.optional(v.string()),
    color: v.optional(v.string()),
    homepageImage: v.optional(v.string()),
    homepageTitle: v.optional(v.string()),
    homepageSubtitle: v.optional(v.string()),
    homepageButtonText: v.optional(v.string()),
    homepageLink: v.optional(v.string()),
    showOnHomepage: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
    requiresDevice: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Check if new slug conflicts with existing
    if (updates.slug) {
      const existing = await ctx.db
        .query("productCategoriesConfig")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .unique();

      if (existing && existing._id !== id) {
        throw new ConvexError({
          code: "CONFLICT",
          message: `Category with slug "${updates.slug}" already exists`,
        });
      }
    }

    // Build update object, filtering out undefined values
    const updateData: Record<string, any> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    await ctx.db.patch(id, updateData);

    return { success: true };
  },
});

// Delete a category (admin only)
export const remove = mutation({
  args: { id: v.id("productCategoriesConfig") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Category not found",
      });
    }

    // Check if any products use this category
    const productsWithCategory = await ctx.db
      .query("products")
      .withIndex("by_product_category", (q) => q.eq("productCategory", category.slug))
      .collect();

    if (productsWithCategory.length > 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Cannot delete category. ${productsWithCategory.length} products are using this category. Please reassign them first.`,
      });
    }

    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// Reorder categories (admin only)
export const reorder = mutation({
  args: {
    categoryIds: v.array(v.id("productCategoriesConfig")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.categoryIds.length; i++) {
      await ctx.db.patch(args.categoryIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Seed default categories (run once)
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("productCategoriesConfig").collect();
    if (existing.length > 0) {
      return { success: false, message: "Categories already exist", count: existing.length };
    }

    const defaultCategories = [
      {
        slug: "skin",
        name: "Skins",
        description: "Premium vinyl skins and wraps for your devices",
        icon: "Package2",
        showOnHomepage: true,
        isDefault: true,
        requiresDevice: true,
        isActive: true,
        order: 0,
      },
      {
        slug: "case-cover",
        name: "Cases & Covers",
        description: "Protective cases and covers",
        icon: "Shield",
        showOnHomepage: true,
        isDefault: false,
        requiresDevice: true,
        isActive: true,
        order: 1,
      },
      {
        slug: "camera-ring",
        name: "Camera Rings",
        description: "Camera lens protector rings",
        icon: "Video",
        showOnHomepage: true,
        isDefault: false,
        requiresDevice: true,
        isActive: true,
        order: 2,
      },
      {
        slug: "magneto-x",
        name: "Magneto X",
        description: "Magnetic phone accessories",
        icon: "Zap",
        showOnHomepage: true,
        isDefault: false,
        requiresDevice: false,
        isActive: true,
        order: 3,
      },
      {
        slug: "glass",
        name: "Screen Protectors",
        description: "Tempered glass and screen protectors",
        icon: "Glasses",
        showOnHomepage: true,
        isDefault: false,
        requiresDevice: true,
        isActive: true,
        order: 4,
      },
      {
        slug: "accessory",
        name: "Accessories",
        description: "Phone accessories and more",
        icon: "ShoppingBag",
        showOnHomepage: true,
        isDefault: false,
        requiresDevice: false,
        isActive: true,
        order: 5,
      },
    ];

    for (const category of defaultCategories) {
      await ctx.db.insert("productCategoriesConfig", {
        ...category,
        createdAt: Date.now(),
      });
    }

    return { success: true, message: "Default categories seeded", count: defaultCategories.length };
  },
});

// ============================================
// Product Category Assignment Operations
// ============================================

// List all product categories with stats (for admin dashboard)
export const listAllCategories = query({
  args: {},
  handler: async (ctx) => {
    // Get all categories from config
    const categoryConfigs = await ctx.db
      .query("productCategoriesConfig")
      .collect();

    // Get all products
    const products = await ctx.db.query("products").collect();

    // Count products by category
    const categoryCounts: Record<string, number> = {};
    products.forEach((product) => {
      const category = product.productCategory || "uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Build categories array with counts
    const categories = categoryConfigs
      .sort((a, b) => a.order - b.order)
      .map((config) => ({
        id: config.slug,
        name: config.name,
        count: categoryCounts[config.slug] || 0,
        isActive: config.isActive,
        icon: config.icon,
      }));

    return {
      categories,
      uncategorizedCount: categoryCounts["uncategorized"] || 0,
      totalProducts: products.length,
    };
  },
});

// List all product categories with counts (for shop page)
export const listAllWithCounts = query({
  args: {},
  handler: async (ctx) => {
    // Get all active categories from config
    const categoryConfigs = await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_active_and_order", (q) => q.eq("isActive", true))
      .collect();

    // Get all active products
    const products = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Count products by category
    const categoryCounts: Record<string, number> = {};
    products.forEach((product) => {
      const category = product.productCategory;
      if (category) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });

    // Build result array sorted by order
    return categoryConfigs
      .sort((a, b) => a.order - b.order)
      .map((config) => ({
        id: config.slug,
        displayName: config.name,
        count: categoryCounts[config.slug] || 0,
        icon: config.icon,
        requiresDevice: config.requiresDevice,
      }));
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
        .filter((q) => q.eq(q.field("productCategory"), undefined))
        .collect();
    } else if (args.category) {
      products = await ctx.db
        .query("products")
        .withIndex("by_product_category", (q) => q.eq("productCategory", args.category))
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
      .filter((q) => q.eq(q.field("productCategory"), undefined))
      .collect();

    return products;
  },
});

// Update single product category
export const updateProductCategory = mutation({
  args: {
    productId: v.id("products"),
    category: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // Validate category exists if not null
    if (args.category) {
      const categoryConfig = await ctx.db
        .query("productCategoriesConfig")
        .withIndex("by_slug", (q) => q.eq("slug", args.category!))
        .unique();

      if (!categoryConfig) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: `Category "${args.category}" does not exist`,
        });
      }
    }

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
    category: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate category exists
    const categoryConfig = await ctx.db
      .query("productCategoriesConfig")
      .withIndex("by_slug", (q) => q.eq("slug", args.category))
      .unique();

    if (!categoryConfig) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: `Category "${args.category}" does not exist`,
      });
    }

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
        products = products.filter((p) => !p.productCategory);
      } else {
        products = products.filter((p) => p.productCategory === args.category);
      }
    }

    // Filter by search term
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();
      products = products.filter((p) => p.title.toLowerCase().includes(searchLower));
    }

    return products.slice(0, limit);
  },
});

// Get category statistics
export const getCategoryStats = query({
  args: {},
  handler: async (ctx) => {
    // Get all categories from config
    const categoryConfigs = await ctx.db.query("productCategoriesConfig").collect();

    // Get all products
    const products = await ctx.db.query("products").collect();

    // Build stats object
    const stats: Record<string, number> = {
      total: products.length,
      uncategorized: 0,
    };

    // Initialize all categories with 0
    categoryConfigs.forEach((config) => {
      stats[config.slug] = 0;
    });

    // Count products
    products.forEach((product) => {
      if (!product.productCategory) {
        stats.uncategorized++;
      } else if (product.productCategory in stats) {
        stats[product.productCategory]++;
      }
    });

    return stats;
  },
});
