import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

// Get all products with pagination
export const getAllProductsPaginated = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
    productCategory: v.optional(v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory")
    )),
    gadgetCategory: v.optional(v.union(
      v.literal("phone"),
      v.literal("laptop"),
      v.literal("tablet"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("drone"),
      v.literal("charger"),
      v.literal("console"),
      v.literal("mac-mini"),
      v.literal("cover"),
      v.literal("accessory")
    )),
    gadgetTypeId: v.optional(v.id("gadgetTypes")),
    finishTypeId: v.optional(v.id("finishTypes")),
    collectionId: v.optional(v.id("collections")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let productsQuery;

    // Priority 1: Use productCategory index if specified
    if (args.productCategory && args.gadgetTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_product_category_and_gadget", (q) => 
          q.eq("productCategory", args.productCategory!).eq("gadgetTypeId", args.gadgetTypeId!)
        );
      // Apply other filters in memory
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
      if (args.finishTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("finishTypeId"), args.finishTypeId!));
      }
    } else if (args.productCategory && args.finishTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_product_category_and_finish", (q) => 
          q.eq("productCategory", args.productCategory!).eq("finishTypeId", args.finishTypeId!)
        );
      // Apply other filters in memory
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
      if (args.gadgetTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("gadgetTypeId"), args.gadgetTypeId!));
      }
    } else if (args.productCategory) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_product_category", (q) => q.eq("productCategory", args.productCategory!));
      // Apply other filters in memory
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
      if (args.gadgetTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("gadgetTypeId"), args.gadgetTypeId!));
      }
      if (args.finishTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("finishTypeId"), args.finishTypeId!));
      }
    }
    // Priority 2: Use gadgetTypeId and finishTypeId indexes
    else if (args.gadgetTypeId && args.finishTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_gadget_type_and_finish", (q) => 
          q.eq("gadgetTypeId", args.gadgetTypeId!).eq("finishTypeId", args.finishTypeId!)
        );
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
    } else if (args.gadgetTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_gadget_type", (q) => q.eq("gadgetTypeId", args.gadgetTypeId!));
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
      if (args.finishTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("finishTypeId"), args.finishTypeId!));
      }
    }
    // Priority 3: Legacy gadgetCategory (for backward compatibility)
    else if (args.gadgetCategory && args.finishTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_category_and_finish", (q) => 
          q.eq("gadgetCategory", args.gadgetCategory!).eq("finishTypeId", args.finishTypeId!)
        );
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
    } else if (args.status && args.gadgetCategory) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_status_and_category", (q) => 
          q.eq("status", args.status!).eq("gadgetCategory", args.gadgetCategory!)
        );
      if (args.finishTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("finishTypeId"), args.finishTypeId!));
      }
    } else if (args.gadgetCategory) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_gadget_category", (q) => q.eq("gadgetCategory", args.gadgetCategory!));
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
      if (args.finishTypeId) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("finishTypeId"), args.finishTypeId!));
      }
    } else if (args.finishTypeId) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_finish_type", (q) => q.eq("finishTypeId", args.finishTypeId!));
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
    } else if (args.status) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      productsQuery = ctx.db.query("products");
      if (args.status) {
        productsQuery = productsQuery.filter((q) => q.eq(q.field("status"), args.status!));
      }
    }

    // Apply collection filter in memory (can't use index easily with pagination)
    if (args.collectionId) {
      const collectionProducts = await ctx.db
        .query("collectionProducts")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId!))
        .collect();
      
      const productIdsInCollection = new Set(collectionProducts.map(cp => cp.productId));
      
      productsQuery = productsQuery.filter((q) => {
        const productIdField = q.field("_id");
        return q.neq(productIdField, "placeholder" as unknown as null);
      });
    }

    const result = await productsQuery.paginate(args.paginationOpts);
    
    // Filter by collection in memory if specified
    let pageProducts = result.page;
    if (args.collectionId) {
      const collectionProducts = await ctx.db
        .query("collectionProducts")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId!))
        .collect();
      
      const productIdsInCollection = new Set(
        collectionProducts.map(cp => cp.productId)
      );
      
      pageProducts = pageProducts.filter(p => productIdsInCollection.has(p._id));
    }
    
    // Fetch ALL variants in one query and group by productId
    const allVariants = await ctx.db.query("variants").collect();
    const variantsByProduct = new Map<string, typeof allVariants>();
    
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    // Build products with their variants
    const productsWithVariants = pageProducts.map((product) => {
      const variants = variantsByProduct.get(product._id) || [];
      return {
        ...product,
        variants,
        collection: null, // Skip collection lookup for performance
      };
    });

    return {
      page: productsWithVariants,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// Get all products with only basic info and variant count (ultra-lightweight)
export const getAllProductsBasic = query({
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

    // Fetch ALL variants
    const allVariants = await ctx.db.query("variants").collect();
    
    // Count variants per product and build SKU list for search
    const variantDataByProduct = new Map<string, {
      count: number;
      skus: string[];
      firstVariant: typeof allVariants[0] | null;
      totalInventory: number;
    }>();
    
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantDataByProduct.has(productId)) {
        variantDataByProduct.set(productId, {
          count: 0,
          skus: [],
          firstVariant: null,
          totalInventory: 0,
        });
      }
      const data = variantDataByProduct.get(productId)!;
      data.count++;
      data.skus.push(variant.sku);
      data.totalInventory += variant.inventoryQuantity;
      if (data.firstVariant === null) {
        data.firstVariant = variant;
      }
    }

    // Build products with variant metadata
    return products.map((product) => {
      const variantData = variantDataByProduct.get(product._id) || {
        count: 0,
        skus: [],
        firstVariant: null,
        totalInventory: 0,
      };
      return {
        _id: product._id,
        _creationTime: product._creationTime,
        title: product.title,
        slug: product.slug,
        description: product.description,
        status: product.status,
        images: product.images,
        tags: product.tags,
        collectionId: product.collectionId,
        metaDescription: product.metaDescription,
        metaTitle: product.metaTitle,
        gadgetCategory: product.gadgetCategory,
        // Variant summary data
        variantCount: variantData.count,
        variantSkus: variantData.skus,
        firstVariant: variantData.firstVariant,
        totalInventory: variantData.totalInventory,
        collection: null,
      };
    });
  },
});

