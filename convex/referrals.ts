import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { ConvexError } from "convex/values";

// Generate a random 8-character alphanumeric code
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get user's referral stats
export const getReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", user._id))
      .collect();

    const rewards = await ctx.db
      .query("referralRewards")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const totalEarned = rewards.reduce((sum, r) => sum + r.amount, 0);
    const successfulReferrals = referrals.filter((r) => r.status === "completed" || r.status === "rewarded").length;

    return {
      referralCode: user.referralCode,
      totalReferrals: referrals.length,
      successfulReferrals,
      totalEarned,
      referralHistory: referrals, // TODO: Enhance with referee names if privacy allows
      rewardHistory: rewards,
    };
  },
});

// Validate a referral code
export const validateReferralCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", args.code))
      .unique();

    return {
      isValid: !!referrer,
      referrerName: referrer?.name,
    };
  },
});

// Internal: Create a unique referral code for a user
export const generateUniqueReferralCode = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    let code = generateCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
        .unique();
      
      if (!existing) {
        isUnique = true;
      } else {
        code = generateCode();
        attempts++;
      }
    }

    if (!isUnique) throw new Error("Failed to generate unique referral code");

    await ctx.db.patch(args.userId, { referralCode: code });
    return code;
  },
});

// Internal: Process a referral when a new user signs up
export const processSignupReferral = internalMutation({
  args: {
    newUserId: v.id("users"),
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find referrer
    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", args.referralCode))
      .unique();

    if (!referrer) return; // Invalid code, ignore
    if (referrer._id === args.newUserId) return; // Self-referral prevention

    // 2. Link users
    await ctx.db.patch(args.newUserId, { referredBy: referrer._id });

    // 3. Create referral record
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      refereeId: args.newUserId,
      status: "pending",
      createdAt: Date.now(),
    });

    // 4. Give "Signup Reward" to Referee (User B)
    // Generate a unique 1-time use coupon
    const couponCode = `WELCOME-${generateCode()}`;
    
    await ctx.db.insert("coupons", {
      code: couponCode,
      description: "Referral Welcome Bonus",
      discountType: "fixed",
      discountValue: 100, // Configurable in future
      startDate: Date.now(),
      endDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days validity
      isActive: true,
      usageLimit: 1,
      usageCount: 0,
      minPurchase: 499, // Minimum purchase requirement
      allowedCustomerEmails: [referrer.email || ""], // Actually this should be the NEW user's email, but we might not have it yet if just ID.
      // Better to restrict by userId if possible, but schema uses emails. 
      // For now, let's leave email restriction open or fetch new user.
    });
    
    // We need the new user's email to restrict the coupon
    const newUser = await ctx.db.get(args.newUserId);
    if (newUser?.email) {
      await ctx.db.patch(
        (await ctx.db.query("coupons").withIndex("by_code", q => q.eq("code", couponCode)).unique())!._id, 
        { allowedCustomerEmails: [newUser.email] }
      );
    }

    // Log the reward
    await ctx.db.insert("referralRewards", {
      userId: args.newUserId,
      referralId: (await ctx.db.query("referrals").withIndex("by_referee", q => q.eq("refereeId", args.newUserId)).unique())!._id,
      type: "referee_bonus",
      rewardType: "coupon",
      amount: 100,
      couponId: (await ctx.db.query("coupons").withIndex("by_code", q => q.eq("code", couponCode)).unique())!._id,
      status: "processed",
      createdAt: Date.now(),
      processedAt: Date.now(),
    });
  },
});

// Internal: Process rewards when an order is delivered
export const processOrderCompletion = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Check if user was referred
    const user = await ctx.db.get(args.userId);
    if (!user || !user.referredBy) return;

    // 2. Check if this is their FIRST successful order
    // We count "delivered" orders. If this is the only one (or first one being marked delivered), trigger reward.
    const completedOrders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "delivered"))
      .collect();

    // If more than 1 delivered order, reward already given (or not eligible)
    if (completedOrders.length > 1) return;

    // 3. Find the referral record
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referee", (q) => q.eq("refereeId", user._id))
      .unique();

    if (!referral || referral.status !== "pending") return;

    // 4. Fetch Reward Settings (Defaults for now)
    const settings = await ctx.db.query("walletSettings").first();
    const rewardAmount = settings?.referralRewardAmount || 100; // Default ₹100

    // 5. Update Referral Status
    await ctx.db.patch(referral._id, {
      status: "completed",
      completedAt: Date.now(),
    });

    // 6. Credit Referrer (User A)
    await ctx.db.patch(referral._id, { status: "rewarded" });
    
    // Add to wallet
    const referrer = await ctx.db.get(user.referredBy);
    if (referrer) {
      const currentBalance = referrer.walletBalance || 0;
      await ctx.db.patch(referrer._id, {
        walletBalance: currentBalance + rewardAmount,
      });

      // Log transaction
      await ctx.db.insert("walletTransactions", {
        userId: referrer._id,
        transactionType: "credit",
        amount: rewardAmount,
        source: "referral_reward",
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + rewardAmount,
        description: `Referral Bonus for ${user.name || "friend"}'s first order`,
        createdAt: Date.now(),
      });

      // Log Reward
      await ctx.db.insert("referralRewards", {
        userId: referrer._id,
        referralId: referral._id,
        type: "referrer_bonus",
        rewardType: "wallet_credit",
        amount: rewardAmount,
        status: "processed",
        createdAt: Date.now(),
        processedAt: Date.now(),
      });
    }
  },
});

// Admin: Get all referrals with details
export const getAdminReferrals = query({
  args: {},
  handler: async (ctx) => {
    // Check admin
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!user || !user.isAdmin) throw new ConvexError("Unauthorized");

    const referrals = await ctx.db.query("referrals").order("desc").take(100);
    
    // Enrich with user details
    const enriched = await Promise.all(referrals.map(async (r) => {
      const referrer = await ctx.db.get(r.referrerId);
      const referee = await ctx.db.get(r.refereeId);
      return {
        ...r,
        referrerName: referrer?.name || "Unknown",
        referrerEmail: referrer?.email || "",
        refereeName: referee?.name || "Unknown",
        refereeEmail: referee?.email || "",
      };
    }));

    return enriched;
  },
});

