import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// Apple-like Product Section Content
// ============================================

// Get section content for a product (with category fallback)
export const getProductSectionContent = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return [];

    // 1. Check product-specific sections first
    const productSections = await ctx.db
      .query("productSectionContent")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (productSections.length > 0) {
      return productSections.sort((a, b) => a.order - b.order);
    }

    // 2. Fall back to category-level sections
    if (product.productCategory) {
      const categorySections = await ctx.db
        .query("productSectionContent")
        .withIndex("by_category", (q) =>
          q.eq("productCategorySlug", product.productCategory)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      return categorySections.sort((a, b) => a.order - b.order);
    }

    return [];
  },
});

// Get all section content for admin (with filters)
export const listSectionContent = query({
  args: {
    productCategorySlug: v.optional(v.string()),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    let sections;

    if (args.productId) {
      sections = await ctx.db
        .query("productSectionContent")
        .withIndex("by_product", (q) => q.eq("productId", args.productId))
        .collect();
    } else if (args.productCategorySlug) {
      sections = await ctx.db
        .query("productSectionContent")
        .withIndex("by_category", (q) =>
          q.eq("productCategorySlug", args.productCategorySlug)
        )
        .collect();
    } else {
      sections = await ctx.db.query("productSectionContent").collect();
    }

    return sections.sort((a, b) => a.order - b.order);
  },
});

