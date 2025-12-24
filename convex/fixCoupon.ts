import { internalMutation } from "./_generated/server";

export const fixMagnetoCoupon = internalMutation({
  args: {},
  handler: async (ctx) => {
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", "MAGNETO500"))
      .first();
    
    if (coupon) {
      await ctx.db.patch(coupon._id, {
        startDate: Date.now() - 86400000, // Yesterday
        endDate: new Date("2026-12-31T23:59:59Z").getTime(), // End of 2026
      });
      return { success: true, couponId: coupon._id };
    }
    
    return { success: false, message: "Coupon not found" };
  },
});
