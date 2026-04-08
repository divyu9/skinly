import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get all cart items for the current user
export const getCart = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return cartItems;
  },
});

// Get cart count for the current user
export const getCartCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return 0;
    }

    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  },
});

// Add item to cart
export const addToCart = mutation({
  args: {
    productId: v.string(),
    productTitle: v.string(),
    productImage: v.optional(v.string()),
    variant: v.string(),
    price: v.number(),
    quantity: v.number(),
    phoneModel: v.optional(v.string()),
    phoneBrand: v.optional(v.string()),
    coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Verify product and variant exist, and get the authoritative price from DB
    const product = await ctx.db.get(args.productId as any);
    if (!product) {
      throw new ConvexError({
        message: "Product not found",
        code: "NOT_FOUND",
      });
    }

    const variantData = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", args.productId as any))
      .filter((q) => q.eq(q.field("title"), args.variant))
      .first();

    if (!variantData) {
      throw new ConvexError({
        message: "Variant not found",
        code: "NOT_FOUND",
      });
    }

    // Use DB price to prevent client-side price tampering
    const authoritativePrice = variantData.price;

    // Check if item already exists in cart
    const existingItem = await ctx.db
      .query("cart")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId).eq("variant", args.variant)
      )
      .unique();

    if (existingItem) {
      // Update quantity if item exists
      await ctx.db.patch(existingItem._id, {
        quantity: existingItem.quantity + args.quantity,
        coverage: args.coverage,
        price: authoritativePrice, // Update to latest price
      });
      return existingItem._id;
    } else {
      // Add new item
      const cartId = await ctx.db.insert("cart", {
        userId: user._id,
        productId: args.productId,
        productTitle: args.productTitle,
        productImage: args.productImage,
        variant: args.variant,
        price: authoritativePrice, // Use authoritative price
        quantity: args.quantity,
        phoneModel: args.phoneModel,
        phoneBrand: args.phoneBrand,
        coverage: args.coverage,
      });
      return cartId;
    }
  },
});

// Update cart item quantity
export const updateQuantity = mutation({
  args: {
    cartId: v.id("cart"),
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

    if (args.quantity < 1) {
      throw new ConvexError({
        message: "Quantity must be at least 1",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.patch(args.cartId, { quantity: args.quantity });
  },
});

// Remove item from cart
export const removeFromCart = mutation({
  args: {
    cartId: v.id("cart"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.cartId);
  },
});

// Clear entire cart
export const clearCart = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }
  },
});

// Sync guest cart to user cart when signing in
export const syncGuestCart = mutation({
  args: {
    guestCartItems: v.array(
      v.object({
        productId: v.string(),
        productTitle: v.string(),
        productImage: v.optional(v.string()),
        variant: v.string(),
        price: v.number(),
        quantity: v.number(),
        phoneModel: v.optional(v.string()),
        phoneBrand: v.optional(v.string()),
        coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Add each guest cart item to user's cart
    for (const item of args.guestCartItems) {
      // Re-verify price from DB to prevent tampering
      let authoritativePrice = item.price;
      const variantData = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", item.productId as any))
        .filter((q) => q.eq(q.field("title"), item.variant))
        .first();
        
      if (variantData) {
        authoritativePrice = variantData.price;
      }

      // Check if item already exists in cart
      const existingItem = await ctx.db
        .query("cart")
        .withIndex("by_user_and_product", (q) =>
          q.eq("userId", user._id).eq("productId", item.productId).eq("variant", item.variant)
        )
        .unique();

      if (existingItem) {
        // Update quantity if item exists
        await ctx.db.patch(existingItem._id, {
          quantity: existingItem.quantity + item.quantity,
          coverage: item.coverage,
          price: authoritativePrice, // Update to authoritative price
        });
      } else {
        // Add new item
        await ctx.db.insert("cart", {
          userId: user._id,
          productId: item.productId,
          productTitle: item.productTitle,
          productImage: item.productImage,
          variant: item.variant,
          price: authoritativePrice, // Use authoritative price
          quantity: item.quantity,
          phoneModel: item.phoneModel,
          phoneBrand: item.phoneBrand,
          coverage: item.coverage,
        });
      }
    }
  },
});

// Sync guest cart items to database cart (for checkout)
export const syncGuestCartToDb = mutation({
  args: {
    sessionId: v.string(),
    guestCartItems: v.array(
      v.object({
        productId: v.string(),
        productTitle: v.string(),
        productImage: v.optional(v.string()),
        variant: v.string(),
        price: v.number(),
        quantity: v.number(),
        phoneModel: v.optional(v.string()),
        phoneBrand: v.optional(v.string()),
        coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Clear existing guest cart for this session
    const existingItems = await ctx.db
      .query("cart")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    for (const item of existingItems) {
      await ctx.db.delete(item._id);
    }

    // Add guest cart items to database
    for (const item of args.guestCartItems) {
      // Re-verify price from DB to prevent tampering
      let authoritativePrice = item.price;
      const variantData = await ctx.db
        .query("variants")
        .withIndex("by_product", (q) => q.eq("productId", item.productId as any))
        .filter((q) => q.eq(q.field("title"), item.variant))
        .first();
        
      if (variantData) {
        authoritativePrice = variantData.price;
      }

      await ctx.db.insert("cart", {
        sessionId: args.sessionId,
        productId: item.productId,
        productTitle: item.productTitle,
        productImage: item.productImage,
        variant: item.variant,
        price: authoritativePrice, // Use authoritative price
        quantity: item.quantity,
        phoneModel: item.phoneModel,
        phoneBrand: item.phoneBrand,
        coverage: item.coverage,
      });
    }
  },
});

// Get cart items for a specific user (for admin / abandoned cart tracking)
export const getCartForUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const cartItems = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return cartItems;
  },
});

// Check stock status for cart items
export const checkCartItemsStock = query({
  args: {
    cartItems: v.array(
      v.object({
        productId: v.string(),
        variant: v.string(),
        quantity: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const stockStatus = await Promise.all(
      args.cartItems.map(async (cartItem) => {
        try {
          // Cast string to proper ID type
          const productId = cartItem.productId as Id<"products">;

          // Get product to find variant
          const product = await ctx.db.get(productId);
          if (!product) {
            return {
              productId: cartItem.productId,
              variant: cartItem.variant,
              isOutOfStock: true,
              availableQuantity: 0,
            };
          }

          // Find variant by matching productId and variant title
          const variant = await ctx.db
            .query("variants")
            .withIndex("by_product", (q) => q.eq("productId", productId))
            .filter((q) => q.eq(q.field("title"), cartItem.variant))
            .first();

          if (!variant) {
            return {
              productId: cartItem.productId,
              variant: cartItem.variant,
              isOutOfStock: true,
              availableQuantity: 0,
            };
          }

          const availableQuantity = variant.inventoryQuantity || 0;
          const isOutOfStock = availableQuantity <= 0 || availableQuantity < cartItem.quantity;

          return {
            productId: cartItem.productId,
            variant: cartItem.variant,
            isOutOfStock,
            availableQuantity,
            requestedQuantity: cartItem.quantity,
          };
        } catch (error) {
          console.error(`Error checking stock for product ${cartItem.productId}:`, error);
          // Return safe default on error
          return {
            productId: cartItem.productId,
            variant: cartItem.variant,
            isOutOfStock: false, // Don't block checkout on error
            availableQuantity: 999,
          };
        }
      })
    );

    return stockStatus;
  },
});
