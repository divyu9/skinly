import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get all products
export const getAllProducts = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    let products;

    if (args.status) {
      products = await ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      products = await ctx.db.query("products").collect();
    }

    // Fetch variants for each product
    const productsWithVariants = await Promise.all(
      products.map(async (product) => {
        const variants = await ctx.db
          .query("variants")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();

        const collection = product.collectionId
          ? await ctx.db.get(product.collectionId)
          : null;

        return {
          ...product,
          variants,
          collection,
        };
      })
    );

    return productsWithVariants;
  },
});

// Get single product
export const getProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    const collection = product.collectionId
      ? await ctx.db.get(product.collectionId)
      : null;

    return {
      ...product,
      variants,
      collection,
    };
  },
});

// Create product
export const createProduct = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    metaDescription: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    })),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if slug already exists
    const existingProduct = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingProduct) {
      throw new ConvexError({
        message: "A product with this slug already exists",
        code: "CONFLICT",
      });
    }

    const productId = await ctx.db.insert("products", {
      title: args.title,
      slug: args.slug,
      description: args.description,
      metaDescription: args.metaDescription,
      collectionId: args.collectionId,
      status: args.status,
      images: args.images,
      tags: args.tags,
    });

    return productId;
  },
});

// Update product
export const updateProduct = mutation({
  args: {
    productId: v.id("products"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
    images: v.optional(v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    }))),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { productId, ...updates } = args;

    // If updating slug, check it's not taken
    if (updates.slug !== undefined) {
      const existingProduct = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .first();

      if (existingProduct && existingProduct._id !== productId) {
        throw new ConvexError({
          message: "A product with this slug already exists",
          code: "CONFLICT",
        });
      }
    }

    await ctx.db.patch(productId, updates);
  },
});

// Delete product
export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Delete all variants
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    for (const variant of variants) {
      await ctx.db.delete(variant._id);
    }

    await ctx.db.delete(args.productId);
  },
});

// Create variant
export const createVariant = mutation({
  args: {
    productId: v.id("products"),
    sku: v.string(),
    title: v.string(),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    inventoryQuantity: v.number(),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if SKU already exists
    const existingVariant = await ctx.db
      .query("variants")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();

    if (existingVariant) {
      throw new ConvexError({
        message: "A variant with this SKU already exists",
        code: "CONFLICT",
      });
    }

    const variantId = await ctx.db.insert("variants", {
      productId: args.productId,
      sku: args.sku,
      title: args.title,
      price: args.price,
      compareAtPrice: args.compareAtPrice,
      inventoryQuantity: args.inventoryQuantity,
      weight: args.weight,
      weightUnit: args.weightUnit,
    });

    return variantId;
  },
});

// Update variant
export const updateVariant = mutation({
  args: {
    variantId: v.id("variants"),
    sku: v.optional(v.string()),
    title: v.optional(v.string()),
    price: v.optional(v.number()),
    compareAtPrice: v.optional(v.number()),
    inventoryQuantity: v.optional(v.number()),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { variantId, ...updates } = args;

    // If updating SKU, check it's not taken
    if (updates.sku !== undefined) {
      const existingVariant = await ctx.db
        .query("variants")
        .withIndex("by_sku", (q) => q.eq("sku", updates.sku!))
        .first();

      if (existingVariant && existingVariant._id !== variantId) {
        throw new ConvexError({
          message: "A variant with this SKU already exists",
          code: "CONFLICT",
        });
      }
    }

    await ctx.db.patch(variantId, updates);
  },
});

// Delete variant
export const deleteVariant = mutation({
  args: { variantId: v.id("variants") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.variantId);
  },
});

// Update inventory
export const updateInventory = mutation({
  args: {
    variantId: v.id("variants"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.patch(args.variantId, {
      inventoryQuantity: args.quantity,
    });
  },
});
