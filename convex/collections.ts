import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// Get all collections
export const getAllCollections = query({
  args: {},
  handler: async (ctx) => {
    const collections = await ctx.db.query("collections").collect();
    return collections;
  },
});

// Get all collections with product counts
export const getAllCollectionsWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const collections = await ctx.db.query("collections").collect();
    
    // Get product counts for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        const productLinks = await ctx.db
          .query("collectionProducts")
          .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
          .collect();
        
        return {
          ...collection,
          productCount: productLinks.length,
        };
      })
    );
    
    return collectionsWithCounts;
  },
});

// Get collections by category
export const getCollectionsByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collections")
      .withIndex("by_category", (q) => q.eq("category", args.category as "phone" | "laptop" | "camera" | "accessory" | "other"))
      .collect();
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

// Get collection by name (case-insensitive)
export const getCollectionByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const searchName = args.name.toLowerCase().trim();
    
    // Get all collections and find a match (case-insensitive)
    const collections = await ctx.db.query("collections").collect();
    const collection = collections.find((c) => 
      c.name.toLowerCase() === searchName || 
      c.slug.toLowerCase() === searchName
    );
    
    if (!collection) {
      return null;
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
    isAuto: v.optional(v.boolean()),
    matchLogic: v.optional(v.union(v.literal("all"), v.literal("any"))),
    rules: v.optional(v.array(v.object({
      field: v.union(
        v.literal("productName"),
        v.literal("sku")
      ),
      condition: v.union(
        v.literal("contains"),
        v.literal("startsWith"),
        v.literal("notContains")
      ),
      value: v.string(),
    }))),
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
      isAuto: args.isAuto,
      matchLogic: args.matchLogic || "all",
      rules: args.rules,
    });

    // Auto-sync products if this is an auto collection
    if (args.isAuto && args.rules && args.rules.length > 0) {
      await ctx.runMutation(api.collections.syncAutoCollectionProducts, {
        collectionId,
      });
    }

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
    isAuto: v.optional(v.boolean()),
    matchLogic: v.optional(v.union(v.literal("all"), v.literal("any"))),
    rules: v.optional(v.array(v.object({
      field: v.union(
        v.literal("productName"),
        v.literal("sku")
      ),
      condition: v.union(
        v.literal("contains"),
        v.literal("startsWith"),
        v.literal("notContains")
      ),
      value: v.string(),
    }))),
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

    // Re-sync products if this is an auto collection
    const collection = await ctx.db.get(collectionId);
    if (collection && collection.isAuto && collection.rules && collection.rules.length > 0) {
      await ctx.runMutation(api.collections.syncAutoCollectionProducts, {
        collectionId,
      });
    }
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

// Get products in a collection (using collectionProducts table)
export const getCollectionProducts = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new ConvexError({
        message: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    // Get all product IDs in this collection
    const collectionProductLinks = await ctx.db
      .query("collectionProducts")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    // Get all products and variants
    const products = await Promise.all(
      collectionProductLinks.map(async (link) => {
        const product = await ctx.db.get(link.productId);
        if (!product) return null;
        
        const variants = await ctx.db
          .query("variants")
          .withIndex("by_product", (q) => q.eq("productId", link.productId))
          .collect();
        
        return {
          ...product,
          variants,
        };
      })
    );

    // Filter out null products
    return products.filter((p) => p !== null);
  },
});

