import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all cards for a specific section (active only, sorted by order)
 */
export const getActiveSectionCards = query({
  args: { sectionId: v.id("homepageSections") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("homepageSectionCards")
      .withIndex("by_section_active_and_order", (q) =>
        q.eq("sectionId", args.sectionId).eq("isActive", true)
      )
      .collect();
    
    return cards.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all cards for a specific section (for admin, includes inactive)
 */
export const getAllSectionCards = query({
  args: { sectionId: v.id("homepageSections") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("homepageSectionCards")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();
    
    return cards.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all brands from supported models (for auto-generation)
 */
export const getAllBrandsForHomepage = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("supportedModels").collect();
    
    // Get unique brand names
    const brandSet = new Set<string>();
    models.forEach((model) => {
      if (model.brandName) {
        brandSet.add(model.brandName);
      }
    });
    
    // Return sorted array
    return Array.from(brandSet).sort();
  },
});

/**
 * Get all gadget types from gadgetTypes table (for auto-generation)
 */
export const getAllGadgetTypesForHomepage = query({
  args: {},
  handler: async (ctx) => {
    // Get all gadget types
    const gadgetTypes = await ctx.db
      .query("gadgetTypes")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Return sorted array of display names
    return gadgetTypes
      .map((gt) => gt.displayName)
      .sort();
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a section card
 */
export const createSectionCard = mutation({
  args: {
    sectionId: v.id("homepageSections"),
    cardType: v.union(v.literal("brand"), v.literal("gadget")),
    imageUrl: v.string(),
    title: v.string(),
    subtitle: v.optional(v.string()),
    linkUrl: v.string(),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    return await ctx.db.insert("homepageSectionCards", {
      ...args,
      createdBy: identity.email,
      createdAt: now,
    });
  },
});

/**
 * Update a section card
 */
export const updateSectionCard = mutation({
  args: {
    cardId: v.id("homepageSectionCards"),
    imageUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const { cardId, ...updates } = args;
    const now = Date.now();
    
    await ctx.db.patch(cardId, {
      ...updates,
      updatedBy: identity.email,
      updatedAt: now,
    });
    
    return cardId;
  },
});

/**
 * Delete a section card
 */
export const deleteSectionCard = mutation({
  args: { cardId: v.id("homepageSectionCards") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.cardId);
    return { success: true };
  },
});

/**
 * Bulk generate brand cards for a section
 */
export const bulkGenerateBrandCards = mutation({
  args: {
    sectionId: v.id("homepageSections"),
    brands: v.array(v.object({
      brandName: v.string(),
      imageUrl: v.string(),
      linkUrl: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete existing brand cards for this section
    const existingCards = await ctx.db
      .query("homepageSectionCards")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .filter((q) => q.eq(q.field("cardType"), "brand"))
      .collect();
    
    for (const card of existingCards) {
      await ctx.db.delete(card._id);
    }

    // Create new brand cards
    const now = Date.now();
    const results: Id<"homepageSectionCards">[] = [];
    
    for (let i = 0; i < args.brands.length; i++) {
      const brand = args.brands[i];
      const cardId = await ctx.db.insert("homepageSectionCards", {
        sectionId: args.sectionId,
        cardType: "brand",
        imageUrl: brand.imageUrl,
        title: brand.brandName,
        linkUrl: brand.linkUrl,
        isActive: true,
        order: i + 1,
        createdBy: identity.email,
        createdAt: now,
      });
      results.push(cardId);
    }
    
    return { success: true, count: results.length };
  },
});

/**
 * Bulk generate gadget cards for a section
 */
export const bulkGenerateGadgetCards = mutation({
  args: {
    sectionId: v.id("homepageSections"),
    gadgets: v.array(v.object({
      gadgetType: v.string(),
      imageUrl: v.string(),
      linkUrl: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete existing gadget cards for this section
    const existingCards = await ctx.db
      .query("homepageSectionCards")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .filter((q) => q.eq(q.field("cardType"), "gadget"))
      .collect();
    
    for (const card of existingCards) {
      await ctx.db.delete(card._id);
    }

    // Create new gadget cards
    const now = Date.now();
    const results: Id<"homepageSectionCards">[] = [];
    
    for (let i = 0; i < args.gadgets.length; i++) {
      const gadget = args.gadgets[i];
      const cardId = await ctx.db.insert("homepageSectionCards", {
        sectionId: args.sectionId,
        cardType: "gadget",
        imageUrl: gadget.imageUrl,
        title: gadget.gadgetType,
        linkUrl: gadget.linkUrl,
        isActive: true,
        order: i + 1,
        createdBy: identity.email,
        createdAt: now,
      });
      results.push(cardId);
    }
    
    return { success: true, count: results.length };
  },
});

/**
 * Bulk reorder section cards
 */
export const bulkReorderSectionCards = mutation({
  args: {
    cardOrders: v.array(v.object({
      cardId: v.id("homepageSectionCards"),
      order: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    
    for (const item of args.cardOrders) {
      await ctx.db.patch(item.cardId, {
        order: item.order,
        updatedBy: identity.email,
        updatedAt: now,
      });
    }
    
    return { success: true, count: args.cardOrders.length };
  },
});
