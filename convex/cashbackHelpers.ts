import { v } from "convex/values";
import { query } from "./_generated/server";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.d.ts";

// Calculate cashback for a specific item (product + variant) considering collections and cart value
export const calculateItemCashback = query({
  args: {
    productId: v.id("products"),
    variantId: v.id("variants"),
    finalPrice: v.number(), // Final price after all discounts/coupons
    cartTotal: v.optional(v.number()), // Total cart value (for cart-value filters)
  },
  handler: async (ctx, args) => {
    try {
      // Get all active cashback rules
      const allActiveRules = await ctx.db
        .query("cashbackRules")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();

      // Get variant-level rules
      const variantRules = allActiveRules.filter(
        (rule) => rule.targetType === "variant" && rule.targetId === args.variantId
      );

      // Get product-level rules
      const productRules = allActiveRules.filter(
        (rule) => rule.targetType === "product" && rule.targetId === args.productId
      );

      // Get collection-level rules
      // First, find which collections this product belongs to
      const collectionProducts = await ctx.db
        .query("collectionProducts")
        .filter((q) => q.eq(q.field("productId"), args.productId))
        .collect();

      const collectionIds = collectionProducts.map((cp) => cp.collectionId);
      
      const collectionRules = allActiveRules.filter(
        (rule) => 
          rule.targetType === "collection" && 
          collectionIds.includes(rule.targetId as Id<"collections">)
      );

      // Combine all applicable rules
      const applicableRules = [...variantRules, ...productRules, ...collectionRules];

      if (applicableRules.length === 0) {
        return {
          hasCashback: false,
          cashbackAmount: 0,
          cashbackRule: null,
        };
      }

      // Filter rules by cart value constraints (if cartTotal is provided)
      const eligibleRules = args.cartTotal !== undefined
        ? applicableRules.filter((rule) => {
            // Check minimum cart value
            if (rule.minCartValue !== undefined && args.cartTotal! < rule.minCartValue) {
              return false;
            }
            // Check maximum cart value
            if (rule.maxCartValue !== undefined && args.cartTotal! > rule.maxCartValue) {
              return false;
            }
            return true;
          })
        : applicableRules;

      if (eligibleRules.length === 0) {
        return {
          hasCashback: false,
          cashbackAmount: 0,
          cashbackRule: null,
        };
      }

      // Calculate cashback for each rule
      const calculatedRules = eligibleRules.map((rule) => {
        let amount = 0;
        
        if (rule.cashbackType === "fixed") {
          amount = rule.cashbackValue;
        } else if (rule.cashbackType === "percentage") {
          // Calculate percentage of final price
          amount = (args.finalPrice * rule.cashbackValue) / 100;
        }

        return {
          rule,
          amount: Math.round(amount), // Round to nearest rupee
        };
      });

      // Find the highest cashback amount (as per priority logic)
      const bestCashback = calculatedRules.reduce((best, current) => {
        return current.amount > best.amount ? current : best;
      });

      return {
        hasCashback: true,
        cashbackAmount: bestCashback.amount,
        cashbackRule: bestCashback.rule,
      };
    } catch (error) {
      // Return no cashback if there's any error
      console.error("Error calculating item cashback:", error);
      return {
        hasCashback: false,
        cashbackAmount: 0,
        cashbackRule: null,
      };
    }
  },
});

