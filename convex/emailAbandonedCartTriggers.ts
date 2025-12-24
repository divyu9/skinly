import type { MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel.d.ts";

/**
 * Helper functions to trigger abandoned cart emails
 */

type Ctx = {
  scheduler: MutationCtx["scheduler"];
  db: MutationCtx["db"];
};

/**
 * Send abandoned cart reminder email with coupon
 */
export async function triggerAbandonedCartEmail(
  ctx: Ctx,
  cart: Doc<"abandonedCarts">,
  couponCode: string
) {
  if (!cart.userEmail) {
    console.log("No email for abandoned cart reminder");
    return;
  }

  try {
    // Check if usecase is enabled
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "abandoned_cart"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("abandoned_cart email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = cart.items
      .map((item) => {
        const coverage = item.coverage === "full_body_wrap" 
          ? "Full Body Wrap" 
          : item.coverage === "only_back" 
            ? "Only Back" 
            : "";
        const model = item.phoneModel || "";
        const details = coverage && model 
          ? `${model} - ${coverage}` 
          : coverage || model;
        return `${item.productTitle}${details ? ` (${details})` : ""} x ${item.quantity}`;
      })
      .join(", ");

    // Get user name if available
    let customerName = "Customer";
    if (cart.userId) {
      const user = await ctx.db.get(cart.userId);
      if (user?.name) {
        customerName = user.name;
      }
    }

    // Get site URL for cart link
    const siteUrl = process.env.VITE_SITE_URL || "https://goskinly.com";
    const cartLink = `${siteUrl}/cart`;

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "abandoned_cart",
        recipientEmail: cart.userEmail,
        recipientUserId: cart.userId,
        variables: {
          customerName,
          cartItems: itemsList,
          cartTotal: `₹${cart.cartTotal.toFixed(2)}`,
          cartLink,
          couponCode,
          discountAmount: "15%",
          expiryDays: "7",
        },
        priority: 7, // High priority for abandoned cart
      }
    );

    console.log(`Abandoned cart email queued for ${cart.userEmail}`);
  } catch (error) {
    console.error("Failed to queue abandoned cart email:", error);
    // Don't fail abandoned cart processing if email fails
  }
}
