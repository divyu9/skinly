import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

// Get applicable upsells for a given cart
export const getUpsellsForCart = query({
  args: {
    cartItems: v.array(v.object({
      productId: v.string(),
      variant: v.string(),
      price: v.number(),
      quantity: v.number(),
      phoneModel: v.optional(v.string()),
      phoneBrand: v.optional(v.string()),
      coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
    })),
  },
  handler: async (ctx, args) => {
    // Get all active upsell rules sorted by priority
    const rules = await ctx.db
      .query("checkoutUpsells")
      .withIndex("by_active_and_priority", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();

    if (rules.length === 0) {
      return [];
    }

    // Calculate cart totals
    const cartValue = args.cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const cartItemCount = args.cartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Extract cart attributes
    const cartProductIds = new Set(args.cartItems.map(item => item.productId));
    const cartPhoneBrands = new Set(
      args.cartItems
        .filter(item => item.phoneBrand)
        .map(item => item.phoneBrand!)
    );

    // Get all products and variants in cart to check collections and categories
    const productsInCart: Doc<"products">[] = [];
    const variantsInCart: Doc<"variants">[] = [];
    
    for (const item of args.cartItems) {
      const product = await ctx.db.get(item.productId as Id<"products">);
      if (product) {
        productsInCart.push(product);
      }
      // Find variant by product and title
      const variants = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", item.productId as Id<"products">))
        .collect();
      const variant = variants.find(v => v.title === item.variant);
      if (variant) {
        variantsInCart.push(variant);
      }
    }

    const cartCollectionIds = new Set(
      productsInCart
        .filter(p => p.collectionId)
        .map(p => p.collectionId!)
    );
    const cartGadgetCategories = new Set(
      productsInCart
        .filter(p => p.gadgetCategory)
        .map(p => p.gadgetCategory!)
    );
    const cartVariantIds = new Set(variantsInCart.map(v => v._id));

    // Evaluate each rule
    const matchingRules: Doc<"checkoutUpsells">[] = [];

    for (const rule of rules) {
      let matches = true;

      // Check match logic type
      const requiresAll = rule.matchLogic === "all";
      const conditions: boolean[] = [];

      // Check cart value conditions
      if (rule.cartValueOperator) {
        if (rule.cartValueOperator === ">=") {
          conditions.push(cartValue >= (rule.cartValueMin || 0));
        } else if (rule.cartValueOperator === "<=") {
          conditions.push(cartValue <= (rule.cartValueMax || Infinity));
        } else if (rule.cartValueOperator === "between") {
          conditions.push(
            cartValue >= (rule.cartValueMin || 0) &&
            cartValue <= (rule.cartValueMax || Infinity)
          );
        }
      }

      // Check cart item count conditions
      if (rule.cartItemCountOperator) {
        if (rule.cartItemCountOperator === ">=") {
          conditions.push(cartItemCount >= (rule.cartItemCountMin || 0));
        } else if (rule.cartItemCountOperator === "<=") {
          conditions.push(cartItemCount <= (rule.cartItemCountMax || Infinity));
        } else if (rule.cartItemCountOperator === "between") {
          conditions.push(
            cartItemCount >= (rule.cartItemCountMin || 0) &&
            cartItemCount <= (rule.cartItemCountMax || Infinity)
          );
        }
      }

      // Check if cart contains specific products
      if (rule.containsProductIds && rule.containsProductIds.length > 0) {
        const hasProduct = rule.containsProductIds.some(id =>
          cartProductIds.has(id)
        );
        conditions.push(hasProduct);
      }

      // Check if cart contains specific collections
      if (rule.containsCollectionIds && rule.containsCollectionIds.length > 0) {
        const hasCollection = rule.containsCollectionIds.some(id =>
          cartCollectionIds.has(id)
        );
        conditions.push(hasCollection);
      }

      // Check if cart contains specific variants
      if (rule.containsVariantIds && rule.containsVariantIds.length > 0) {
        const hasVariant = rule.containsVariantIds.some(id =>
          cartVariantIds.has(id)
        );
        conditions.push(hasVariant);
      }

      // Check if cart contains specific phone brands
      if (rule.containsPhoneBrands && rule.containsPhoneBrands.length > 0) {
        const hasBrand = rule.containsPhoneBrands.some(brand =>
          cartPhoneBrands.has(brand)
        );
        conditions.push(hasBrand);
      }

      // Check if cart contains specific gadget categories
      if (rule.containsGadgetCategories && rule.containsGadgetCategories.length > 0) {
        const hasCategory = rule.containsGadgetCategories.some(category =>
          cartGadgetCategories.has(category)
        );
        conditions.push(hasCategory);
      }

      // Evaluate based on match logic
      if (conditions.length === 0) {
        // No conditions = always match
        matches = true;
      } else if (requiresAll) {
        matches = conditions.every(c => c);
      } else {
        matches = conditions.some(c => c);
      }

      if (matches) {
        matchingRules.push(rule);
      }
    }

    // Get upsell products from matching rules (up to 3 total)
    const upsellProducts: Array<{
      productId: Id<"products">;
      productTitle: string;
      productImage: string | undefined;
      variantId: Id<"variants">;
      variantTitle: string;
      originalPrice: number;
      discountedPrice: number | undefined;
      sku: string;
    }> = [];

    for (const rule of matchingRules) {
      for (const upsell of rule.upsellProducts) {
        // Skip if already in cart
        if (cartVariantIds.has(upsell.variantId)) {
          continue;
        }

        // Get product and variant details
        const product = await ctx.db.get(upsell.productId);
        const variant = await ctx.db.get(upsell.variantId);

        if (product && variant && variant.inventoryQuantity > 0) {
          upsellProducts.push({
            productId: upsell.productId,
            productTitle: product.title,
            productImage: product.images[0]?.url,
            variantId: upsell.variantId,
            variantTitle: variant.title,
            originalPrice: variant.price,
            discountedPrice: upsell.discountedPrice,
            sku: variant.sku,
          });

          // Stop at 3 products
          if (upsellProducts.length >= 3) {
            break;
          }
        }
      }

      // Stop at 3 products
      if (upsellProducts.length >= 3) {
        break;
      }
    }

    return upsellProducts;
  },
});

// Admin: List all upsell rules
export const listAllRules = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    const rules = await ctx.db
      .query("checkoutUpsells")
      .order("desc")
      .collect();

    // Enrich with product/variant details
    const enrichedRules = await Promise.all(
      rules.map(async (rule) => {
        const upsellsWithDetails = await Promise.all(
          rule.upsellProducts.map(async (upsell) => {
            const product = await ctx.db.get(upsell.productId);
            const variant = await ctx.db.get(upsell.variantId);
            return {
              ...upsell,
              productTitle: product?.title || "Unknown",
              variantTitle: variant?.title || "Unknown",
              originalPrice: variant?.price || 0,
            };
          })
        );

        return {
          ...rule,
          upsellProductsWithDetails: upsellsWithDetails,
        };
      })
    );

    return enrichedRules;
  },
});