// Get variants for a specific product
export const getProductVariants = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
    return variants;
  },
});

// Get all products (non-paginated - keep for backward compatibility)
// WARNING: This query can exceed response size limits with large datasets
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

    // Fetch ALL variants in one query and group by productId
    const allVariants = await ctx.db.query("variants").collect();
    const variantsByProduct = new Map<string, typeof allVariants>();
    
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }

    // Build products with their variants
    const productsWithVariants = products.map((product) => {
      const variants = variantsByProduct.get(product._id) || [];
      return {
        ...product,
        variants,
        collection: null, // Skip collection lookup for performance
      };
    });

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

// Get product by slug
export const getProductBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
      
    if (!product) {
      return null;
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

// Search products by title and SKU
export const searchProducts = query({
  args: { 
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const searchQuery = args.query.toLowerCase().trim();
    
    if (searchQuery.length < 2) {
      return [];
    }
    
    // Normalize search query (remove spaces and special chars for better matching)
    const normalizeText = (text: string): string => {
      return text.toLowerCase().replace(/[\s\-_]/g, '');
    };
    
    const normalizedSearchTerms = searchQuery.split(/\s+/).filter(term => term.length > 0).map(normalizeText);
    
    // Get all active products
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    
    // Get all variants for SKU search
    const allVariants = await ctx.db.query("variants").collect();
    const variantsByProduct = new Map<string, typeof allVariants>();
    
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }
    
    // Search products by title
    const matchingProducts = products.filter(product => {
      const normalizedTitle = normalizeText(product.title);
      // Check if ALL search terms are present in the title
      return normalizedSearchTerms.every(term => normalizedTitle.includes(term));
    });
    
    // Also search by SKU
    const productsBySku = new Set<string>();
    for (const variant of allVariants) {
      if (variant.sku) {
        const normalizedSku = normalizeText(variant.sku);
        if (normalizedSearchTerms.every(term => normalizedSku.includes(term))) {
          productsBySku.add(variant.productId);
        }
      }
    }
    
    // Combine results (products found by title or SKU)
    const combinedProductIds = new Set([
      ...matchingProducts.map(p => p._id),
      ...Array.from(productsBySku)
    ]);
    
    // Build final results with variants
    const results = products
      .filter(p => combinedProductIds.has(p._id))
      .slice(0, limit)
      .map(product => ({
        _id: product._id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        status: product.status,
        images: product.images,
        tags: product.tags,
        variants: variantsByProduct.get(product._id) || [],
      }));
    
    return results;
  },
});

