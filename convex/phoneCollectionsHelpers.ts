import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal queries and mutations for phone collections
export const getAllProductsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").filter((q) => q.eq(q.field("status"), "active")).collect();
  },
});

export const getCollectionBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("collections").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
  },
});

export const checkProductInCollectionInternal = internalQuery({
  args: { collectionId: v.id("collections"), productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collectionProducts")
      .withIndex("by_collection_and_product", (q) =>
        q.eq("collectionId", args.collectionId).eq("productId", args.productId)
      )
      .first();
  },
});

export const createCollectionInternal = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    category: v.string(),
    deviceType: v.string(),
    keywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("collections", {
      name: args.name,
      slug: args.slug,
      category: args.category as "phone",
      deviceType: args.deviceType,
      keywords: args.keywords,
    });
  },
});

export const updateCollectionInternal = internalMutation({
  args: {
    collectionId: v.id("collections"),
    category: v.string(),
    deviceType: v.string(),
    keywords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.collectionId, {
      category: args.category as "phone",
      deviceType: args.deviceType,
      keywords: args.keywords,
    });
  },
});

export const addProductToCollectionInternal = internalMutation({
  args: {
    collectionId: v.id("collections"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("collectionProducts", {
      collectionId: args.collectionId,
      productId: args.productId,
    });
  },
});
