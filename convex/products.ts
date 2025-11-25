import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel.d.ts";

// Get all products with pagination
export const getAllProductsPaginated = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let productsQuery;

    if (args.status) {
      productsQuery = ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      productsQuery = ctx.db.query("products");
    }

    const result = await productsQuery.paginate(args.paginationOpts);
    
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
    const productsWithVariants = result.page.map((product) => {
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

// Get all products (non-paginated - keep for backward compatibility)
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

        // If SKU is being updated, check for duplicates
        if (fields.sku !== undefined && fields.sku !== variant.sku) {
          const existingVariant = await ctx.db
            .query("variants")
            .withIndex("by_sku", (q) => q.eq("sku", fields.sku!))
            .first();

          if (existingVariant && existingVariant._id !== variantId) {
            errors.push({ variantId, error: `SKU ${fields.sku} already exists` });
            errorCount++;
            continue;
          }
        }

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
