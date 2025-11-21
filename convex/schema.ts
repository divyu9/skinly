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
});