// Get products by tag (for Top Picks section)
export const getProductsByTag = query({
  args: { 
    tag: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const searchTag = args.tag.toLowerCase().trim();
    
    // Get all active products with the specified tag
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    
    // Filter products that have the tag
    const matchingProducts = products.filter(product => 
      product.tags.some(tag => tag.toLowerCase() === searchTag)
    );
    
    // Get variants for matching products
    const allVariants = await ctx.db.query("variants").collect();
    const variantsByProduct = new Map<string, typeof allVariants>();
    
    for (const variant of allVariants) {
      const productId = variant.productId;
      if (!variantsByProduct.has(productId)) {
        variantsByProduct.set(productId, []);
      }
      variantsByProduct.get(productId)!.push(variant);
    }
    
    // Build results with variants
    const results = matchingProducts
      .slice(0, limit)
      .map(product => ({
        _id: product._id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        status: product.status,
        images: product.images,
        tags: product.tags,
        variants: variantsByProduct.get(product._id) || [],
      }));
    
    return results;
  },
});

// Create product
export const createProduct = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    metaDescription: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    })),
    tags: v.array(v.string()),
    gadgetCategory: v.union(
      v.literal("phone"),
      v.literal("laptop"),
      v.literal("tablet"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("drone"),
      v.literal("charger"),
      v.literal("console"),
      v.literal("mac-mini"),
      v.literal("cover"),
      v.literal("accessory")
    ),
    gadgetTypeId: v.optional(v.id("gadgetTypes")),
    finishTypeId: v.optional(v.id("finishTypes")),
    productCategory: v.optional(v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory")
    )),
    length: v.optional(v.number()),
    breadth: v.optional(v.number()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    productType: v.optional(v.union(v.literal("physical"), v.literal("digital"))),
    hasMultipleVariants: v.optional(v.boolean()),
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
      metaTitle: args.metaTitle,
      collectionId: args.collectionId,
      status: args.status,
      images: args.images,
      tags: args.tags,
      gadgetCategory: args.gadgetCategory,
      gadgetTypeId: args.gadgetTypeId,
      finishTypeId: args.finishTypeId,
      productCategory: args.productCategory,
      length: args.length ?? 10,
      breadth: args.breadth ?? 10,
      height: args.height ?? 2,
      weight: args.weight ?? 100,
      productType: args.productType ?? "physical",
      hasMultipleVariants: args.hasMultipleVariants ?? false,
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
    metaTitle: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
    images: v.optional(v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    }))),
    tags: v.optional(v.array(v.string())),
    length: v.optional(v.number()),
    breadth: v.optional(v.number()),
    height: v.optional(v.number()),
    weight: v.optional(v.number()),
    productType: v.optional(v.union(v.literal("physical"), v.literal("digital"))),
    gadgetCategory: v.optional(v.string()),
    gadgetTypeId: v.optional(v.id("gadgetTypes")),
    finishTypeId: v.optional(v.id("finishTypes")),
    productCategory: v.optional(v.union(
      v.literal("skin"),
      v.literal("case-cover"),
      v.literal("camera-ring"),
      v.literal("magneto-x"),
      v.literal("glass"),
      v.literal("accessory")
    )),
    hasMultipleVariants: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { productId, ...rawUpdates } = args;

    // Type the updates properly for patch
    const updates: Partial<{
      title?: string;
      slug?: string;
      description?: string;
      metaDescription?: string;
      metaTitle?: string;
      collectionId?: Id<"collections">;
      status?: "active" | "draft" | "archived";
      images?: Array<{ url: string; alt?: string }>;
      tags?: string[];
      length?: number;
      breadth?: number;
      height?: number;
      weight?: number;
      productType?: "physical" | "digital";
      gadgetCategory?: "phone" | "laptop" | "camera" | "accessory" | "tablet" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover";
      gadgetTypeId?: Id<"gadgetTypes">;
      finishTypeId?: Id<"finishTypes">;
      productCategory?: "skin" | "case-cover" | "camera-ring" | "magneto-x" | "glass" | "accessory";
      hasMultipleVariants?: boolean;
    }> = {
      ...rawUpdates,
      gadgetCategory: rawUpdates.gadgetCategory as "phone" | "laptop" | "camera" | "accessory" | "tablet" | "lens" | "drone" | "charger" | "console" | "mac-mini" | "cover" | undefined,
    };

    // Validate shipping dimensions
    if (updates.length !== undefined && updates.length < 0) {
      throw new ConvexError({
        message: "Length must be a positive number",
        code: "BAD_REQUEST",
      });
    }
    if (updates.breadth !== undefined && updates.breadth < 0) {
      throw new ConvexError({
        message: "Breadth must be a positive number",
        code: "BAD_REQUEST",
      });
    }
    if (updates.height !== undefined && updates.height < 0) {
      throw new ConvexError({
        message: "Height must be a positive number",
        code: "BAD_REQUEST",
      });
    }
    if (updates.weight !== undefined && updates.weight < 0) {
      throw new ConvexError({
        message: "Weight must be a positive number",
        code: "BAD_REQUEST",
      });
    }

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

