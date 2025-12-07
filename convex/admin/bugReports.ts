import { v, ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel.d.ts";

// Get bug statistics for admin dashboard
export const getBugStats = query({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || !user.isAdmin) {
      throw new ConvexError({
        message: "Unauthorized. Admin access required.",
        code: "FORBIDDEN",
      });
    }

    const allBugs = await ctx.db.query("bugReports").collect();

    return {
      total: allBugs.length,
      pending: allBugs.filter((b) => b.status === "pending").length,
      resolved: allBugs.filter((b) => b.status === "resolved").length,
      deleted: allBugs.filter((b) => b.status === "deleted").length,
    };
  },
});

// Get all bug reports with filtering and search
export const getBugReports = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("resolved"), v.literal("deleted"), v.literal("all"))),
    searchTerm: v.optional(v.string()),
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

    // Check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || !user.isAdmin) {
      throw new ConvexError({
        message: "Unauthorized. Admin access required.",
        code: "FORBIDDEN",
      });
    }

    let bugs = await ctx.db.query("bugReports").collect();

    // Filter by status
    if (args.status && args.status !== "all") {
      bugs = bugs.filter((b) => b.status === args.status);
    }

    // Search by bug ID, email, or bug details
    if (args.searchTerm && args.searchTerm.length > 0) {
      const searchLower = args.searchTerm.toLowerCase();
      bugs = bugs.filter(
        (b) =>
          b.bugId.toLowerCase().includes(searchLower) ||
          b.userEmail.toLowerCase().includes(searchLower) ||
          b.userPhone.includes(searchLower) ||
          b.bugDetails.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation time (newest first)
    bugs.sort((a, b) => b._creationTime - a._creationTime);

    // Get attachments for each bug
    const bugsWithAttachments = await Promise.all(
      bugs.map(async (bug) => {
        const attachments = await ctx.db
          .query("bugAttachments")
          .withIndex("by_bug_report", (q) => q.eq("bugReportId", bug._id))
          .collect();

        return {
          ...bug,
          attachments,
        };
      })
    );

    return bugsWithAttachments;
  },
});

// Get a single bug report with all attachments
export const getBugById = query({
  args: {
    bugReportId: v.id("bugReports"),
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

    // Check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || !user.isAdmin) {
      throw new ConvexError({
        message: "Unauthorized. Admin access required.",
        code: "FORBIDDEN",
      });
    }

    const bug = await ctx.db.get(args.bugReportId);
    if (!bug) {
      throw new ConvexError({
        message: "Bug report not found",
        code: "NOT_FOUND",
      });
    }

    // Get all attachments
    const attachments = await ctx.db
      .query("bugAttachments")
      .withIndex("by_bug_report", (q) => q.eq("bugReportId", args.bugReportId))
      .collect();

    // Get file URLs for attachments
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.fileId);
        return {
          ...attachment,
          url,
        };
      })
    );

    return {
      ...bug,
      attachments: attachmentsWithUrls,
    };
  },
});

// Update bug status
export const updateBugStatus = mutation({
  args: {
    bugReportId: v.id("bugReports"),
    status: v.union(v.literal("pending"), v.literal("resolved"), v.literal("deleted")),
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

    // Check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || !user.isAdmin) {
      throw new ConvexError({
        message: "Unauthorized. Admin access required.",
        code: "FORBIDDEN",
      });
    }

    const bug = await ctx.db.get(args.bugReportId);
    if (!bug) {
      throw new ConvexError({
        message: "Bug report not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.bugReportId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete bug (soft delete - sets status to deleted)
export const deleteBug = mutation({
  args: {
    bugReportId: v.id("bugReports"),
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

    // Check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || !user.isAdmin) {
      throw new ConvexError({
        message: "Unauthorized. Admin access required.",
        code: "FORBIDDEN",
      });
    }

    const bug = await ctx.db.get(args.bugReportId);
    if (!bug) {
      throw new ConvexError({
        message: "Bug report not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.bugReportId, {
      status: "deleted",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
