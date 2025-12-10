import type { MutationCtx, QueryCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

/**
 * Helper functions to trigger order-related emails
 * These are called from order mutations at appropriate lifecycle events
 */

type Ctx = {
  scheduler: MutationCtx["scheduler"];
  db: MutationCtx["db"];
};

// Helper to get customer email (guest or authenticated)
function getCustomerEmail(order: Doc<"orders">): string | undefined {
  return order.customerEmail || order.guestEmail;
}

/**
 * Send order confirmed email
 */
export async function triggerOrderConfirmedEmail(
  ctx: Ctx,
  order: Doc<"orders">,
  user: { name?: string } | null
) {
  const recipientEmail = getCustomerEmail(order);
  if (!recipientEmail) {
    console.log("No email for order confirmed notification");
    return;
  }

  try {
    // Check if usecase is enabled
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "order_confirmed"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("order_confirmed email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = order.items
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

    // Format shipping address
    const shippingAddress = [
      order.shippingAddress.addressLine1,
      order.shippingAddress.addressLine2,
      order.shippingAddress.city,
      order.shippingAddress.state,
      order.shippingAddress.pincode,
    ]
      .filter(Boolean)
      .join(", ");

    // Format payment method
    let paymentMethod = order.paymentMethod.toUpperCase();
    if (order.paymentMethod === "cod") {
      paymentMethod = order.prepaidAmount && order.prepaidAmount > 0 ? "Partial COD" : "COD";
    } else if (order.paymentMethod === "phonepe") {
      paymentMethod = "PhonePe (Online)";
    }

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "order_confirmed",
        recipientEmail,
        recipientUserId: order.userId,
        variables: {
          customerName: order.shippingAddress.fullName || user?.name || "Customer",
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          productName: itemsList,
          amount: `₹${order.total.toFixed(2)}`,
          productImage: "",
        },
        priority: 8,
      }
    );
  } catch (error) {
    console.error("Failed to queue order confirmed email:", error);
    // Don't fail order if email fails
  }
}

/**
 * Send order dispatched/shipped email
 */
export async function triggerOrderDispatchedEmail(
  ctx: Ctx,
  order: Doc<"orders">,
  user: { name?: string } | null
) {
  const recipientEmail = getCustomerEmail(order);
  if (!recipientEmail) {
    console.log("No email for order dispatched notification");
    return;
  }

  try {
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "order_dispatched"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("order_dispatched email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = order.items
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

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "order_dispatched",
        recipientEmail,
        recipientUserId: order.userId,
        variables: {
          customerName: order.shippingAddress.fullName || user?.name || "Customer",
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          productName: itemsList,
          amount: `₹${order.total.toFixed(2)}`,
          productImage: "",
        },
        priority: 8,
      }
    );
  } catch (error) {
    console.error("Failed to queue order dispatched email:", error);
  }
}

/**
 * Send order delivered email
 */
export async function triggerOrderDeliveredEmail(
  ctx: Ctx,
  order: Doc<"orders">,
  user: { name?: string } | null
) {
  const recipientEmail = getCustomerEmail(order);
  if (!recipientEmail) {
    console.log("No email for order delivered notification");
    return;
  }

  try {
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "order_delivered"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("order_delivered email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = order.items
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

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "order_delivered",
        recipientEmail,
        recipientUserId: order.userId,
        variables: {
          customerName: order.shippingAddress.fullName || user?.name || "Customer",
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          productName: itemsList,
          amount: `₹${order.total.toFixed(2)}`,
          productImage: "",
        },
        priority: 8,
      }
    );
  } catch (error) {
    console.error("Failed to queue order delivered email:", error);
  }
}

/**
 * Send order cancelled email
 */
export async function triggerOrderCancelledEmail(
  ctx: Ctx,
  order: Doc<"orders">,
  user: { name?: string } | null
) {
  const recipientEmail = getCustomerEmail(order);
  if (!recipientEmail) {
    console.log("No email for order cancelled notification");
    return;
  }

  try {
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "order_cancelled"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("order_cancelled email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = order.items
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

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "order_cancelled",
        recipientEmail,
        recipientUserId: order.userId,
        variables: {
          customerName: order.shippingAddress.fullName || user?.name || "Customer",
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          productName: itemsList,
          amount: `₹${order.total.toFixed(2)}`,
          productImage: "",
        },
        priority: 8,
      }
    );
  } catch (error) {
    console.error("Failed to queue order cancelled email:", error);
  }
}

/**
 * Send payment failed email
 */
export async function triggerPaymentFailedEmail(
  ctx: Ctx,
  order: Doc<"orders">,
  user: { name?: string } | null
) {
  const recipientEmail = getCustomerEmail(order);
  if (!recipientEmail) {
    console.log("No email for payment failed notification");
    return;
  }

  try {
    const usecase = await ctx.db
      .query("emailUsecaseTemplates")
      .withIndex("by_usecase_key", (q) => q.eq("usecaseKey", "payment_failed"))
      .first();

    if (!usecase?.enabled || !usecase.msg91TemplateId) {
      console.log("payment_failed email usecase not enabled or no template");
      return;
    }

    // Format items list
    const itemsList = order.items
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

    await ctx.scheduler.runAfter(
      0,
      api.emailMessaging.queueMessage,
      {
        usecaseKey: "payment_failed",
        recipientEmail,
        recipientUserId: order.userId,
        variables: {
          customerName: order.shippingAddress.fullName || user?.name || "Customer",
          orderNumber: order.orderNumber || order.failedOrderNumber || "Pending",
          productName: itemsList,
          amount: `₹${order.total.toFixed(2)}`,
          productImage: "",
        },
        priority: 8,
      }
    );
  } catch (error) {
    console.error("Failed to queue payment failed email:", error);
  }
}
