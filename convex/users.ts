import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * =========================
 * MUTATIONS (AUTH REQUIRED)
 * =========================
 */

/**
 * Create or update the current user after login
 */
export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      name: identity.name || "",
      email: identity.email || "",
      tokenIdentifier: identity.tokenIdentifier,
      isAdmin: false,
      walletBalance: 0,
    });
  },
});

/**
 * Update user profile (name only)
 */
export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Name cannot be empty",
      });
    }

    if (name.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Name is too long",
      });
    }

    await ctx.db.patch(user._id, { name });

    return { success: true };
  },
});

/**
 * =========================
 * QUERIES (GUEST SAFE)
 * =========================
 */

/**
 * Primary current user query
 * (frontend-safe, guest-safe)
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});

/**
 * Alias for newer code paths
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await currentUser.handler(ctx);
  },
});

/**
 * Profile data for My Account page
 */
export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return null;
    }

    const walletBalance = user.walletBalance || 0;

    const walletTransactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("source"), "cashback"))
      .collect();

    const totalCashbackEarned = walletTransactions.reduce(
      (sum, txn) => sum + (txn.amount || 0),
      0
    );

    const recentOrder = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    return {
      name: user.name || "",
      email: user.email || "",
      phone: recentOrder?.shippingAddress?.phone || "",
      walletBalance,
      totalCashbackEarned,
    };
  },
});

/**
 * Check admin status
 */
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isAuthenticated: false, isAdmin: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    return {
      isAuthenticated: true,
      isAdmin: user?.isAdmin === true,
    };
  },
});
