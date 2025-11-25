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

// Get products matching collection rules
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

    // If not an auto collection, return empty
    if (!collection.isAuto || !collection.rules || collection.rules.length === 0) {
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
    const matchLogic = collection.matchLogic || "all";
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
        return collection.rules!.some(ruleMatches);
      } else {
        return collection.rules!.every(ruleMatches);
      }
    });

    // Return products with their variants
    return matchingProducts.map((product) => ({
      ...product,
      variants: variantsByProduct.get(product._id) || [],
    }));
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
