import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// Generate upload URL for bug attachments
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Submit a new bug report
export const submitBugReport = mutation({
  args: {
    userEmail: v.string(),
    userPhone: v.string(),
    bugDetails: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.userEmail)) {
      throw new ConvexError({
        message: "Invalid email format",
        code: "BAD_REQUEST",
      });
    }

    // Validate phone number (10 digits, optional country code)
    const phoneRegex = /^(\+?\d{1,3})?[\s-]?\d{10}$/;
    if (!phoneRegex.test(args.userPhone)) {
      throw new ConvexError({
        message: "Invalid phone number format. Please enter a valid 10-digit phone number",
        code: "BAD_REQUEST",
      });
    }

    // Validate bug details (minimum 20 characters)
    if (args.bugDetails.length < 20) {
      throw new ConvexError({
        message: "Bug details must be at least 20 characters long",
        code: "BAD_REQUEST",
      });
    }

    // Get current user if authenticated
    const identity = await ctx.auth.getUserIdentity();
    let userId: Id<"users"> | undefined;
    
    if (identity) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .unique();
      
      if (user) {
        userId = user._id;
      }
    }

    // Get the next bug ID
    const allBugs = await ctx.db.query("bugReports").collect();
    const bugNumber = allBugs.length + 1;
    const bugId = `BUG-${bugNumber.toString().padStart(3, "0")}`;

    // Create the bug report
    const bugReportId = await ctx.db.insert("bugReports", {
      bugId,
      userEmail: args.userEmail,
      userPhone: args.userPhone,
      bugDetails: args.bugDetails,
      status: "pending",
      userId,
      attachmentCount: 0,
      ipAddress: args.ipAddress,
      updatedAt: Date.now(),
    });

    return {
      bugReportId,
      bugId,
    };
  },
});

// Attach a file to a bug report
export const attachFileToBug = mutation({
  args: {
    bugReportId: v.id("bugReports"),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate file size (20MB max)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new ConvexError({
        message: "File size exceeds 20MB limit",
        code: "BAD_REQUEST",
      });
    }

    // Validate file type (images and videos only)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "video/mov", "video/quicktime"];
    if (!allowedTypes.includes(args.fileType.toLowerCase())) {
      throw new ConvexError({
        message: "Invalid file type. Only images (jpg, png, gif, webp) and videos (mp4, webm, mov) are allowed",
        code: "BAD_REQUEST",
      });
    }

    // Get bug report
    const bugReport = await ctx.db.get(args.bugReportId);
    if (!bugReport) {
      throw new ConvexError({
        message: "Bug report not found",
        code: "NOT_FOUND",
      });
    }

    // Check attachment count (max 5 files)
    const attachmentCount = await ctx.db
      .query("bugAttachments")
      .withIndex("by_bug_report", (q) => q.eq("bugReportId", args.bugReportId))
      .collect();

    if (attachmentCount.length >= 5) {
      throw new ConvexError({
        message: "Maximum of 5 files per bug report",
        code: "BAD_REQUEST",
      });
    }

    // Create the attachment
    await ctx.db.insert("bugAttachments", {
      bugReportId: args.bugReportId,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
    });

    // Update attachment count
    await ctx.db.patch(args.bugReportId, {
      attachmentCount: bugReport.attachmentCount + 1,
    });

    return { success: true };
  },
});
