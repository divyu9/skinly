import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Get COD settings
export const getCodSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("codSettings").first();
    
    // Return default settings if none exist
    if (!settings) {
      return {
        enabled: false,
        matchMode: "ALL" as const,
        productIdsEnabled: false,
        productIds: [],
        collectionIdsEnabled: false,
        collectionIds: [],
        variantIdsEnabled: false,
        variantIds: [],
        minOrderAmountEnabled: false,
        minOrderAmount: 0,
        maxOrderAmountEnabled: false,
        maxOrderAmount: 0,
        minProductCountEnabled: false,
        minProductCount: 0,
        maxProductCountEnabled: false,
        maxProductCount: 0,
        codFeeType: "fixed" as const,
        codFeeValue: 0,
        partialCodEnabled: false,
        prepaidType: "fixed" as const,
        prepaidValue: 0,
      };
    }
    
    return settings;
  },
});

// Initialize COD settings with defaults
export const initializeCodSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const existing = await ctx.db.query("codSettings").first();
    
    if (existing) {
      return existing._id;
    }

    const settingsId = await ctx.db.insert("codSettings", {
      enabled: false,
      matchMode: "ALL",
      productIdsEnabled: false,
      productIds: [],
      collectionIdsEnabled: false,
      collectionIds: [],
      variantIdsEnabled: false,
      variantIds: [],
      minOrderAmountEnabled: false,
      minOrderAmount: 0,
      maxOrderAmountEnabled: false,
      maxOrderAmount: 0,
      minProductCountEnabled: false,
      minProductCount: 0,
      maxProductCountEnabled: false,
      maxProductCount: 0,
      codFeeType: "fixed",
      codFeeValue: 0,
      partialCodEnabled: false,
      prepaidType: "fixed",
      prepaidValue: 0,
    });

    return settingsId;
  },
});

// Update COD settings
export const updateCodSettings = mutation({
  args: {
    enabled: v.boolean(),
    matchMode: v.union(v.literal("ALL"), v.literal("ANY")),
    productIdsEnabled: v.boolean(),
    productIds: v.array(v.id("products")),
    collectionIdsEnabled: v.boolean(),
    collectionIds: v.array(v.id("collections")),
    variantIdsEnabled: v.boolean(),
    variantIds: v.array(v.id("variants")),
    minOrderAmountEnabled: v.boolean(),
    minOrderAmount: v.number(),
    maxOrderAmountEnabled: v.boolean(),
    maxOrderAmount: v.number(),
    minProductCountEnabled: v.boolean(),
    minProductCount: v.number(),
    maxProductCountEnabled: v.boolean(),
    maxProductCount: v.number(),
    codFeeType: v.union(v.literal("fixed"), v.literal("percentage")),
    codFeeValue: v.number(),
    partialCodEnabled: v.boolean(),
    prepaidType: v.union(v.literal("fixed"), v.literal("percentage")),
    prepaidValue: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const existing = await ctx.db.query("codSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      const settingsId = await ctx.db.insert("codSettings", args);
      return settingsId;
    }
  },
});

// Helper: Calculate COD fee
export function calculateCodFee(
  amount: number,
  feeType: "fixed" | "percentage",
  feeValue: number
): number {
  if (feeType === "fixed") {
    return feeValue;
  } else {
    return (amount * feeValue) / 100;
  }
}

// Helper: Calculate prepaid amount for partial COD
export function calculatePrepaidAmount(
  total: number,
  prepaidType: "fixed" | "percentage",
  prepaidValue: number
): number {
  if (prepaidType === "fixed") {
    return prepaidValue;
  } else {
    return (total * prepaidValue) / 100;
  }
}

