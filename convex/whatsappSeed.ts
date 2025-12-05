import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================================================
// SEED USE-CASES
// ============================================================================

const DEFAULT_USECASES = [
  {
    usecaseKey: "order_received",
    displayName: "Order Received",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "order_dispatched",
    displayName: "Order Dispatched",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "order_cancelled",
    displayName: "Order Cancelled",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "cod_confirmation",
    displayName: "COD Confirmation",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "partial_cod",
    displayName: "Partial COD Payment",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "order_delivered",
    displayName: "Order Delivered",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "review_request",
    displayName: "Review Request",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "review_reminder",
    displayName: "Review Reminder",
    isTransactional: false,
    requireConsent: true,
  },
  {
    usecaseKey: "back_in_stock",
    displayName: "Back in Stock Alert",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "model_requested",
    displayName: "Model Request Received",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "model_added",
    displayName: "Requested Model Added",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "otp_login",
    displayName: "OTP Login",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "abandoned_cart",
    displayName: "Abandoned Cart Reminder",
    isTransactional: false,
    requireConsent: true,
  },
  {
    usecaseKey: "refund_initiated",
    displayName: "Refund Initiated",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "return_update",
    displayName: "Return Update",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "payment_failed",
    displayName: "Payment Failed",
    isTransactional: true,
    requireConsent: false,
  },
  {
    usecaseKey: "price_drop",
    displayName: "Price Drop Alert",
    isTransactional: false,
    requireConsent: true,
  },
  {
    usecaseKey: "winback_campaign",
    displayName: "Winback Campaign",
    isTransactional: false,
    requireConsent: true,
  },
  {
    usecaseKey: "birthday_offer",
    displayName: "Birthday Offer",
    isTransactional: false,
    requireConsent: true,
  },
];

export const seedUsecases = mutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let skipped = 0;

    for (const usecase of DEFAULT_USECASES) {
      // Check if usecase already exists
      const existing = await ctx.db
        .query("whUsecaseTemplates")
        .withIndex("by_usecase_key", (q) =>
          q.eq("usecaseKey", usecase.usecaseKey)
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      // Create the use-case (disabled by default)
      await ctx.db.insert("whUsecaseTemplates", {
        usecaseKey: usecase.usecaseKey,
        displayName: usecase.displayName,
        enabled: false,
        isTransactional: usecase.isTransactional,
        requireConsent: usecase.requireConsent,
      });

      created++;
    }

    return {
      success: true,
      created,
      skipped,
      total: DEFAULT_USECASES.length,
      message: `Seeded ${created} use-cases, skipped ${skipped} existing`,
    };
  },
});

// ============================================================================
// SEED APPROVED TEMPLATES
// ============================================================================

const SAMPLE_TEMPLATES = [
  {
    templateName: "Order Received - v3",
    providerTemplateId: "ORDER_RECEIVED_V3",
    templateType: "transactional" as const,
    templateBody:
      "Hi {customer_name}, your order #{order_number} has been received! We'll notify you once it's shipped. Track: {tracking_url}",
    variables: ["customer_name", "order_number", "tracking_url"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Order Dispatched - v2",
    providerTemplateId: "ORDER_DISPATCHED_V2",
    templateType: "transactional" as const,
    templateBody:
      "Great news {customer_name}! Your order #{order_number} has been dispatched via {courier_name}. AWB: {awb_number}. Track: {tracking_url}",
    variables: [
      "customer_name",
      "order_number",
      "courier_name",
      "awb_number",
      "tracking_url",
    ],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "COD OTP Verification - v1",
    providerTemplateId: "COD_OTP_V1",
    templateType: "transactional" as const,
    templateBody:
      "Your COD verification OTP is {otp}. Valid for 10 minutes. Order #{order_number}",
    variables: ["otp", "order_number"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Back in Stock - v2",
    providerTemplateId: "BACK_IN_STOCK_V2",
    templateType: "transactional" as const,
    templateBody:
      "Good news! {product_name} is back in stock. Order now: {product_url}",
    variables: ["product_name", "product_url"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Review Request - v1",
    providerTemplateId: "REVIEW_REQUEST_V1",
    templateType: "transactional" as const,
    templateBody:
      "Hi {customer_name}! We'd love to hear your feedback on {product_name}. Leave a review: {review_url}",
    variables: ["customer_name", "product_name", "review_url"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Abandoned Cart - v3",
    providerTemplateId: "ABANDONED_CART_V3",
    templateType: "marketing" as const,
    templateBody:
      "Hi {customer_name}, you left items in your cart! Complete your order now and get {discount}% off with code {coupon_code}: {cart_url}",
    variables: ["customer_name", "discount", "coupon_code", "cart_url"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Price Drop Alert - v1",
    providerTemplateId: "PRICE_DROP_V1",
    templateType: "marketing" as const,
    templateBody:
      "Price drop alert! {product_name} is now {new_price} (was {old_price}). Get it now: {product_url}",
    variables: ["product_name", "new_price", "old_price", "product_url"],
    language: "en",
    status: "active" as const,
  },
  {
    templateName: "Model Request Received - v1",
    providerTemplateId: "MODEL_REQUEST_V1",
    templateType: "transactional" as const,
    templateBody:
      "Thanks {customer_name}! We've received your request for {brand_name} {model_name}. We'll notify you once it's available.",
    variables: ["customer_name", "brand_name", "model_name"],
    language: "en",
    status: "active" as const,
  },
];

export const seedTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let skipped = 0;

    for (const template of SAMPLE_TEMPLATES) {
      // Check if template already exists
      const existing = await ctx.db
        .query("whApprovedTemplates")
        .withIndex("by_provider_id", (q) =>
          q.eq("providerTemplateId", template.providerTemplateId)
        )
        .unique();

      if (existing) {
        skipped++;
        continue;
      }

      // Create the template
      await ctx.db.insert("whApprovedTemplates", {
        ...template,
        approvedAt: Date.now(),
      });

      created++;
    }

    return {
      success: true,
      created,
      skipped,
      total: SAMPLE_TEMPLATES.length,
      message: `Seeded ${created} templates, skipped ${skipped} existing`,
    };
  },
});

// ============================================================================
// CHECK IF SEEDED
// ============================================================================

export const checkSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const usecasesCount = (
      await ctx.db.query("whUsecaseTemplates").collect()
    ).length;
    const templatesCount = (
      await ctx.db.query("whApprovedTemplates").collect()
    ).length;

    return {
      usecases: {
        count: usecasesCount,
        seeded: usecasesCount >= DEFAULT_USECASES.length,
      },
      templates: {
        count: templatesCount,
        seeded: templatesCount >= SAMPLE_TEMPLATES.length,
      },
    };
  },
});
