import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  cart: defineTable({
    userId: v.id("users"),
    productId: v.string(),
    productTitle: v.string(),
    productImage: v.optional(v.string()),
    variant: v.string(),
    price: v.number(),
    quantity: v.number(),
    phoneModel: v.optional(v.string()),
    phoneBrand: v.optional(v.string()),
    coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId", "variant"]),

  orders: defineTable({
    userId: v.id("users"),
    orderNumber: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    items: v.array(
      v.object({
        productId: v.string(),
        productTitle: v.string(),
        productImage: v.optional(v.string()),
        variant: v.string(),
        price: v.number(),
        quantity: v.number(),
        phoneModel: v.optional(v.string()),
        phoneBrand: v.optional(v.string()),
        coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
      })
    ),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    shippingAddress: v.object({
      fullName: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
    }),
    paymentMethod: v.string(),
    // GST fields (tax-inclusive pricing)
    taxableAmount: v.optional(v.number()), // Amount before tax (price / 1.18)
    gstRate: v.optional(v.number()), // 18% (0.18)
    cgstRate: v.optional(v.number()), // 9% (0.09) for Uttar Pradesh orders
    sgstRate: v.optional(v.number()), // 9% (0.09) for Uttar Pradesh orders
    igstRate: v.optional(v.number()), // 18% (0.18) for other state orders
    cgstAmount: v.optional(v.number()), // CGST amount
    sgstAmount: v.optional(v.number()), // SGST amount
    igstAmount: v.optional(v.number()), // IGST amount
    totalGstAmount: v.optional(v.number()), // Total GST amount
    // Payment fields
    paymentStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed")
    )),
    phonepeTransactionId: v.optional(v.string()),
    phonepeMerchantTransactionId: v.optional(v.string()),
    phonepePaymentUrl: v.optional(v.string()),
    // Shipping fields
    awbNumber: v.optional(v.string()), // Airway Bill Number from RapidShyp
    trackingUrl: v.optional(v.string()),
    shippingStatus: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_order_number", ["orderNumber"])
    .index("by_merchant_transaction", ["phonepeMerchantTransactionId"]),

  collections: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    isAuto: v.optional(v.boolean()), // Whether this is an auto-collection with rules
    matchLogic: v.optional(v.union(v.literal("all"), v.literal("any"))), // "all" = AND, "any" = OR
    rules: v.optional(v.array(v.object({
      field: v.union(
        v.literal("productName"),
        v.literal("sku")
      ),
      condition: v.union(
        v.literal("contains"),
        v.literal("startsWith"),
        v.literal("notContains")
      ),
      value: v.string(),
    }))),
  }).index("by_slug", ["slug"]),

  products: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    metaDescription: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    images: v.array(v.object({
      url: v.string(),
      alt: v.optional(v.string()),
      phoneModel: v.optional(v.string()), // e.g., "iPhone 14 Pro", "Realme 11", etc.
    })),
    tags: v.array(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"]),

  variants: defineTable({
    productId: v.id("products"),
    sku: v.string(),
    title: v.string(),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    inventoryQuantity: v.number(),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
  })
    .index("by_product", ["productId"])
    .index("by_sku", ["sku"]),

  reviews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    userName: v.string(),
    userEmail: v.optional(v.string()),
    rating: v.number(), // 1-5
    title: v.string(),
    comment: v.string(),
    verified: v.boolean(), // verified purchase
    images: v.optional(v.array(v.string())), // Array of storage IDs
  })
    .index("by_product", ["productId"])
    .index("by_user", ["userId"])
    .index("by_verified", ["verified"]),

  coupons: defineTable({
    code: v.string(),
    description: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(),
    minPurchase: v.optional(v.number()),
    maxDiscount: v.optional(v.number()),
    startDate: v.number(), // timestamp
    endDate: v.number(), // timestamp
    isActive: v.boolean(),
    usageLimit: v.optional(v.number()), // Total usage limit
    usageCount: v.number(),
    // Applicability conditions (at least one must be set)
    applicableVariantIds: v.optional(v.array(v.id("variants"))), // Specific variants
    applicableCollectionIds: v.optional(v.array(v.id("collections"))), // Specific collections
    applicableProductKeywords: v.optional(v.array(v.string())), // Product title contains
    minCartValue: v.optional(v.number()), // Minimum cart value
    minProductValue: v.optional(v.number()), // Minimum individual product value
    // Customer restrictions
    allowedCustomerEmails: v.optional(v.array(v.string())), // Specific customer emails
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  couponUsage: defineTable({
    couponId: v.id("coupons"),
    userId: v.id("users"),
    userEmail: v.string(),
    orderId: v.id("orders"),
    discountAmount: v.number(),
    usedAt: v.number(),
  })
    .index("by_coupon", ["couponId"])
    .index("by_user", ["userId"])
    .index("by_coupon_and_user", ["couponId", "userId"]),

  mockups: defineTable({
    brand: v.string(), // e.g., "Apple", "Samsung"
    model: v.string(), // e.g., "iPhone 15 Pro", "Galaxy S24"
    sku: v.string(), // e.g., "M-174"
    fileId: v.string(), // Hercules CDN file ID (e.g., "file_abc123")
  })
    .index("by_brand_model_sku", ["brand", "model", "sku"])
    .index("by_sku", ["sku"]),

  abandonedCarts: defineTable({
    userId: v.id("users"),
    userEmail: v.string(),
    userPhone: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.string(),
        productTitle: v.string(),
        productImage: v.optional(v.string()),
        variant: v.string(),
        price: v.number(),
        quantity: v.number(),
        phoneModel: v.optional(v.string()),
        phoneBrand: v.optional(v.string()),
        coverage: v.optional(v.union(v.literal("only_back"), v.literal("full_body_wrap"))),
      })
    ),
    cartTotal: v.number(),
    abandonedAt: v.number(), // timestamp when cart was abandoned
    reminderSentAt: v.optional(v.number()), // timestamp when reminder was sent
    couponCode: v.optional(v.string()), // Custom coupon generated for this cart
    status: v.union(
      v.literal("pending"), // Abandoned but no reminder sent yet
      v.literal("reminded"), // Reminder sent
      v.literal("recovered"), // User completed checkout
      v.literal("expired") // Too old or no longer relevant
    ),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_abandoned_at", ["abandonedAt"]),

  stockNotifications: defineTable({
    variantId: v.id("variants"),
    productId: v.id("products"),
    productTitle: v.string(),
    variantTitle: v.string(),
    sku: v.string(),
    phoneNumber: v.string(), // User's phone number
    subscribedAt: v.number(), // timestamp when subscribed
    notifiedAt: v.optional(v.number()), // timestamp when notification was sent
    status: v.union(
      v.literal("waiting"), // Waiting for restock
      v.literal("notified"), // Notification sent
      v.literal("expired") // User no longer interested or expired
    ),
  })
    .index("by_variant", ["variantId"])
    .index("by_status", ["status"])
    .index("by_variant_and_status", ["variantId", "status"]),

  settings: defineTable({
    key: v.string(), // Unique setting key
    value: v.union(v.boolean(), v.string(), v.number()), // Setting value
  }).index("by_key", ["key"]),

  supportedModels: defineTable({
    brandName: v.string(), // e.g., "Apple", "Samsung", "OnePlus"
    modelName: v.string(), // e.g., "iPhone 15 Pro Max", "Galaxy S24 Ultra"
    category: v.union(
      v.literal("phone"),
      v.literal("tablet"),
      v.literal("laptop"),
      v.literal("console"),
      v.literal("charger"),
      v.literal("drone"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("mac-mini")
    ),
    isActive: v.boolean(), // Control visibility
  })
    .index("by_brand", ["brandName"])
    .index("by_category", ["category"]),
});