// Calculate total cashback for all items in a cart/order
export const calculateCartCashback = query({
  args: {
    items: v.array(
      v.object({
        productId: v.id("products"),
        variantId: v.id("variants"),
        finalPrice: v.number(), // Final unit price after discounts
        quantity: v.number(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{
    totalCashback: number;
    itemCashbacks: Array<{
      productId: Id<"products">;
      variantId: Id<"variants">;
      cashbackPerUnit: number;
      totalCashback: number;
      quantity: number;
    }>;
  }> => {
    // Calculate total cart value first
    const cartTotal = args.items.reduce(
      (sum, item) => sum + item.finalPrice * item.quantity,
      0
    );

    let totalCashback = 0;
    const itemCashbacks: Array<{
      productId: Id<"products">;
      variantId: Id<"variants">;
      cashbackPerUnit: number;
      totalCashback: number;
      quantity: number;
    }> = [];

    // Calculate cashback for each item
    for (const item of args.items) {
      try {
        const cashbackResult = await ctx.runQuery(api.cashbackHelpers.calculateItemCashback, {
          productId: item.productId,
          variantId: item.variantId,
          finalPrice: item.finalPrice,
          cartTotal, // Pass cart total for cart-value filters
        });

        if (cashbackResult.hasCashback) {
          const itemTotalCashback = cashbackResult.cashbackAmount * item.quantity;
          totalCashback += itemTotalCashback;

          itemCashbacks.push({
            productId: item.productId,
            variantId: item.variantId,
            cashbackPerUnit: cashbackResult.cashbackAmount,
            totalCashback: itemTotalCashback,
            quantity: item.quantity,
          });
        }
      } catch (error) {
        // Skip this item if cashback calculation fails
        console.error("Failed to calculate cashback for item:", item.productId, error);
        continue;
      }
    }

    return {
      totalCashback: Math.round(totalCashback),
      itemCashbacks,
    };
  },
});

// Get cashback display info for a product page (before user selects variant)
export const getProductCashbackInfo = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // Get the product to access its variants
    const product = await ctx.db.get(args.productId);
    if (!product) {
      return {
        hasCashback: false,
        displayText: null,
      };
    }

    // Get all variants for this product
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    if (variants.length === 0) {
      return {
        hasCashback: false,
        displayText: null,
      };
    }

    // Get all active cashback rules
    const allActiveRules = await ctx.db
      .query("cashbackRules")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Check for product-level rules first
    const productRules = allActiveRules.filter(
      (rule) => rule.targetType === "product" && rule.targetId === args.productId
    );

    if (productRules.length > 0) {
      // Product-level rule exists, use it
      const bestProductRule = productRules.reduce((best, current) => {
        // For display, compare raw values (for fixed) or percentages
        const currentValue = current.cashbackType === "percentage" 
          ? current.cashbackValue 
          : current.cashbackValue;
        const bestValue = best.cashbackType === "percentage" 
          ? best.cashbackValue 
          : best.cashbackValue;
        
        return currentValue > bestValue ? current : best;
      });

      return {
        hasCashback: true,
        cashbackType: bestProductRule.cashbackType,
        cashbackValue: bestProductRule.cashbackValue,
        displayText: bestProductRule.cashbackType === "fixed"
          ? `₹${bestProductRule.cashbackValue}`
          : `${bestProductRule.cashbackValue}%`,
      };
    }

    // Check for variant-level rules
    const variantIds = variants.map((v) => v._id);
    const variantRules = allActiveRules.filter(
      (rule) => rule.targetType === "variant" && variantIds.includes(rule.targetId as Id<"variants">)
    );

    // Check for collection-level rules
    const collectionProducts = await ctx.db
      .query("collectionProducts")
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .collect();

    const collectionIds = collectionProducts.map((cp) => cp.collectionId);
    
    const collectionRules = allActiveRules.filter(
      (rule) => 
        rule.targetType === "collection" && 
        collectionIds.includes(rule.targetId as Id<"collections">)
    );

    const applicableRules = [...variantRules, ...collectionRules];

    if (applicableRules.length === 0) {
      return {
        hasCashback: false,
        displayText: null,
      };
    }

    // Find the highest cashback rule
    const bestRule = applicableRules.reduce((best, current) => {
      const currentValue = current.cashbackType === "percentage" 
        ? current.cashbackValue 
        : current.cashbackValue;
      const bestValue = best.cashbackType === "percentage" 
        ? best.cashbackValue 
        : best.cashbackValue;
      
      return currentValue > bestValue ? current : best;
    });

    return {
      hasCashback: true,
      cashbackType: bestRule.cashbackType,
      cashbackValue: bestRule.cashbackValue,
      displayText: bestRule.cashbackType === "fixed"
        ? `up to ₹${bestRule.cashbackValue}`
        : `up to ${bestRule.cashbackValue}%`,
    };
  },
});