// Clone product (create a duplicate with all variants)
export const cloneProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<Id<"products">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get the original product
    const originalProduct = await ctx.db.get(args.productId);
    if (!originalProduct) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    // Get all variants of the original product
    const originalVariants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    // Generate a unique slug by appending "-copy" (or "-copy-2", "-copy-3", etc.)
    let newSlug = `${originalProduct.slug}-copy`;
    let counter = 2;
    
    // Keep checking until we find an available slug
    while (true) {
      const existingProduct = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", newSlug))
        .first();
      
      if (!existingProduct) {
        break;
      }
      
      newSlug = `${originalProduct.slug}-copy-${counter}`;
      counter++;
    }

    // Create the cloned product (set status to draft)
    const clonedProductId = await ctx.db.insert("products", {
      title: `${originalProduct.title} (Copy)`,
      slug: newSlug,
      description: originalProduct.description,
      metaDescription: originalProduct.metaDescription,
      metaTitle: originalProduct.metaTitle,
      collectionId: originalProduct.collectionId,
      status: "draft", // Set to draft so admin can review before publishing
      images: originalProduct.images,
      tags: originalProduct.tags,
      gadgetCategory: originalProduct.gadgetCategory,
      gadgetTypeId: originalProduct.gadgetTypeId,
      finishTypeId: originalProduct.finishTypeId,
      productCategory: originalProduct.productCategory,
      finishType: originalProduct.finishType,
      length: originalProduct.length ?? 10,
      breadth: originalProduct.breadth ?? 10,
      height: originalProduct.height ?? 2,
      weight: originalProduct.weight ?? 100,
      productType: originalProduct.productType ?? "physical",
      hasMultipleVariants: originalProduct.hasMultipleVariants ?? false,
    });

    // Clone all variants
    for (const originalVariant of originalVariants) {
      await ctx.db.insert("variants", {
        productId: clonedProductId,
        sku: originalVariant.sku, // Keep same SKU (admin can change later if needed)
        title: originalVariant.title,
        price: originalVariant.price,
        compareAtPrice: originalVariant.compareAtPrice,
        inventoryQuantity: originalVariant.inventoryQuantity,
        weight: originalVariant.weight,
        weightUnit: originalVariant.weightUnit,
        rNumber: originalVariant.rNumber,
        materialMultiplier: originalVariant.materialMultiplier,
        consumptionPresetId: originalVariant.consumptionPresetId,
        customMultiplier: originalVariant.customMultiplier,
        isDefaultVariant: originalVariant.isDefaultVariant,
      });
    }

    return clonedProductId;
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
    isDefaultVariant: v.optional(v.boolean()),
    consumptionPresetId: v.optional(v.id("variantConsumptionPresets")),
    customMultiplier: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Duplicate SKUs are allowed
    const variantId = await ctx.db.insert("variants", {
      productId: args.productId,
      sku: args.sku,
      title: args.title,
      price: args.price,
      compareAtPrice: args.compareAtPrice,
      inventoryQuantity: args.inventoryQuantity,
      weight: args.weight,
      weightUnit: args.weightUnit,
      isDefaultVariant: args.isDefaultVariant,
      consumptionPresetId: args.consumptionPresetId,
      customMultiplier: args.customMultiplier,
    });
    
    // Auto-sync if preset or custom multiplier is set and variant will have R-number
    if ((args.consumptionPresetId || args.customMultiplier) && args.productId) {
      // Schedule sync for this variant after 2 seconds
      await ctx.scheduler.runAfter(2000, internal.rollsManagement.syncInventoryFromRollsInternal, {
        variantIds: [variantId],
      });
    }

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
    isDefaultVariant: v.optional(v.boolean()),
    consumptionPresetId: v.optional(v.id("variantConsumptionPresets")),
    customMultiplier: v.optional(v.number()),
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

    // Duplicate SKUs are allowed
    await ctx.db.patch(variantId, updates);
    
    // Auto-sync if preset or custom multiplier was updated
    if (args.consumptionPresetId !== undefined || args.customMultiplier !== undefined) {
      // Schedule sync for this variant after 2 seconds
      await ctx.scheduler.runAfter(2000, internal.rollsManagement.syncInventoryFromRollsInternal, {
        variantIds: [variantId],
      });
    }
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

