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
  })
    .index("by_user", ["userId"])
    .index("by_order_number", ["orderNumber"]),

  collections: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
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
    rating: v.number(), // 1-5
    title: v.string(),
    comment: v.string(),
    verified: v.boolean(), // verified purchase
  })
    .index("by_product", ["productId"])
    .index("by_user", ["userId"]),

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
    usageLimit: v.optional(v.number()),
    usageCount: v.number(),
    applicableProductKeywords: v.optional(v.array(v.string())), // restrict to products containing these keywords in title
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),
});