// Admin: Get single rule
export const getRule = query({
  args: { ruleId: v.id("checkoutUpsells") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    return await ctx.db.get(args.ruleId);
  },
});

// Admin: Create new rule
export const createRule = mutation({
  args: {
    ruleName: v.string(),
    isActive: v.boolean(),
    priority: v.number(),
    matchLogic: v.union(v.literal("all"), v.literal("any")),
    cartValueMin: v.optional(v.number()),
    cartValueMax: v.optional(v.number()),
    cartValueOperator: v.optional(v.union(v.literal(">="), v.literal("<="), v.literal("between"))),
    cartItemCountMin: v.optional(v.number()),
    cartItemCountMax: v.optional(v.number()),
    cartItemCountOperator: v.optional(v.union(v.literal(">="), v.literal("<="), v.literal("between"))),
    containsProductIds: v.optional(v.array(v.id("products"))),
    containsCollectionIds: v.optional(v.array(v.id("collections"))),
    containsVariantIds: v.optional(v.array(v.id("variants"))),
    containsPhoneBrands: v.optional(v.array(v.string())),
    containsGadgetCategories: v.optional(v.array(v.union(
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
    ))),
    upsellProducts: v.array(v.object({
      productId: v.id("products"),
      variantId: v.id("variants"),
      discountedPrice: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    const ruleId = await ctx.db.insert("checkoutUpsells", {
      ...args,
      createdBy: identity.email || "admin",
      createdAt: Date.now(),
    });

    return ruleId;
  },
});

// Admin: Update rule
export const updateRule = mutation({
  args: {
    ruleId: v.id("checkoutUpsells"),
    ruleName: v.string(),
    isActive: v.boolean(),
    priority: v.number(),
    matchLogic: v.union(v.literal("all"), v.literal("any")),
    cartValueMin: v.optional(v.number()),
    cartValueMax: v.optional(v.number()),
    cartValueOperator: v.optional(v.union(v.literal(">="), v.literal("<="), v.literal("between"))),
    cartItemCountMin: v.optional(v.number()),
    cartItemCountMax: v.optional(v.number()),
    cartItemCountOperator: v.optional(v.union(v.literal(">="), v.literal("<="), v.literal("between"))),
    containsProductIds: v.optional(v.array(v.id("products"))),
    containsCollectionIds: v.optional(v.array(v.id("collections"))),
    containsVariantIds: v.optional(v.array(v.id("variants"))),
    containsPhoneBrands: v.optional(v.array(v.string())),
    containsGadgetCategories: v.optional(v.array(v.union(
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
    ))),
    upsellProducts: v.array(v.object({
      productId: v.id("products"),
      variantId: v.id("variants"),
      discountedPrice: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    const { ruleId, ...updates } = args;

    await ctx.db.patch(ruleId, {
      ...updates,
      updatedBy: identity.email || "admin",
      updatedAt: Date.now(),
    });

    return ruleId;
  },
});

// Admin: Delete rule
export const deleteRule = mutation({
  args: { ruleId: v.id("checkoutUpsells") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    await ctx.db.delete(args.ruleId);
  },
});
