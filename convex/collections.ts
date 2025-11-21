import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get all collections
export const getAllCollections = query({
  args: {},
  handler: async (ctx) => {
    const collections = await ctx.db.query("collections").collect();
    return collections;
  },
});

// Get single collection
export const getCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new ConvexError({
        message: "Collection not found",
        code: "NOT_FOUND",
      });
    }
    return collection;
  },
});

// Create collection
export const createCollection = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
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
    const existingCollection = await ctx.db
      .query("collections")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingCollection) {
      throw new ConvexError({
        message: "A collection with this slug already exists",
        code: "CONFLICT",
      });
    }

    const collectionId = await ctx.db.insert("collections", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      image: args.image,
    });

    return collectionId;
  },
});

// Update collection
export const updateCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { collectionId, ...updates } = args;

    // If updating slug, check it's not taken
    if (updates.slug !== undefined) {
      const existingCollection = await ctx.db
        .query("collections")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .first();

      if (existingCollection && existingCollection._id !== collectionId) {
        throw new ConvexError({
          message: "A collection with this slug already exists",
          code: "CONFLICT",
        });
      }
    }

    await ctx.db.patch(collectionId, updates);
  },
});

// Delete collection
export const deleteCollection = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.collectionId);
  },
});
