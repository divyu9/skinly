import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // 1. Check if user exists with current tokenIdentifier (already migrated)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    
    if (existingUser !== null) {
      await ctx.db.patch(existingUser._id, {
        name: identity.name ?? existingUser.name,
        email: identity.email ?? existingUser.email,
      });
      return existingUser._id;
    }

    // 2. Check if user exists with same email (Hercules migrating to Clerk)
    if (identity.email) {
      const userByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
      
      if (userByEmail !== null) {
        await ctx.db.patch(userByEmail._id, {
          tokenIdentifier: identity.tokenIdentifier,
          name: identity.name ?? userByEmail.name,
        });
        return userByEmail._id;
      }
    }

    // 3. New user - create fresh record
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    
    // First try by tokenIdentifier
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    
    // If not found, try by email (for users being migrated)
    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
    }
    
    return user;
  },
});

/**
 * Get profile data for the current user (for My Account panel)
 */
export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // First try by tokenIdentifier
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    // If not found, try by email (for users being migrated)
    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
    }

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Get wallet balance
    const walletBalance = user.walletBalance || 0;

    // Calculate total cashback earned
    const walletTransactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("source"), "cashback"))
      .collect();

    const totalCashbackEarned = walletTransactions.reduce(
      (sum, txn) => sum + txn.amount,
      0
    );

    // Get phone number from most recent order
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
 * Update user profile (only name is editable)
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

    // First try by tokenIdentifier
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    // If not found, try by email (for users being migrated)
    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
    }

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Validate name
    if (!args.name || args.name.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Name cannot be empty",
      });
    }

    if (args.name.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Name is too long",
      });
    }

    await ctx.db.patch(user._id, {
      name: args.name.trim(),
    });

    return { success: true };
  },
});

/**
 * Check if the current user is an admin
 */
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isAuthenticated: false, isAdmin: false };
    }

    // 1️⃣ Try by tokenIdentifier (existing logic)
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    // 2️⃣ Fallback: try by Clerk subject (STABLE ID) ✅
    if (!user && identity.subject) {
      user = await ctx.db
        .query("users")
        .filter((q) =>
          q.eq(q.field("clerkId"), identity.subject)
        )
        .first();
    }

    // 3️⃣ Fallback: try by email (migration logic)
    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
    }

    if (!user) {
      return { isAuthenticated: true, isAdmin: false };
    }

    return {
      isAuthenticated: true,
      isAdmin: user.isAdmin === true,
    };
  },
});


/**
 * Get all users (for admin / abandoned cart tracking)
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all users with email
    const users = await ctx.db.query("users").collect();
    return users.map(user => ({
      _id: user._id,
      email: user.email,
      name: user.name,
    }));
  },
});
