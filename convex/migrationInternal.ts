import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Internal mutations to create products without auth checks (for migration)
export const createProductInternal = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    metaDescription: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    images: v.array(
      v.object({
        url: v.string(),
        alt: v.optional(v.string()),
      })
    ),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if product with this slug already exists
    const existingProduct = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingProduct) {
      // Return existing product ID instead of creating duplicate
      return existingProduct._id;
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

export const createVariantInternal = internalMutation({
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
    // Check if variant with this SKU already exists
    const existingVariant = await ctx.db
      .query("variants")
      .withIndex("by_sku", (q) => q.eq("sku", args.sku))
      .first();

    if (existingVariant) {
      // Update existing variant instead of creating duplicate
      await ctx.db.patch(existingVariant._id, {
        title: args.title,
        price: args.price,
        compareAtPrice: args.compareAtPrice,
        inventoryQuantity: args.inventoryQuantity,
        weight: args.weight,
        weightUnit: args.weightUnit,
      });
      return existingVariant._id;
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
