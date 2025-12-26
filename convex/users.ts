import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Shared helper: get user by identity
 */
async function getUserByIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .unique();
}

/**
 * Create or update current user (only when logged in)
 */
export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("UNAUTHENTICATED");
    }

    const existing = await getUserByIdentity(ctx);
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

/**
 * Get current user (guest-safe)
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getUserByIdentity(ctx);
  },
});

/**
 * My Account / Profile data (guest-safe)
 */
export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserByIdentity(ctx);
    if (!user) return null;

    const walletBalance = user.walletBalance ?? 0;

    const cashbackTxns = await ctx.db
      .query("walletTransactions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .filter((q: any) => q.eq(q.field("source"), "cashback"))
      .collect();

    const totalCashbackEarned = cashbackTxns.reduce(
      (sum: number, t: any) => sum + t.amount,
      0
    );

    const recentOrder = await ctx.db
      .query("orders")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .first();

    return {
      name: user.name ?? "",
      email: user.email ?? "",
      phone: recentOrder?.shippingAddress?.phone ?? "",
      walletBalance,
      totalCashbackEarned,
    };
  },
});

/**
 * Update profile (name only)
 */
export const updateProfile = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByIdentity(ctx);
    if (!user) {
      throw new ConvexError("UNAUTHENTICATED");
    }

    if (!args.name.trim()) {
      throw new ConvexError("INVALID_NAME");
    }

    await ctx.db.patch(user._id, {
      name: args.name.trim(),
    });

    return { success: true };
  },
});

/**
 * Admin check (guest-safe)
 */
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserByIdentity(ctx);
    return {
      isAuthenticated: !!user,
      isAdmin: user?.isAdmin === true,
    };
  },
});
