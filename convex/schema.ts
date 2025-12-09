import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    walletBalance: v.optional(v.number()), // Current wallet balance (default 0)
    referralCode: v.optional(v.string()), // Unique referral code for this user
    referredBy: v.optional(v.id("users")), // User who referred them
    isAdmin: v.optional(v.boolean()), // Admin role for bug dashboard access
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_referral_code", ["referralCode"])
    .index("by_is_admin", ["isAdmin"]),

  cart: defineTable({
    userId: v.optional(v.id("users")), // Optional for guest carts
    sessionId: v.optional(v.string()), // Session ID for guest carts
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
    .index("by_session", ["sessionId"])
    .index("by_user_and_product", ["userId", "productId", "variant"]),

  orders: defineTable({
    userId: v.optional(v.id("users")), // Optional for guest orders
    isGuest: v.optional(v.boolean()), // Whether this is a guest order
    guestEmail: v.optional(v.string()), // Guest email for guest orders
    trackingToken: v.optional(v.string()), // Secure token for guest order tracking
    orderNumber: v.optional(v.string()), // Sequential order number (e.g., #4001), assigned when payment succeeds
    failedOrderNumber: v.optional(v.string()), // Failed order number (e.g., F26-001), for failed payments
    customerEmail: v.optional(v.string()), // Customer's email for notifications
    status: v.union(
      v.literal("processing"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("rto")
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
    // COD fields
    codFee: v.optional(v.number()), // COD fee charged
    prepaidAmount: v.optional(v.number()), // Amount paid upfront (for partial COD)
    codAmount: v.optional(v.number()), // Amount to be collected on delivery
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
    courierName: v.optional(v.string()), // Courier company name (e.g., "DTDC Surface")
    labelUrl: v.optional(v.string()), // Shipping label PDF URL
    // Wallet fields
    walletAmountUsed: v.optional(v.number()), // Amount deducted from wallet
    cashbackAmount: v.optional(v.number()), // Cashback earned on this order
    cashbackCredited: v.optional(v.boolean()), // Whether cashback has been credited
    // Coupon fields
    couponId: v.optional(v.id("coupons")), // Coupon used for this order
    couponDiscount: v.optional(v.number()), // Discount amount from coupon
    // Refund tracking fields
    refundedToWallet: v.optional(v.boolean()), // Whether order was refunded to wallet
    refundAmount: v.optional(v.number()), // Amount refunded to wallet
    refundedAt: v.optional(v.number()), // Timestamp of refund
    refundedBy: v.optional(v.string()), // Admin who processed the refund
    refundReason: v.optional(v.string()), // Reason for refund
    // Manual tracking fields (for non-RapidShyp orders)
    manualTrackingNumber: v.optional(v.string()), // Manual tracking number
    manualCourierCompany: v.optional(v.string()), // Manual courier company name
    // Inventory restocking audit trail
    restockingHistory: v.optional(v.array(v.object({
      restockedAt: v.number(), // Timestamp
      restockedBy: v.string(), // Admin email
      items: v.array(v.object({
        productId: v.string(),
        variantId: v.optional(v.string()),
        sku: v.string(),
        quantity: v.number(),
      })),
    }))),
    // RTO action history
    rtoActions: v.optional(v.array(v.object({
      actionType: v.union(
        v.literal("restocked"), // Inventory restocked
        v.literal("resent"), // Package resent
        v.literal("resolved") // Marked as resolved
      ),
      actionAt: v.number(), // Timestamp
      actionBy: v.string(), // Admin email
      notes: v.optional(v.string()), // Optional notes
      newOrderNumber: v.optional(v.string()), // New order number if resent (with -C suffix)
    }))),
    // Soft delete fields
    isDeleted: v.optional(v.boolean()), // Whether order is soft deleted
    deletedAt: v.optional(v.number()), // Timestamp of deletion
    deletedBy: v.optional(v.id("users")), // Admin who deleted the order
  })
    .index("by_user", ["userId"])
    .index("by_order_number", ["orderNumber"])
    .index("by_merchant_transaction", ["phonepeMerchantTransactionId"])
    .index("by_status", ["status"])
    .index("by_guest_email", ["guestEmail"])
    .index("by_tracking_token", ["trackingToken"])
    .index("by_payment_status", ["paymentStatus"])
    .index("by_is_deleted", ["isDeleted"]),

  collections: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("phone"),
      v.literal("laptop"),
      v.literal("camera"),
      v.literal("accessory"),
      v.literal("other")
    )),
    deviceType: v.optional(v.string()), // e.g., "phone", "laptop", "camera"
    keywords: v.optional(v.array(v.string())), // Keywords for auto-assignment
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
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"]),

  collectionProducts: defineTable({
    collectionId: v.id("collections"),
    productId: v.id("products"),
  })
    .index("by_collection", ["collectionId"])
    .index("by_product", ["productId"])
    .index("by_collection_and_product", ["collectionId", "productId"]),

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
    gadgetCategory: v.optional(v.union(
      v.literal("phone"),
      v.literal("laptop"),
      v.literal("tablet"),
      v.literal("camera"),
      v.literal("lens"),
      v.literal("drone"),
      v.literal("charger"),
      v.literal("console"),
      v.literal("mac-mini"),
      v.literal("cover"),
      v.literal("accessory")
    )),
    finishType: v.optional(v.union(
      v.literal("matte"),
      v.literal("embossed"),
      v.literal("transparent")
    )),
    // Shipping dimensions and weight
    length: v.optional(v.number()), // Length in cm
    breadth: v.optional(v.number()), // Breadth in cm
    height: v.optional(v.number()), // Height in cm
    weight: v.optional(v.number()), // Weight in grams
    productType: v.optional(v.union(v.literal("physical"), v.literal("digital"))),
  })
    .index("by_slug", ["slug"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_status_and_category", ["status", "gadgetCategory"]),

  variants: defineTable({
    productId: v.id("products"),
    sku: v.string(),
    title: v.string(),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    inventoryQuantity: v.number(),
    weight: v.optional(v.number()),
    weightUnit: v.optional(v.string()),
    rNumber: v.optional(v.string()), // Manual override for R-number (e.g., "R-1", "R-59")
    materialMultiplier: v.optional(v.number()), // Material usage multiplier (1x, 2x, 3x, etc.) - defaults to 1
  })
    .index("by_product", ["productId"])
    .index("by_sku", ["sku"])
    .index("by_r_number", ["rNumber"]),

  reviews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    userName: v.string(),
    userEmail: v.optional(v.string()),
    rating: v.number(), // 1-5
    title: v.string(),
    comment: v.string(),
    verified: v.boolean(), // verified purchase
    images: v.optional(v.array(v.string())), // Array of image storage IDs
    videos: v.optional(v.array(v.string())), // Array of video storage IDs
  })
    .index("by_product", ["productId"])
    .index("by_user", ["userId"])
    .index("by_verified", ["verified"]),

  coupons: defineTable({
    code: v.string(),
    description: v.string(),
    // Coupon effect type
    effectType: v.optional(v.union(
      v.literal("discount"), // Traditional discount coupon
      v.literal("wallet_credit") // Adds credit to user's wallet
    )),
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
    orderId: v.optional(v.id("orders")), // Optional because wallet credit coupons don't have orders
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
    fileId: v.id("_storage"), // Convex storage ID
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

  // Cached model metadata (for fast queries - updated when models change)
  modelMetadata: defineTable({
    key: v.string(), // Always "current" - single row table
    brands: v.array(v.string()), // All unique brand names sorted
    totalModels: v.number(), // Total count of active models
    // Per-category metadata
    byCategory: v.object({
      phone: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      laptop: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      tablet: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      camera: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      lens: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      drone: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      charger: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      console: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
      macMini: v.object({
        brands: v.array(v.string()),
        count: v.number(),
      }),
    }),
    lastUpdated: v.number(), // Timestamp of last cache update
  }).index("by_key", ["key"]),

  gadgetConsumption: defineTable({
    categoryName: v.string(), // e.g., "Phone", "Laptop Top", "Mac Mini"
    lengthCm: v.number(), // Length in cm
    widthCm: v.number(), // Width in cm
    notes: v.optional(v.string()), // Optional notes (e.g., "Standard iPhone size")
  }).index("by_category", ["categoryName"]),

  rollInventory: defineTable({
    rNumber: v.string(), // e.g., "R-1", "R-59"
    designName: v.string(), // e.g., "Carbon Fiber Black", "Marble White"
    isContinuous: v.boolean(), // True = can cut any direction, False = must respect orientation
    metersAvailable: v.number(), // Available vinyl in meters
    notes: v.optional(v.string()), // Optional notes
  }).index("by_r_number", ["rNumber"]),

  importJobs: defineTable({
    folderId: v.string(), // Google Drive folder ID
    folderUrl: v.string(), // Original folder URL provided by user
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
    // Progress tracking
    totalFiles: v.optional(v.number()), // Total files found in folder
    filesChecked: v.number(), // Files checked for duplicates
    filesSkipped: v.number(), // Files already uploaded (duplicates)
    filesUploaded: v.number(), // Successfully uploaded new files
    filesFailed: v.number(), // Failed uploads
    // Current state
    currentFile: v.optional(v.string()), // Currently processing filename
    lastCheckpoint: v.optional(v.number()), // Last processed file index for resume
    // Timing
    startedAt: v.optional(v.number()), // When job started
    completedAt: v.optional(v.number()), // When job completed
    lastActivityAt: v.optional(v.number()), // Last activity timestamp
    // Error tracking
    errorMessage: v.optional(v.string()),
    failedFiles: v.optional(v.array(v.object({
      fileId: v.optional(v.string()), // Google Drive file ID for retry (optional for backward compatibility)
      filename: v.string(),
      reason: v.string(),
    }))),
  })
    .index("by_status", ["status"])
    .index("by_started_at", ["startedAt"]),

  uploadJobs: defineTable({
    jobName: v.string(), // User-friendly name for the job
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    // Progress tracking
    totalFiles: v.number(), // Total files to upload
    filesChecked: v.number(), // Files checked for duplicates
    filesSkipped: v.number(), // Files already uploaded (duplicates)
    filesUploaded: v.number(), // Successfully uploaded new files
    filesFailed: v.number(), // Failed uploads
    // Current state
    currentFile: v.optional(v.string()), // Currently processing filename
    currentBatch: v.number(), // Current batch number (for resume)
    // Timing
    startedAt: v.optional(v.number()), // When job started
    completedAt: v.optional(v.number()), // When job completed
    lastActivityAt: v.optional(v.number()), // Last activity timestamp
    // Error tracking
    errorMessage: v.optional(v.string()),
    failedFiles: v.array(v.object({
      filename: v.string(),
      reason: v.string(),
    })),
  })
    .index("by_status", ["status"])
    .index("by_started_at", ["startedAt"]),

  modelRequests: defineTable({
    brandName: v.string(), // Brand name requested
    modelName: v.string(), // Model name requested
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
    whatsappPhone: v.string(), // User's WhatsApp number for notification
    userId: v.optional(v.id("users")), // User who requested (if authenticated)
    userEmail: v.optional(v.string()), // Email if available
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    requestedAt: v.number(), // Timestamp when requested
    approvedAt: v.optional(v.number()), // Timestamp when admin approved
  })
    .index("by_status", ["status"]),

  codSettings: defineTable({
    // Master toggle
    enabled: v.boolean(),
    // Match logic
    matchMode: v.union(v.literal("ALL"), v.literal("ANY")),
    // Product IDs condition
    productIdsEnabled: v.boolean(),
    productIds: v.array(v.id("products")),
    // Collection IDs condition
    collectionIdsEnabled: v.boolean(),
    collectionIds: v.array(v.id("collections")),
    // Variant IDs condition
    variantIdsEnabled: v.boolean(),
    variantIds: v.array(v.id("variants")),
    // Min order amount condition
    minOrderAmountEnabled: v.boolean(),
    minOrderAmount: v.number(),
    // Max order amount condition
    maxOrderAmountEnabled: v.boolean(),
    maxOrderAmount: v.number(),
    // Min product count condition
    minProductCountEnabled: v.boolean(),
    minProductCount: v.number(),
    // Max product count condition
    maxProductCountEnabled: v.boolean(),
    maxProductCount: v.number(),
    // COD fee configuration
    codFeeType: v.union(v.literal("fixed"), v.literal("percentage")),
    codFeeValue: v.number(),
    // Partial COD configuration
    partialCodEnabled: v.boolean(),
    prepaidType: v.union(v.literal("fixed"), v.literal("percentage")),
    prepaidValue: v.number(),
    // UI visibility controls
    showCodOnPaymentPage: v.optional(v.boolean()), // Show COD option even when not eligible
    allowMixedCartCod: v.optional(v.boolean()), // Allow COD when cart has both eligible and non-eligible items
    // Display rules configuration
    hideWhenIneligible: v.optional(v.boolean()), // Hide COD completely when ineligible or disabled (default: false)
    displayRules: v.optional(v.array(v.object({
      ruleType: v.union(
        v.literal("cart_min_value"), // Hide if cart value < value
        v.literal("cart_max_value"), // Hide if cart value > value
        v.literal("product_count_min"), // Hide if product count < value
        v.literal("product_count_max"), // Hide if product count > value
        v.literal("contains_category"), // Hide if cart contains specific gadget category
        v.literal("excludes_category"), // Show only if cart contains specific gadget category
        v.literal("user_verified"), // Show only for verified users (has completed an order)
        v.literal("first_time_buyer") // Show only for first-time buyers (no previous orders)
      ),
      value: v.union(v.string(), v.number()), // Value to compare (category name for category rules, number for others)
      enabled: v.boolean(), // Whether this rule is active
    }))),
  }),

  // WhatsApp Use-case Templates
  whUsecaseTemplates: defineTable({
    usecaseKey: v.string(), // Unique key (e.g., "order_received", "cod_confirmation")
    displayName: v.string(), // Friendly name for UI (e.g., "Order Received")
    description: v.optional(v.string()), // Description of when this usecase triggers
    enabled: v.boolean(), // ON/OFF toggle
    templateName: v.optional(v.string()), // Selected template name (e.g., "Order Received - v3")
    providerTemplateId: v.optional(v.string()), // Provider/HSM ID (e.g., "AUTHKEY_HSM_123")
    templateId: v.optional(v.id("whApprovedTemplates")), // Link to approved template (for variable mapping)
    // Variable mapping configuration
    variableMapping: v.optional(v.array(v.object({
      templateVariable: v.string(), // Template variable name (e.g., "customer_name", "1", "2")
      sourceFields: v.array(v.string()), // Source fields to combine (e.g., ["brand_name", "model_name"])
      separator: v.optional(v.string()), // Separator for multiple fields (default: " ")
    }))),
    isTransactional: v.boolean(), // Transactional vs marketing
    requireConsent: v.boolean(), // Whether user consent is required
    lastUpdatedBy: v.optional(v.string()), // Admin email who made the change
    lastUpdatedAt: v.optional(v.number()), // Timestamp of last update
  }).index("by_usecase_key", ["usecaseKey"]),

  // WhatsApp Use-case Audit Trail
  whUsecaseAudit: defineTable({
    usecaseKey: v.string(), // Which use-case was changed
    fieldChanged: v.string(), // "enabled" or "template_name"
    oldValue: v.optional(v.string()), // Previous value
    newValue: v.optional(v.string()), // New value
    changedBy: v.string(), // Admin email
    changedAt: v.number(), // Timestamp
  })
    .index("by_usecase_key", ["usecaseKey"])
    .index("by_changed_at", ["changedAt"]),

  // WhatsApp Approved Templates
  whApprovedTemplates: defineTable({
    templateName: v.string(), // Template name (e.g., "Order Received - v3")
    providerTemplateId: v.string(), // Provider/HSM ID (e.g., "AUTHKEY_HSM_123")
    templateType: v.union(v.literal("transactional"), v.literal("marketing"), v.literal("authentication")), // Type
    templateBody: v.optional(v.string()), // Template text with placeholders
    variables: v.optional(v.array(v.string())), // List of variables in template
    language: v.optional(v.string()), // Language code (e.g., "en")
    status: v.union(v.literal("active"), v.literal("inactive")), // Status
    approvedAt: v.optional(v.number()), // When approved/synced from AUTHKEY
  })
    .index("by_provider_id", ["providerTemplateId"])
    .index("by_status", ["status"]),

  // WhatsApp Messages Log
  whatsappMessages: defineTable({
    usecaseKey: v.string(), // Which use-case triggered this (e.g., "order_received")
    recipientPhone: v.string(), // Phone number (cleaned)
    recipientUserId: v.optional(v.id("users")), // User ID if available
    providerTemplateId: v.string(), // Template ID used
    templateName: v.string(), // Template name for reference
    variables: v.optional(v.record(v.string(), v.string())), // Variables sent (as JSON object)
    status: v.union(
      v.literal("pending"), // Queued for sending
      v.literal("sent"), // Sent to provider
      v.literal("delivered"), // Delivered to recipient
      v.literal("read"), // Read by recipient
      v.literal("failed") // Failed to send
    ),
    providerMessageId: v.optional(v.string()), // Message ID from provider
    errorMessage: v.optional(v.string()), // Error details if failed
    retryCount: v.number(), // Number of retry attempts
    sentAt: v.optional(v.number()), // When sent successfully
    deliveredAt: v.optional(v.number()), // When delivered
    readAt: v.optional(v.number()), // When read
    createdAt: v.number(), // When queued
  })
    .index("by_usecase", ["usecaseKey"])
    .index("by_recipient", ["recipientPhone"])
    .index("by_status", ["status"])
    .index("by_user", ["recipientUserId"])
    .index("by_provider_message_id", ["providerMessageId"])
    .index("by_created_at", ["createdAt"]),

  // WhatsApp Message Queue (for worker processing)
  whatsappQueue: defineTable({
    messageId: v.id("whatsappMessages"), // Reference to message
    priority: v.number(), // Higher = more urgent (1-10)
    scheduledFor: v.number(), // When to send (for retry delays)
    attempts: v.number(), // Number of processing attempts
    status: v.union(
      v.literal("pending"), // Waiting to be processed
      v.literal("processing"), // Currently being processed
      v.literal("completed"), // Successfully sent
      v.literal("failed") // Permanently failed (max retries)
    ),
    lastAttemptAt: v.optional(v.number()), // Last processing attempt
    nextRetryAt: v.optional(v.number()), // Next retry time
    errorMessage: v.optional(v.string()), // Latest error
  })
    .index("by_status", ["status"])
    .index("by_scheduled", ["scheduledFor"])
    .index("by_message", ["messageId"])
    .index("by_status_and_scheduled", ["status", "scheduledFor"]),

  // WhatsApp Customer Consent
  whatsappConsent: defineTable({
    userId: v.optional(v.id("users")), // User ID if authenticated
    phoneNumber: v.string(), // Phone number
    consentType: v.union(
      v.literal("all"), // All messages
      v.literal("transactional_only"), // Only transactional
      v.literal("none") // Opted out
    ),
    consentedAt: v.number(), // When consent was given/updated
    ipAddress: v.optional(v.string()), // IP address for audit
  })
    .index("by_user", ["userId"])
    .index("by_phone", ["phoneNumber"]),

  // WhatsApp Provider Webhooks (for audit and debugging)
  whatsappWebhooks: defineTable({
    eventType: v.string(), // Event type (e.g., "delivered", "read", "failed")
    phoneNumber: v.optional(v.string()), // Recipient phone number
    providerMessageId: v.optional(v.string()), // Message ID from provider
    status: v.optional(v.string()), // Delivery status
    rawPayload: v.string(), // Raw JSON payload from webhook
    processedAt: v.number(), // When webhook was received
    errorMessage: v.optional(v.string()), // Error if processing failed
  })
    .index("by_provider_message_id", ["providerMessageId"])
    .index("by_phone", ["phoneNumber"])
    .index("by_processed_at", ["processedAt"]),

  // WhatsApp Debug Logs (detailed API call logs for debugging)
  whatsappDebugLogs: defineTable({
    messageId: v.id("whatsappMessages"), // Related message
    usecaseKey: v.string(), // Use case that triggered this
    recipientPhone: v.string(), // Phone number (for filtering)
    templateId: v.string(), // Provider template ID used
    // Request details
    requestUrl: v.string(), // Full URL (with authkey masked)
    requestParams: v.string(), // JSON string of all params sent
    requestVariables: v.optional(v.string()), // JSON string of variables
    // Response details
    responseStatus: v.number(), // HTTP status code
    responseBody: v.string(), // Full response body
    responseHeaders: v.optional(v.string()), // Response headers
    // Parsed error information
    success: v.boolean(), // Whether the API call succeeded
    errorType: v.optional(v.string()), // Parsed error type (invalid_authkey, template_not_found, etc.)
    errorMessage: v.optional(v.string()), // Human-readable error message
    suggestedFix: v.optional(v.string()), // Suggested fix for the error
    // Metadata
    createdAt: v.number(), // When this log was created
  })
    .index("by_message", ["messageId"])
    .index("by_usecase", ["usecaseKey"])
    .index("by_success", ["success"])
    .index("by_created_at", ["createdAt"])
    .index("by_error_type", ["errorType"]),

  // COD OTP Verification
  codOtps: defineTable({
    phoneNumber: v.string(), // Phone number to verify
    otp: v.string(), // 6-digit OTP
    orderId: v.optional(v.string()), // Temporary order ID (before creation)
    verified: v.boolean(), // Whether OTP was successfully verified
    attempts: v.number(), // Verification attempts made
    expiresAt: v.number(), // Expiry timestamp (10 minutes from generation)
    createdAt: v.number(), // When OTP was generated
    verifiedAt: v.optional(v.number()), // When OTP was verified
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_expires_at", ["expiresAt"]),

  // Login OTP Verification
  loginOtps: defineTable({
    phoneNumber: v.string(), // Phone number for login
    otp: v.string(), // 6-digit OTP
    verified: v.boolean(), // Whether OTP was successfully verified
    attempts: v.number(), // Verification attempts made
    expiresAt: v.number(), // Expiry timestamp (10 minutes from generation)
    createdAt: v.number(), // When OTP was generated
    verifiedAt: v.optional(v.number()), // When OTP was verified
    userId: v.optional(v.id("users")), // User ID if authenticated after verification
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_expires_at", ["expiresAt"]),

  // Wallet Transactions (audit trail for all wallet activity)
  walletTransactions: defineTable({
    userId: v.id("users"), // User whose wallet changed
    transactionType: v.union(
      v.literal("credit"), // Money added
      v.literal("debit") // Money deducted
    ),
    amount: v.number(), // Transaction amount
    source: v.union(
      v.literal("refund"), // Order refund/cancellation
      v.literal("admin_credit"), // Manual credit by admin
      v.literal("coupon_credit"), // Coupon redemption
      v.literal("referral_reward"), // Referral reward
      v.literal("cashback"), // Order cashback
      v.literal("order_payment") // Used to pay for order
    ),
    balanceBefore: v.number(), // Balance before transaction
    balanceAfter: v.number(), // Balance after transaction
    description: v.string(), // Human-readable description
    relatedOrderId: v.optional(v.id("orders")), // Related order if applicable
    relatedCouponId: v.optional(v.id("coupons")), // Related coupon if applicable
    adminEmail: v.optional(v.string()), // Admin who made change (for admin_credit)
    createdAt: v.number(), // Transaction timestamp
  })
    .index("by_user", ["userId"])
    .index("by_created_at", ["createdAt"])
    .index("by_user_and_created", ["userId", "createdAt"])
    .index("by_source", ["source"]),

  // Wallet Settings (admin-configurable)
  walletSettings: defineTable({
    // Maximum wallet usage per order
    maxUsageType: v.union(
      v.literal("percentage"), // Percentage of order total
      v.literal("fixed"), // Fixed amount
      v.literal("unlimited") // No limit
    ),
    maxUsageValue: v.number(), // Value (e.g., 50 for 50%, or 500 for ₹500)
    // Referral reward settings
    referralRewardAmount: v.number(), // Amount credited to referrer when referee completes first order
    referralMinOrderValue: v.number(), // Minimum order value for referral to count
    // General settings
    walletEnabled: v.boolean(), // Master toggle for wallet feature
    updatedBy: v.optional(v.string()), // Admin email who last updated
    updatedAt: v.optional(v.number()), // Last update timestamp
  }),

  // Cashback Rules (Skinly Coins rewards system - variant/product/collection level)
  cashbackRules: defineTable({
    targetType: v.union(
      v.literal("variant"), // Specific variant
      v.literal("product"), // All variants of a product
      v.literal("collection") // All products in a collection
    ),
    targetId: v.string(), // ID of variant, product, or collection
    cashbackType: v.union(
      v.literal("fixed"), // Fixed amount (e.g., ₹50)
      v.literal("percentage") // Percentage of final price (e.g., 5%)
    ),
    cashbackValue: v.number(), // Value (e.g., 50 for ₹50, or 5 for 5%)
    isActive: v.boolean(), // Whether this rule is currently active
    createdAt: v.number(), // When rule was created
    updatedAt: v.optional(v.number()), // Last update timestamp
    createdBy: v.optional(v.string()), // Admin email who created
    updatedBy: v.optional(v.string()), // Admin email who last updated
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_target_and_active", ["targetType", "targetId", "isActive"])
    .index("by_active", ["isActive"]),

  // Email Templates (admin-managed custom HTML templates)
  emailTemplates: defineTable({
    templateType: v.union(
      v.literal("order_confirmed"),
      v.literal("order_dispatched"),
      v.literal("order_delivered"),
      v.literal("order_cancelled"),
      v.literal("payment_failed")
    ),
    templateName: v.string(), // Display name for UI
    subject: v.string(), // Email subject line
    htmlContent: v.string(), // Full HTML template with variable placeholders
    isActive: v.boolean(), // Whether this template is currently active
    variables: v.array(v.string()), // List of available variables (e.g., ["customer_name", "order_id"])
    createdBy: v.string(), // Admin email who created
    createdAt: v.number(), // Creation timestamp
    updatedAt: v.optional(v.number()), // Last update timestamp
    lastActivatedAt: v.optional(v.number()), // When it was last activated
  })
    .index("by_type", ["templateType"])
    .index("by_type_and_active", ["templateType", "isActive"])
    .index("by_active", ["isActive"]),

  // Bug Reports (user-submitted bugs)
  bugReports: defineTable({
    bugId: v.string(), // Human-readable ID (e.g., "BUG-001")
    userEmail: v.string(), // Reporter's email
    userPhone: v.string(), // Reporter's phone number
    bugDetails: v.string(), // Bug description (min 20 chars)
    status: v.union(
      v.literal("pending"), // New bug, not addressed
      v.literal("resolved"), // Bug fixed
      v.literal("deleted") // Soft deleted
    ),
    userId: v.optional(v.id("users")), // User ID if authenticated
    attachmentCount: v.number(), // Number of attached files
    ipAddress: v.optional(v.string()), // IP address for audit trail
    updatedAt: v.optional(v.number()), // Last update timestamp
  })
    .index("by_status", ["status"])
    .index("by_bug_id", ["bugId"])
    .index("by_user", ["userId"])
    .index("by_email", ["userEmail"]),

  // Bug Attachments (files uploaded with bug reports)
  bugAttachments: defineTable({
    bugReportId: v.id("bugReports"), // Link to bug report
    fileId: v.id("_storage"), // Convex storage ID
    fileName: v.string(), // Original file name
    fileSize: v.number(), // File size in bytes
    fileType: v.string(), // MIME type (e.g., "image/jpeg", "video/mp4")
  })
    .index("by_bug_report", ["bugReportId"]),
});
