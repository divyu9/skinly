import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all templates
export const getTemplates = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.query("seoPageTemplates").collect();
  },
});

// Get template by page type
export const getTemplateByType = query({
  args: {
    pageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
  },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("seoPageTemplates")
      .filter((q) => q.eq(q.field("pageType"), args.pageType))
      .collect();

    return templates.length > 0 ? templates[0] : null;
  },
});

// Update template
export const updateTemplate = mutation({
  args: {
    pageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    layoutConfig: v.optional(
      v.object({
        sections: v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            enabled: v.boolean(),
            order: v.number(),
          })
        ),
      })
    ),
    defaultFilters: v.optional(
      v.object({
        autoCategorize: v.optional(v.boolean()),
        filterByBrand: v.optional(v.boolean()),
        filterByDevice: v.optional(v.boolean()),
        filterByProduct: v.optional(v.boolean()),
        filterByDesign: v.optional(v.boolean()),
        showModelSelector: v.optional(v.boolean()),
      })
    ),
    contentStructure: v.optional(
      v.object({
        h1Pattern: v.string(),
        introLength: v.string(),
        includeSections: v.array(v.string()),
        keywordsToInclude: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Check if template exists
    const existing = await ctx.db
      .query("seoPageTemplates")
      .filter((q) => q.eq(q.field("pageType"), args.pageType))
      .collect();

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: identity.email,
    };

    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.description !== undefined) updates.description = args.description;
    if (args.layoutConfig !== undefined)
      updates.layoutConfig = args.layoutConfig;
    if (args.defaultFilters !== undefined)
      updates.defaultFilters = args.defaultFilters;
    if (args.contentStructure !== undefined)
      updates.contentStructure = args.contentStructure;

    if (existing.length > 0) {
      // Update existing
      await ctx.db.patch(existing[0]._id, updates);
      return { templateId: existing[0]._id, isNew: false };
    } else {
      // Create new template
      const templateId = await ctx.db.insert("seoPageTemplates", {
        pageType: args.pageType,
        displayName: args.displayName || args.pageType,
        description: args.description,
        layoutConfig: args.layoutConfig || {
          sections: [],
        },
        defaultFilters: args.defaultFilters || {},
        contentStructure: args.contentStructure || {
          h1Pattern: "",
          introLength: "2-3 paragraphs",
          includeSections: [],
          keywordsToInclude: [],
        },
        updatedAt: Date.now(),
        updatedBy: identity.email,
      });

      return { templateId, isNew: true };
    }
  },
});