// Delete all products (use with caution!)
export const deleteAllProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Delete all variants first
    const variants = await ctx.db.query("variants").collect();
    for (const variant of variants) {
      await ctx.db.delete(variant._id);
    }

    // Delete all products
    const products = await ctx.db.query("products").collect();
    for (const product of products) {
      await ctx.db.delete(product._id);
    }

    return {
      deletedProducts: products.length,
      deletedVariants: variants.length,
    };
  },
});

// Get cross-sell products
export const getCrossSellProducts = query({
  args: {
    phoneBrand: v.optional(v.string()),
    isPhoneSkin: v.boolean(),
  },
  handler: async (ctx, args) => {
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
    
    const crossSells: Array<typeof allProducts[0] & { variants: typeof allVariants }> = [];
    
    // For all phone skins: Show Matte Membrane + Gloss Membrane
    if (args.isPhoneSkin) {
      const matteMemb = allProducts.find(p => 
        p.title.toLowerCase().includes("matte membrane") && 
        p.title.toLowerCase().includes("3 layer")
      );
      const glossMemb = allProducts.find(p => 
        p.title.toLowerCase().includes("gloss membrane") && 
        p.title.toLowerCase().includes("3 layer")
      );
      
      if (matteMemb) {
        crossSells.push({
          ...matteMemb,
          variants: variantsByProduct.get(matteMemb._id) || [],
        });
      }
      if (glossMemb) {
        crossSells.push({
          ...glossMemb,
          variants: variantsByProduct.get(glossMemb._id) || [],
        });
      }
    }
    
    // For Apple phones: Show AutoApply Tempered Glass + Privacy Pack + Cases
    if (args.phoneBrand?.toLowerCase() === "apple") {
      const temperedGlass = allProducts.find(p => 
        p.title.toLowerCase().includes("autoapply") && 
        p.title.toLowerCase().includes("tempered") &&
        !p.title.toLowerCase().includes("privacy")
      );
      const privacyPack = allProducts.find(p => 
        p.title.toLowerCase().includes("autoapply") && 
        p.title.toLowerCase().includes("privacy")
      );
      const appleCase = allProducts.find(p => 
        p.title.toLowerCase().includes("case") && 
        p.title.toLowerCase().includes("iphone") &&
        p.title.toLowerCase().includes("magsafe")
      );
      
      if (temperedGlass) {
        crossSells.push({
          ...temperedGlass,
          variants: variantsByProduct.get(temperedGlass._id) || [],
        });
      }
      if (privacyPack) {
        crossSells.push({
          ...privacyPack,
          variants: variantsByProduct.get(privacyPack._id) || [],
        });
      }
      if (appleCase) {
        crossSells.push({
          ...appleCase,
          variants: variantsByProduct.get(appleCase._id) || [],
        });
      }
    }
    
    // For Samsung phones: Show Cases + Camera Rings
    if (args.phoneBrand?.toLowerCase() === "samsung") {
      const samsungCase = allProducts.find(p => 
        p.title.toLowerCase().includes("case") && 
        p.title.toLowerCase().includes("samsung")
      );
      const cameraRings = allProducts.find(p => 
        p.title.toLowerCase().includes("camera") && 
        p.title.toLowerCase().includes("ring") &&
        p.title.toLowerCase().includes("samsung")
      );
      
      if (samsungCase) {
        crossSells.push({
          ...samsungCase,
          variants: variantsByProduct.get(samsungCase._id) || [],
        });
      }
      if (cameraRings) {
        crossSells.push({
          ...cameraRings,
          variants: variantsByProduct.get(cameraRings._id) || [],
        });
      }
    }
    
    return crossSells;
  },
});

