import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Make a user an admin by their email address.
 * This should only be run once to bootstrap the first admin.
 * After that, admins can be managed through the database UI.
 */
export const makeUserAdmin = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.email === args.email);

    if (!user) {
      throw new ConvexError({
        message: `User with email ${args.email} not found`,
        code: "NOT_FOUND",
      });
    }

    // Set isAdmin to true
    await ctx.db.patch(user._id, {
      isAdmin: true,
    });

    return {
      success: true,
      message: `User ${args.email} is now an admin`,
    };
  },
});

/**
 * Remove admin privileges from a user by email.
 */
export const removeAdmin = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.email === args.email);

    if (!user) {
      throw new ConvexError({
        message: `User with email ${args.email} not found`,
        code: "NOT_FOUND",
      });
    }

    // Set isAdmin to false
    await ctx.db.patch(user._id, {
      isAdmin: false,
    });

    return {
      success: true,
      message: `Admin privileges removed from ${args.email}`,
    };
  },
});