// Initialize default templates
export const initializeDefaultTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.query("seoPageTemplates").collect();
    if (existing.length > 0) {
      return { message: "Templates already initialized", count: existing.length };
    }

    // Brand template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "brand",
      displayName: "Brand Pages",
      description: "Landing pages for each brand (Samsung, Apple, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Hero Banner", enabled: true, order: 1 },
          { id: "intro", label: "Brand Introduction", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "story", label: "Brand Story", enabled: true, order: 4 },
          { id: "comparison", label: "Comparison", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
        ],
      },
      defaultFilters: {
        autoCategorize: true,
        filterByBrand: true,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Brand} Skins - Premium Protection for All Devices",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "compatibility"],
        keywordsToInclude: ["premium", "protection", "durability", "quality"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Device template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "device",
      displayName: "Device Pages",
      description: "Landing pages for device categories (Mobile, Tablet, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Device Hero", enabled: true, order: 1 },
          { id: "showcase", label: "Device Showcase", enabled: true, order: 2 },
          { id: "selector", label: "Model Selector", enabled: true, order: 3 },
          { id: "products", label: "Product Grid", enabled: true, order: 4 },
          { id: "comparison", label: "Comparison", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: true,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: true,
      },
      contentStructure: {
        h1Pattern: "{Device} Skins - Perfect Fit for All {Device} Models",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "installation", "models"],
        keywordsToInclude: ["perfect fit", "precise cut", "easy application"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Product template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "product",
      displayName: "Product Pages",
      description: "Landing pages for product types (Skins, Cases, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Product Hero", enabled: true, order: 1 },
          { id: "features", label: "Feature Highlights", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "comparison", label: "Comparison", enabled: true, order: 4 },
          { id: "faqs", label: "FAQs", enabled: true, order: 5 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: true,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Product} - Premium Quality at Best Prices",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "quality", "installation"],
        keywordsToInclude: ["premium", "quality", "affordable", "best price"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Skin Type template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "skin-type",
      displayName: "Skin Type Pages",
      description: "Landing pages for skin designs (Anime, Carbon Fiber, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Skin Type Hero", enabled: true, order: 1 },
          { id: "benefits", label: "Benefits", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "guide", label: "Installation Guide", enabled: true, order: 4 },
          { id: "faqs", label: "FAQs", enabled: true, order: 5 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: true,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{DesignType} Skins - Unique Designs for Your Device",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "style", "installation"],
        keywordsToInclude: ["unique", "design", "style", "personalization"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Keyword template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "keyword",
      displayName: "Keyword Pages",
      description: "SEO landing pages for specific keywords",
      layoutConfig: {
        sections: [
          { id: "hero", label: "SEO Hero", enabled: true, order: 1 },
          { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
          { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
          { id: "content", label: "SEO Content", enabled: true, order: 4 },
          { id: "products", label: "Wide Product Grid", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
          { id: "cta", label: "Call to Action", enabled: true, order: 7 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Keyword} - Best Quality at GoSkinly",
        introLength: "3-4 paragraphs",
        includeSections: [
          "benefits",
          "features",
          "comparison",
          "why-goskinly",
          "installation",
        ],
        keywordsToInclude: ["best", "premium", "quality", "goskinly", "noida"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { message: "Default templates initialized", count: 5 };
  },
});

// Re-initialize templates (deletes existing and creates fresh defaults)
export const reinitializeTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Delete all existing templates
    const existing = await ctx.db.query("seoPageTemplates").collect();
    for (const template of existing) {
      await ctx.db.delete(template._id);
    }

    // Re-run initialization
    // Brand template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "brand",
      displayName: "Brand Pages",
      description: "Landing pages for each brand (Samsung, Apple, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Hero Banner", enabled: true, order: 1 },
          { id: "intro", label: "Brand Introduction", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "story", label: "Brand Story", enabled: true, order: 4 },
          { id: "comparison", label: "Comparison", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
        ],
      },
      defaultFilters: {
        autoCategorize: true,
        filterByBrand: true,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Brand} Skins - Premium Protection for All Devices",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "compatibility"],
        keywordsToInclude: ["premium", "protection", "durability", "quality"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Device template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "device",
      displayName: "Device Pages",
      description: "Landing pages for device categories (Mobile, Tablet, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Device Hero", enabled: true, order: 1 },
          { id: "showcase", label: "Device Showcase", enabled: true, order: 2 },
          { id: "selector", label: "Model Selector", enabled: true, order: 3 },
          { id: "products", label: "Product Grid", enabled: true, order: 4 },
          { id: "comparison", label: "Comparison", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: true,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: true,
      },
      contentStructure: {
        h1Pattern: "{Device} Skins - Perfect Fit for All {Device} Models",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "installation", "models"],
        keywordsToInclude: ["perfect fit", "precise cut", "easy application"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Product template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "product",
      displayName: "Product Pages",
      description: "Landing pages for product types (Skins, Cases, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Product Hero", enabled: true, order: 1 },
          { id: "features", label: "Feature Highlights", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "comparison", label: "Comparison", enabled: true, order: 4 },
          { id: "faqs", label: "FAQs", enabled: true, order: 5 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: true,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Product} - Premium Quality at Best Prices",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "quality", "installation"],
        keywordsToInclude: ["premium", "quality", "affordable", "best price"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Skin Type template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "skin-type",
      displayName: "Skin Type Pages",
      description: "Landing pages for skin designs (Anime, Carbon Fiber, etc.)",
      layoutConfig: {
        sections: [
          { id: "hero", label: "Skin Type Hero", enabled: true, order: 1 },
          { id: "benefits", label: "Benefits", enabled: true, order: 2 },
          { id: "products", label: "Product Grid", enabled: true, order: 3 },
          { id: "guide", label: "Installation Guide", enabled: true, order: 4 },
          { id: "faqs", label: "FAQs", enabled: true, order: 5 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: true,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{DesignType} Skins - Unique Designs for Your Device",
        introLength: "2-3 paragraphs",
        includeSections: ["benefits", "features", "style", "installation"],
        keywordsToInclude: ["unique", "design", "style", "personalization"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    // Keyword template
    await ctx.db.insert("seoPageTemplates", {
      pageType: "keyword",
      displayName: "Keyword Pages",
      description: "SEO landing pages for specific keywords",
      layoutConfig: {
        sections: [
          { id: "hero", label: "SEO Hero", enabled: true, order: 1 },
          { id: "gadget-selector", label: "Gadget Selector", enabled: true, order: 2 },
          { id: "phone-brand-selector", label: "Phone Brand Selector", enabled: true, order: 3 },
          { id: "content", label: "SEO Content", enabled: true, order: 4 },
          { id: "products", label: "Wide Product Grid", enabled: true, order: 5 },
          { id: "faqs", label: "FAQs", enabled: true, order: 6 },
          { id: "cta", label: "Call to Action", enabled: true, order: 7 },
        ],
      },
      defaultFilters: {
        autoCategorize: false,
        filterByBrand: false,
        filterByDevice: false,
        filterByProduct: false,
        filterByDesign: false,
        showModelSelector: false,
      },
      contentStructure: {
        h1Pattern: "{Keyword} - Best Quality at GoSkinly",
        introLength: "3-4 paragraphs",
        includeSections: [
          "benefits",
          "features",
          "comparison",
          "why-goskinly",
          "installation",
        ],
        keywordsToInclude: ["best", "premium", "quality", "goskinly", "noida"],
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { 
      message: "Templates re-initialized successfully", 
      deleted: existing.length, 
      created: 5 
    };
  },
});