// Export products for bulk editing
export const exportProductsForBulkEdit = query({
  args: {
    productIds: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const exportData = [];

    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (!product) continue;

      const variants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .collect();

      const collection = product.collectionId
        ? await ctx.db.get(product.collectionId)
        : null;

      // Each variant gets its own row
      for (const variant of variants) {
        exportData.push({
          productId: product._id,
          productTitle: product.title,
          productSlug: product.slug,
          productStatus: product.status,
          collectionName: collection?.name || "",
          variantId: variant._id,
          variantTitle: variant.title,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice || "",
          inventoryQuantity: variant.inventoryQuantity,
          weight: variant.weight || "",
          weightUnit: variant.weightUnit || "",
        });
      }
    }

    return exportData;
  },
});

// Bulk update variants from import
export const bulkUpdateVariants = mutation({
  args: {
    updates: v.array(v.object({
      variantId: v.id("variants"),
      sku: v.optional(v.string()),
      variantTitle: v.optional(v.string()),
      price: v.optional(v.number()),
      compareAtPrice: v.optional(v.union(v.number(), v.null())),
      inventoryQuantity: v.optional(v.number()),
      weight: v.optional(v.union(v.number(), v.null())),
      weightUnit: v.optional(v.union(v.string(), v.null())),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ variantId: string; error: string }> = [];

    for (const update of args.updates) {
      try {
        const { variantId, ...fields } = update;
        
        // Check if variant exists
        const variant = await ctx.db.get(variantId);
        if (!variant) {
          errors.push({ variantId, error: "Variant not found" });
          errorCount++;
          continue;
        }

        // Duplicate SKUs are allowed - skip validation

        // Build update object
        const updateObj: Record<string, string | number | null | undefined> = {};
        if (fields.sku !== undefined) updateObj.sku = fields.sku;
        if (fields.variantTitle !== undefined) updateObj.title = fields.variantTitle;
        if (fields.price !== undefined) updateObj.price = fields.price;
        if (fields.compareAtPrice !== undefined) updateObj.compareAtPrice = fields.compareAtPrice;
        if (fields.inventoryQuantity !== undefined) updateObj.inventoryQuantity = fields.inventoryQuantity;
        if (fields.weight !== undefined) updateObj.weight = fields.weight;
        if (fields.weightUnit !== undefined) updateObj.weightUnit = fields.weightUnit;

        await ctx.db.patch(variantId, updateObj);
        successCount++;
      } catch (error) {
        errors.push({
          variantId: update.variantId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errorCount++;
      }
    }

    return {
      successCount,
      errorCount,
      errors,
    };
  },
});

// Get all variants
export const getAllVariants = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("variants").collect();
  },
});

// Get all variants with their product information
export const getAllVariantsWithProducts = query({
  args: {},
  handler: async (ctx) => {
    const variants = await ctx.db.query("variants").collect();
    const products = await ctx.db.query("products").collect();
    
    const productsMap = new Map<string, Doc<"products">>();
    for (const product of products) {
      productsMap.set(product._id, product);
    }
    
    return variants.map((variant) => {
      const product = productsMap.get(variant.productId);
      return {
        ...variant,
        productTitle: product?.title || "Unknown Product",
      };
    });
  },
});

// Generate upload URL for product images
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Add images to product
export const addProductImages = mutation({
  args: {
    productId: v.id("products"),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    // Append new images to existing ones
    const updatedImages = [...product.images, ...args.images];
    await ctx.db.patch(args.productId, { images: updatedImages });

    return updatedImages;
  },
});

// Remove image from product
export const removeProductImage = mutation({
  args: {
    productId: v.id("products"),
    imageIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    if (args.imageIndex < 0 || args.imageIndex >= product.images.length) {
      throw new ConvexError({
        message: "Invalid image index",
        code: "BAD_REQUEST",
      });
    }

    // Remove image at index
    const updatedImages = product.images.filter((_, i) => i !== args.imageIndex);
    await ctx.db.patch(args.productId, { images: updatedImages });

    return updatedImages;
  },
});

// Reorder product images (first image is always primary)
export const reorderProductImages = mutation({
  args: {
    productId: v.id("products"),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.productId, { images: args.images });
    return args.images;
  },
});