// Create section content
export const createSectionContent = mutation({
  args: {
    productCategorySlug: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    sectionType: v.union(
      v.literal("hero"),
      v.literal("feature-left"),
      v.literal("feature-right"),
      v.literal("full-width"),
      v.literal("specs")
    ),
    title: v.string(),
    descriptionHtml: v.string(),
    imageUrl: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("productSectionContent", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update section content
export const updateSectionContent = mutation({
  args: {
    id: v.id("productSectionContent"),
    sectionType: v.optional(
      v.union(
        v.literal("hero"),
        v.literal("feature-left"),
        v.literal("feature-right"),
        v.literal("full-width"),
        v.literal("specs")
      )
    ),
    title: v.optional(v.string()),
    descriptionHtml: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Section not found");

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete section content
export const deleteSectionContent = mutation({
  args: { id: v.id("productSectionContent") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ============================================
// Suggested Products Configuration
// ============================================

// Get suggested products config for a product (with category fallback)
export const getSuggestedProductsConfig = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    // 1. Check product-specific config first
    const productConfig = await ctx.db
      .query("suggestedProductsConfig")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (productConfig && productConfig.isActive) {
      return productConfig;
    }

    // 2. Fall back to category-level config
    if (product.productCategory) {
      const categoryConfig = await ctx.db
        .query("suggestedProductsConfig")
        .withIndex("by_category", (q) =>
          q.eq("productCategorySlug", product.productCategory)
        )
        .first();

      if (categoryConfig && categoryConfig.isActive) {
        return categoryConfig;
      }
    }

    return null;
  },
});

// Get suggested products for a product (resolves actual products)
export const getSuggestedProducts = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return { config: null, products: [] };

    // Get the config
    let config = await ctx.db
      .query("suggestedProductsConfig")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (!config || !config.isActive) {
      if (product.productCategory) {
        config = await ctx.db
          .query("suggestedProductsConfig")
          .withIndex("by_category", (q) =>
            q.eq("productCategorySlug", product.productCategory)
          )
          .first();
      }
    }

    if (!config || !config.isActive) {
      return { config: null, products: [] };
    }

    let products: typeof product[] = [];

    switch (config.sourceType) {
      case "manual":
        if (config.manualProductIds) {
          const fetchedProducts = await Promise.all(
            config.manualProductIds.map((id) => ctx.db.get(id))
          );
          products = fetchedProducts.filter(
            (p): p is NonNullable<typeof p> =>
              p !== null && p.status === "active" && p._id !== args.productId
          );
        }
        break;

      case "same-category":
        if (product.productCategory) {
          const categoryProducts = await ctx.db
            .query("products")
            .filter((q) =>
              q.and(
                q.eq(q.field("productCategory"), product.productCategory),
                q.eq(q.field("status"), "active"),
                q.neq(q.field("_id"), args.productId)
              )
            )
            .take(config.maxProducts + 5); // Get extra in case some are filtered
          products = categoryProducts.slice(0, config.maxProducts);
        }
        break;

      case "tag-based":
        if (config.filterTags && config.filterTags.length > 0) {
          const allProducts = await ctx.db
            .query("products")
            .filter((q) =>
              q.and(
                q.eq(q.field("status"), "active"),
                q.neq(q.field("_id"), args.productId)
              )
            )
            .collect();

          products = allProducts
            .filter((p) =>
              p.tags?.some((tag) => config.filterTags?.includes(tag))
            )
            .slice(0, config.maxProducts);
        }
        break;
    }

    return { config, products: products.slice(0, config.maxProducts) };
  },
});

// List all suggested products configs for admin
export const listSuggestedProductsConfigs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("suggestedProductsConfig").collect();
  },
});

// Create suggested products config
export const createSuggestedProductsConfig = mutation({
  args: {
    productCategorySlug: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    sectionTitle: v.string(),
    sectionDescription: v.optional(v.string()),
    sourceType: v.union(
      v.literal("same-category"),
      v.literal("manual"),
      v.literal("tag-based")
    ),
    manualProductIds: v.optional(v.array(v.id("products"))),
    filterTags: v.optional(v.array(v.string())),
    maxProducts: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("suggestedProductsConfig", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update suggested products config
export const updateSuggestedProductsConfig = mutation({
  args: {
    id: v.id("suggestedProductsConfig"),
    sectionTitle: v.optional(v.string()),
    sectionDescription: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("same-category"),
        v.literal("manual"),
        v.literal("tag-based")
      )
    ),
    manualProductIds: v.optional(v.array(v.id("products"))),
    filterTags: v.optional(v.array(v.string())),
    maxProducts: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Config not found");

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete suggested products config
export const deleteSuggestedProductsConfig = mutation({
  args: { id: v.id("suggestedProductsConfig") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ============================================
// Trending Products Configuration
// ============================================

// Get trending products config for a product (with category fallback)
export const getTrendingProductsConfig = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    // 1. Check product-specific config first
    const productConfig = await ctx.db
      .query("trendingProductsConfig")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (productConfig && productConfig.isActive) {
      return productConfig;
    }

    // 2. Fall back to category-level config
    if (product.productCategory) {
      const categoryConfig = await ctx.db
        .query("trendingProductsConfig")
        .withIndex("by_category", (q) =>
          q.eq("productCategorySlug", product.productCategory)
        )
        .first();

      if (categoryConfig && categoryConfig.isActive) {
        return categoryConfig;
      }
    }

    return null;
  },
});

// Get trending products for a product (resolves actual products)
export const getTrendingProducts = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return { config: null, products: [] };

    // Get the config
    let config = await ctx.db
      .query("trendingProductsConfig")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();

    if (!config || !config.isActive) {
      if (product.productCategory) {
        config = await ctx.db
          .query("trendingProductsConfig")
          .withIndex("by_category", (q) =>
            q.eq("productCategorySlug", product.productCategory)
          )
          .first();
      }
    }

    if (!config || !config.isActive) {
      return { config: null, products: [] };
    }

    let products: typeof product[] = [];

    switch (config.sourceType) {
      case "manual":
        if (config.manualProductIds) {
          const fetchedProducts = await Promise.all(
            config.manualProductIds.map((id) => ctx.db.get(id))
          );
          products = fetchedProducts.filter(
            (p): p is NonNullable<typeof p> =>
              p !== null && p.status === "active" && p._id !== args.productId
          );
        }
        break;

      case "tag-based":
        if (config.filterTags && config.filterTags.length > 0) {
          const allProducts = await ctx.db
            .query("products")
            .filter((q) =>
              q.and(
                q.eq(q.field("status"), "active"),
                q.neq(q.field("_id"), args.productId)
              )
            )
            .collect();

          products = allProducts
            .filter((p) =>
              p.tags?.some((tag) => config.filterTags?.includes(tag))
            )
            .slice(0, config.maxProducts);
        }
        break;

      case "auto":
        // Future implementation: fetch based on order counts, view counts, etc.
        // For now, just return products with "trending" or "bestseller" tags
        const autoProducts = await ctx.db
          .query("products")
          .filter((q) =>
            q.and(
              q.eq(q.field("status"), "active"),
              q.neq(q.field("_id"), args.productId)
            )
          )
          .collect();

        products = autoProducts
          .filter((p) =>
            p.tags?.some((tag) =>
              ["trending", "bestseller", "popular"].includes(tag.toLowerCase())
            )
          )
          .slice(0, config.maxProducts);
        break;
    }

    return { config, products: products.slice(0, config.maxProducts) };
  },
});

// List all trending products configs for admin
export const listTrendingProductsConfigs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trendingProductsConfig").collect();
  },
});

// Create trending products config
export const createTrendingProductsConfig = mutation({
  args: {
    productCategorySlug: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    sectionTitle: v.string(),
    sectionDescription: v.optional(v.string()),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("tag-based"),
      v.literal("auto")
    ),
    manualProductIds: v.optional(v.array(v.id("products"))),
    filterTags: v.optional(v.array(v.string())),
    maxProducts: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("trendingProductsConfig", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update trending products config
export const updateTrendingProductsConfig = mutation({
  args: {
    id: v.id("trendingProductsConfig"),
    sectionTitle: v.optional(v.string()),
    sectionDescription: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("tag-based"),
        v.literal("auto")
      )
    ),
    manualProductIds: v.optional(v.array(v.id("products"))),
    filterTags: v.optional(v.array(v.string())),
    maxProducts: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Config not found");

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete trending products config
export const deleteTrendingProductsConfig = mutation({
  args: { id: v.id("trendingProductsConfig") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
