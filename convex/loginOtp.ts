import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";

/**
 * Generate a 6-digit OTP for phone verification (login/account verification)
 */
export const generateLoginOtp = mutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const phone = args.phoneNumber.trim();

    if (!phone) {
      throw new ConvexError({
        message: "Phone number is required",
        code: "BAD_REQUEST",
      });
    }

    // Check for recent unverified OTP (prevent spam)
    const recentOtp = await ctx.db
      .query("loginOtps")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .filter((q) => q.eq(q.field("verified"), false))
      .order("desc")
      .first();

    if (recentOtp) {
      const now = Date.now();
      const timeSinceCreation = now - recentOtp.createdAt;
      
      // Don't allow new OTP within 60 seconds of last one
      if (timeSinceCreation < 60000) {
        throw new ConvexError({
          message: "Please wait before requesting a new OTP",
          code: "BAD_REQUEST",
        });
      }

      // If OTP is not expired, resend it
      if (now < recentOtp.expiresAt) {
        // Queue WhatsApp message with existing OTP
        try {
          await ctx.scheduler.runAfter(
            0,
            api.whatsappMessaging.queueMessage,
            {
              usecaseKey: "otp_login",
              recipientPhone: phone,
              variables: {
                otp: recentOtp.otp,
              },
              priority: 10, // Highest priority for OTPs
            }
          );
        } catch (error) {
          console.error("Failed to queue Login OTP WhatsApp:", error);
          throw new ConvexError({
            message: "Failed to send OTP. Please try again.",
            code: "EXTERNAL_SERVICE_ERROR",
          });
        }

        return {
          success: true,
          expiresAt: recentOtp.expiresAt,
          message: "OTP resent successfully",
        };
      }
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create OTP record
    const otpId = await ctx.db.insert("loginOtps", {
      phoneNumber: phone,
      otp,
      verified: false,
      attempts: 0,
      expiresAt,
      createdAt: Date.now(),
    });

    // Queue WhatsApp message
    try {
      await ctx.scheduler.runAfter(
        0,
        api.whatsappMessaging.queueMessage,
        {
          usecaseKey: "otp_login",
          recipientPhone: phone,
          variables: {
            otp,
          },
          priority: 10, // Highest priority for OTPs
        }
      );
    } catch (error) {
      console.error("Failed to queue Login OTP WhatsApp:", error);
      // Delete the OTP record if WhatsApp fails
      await ctx.db.delete(otpId);
      throw new ConvexError({
        message: "Failed to send OTP. Please try again.",
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }

    return {
      success: true,
      expiresAt,
      message: "OTP sent successfully",
    };
  },
});

/**
 * Verify Login OTP and update user's phone number
 */
export const verifyLoginOtp = mutation({
  args: {
    phoneNumber: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const phone = args.phoneNumber.trim();
    const otpInput = args.otp.trim();

    if (!phone || !otpInput) {
      throw new ConvexError({
        message: "Phone number and OTP are required",
        code: "BAD_REQUEST",
      });
    }

    // Find the most recent unverified OTP for this phone
    const otpRecord = await ctx.db
      .query("loginOtps")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phone))
      .filter((q) => q.eq(q.field("verified"), false))
      .order("desc")
      .first();

    if (!otpRecord) {
      throw new ConvexError({
        message: "No OTP found. Please request a new one.",
        code: "NOT_FOUND",
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      throw new ConvexError({
        message: "OTP has expired. Please request a new one.",
        code: "BAD_REQUEST",
      });
    }

    // Check max attempts
    if (otpRecord.attempts >= 3) {
      throw new ConvexError({
        message: "Maximum verification attempts exceeded. Please request a new OTP.",
        code: "BAD_REQUEST",
      });
    }

    // Increment attempts
    await ctx.db.patch(otpRecord._id, {
      attempts: otpRecord.attempts + 1,
    });

    // Verify OTP
    if (otpRecord.otp !== otpInput) {
      const attemptsLeft = 3 - (otpRecord.attempts + 1);
      throw new ConvexError({
        message: `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`,
        code: "BAD_REQUEST",
      });
    }

    // Get current user
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

    // Mark OTP as verified and link to user
    await ctx.db.patch(otpRecord._id, {
      verified: true,
      verifiedAt: Date.now(),
      userId: user._id,
    });

    return {
      success: true,
      verified: true,
      message: "Phone number verified successfully",
    };
  },
});

/**
 * Check if current user has verified their phone number
 */
export const checkPhoneVerified = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { verified: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return { verified: false };
    }

    // Find the most recent verified OTP for this user
    const recentVerified = await ctx.db
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

    if (!recentVerified) {
      return { verified: false };
    }

    return {
      verified: true,
      phoneNumber: recentVerified.phoneNumber,
      verifiedAt: recentVerified.verifiedAt,
    };
  },
});