// Bulk update variant prices
export const bulkUpdateVariantPrices = mutation({
  args: {
    updates: v.array(v.object({
      variantId: v.id("variants"),
      newPrice: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ variantId: string; error: string }> = [];

    for (const update of args.updates) {
      try {
        // Validate price
        if (update.newPrice < 0) {
          errors.push({
            variantId: update.variantId,
            error: "Price cannot be negative",
          });
          errorCount++;
          continue;
        }

        const variant = await ctx.db.get(update.variantId);
        if (!variant) {
          errors.push({
            variantId: update.variantId,
            error: "Variant not found",
          });
          errorCount++;
          continue;
        }

        await ctx.db.patch(update.variantId, { price: update.newPrice });
        successCount++;
      } catch (error) {
        errors.push({
          variantId: update.variantId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        errorCount++;
      }
    }

    return {
      successCount,
      errorCount,
      errors,
    };
  },
});

// Update product tags
export const updateProductTags = mutation({
  args: {
    productId: v.id("products"),
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

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.productId, { tags: args.tags });
    return { success: true };
  },
});

// Bulk add tag to products
export const bulkAddTag = mutation({
  args: {
    productIds: v.array(v.id("products")),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    let successCount = 0;
    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (product) {
        const newTags = product.tags.includes(args.tag)
          ? product.tags
          : [...product.tags, args.tag];
        await ctx.db.patch(productId, { tags: newTags });
        successCount++;
      }
    }

    return { successCount };
  },
});

// Bulk remove tag from products
export const bulkRemoveTag = mutation({
  args: {
    productIds: v.array(v.id("products")),
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    let successCount = 0;
    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (product) {
        const newTags = product.tags.filter(t => t !== args.tag);
        await ctx.db.patch(productId, { tags: newTags });
        successCount++;
      }
    }

    return { successCount };
  },
});
