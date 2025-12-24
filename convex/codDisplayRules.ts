import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Update display settings
export const updateDisplaySettings = mutation({
  args: {
    hideWhenIneligible: v.boolean(),
    displayRules: v.array(
      v.object({
        ruleType: v.union(
          v.literal("cart_min_value"),
          v.literal("cart_max_value"),
          v.literal("product_count_min"),
          v.literal("product_count_max"),
          v.literal("contains_category"),
          v.literal("excludes_category"),
          v.literal("user_verified"),
          v.literal("first_time_buyer")
        ),
        value: v.union(v.string(), v.number()),
        enabled: v.boolean(),
      })
    ),
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
      await ctx.db.patch(existing._id, {
        hideWhenIneligible: args.hideWhenIneligible,
        displayRules: args.displayRules,
      });
      return existing._id;
    } else {
      throw new ConvexError({
        message: "COD settings not initialized",
        code: "NOT_FOUND",
      });
    }
  },
});

// Evaluate display rules to determine if COD should be shown
export const shouldShowCod = query({
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
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("codSettings").first();

    // If no settings or COD disabled, check hideWhenIneligible
    if (!settings || !settings.enabled) {
      const hideWhenIneligible = settings?.hideWhenIneligible ?? false;
      return {
        shouldShow: !hideWhenIneligible,
        reason: hideWhenIneligible ? "COD is disabled" : "",
        isEligible: false,
      };
    }

    // Basic eligibility check
    let isEligible = true;
    let eligibilityReason = "";

    // Min order amount condition
    if (settings.minOrderAmountEnabled && args.totalAmount < settings.minOrderAmount) {
      isEligible = false;
      eligibilityReason = `Minimum order amount ₹${settings.minOrderAmount} required for COD`;
    }

    // Max order amount condition
    if (settings.maxOrderAmountEnabled && args.totalAmount > settings.maxOrderAmount) {
      isEligible = false;
      eligibilityReason = `Maximum order amount ₹${settings.maxOrderAmount} exceeded for COD`;
    }

    // Product count
    const totalProductCount = args.cartItems.reduce((sum, item) => sum + item.quantity, 0);

    // Min product count condition
    if (settings.minProductCountEnabled && totalProductCount < settings.minProductCount) {
      isEligible = false;
      eligibilityReason = `Minimum ${settings.minProductCount} items required for COD`;
    }

    // Max product count condition
    if (settings.maxProductCountEnabled && totalProductCount > settings.maxProductCount) {
      isEligible = false;
      eligibilityReason = `Maximum ${settings.maxProductCount} items allowed for COD`;
    }

    // If ineligible and hideWhenIneligible is true, hide COD
    if (!isEligible && settings.hideWhenIneligible) {
      return {
        shouldShow: false,
        reason: eligibilityReason,
        isEligible: false,
      };
    }

    // If no display rules or all disabled, show based on eligibility (or showCodOnPaymentPage setting)
    const activeRules = settings.displayRules?.filter((rule) => rule.enabled) || [];

    if (activeRules.length === 0) {
      return {
        shouldShow: isEligible || (settings.showCodOnPaymentPage ?? true),
        reason: !isEligible ? eligibilityReason : "",
        isEligible,
      };
    }

    // Get products for category checks
    const productIds = [...new Set(args.cartItems.map((item) => item.productId))];
    const products = await Promise.all(
      productIds.map(async (pid) => {
        const product = await ctx.db.get(pid as Id<"products">);
        return product;
      })
    );
    const productMap = new Map(
      products.filter((p) => p !== null).map((p) => [p!._id, p!])
    );

    // Check user order history for user_verified and first_time_buyer rules
    let userOrders = 0;
    if (
      args.userId &&
      activeRules.some(
        (r) => r.ruleType === "user_verified" || r.ruleType === "first_time_buyer"
      )
    ) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .filter((q) => q.eq(q.field("status"), "delivered"))
        .collect();
      userOrders = orders.length;
    }

    // Evaluate each rule - if ANY rule fails, hide COD
    for (const rule of activeRules) {
      let ruleFailed = false;
      let failReason = "";

      switch (rule.ruleType) {
        case "cart_min_value":
          if (args.totalAmount < Number(rule.value)) {
            ruleFailed = true;
            failReason = `Cart value must be at least ₹${rule.value} for COD`;
          }
          break;

        case "cart_max_value":
          if (args.totalAmount > Number(rule.value)) {
            ruleFailed = true;
            failReason = `Cart value must not exceed ₹${rule.value} for COD`;
          }
          break;

        case "product_count_min": {
          const totalCount = args.cartItems.reduce((sum, item) => sum + item.quantity, 0);
          if (totalCount < Number(rule.value)) {
            ruleFailed = true;
            failReason = `At least ${rule.value} items required for COD`;
          }
          break;
        }

        case "product_count_max": {
          const totalCount = args.cartItems.reduce((sum, item) => sum + item.quantity, 0);
          if (totalCount > Number(rule.value)) {
            ruleFailed = true;
            failReason = `Maximum ${rule.value} items allowed for COD`;
          }
          break;
        }

        case "contains_category": {
          const hasCategory = args.cartItems.some((item) => {
            const product = productMap.get(item.productId as Id<"products">);
            return product?.gadgetCategory === rule.value;
          });
          if (hasCategory) {
            ruleFailed = true;
            failReason = `COD not available for ${rule.value} products`;
          }
          break;
        }

        case "excludes_category": {
          const hasCategory = args.cartItems.some((item) => {
            const product = productMap.get(item.productId as Id<"products">);
            return product?.gadgetCategory === rule.value;
          });
          if (!hasCategory) {
            ruleFailed = true;
            failReason = `COD only available for ${rule.value} products`;
          }
          break;
        }

        case "user_verified":
          if (!args.userId || userOrders === 0) {
            ruleFailed = true;
            failReason = "COD only available for verified users with completed orders";
          }
          break;

        case "first_time_buyer":
          if (userOrders > 0) {
            ruleFailed = true;
            failReason = "COD only available for first-time buyers";
          }
          break;
      }

      // If any rule fails, hide COD
      if (ruleFailed) {
        return {
          shouldShow: false,
          reason: failReason,
          isEligible: false,
        };
      }
    }

    // All rules passed, show COD based on eligibility
    return {
      shouldShow: isEligible || (settings.showCodOnPaymentPage ?? true),
      reason: !isEligible ? eligibilityReason : "",
      isEligible,
    };
  },
});