// Check if COD is available for a cart
export const isCodAvailable = query({
  args: {
    cartItems: v.array(
      v.object({
        productId: v.string(),
        variant: v.string(),
        quantity: v.number(),
        price: v.number(),
      })
    ),
    totalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("codSettings").first();

    // If COD is disabled, return false
    if (!settings || !settings.enabled) {
      return {
        available: false,
        codFee: 0,
        prepaidAmount: 0,
        codAmount: 0,
      };
    }

    // Get all variants to map productId + variant title to variant ID
    const allVariants = await ctx.db.query("variants").collect();
    
    // Build a map of productId to product for collection checks
    const productIds = [...new Set(args.cartItems.map((item) => item.productId))];
    const products = await Promise.all(
      productIds.map(async (pid) => {
        const product = await ctx.db.get(pid as Id<"products">);
        return product;
      })
    );
    const productMap = new Map(products.filter((p) => p !== null).map((p) => [p!._id, p!]));

    // Get all collection products for collection checks
    const collectionProducts = await ctx.db.query("collectionProducts").collect();

    // Validate conditions
    const conditions: boolean[] = [];

    // Product IDs condition
    if (settings.productIdsEnabled && settings.productIds.length > 0) {
      const hasMatchingProduct = args.cartItems.some((item) =>
        settings.productIds.includes(item.productId as Id<"products">)
      );
      conditions.push(hasMatchingProduct);
    }

    // Collection IDs condition
    if (settings.collectionIdsEnabled && settings.collectionIds.length > 0) {
      const hasMatchingCollection = args.cartItems.some((item) => {
        const product = productMap.get(item.productId as Id<"products">);
        if (!product) return false;
        
        // Check direct collectionId
        if (product.collectionId && settings.collectionIds.includes(product.collectionId)) {
          return true;
        }
        
        // Check collectionProducts
        const productCollections = collectionProducts
          .filter((cp) => cp.productId === product._id)
          .map((cp) => cp.collectionId);
        
        return productCollections.some((colId) => settings.collectionIds.includes(colId));
      });
      conditions.push(hasMatchingCollection);
    }

    // Variant IDs condition
    if (settings.variantIdsEnabled && settings.variantIds.length > 0) {
      const hasMatchingVariant = args.cartItems.some((item) => {
        const variant = allVariants.find(
          (v) => v.productId === item.productId && v.title === item.variant
        );
        return variant && settings.variantIds.includes(variant._id);
      });
      conditions.push(hasMatchingVariant);
    }

    // Min order amount condition
    if (settings.minOrderAmountEnabled) {
      conditions.push(args.totalAmount >= settings.minOrderAmount);
    }

    // Max order amount condition
    if (settings.maxOrderAmountEnabled) {
      conditions.push(args.totalAmount <= settings.maxOrderAmount);
    }

    // Product count
    const totalProductCount = args.cartItems.reduce((sum, item) => sum + item.quantity, 0);

    // Min product count condition
    if (settings.minProductCountEnabled) {
      conditions.push(totalProductCount >= settings.minProductCount);
    }

    // Max product count condition
    if (settings.maxProductCountEnabled) {
      conditions.push(totalProductCount <= settings.maxProductCount);
    }

    // Check if conditions pass based on match mode
    let conditionsPassed = false;
    if (conditions.length === 0) {
      // No conditions set, COD is available
      conditionsPassed = true;
    } else if (settings.matchMode === "ALL") {
      conditionsPassed = conditions.every((c) => c);
    } else {
      conditionsPassed = conditions.some((c) => c);
    }

    if (!conditionsPassed) {
      return {
        available: false,
        codFee: 0,
        prepaidAmount: 0,
        codAmount: 0,
      };
    }

    // Calculate COD fee
    const codFee = calculateCodFee(args.totalAmount, settings.codFeeType, settings.codFeeValue);

    // Calculate prepaid and COD amounts
    let prepaidAmount = 0;
    let codAmount = args.totalAmount + codFee;

    if (settings.partialCodEnabled) {
      prepaidAmount = calculatePrepaidAmount(
        args.totalAmount,
        settings.prepaidType,
        settings.prepaidValue
      );
      codAmount = args.totalAmount + codFee - prepaidAmount;
    }

    return {
      available: true,
      codFee,
      prepaidAmount,
      codAmount,
    };
  },
});

// Get COD calculation for checkout
export const getCodCalculation = query({
  args: { totalAmount: v.number() },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("codSettings").first();

    if (!settings || !settings.enabled) {
      return {
        codFee: 0,
        prepaidAmount: 0,
        codAmount: 0,
      };
    }

    const codFee = calculateCodFee(args.totalAmount, settings.codFeeType, settings.codFeeValue);

    let prepaidAmount = 0;
    let codAmount = args.totalAmount + codFee;

    if (settings.partialCodEnabled) {
      prepaidAmount = calculatePrepaidAmount(
        args.totalAmount,
        settings.prepaidType,
        settings.prepaidValue
      );
      codAmount = args.totalAmount + codFee - prepaidAmount;
    }

    return {
      codFee,
      prepaidAmount,
      codAmount,
    };
  },
});
