import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

/**
 * Get current user's WhatsApp consent status
 */
export const getMyConsent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        consentType: "none" as const,
        hasConsent: false,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return {
        consentType: "none" as const,
        hasConsent: false,
      };
    }

    // Get most recent verified phone number from loginOtps
    const verifiedOtp = await ctx.db
      .query("loginOtps")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", user.email || ""))
      .filter((q) =>
        q.and(
          q.eq(q.field("verified"), true),
          q.eq(q.field("userId"), user._id)
        )
      )
      .order("desc")
      .first();

    let phoneNumber = "";
    if (verifiedOtp) {
      phoneNumber = verifiedOtp.phoneNumber;
    }

    // If no verified phone, check if there's a consent record by user ID
    const consentByUser = await ctx.db
      .query("whatsappConsent")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (consentByUser) {
      return {
        consentType: consentByUser.consentType,
        hasConsent: consentByUser.consentType !== "none",
        phoneNumber: consentByUser.phoneNumber,
        consentedAt: consentByUser.consentedAt,
      };
    }

    // If we have a verified phone, check by phone number
    if (phoneNumber) {
      const consentByPhone = await ctx.db
        .query("whatsappConsent")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
        .first();

      if (consentByPhone) {
        return {
          consentType: consentByPhone.consentType,
          hasConsent: consentByPhone.consentType !== "none",
          phoneNumber: consentByPhone.phoneNumber,
          consentedAt: consentByPhone.consentedAt,
        };
      }
    }

    // No consent record found - default to transactional only
    return {
      consentType: "transactional_only" as const,
      hasConsent: true,
      phoneNumber,
    };
  },
});

/**
 * Update current user's WhatsApp consent
 */
export const updateMyConsent = mutation({
  args: {
    consentType: v.union(
      v.literal("all"),
      v.literal("transactional_only"),
      v.literal("none")
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

    // Get verified phone number
    const verifiedOtp = await ctx.db
      .query("loginOtps")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", user.email || ""))
      .filter((q) =>
        q.and(
          q.eq(q.field("verified"), true),
          q.eq(q.field("userId"), user._id)
        )
      )
      .order("desc")
      .first();

    if (!verifiedOtp) {
      throw new ConvexError({
        message: "Please verify your phone number first",
        code: "BAD_REQUEST",
      });
    }

    const phoneNumber = verifiedOtp.phoneNumber;

    // Check if consent record exists
    const existingConsent = await ctx.db
      .query("whatsappConsent")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .first();

    if (existingConsent) {
      // Update existing consent
      await ctx.db.patch(existingConsent._id, {
        consentType: args.consentType,
        consentedAt: Date.now(),
        userId: user._id, // Update user ID if not set
      });
    } else {
      // Create new consent record
      await ctx.db.insert("whatsappConsent", {
        userId: user._id,
        phoneNumber,
        consentType: args.consentType,
        consentedAt: Date.now(),
      });
    }

    return {
      success: true,
      consentType: args.consentType,
    };
  },
});

/**
 * Get consent status for a specific phone number (admin)
 */
export const getConsentByPhone = query({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const cleanedPhone = args.phoneNumber.replace(/[\s+\-()]/g, "");

    const consent = await ctx.db
      .query("whatsappConsent")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", cleanedPhone))
      .first();

    if (!consent) {
      return {
        phoneNumber: cleanedPhone,
        consentType: "transactional_only" as const,
        hasConsent: true,
        consentedAt: null,
      };
    }

    return {
      phoneNumber: consent.phoneNumber,
      consentType: consent.consentType,
      hasConsent: consent.consentType !== "none",
      consentedAt: consent.consentedAt,
      userId: consent.userId,
    };
  },
});

/**
 * Get all consent records (admin)
 */
export const getAllConsents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const limit = args.limit ?? 100;
    const consents = await ctx.db
      .query("whatsappConsent")
      .order("desc")
      .take(limit);

    // Enrich with user data
    const enrichedConsents = await Promise.all(
      consents.map(async (consent) => {
        let userName = "Unknown";
        let userEmail = "";

        if (consent.userId) {
          const user = await ctx.db.get(consent.userId);
          userName = user?.name || "Unknown";
          userEmail = user?.email || "";
        }

        return {
          ...consent,
          userName,
          userEmail,
          consentedAtFormatted: new Date(consent.consentedAt).toLocaleString("en-IN", {
            dateStyle: "short",
            timeStyle: "short",
          }),
        };
      })
    );

    return enrichedConsents;
  },
});

/**
 * Update consent for a user by phone number (admin)
 */
export const updateConsentByPhone = mutation({
  args: {
    phoneNumber: v.string(),
    consentType: v.union(
      v.literal("all"),
      v.literal("transactional_only"),
      v.literal("none")
    ),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const cleanedPhone = args.phoneNumber.replace(/[\s+\-()]/g, "");

    // Check if consent record exists
    const existingConsent = await ctx.db
      .query("whatsappConsent")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", cleanedPhone))
      .first();

    if (existingConsent) {
      // Update existing consent
      await ctx.db.patch(existingConsent._id, {
        consentType: args.consentType,
        consentedAt: Date.now(),
      });
    } else {
      // Create new consent record
      await ctx.db.insert("whatsappConsent", {
        phoneNumber: cleanedPhone,
        consentType: args.consentType,
        consentedAt: Date.now(),
      });
    }

    return {
      success: true,
      consentType: args.consentType,
    };
  },
});