// Get products in a collection with pagination (optimized)
export const getCollectionProductsPaginated = query({
  args: { 
    collectionId: v.id("collections"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new ConvexError({
        message: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    const limit = args.limit || 30;
    const offset = args.offset || 0;

    // Get product IDs in this collection
    const collectionProductLinks = await ctx.db
      .query("collectionProducts")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    // Paginate the product links
    const paginatedLinks = collectionProductLinks.slice(offset, offset + limit);

    // Get all variants once
    const allVariants = await ctx.db.query("variants").collect();
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    // Get products for the current page
    const products = await Promise.all(
      paginatedLinks.map(async (link) => {
        const product = await ctx.db.get(link.productId);
        if (!product) return null;
        
        const variants = variantsByProduct.get(link.productId) || [];
        
        return {
          ...product,
          variants,
        };
      })
    );

    // Filter out null products
    const validProducts = products.filter((p) => p !== null);

    return {
      products: validProducts,
      hasMore: offset + limit < collectionProductLinks.length,
      total: collectionProductLinks.length
    };
  },
});

// Sync products for an auto-collection (populate collectionProducts table)
export const syncAutoCollectionProducts = mutation({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new ConvexError({
        message: "Collection not found",
        code: "NOT_FOUND",
      });
    }

    // Only sync auto collections
    if (!collection.isAuto || !collection.rules || collection.rules.length === 0) {
      return { synced: 0, message: "Not an auto collection or no rules defined" };
    }

    // Filter out rules with empty values
    const validRules = collection.rules.filter((rule) => rule.value.trim() !== "");
    if (validRules.length === 0) {
      return { synced: 0, message: "No valid rules" };
    }

    // Get all products and variants
    const allProducts = await ctx.db.query("products").collect();
    const allVariants = await ctx.db.query("variants").collect();

    // Group variants by product
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    // Filter products based on rules (same logic as preview)
    const matchLogic = collection.matchLogic || "all";
    const matchingProducts = allProducts.filter((product) => {
      const variants = variantsByProduct.get(product._id) || [];
      
      const ruleMatches = (rule: {
        field: "productName" | "sku";
        condition: "contains" | "startsWith" | "notContains";
        value: string;
      }) => {
        const value = rule.value.toLowerCase();
        
        if (rule.field === "productName") {
          const productName = product.title.toLowerCase();
          
          if (rule.condition === "contains") {
            return productName.includes(value);
          } else if (rule.condition === "startsWith") {
            return productName.startsWith(value);
          } else if (rule.condition === "notContains") {
            return !productName.includes(value);
          }
        } else if (rule.field === "sku") {
          return variants.some((variant) => {
            const sku = variant.sku.toLowerCase();
            
            if (rule.condition === "contains") {
              return sku.includes(value);
            } else if (rule.condition === "startsWith") {
              return sku.startsWith(value);
            } else if (rule.condition === "notContains") {
              return !sku.includes(value);
            }
            return false;
          });
        }
        
        return false;
      };
      
      if (matchLogic === "any") {
        return validRules.some(ruleMatches);
      } else {
        return validRules.every(ruleMatches);
      }
    });

    // Delete existing collectionProducts entries for this collection
    const existingLinks = await ctx.db
      .query("collectionProducts")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();
    
    for (const link of existingLinks) {
      await ctx.db.delete(link._id);
    }

    // Insert new collectionProducts entries
    for (const product of matchingProducts) {
      await ctx.db.insert("collectionProducts", {
        collectionId: args.collectionId,
        productId: product._id,
      });
    }

    return { synced: matchingProducts.length };
  },
});

// Preview products matching rules (before collection is created)
export const previewCollectionProducts = query({
  args: {
    rules: v.array(v.object({
      field: v.union(
        v.literal("productName"),
        v.literal("sku")
      ),
      condition: v.union(
        v.literal("contains"),
        v.literal("startsWith"),
        v.literal("notContains")
      ),
      value: v.string(),
    })),
    matchLogic: v.optional(v.union(v.literal("all"), v.literal("any"))),
  },
  handler: async (ctx, args) => {
    // If no rules, return empty
    if (args.rules.length === 0) {
      return [];
    }

    // Filter out rules with empty values
    const validRules = args.rules.filter((rule) => rule.value.trim() !== "");
    if (validRules.length === 0) {
      return [];
    }

    // Get all products and variants
    const allProducts = await ctx.db.query("products").collect();
    const allVariants = await ctx.db.query("variants").collect();

    // Group variants by product
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    // Filter products based on rules
    const matchLogic = args.matchLogic || "all";
    const matchingProducts = allProducts.filter((product) => {
      const variants = variantsByProduct.get(product._id) || [];
      
      // Helper function to check if a rule matches
      const ruleMatches = (rule: {
        field: "productName" | "sku";
        condition: "contains" | "startsWith" | "notContains";
        value: string;
      }) => {
        const value = rule.value.toLowerCase();
        
        if (rule.field === "productName") {
          const productName = product.title.toLowerCase();
          
          if (rule.condition === "contains") {
            return productName.includes(value);
          } else if (rule.condition === "startsWith") {
            return productName.startsWith(value);
          } else if (rule.condition === "notContains") {
            return !productName.includes(value);
          }
        } else if (rule.field === "sku") {
          // Check if any variant matches the SKU condition
          return variants.some((variant) => {
            const sku = variant.sku.toLowerCase();
            
            if (rule.condition === "contains") {
              return sku.includes(value);
            } else if (rule.condition === "startsWith") {
              return sku.startsWith(value);
            } else if (rule.condition === "notContains") {
              return !sku.includes(value);
            }
            return false;
          });
        }
        
        return false;
      };
      
      // Apply match logic: "all" = AND, "any" = OR
      if (matchLogic === "any") {
        return validRules.some(ruleMatches);
      } else {
        return validRules.every(ruleMatches);
      }
    });

    // Return products with their variants
    return matchingProducts.map((product) => ({
      ...product,
      variants: variantsByProduct.get(product._id) || [],
    }));
  },
});
