import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

// Helper to generate SEO-friendly slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-"); // Replace multiple hyphens with single
}

// Helper to check if slug exists
async function isSlugUnique(
  allPages: Doc<"seoPages">[],
  slug: string,
  excludeId?: Id<"seoPages">
): Promise<boolean> {
  return !allPages.some(
    (p) => p.slug === slug && (!excludeId || p._id !== excludeId)
  );
}

// Helper to generate unique slug
async function generateUniqueSlug(
  allPages: Doc<"seoPages">[],
  baseSlug: string,
  excludeId?: Id<"seoPages">
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (!await isSlugUnique(allPages, slug, excludeId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// List all SEO pages with optional filters
export const listPages = query({
  args: {
    pageType: v.optional(
      v.union(
        v.literal("brand"),
        v.literal("device"),
        v.literal("product"),
        v.literal("skin-type"),
        v.literal("keyword")
      )
    ),
    isPublished: v.optional(v.boolean()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    let pages = await ctx.db.query("seoPages").collect();

    // Filter by page type
    if (args.pageType) {
      pages = pages.filter((p) => p.pageType === args.pageType);
    }

    // Filter by published status
    if (args.isPublished !== undefined) {
      pages = pages.filter((p) => p.isPublished === args.isPublished);
    }

    // Search filter
    if (args.searchQuery) {
      const query = args.searchQuery.toLowerCase();
      pages = pages.filter(
        (p) =>
          p.metaTitle.toLowerCase().includes(query) ||
          p.slug.toLowerCase().includes(query) ||
          p.h1Heading.toLowerCase().includes(query)
      );
    }

    // Sort by creation date (newest first)
    pages.sort((a, b) => b.createdAt - a.createdAt);

    return pages;
  },
});

// Get single page by slug (public - for frontend)
export const getPageBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("seoPages")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .collect();

    if (pages.length === 0) {
      return null;
    }

    return pages[0];
  },
});

// Get single page by ID (admin)
export const getPageById = query({
  args: { pageId: v.id("seoPages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.get(args.pageId);
  },
});

// Alias for getPageById (used by edit page)
export const getPage = query({
  args: { pageId: v.id("seoPages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.db.get(args.pageId);
  },
});

// Get all published pages (for sitemap)
export const getAllPublishedPages = query({
  args: {},
  handler: async (ctx) => {
    const pages = await ctx.db
      .query("seoPages")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    return pages.map((p) => ({
      slug: p.slug,
      pageType: p.pageType,
      updatedAt: p.updatedAt || p.createdAt,
    }));
  },
});

// Create new SEO page
export const createPage = mutation({
  args: {
    pageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
    metaTitle: v.string(),
    metaDescription: v.string(),
    slug: v.string(),
    canonicalUrl: v.optional(v.string()),
    h1Heading: v.string(),
    contentHTML: v.string(),
    faqs: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      })
    ),
    keywords: v.array(v.string()),
    imageAltTexts: v.array(v.string()),
    filterConfig: v.object({
      brandName: v.optional(v.string()),
      gadgetCategory: v.optional(v.string()),
      productType: v.optional(v.string()),
      designType: v.optional(v.string()),
      autoCategorize: v.optional(v.boolean()),
      showModelSelector: v.optional(v.boolean()),
    }),
    layoutOverrides: v.optional(
      v.object({
        sections: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
              enabled: v.boolean(),
              order: v.number(),
            })
          )
        ),
      })
    ),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Generate unique slug
    const baseSlug = generateSlug(args.slug);
    const allPages = await ctx.db.query("seoPages").collect();
    const uniqueSlug = await generateUniqueSlug(allPages, baseSlug);

    const pageId = await ctx.db.insert("seoPages", {
      pageType: args.pageType,
      metaTitle: args.metaTitle.slice(0, 70), // Enforce 70 char limit
      metaDescription: args.metaDescription.slice(0, 160), // Enforce 160 char limit
      slug: uniqueSlug,
      canonicalUrl: args.canonicalUrl,
      h1Heading: args.h1Heading,
      contentHTML: args.contentHTML,
      faqs: args.faqs,
      keywords: args.keywords,
      imageAltTexts: args.imageAltTexts,
      filterConfig: args.filterConfig,
      layoutOverrides: args.layoutOverrides,
      isPublished: args.isPublished,
      publishedAt: args.isPublished ? Date.now() : undefined,
      createdAt: Date.now(),
      createdBy: identity.email,
    });

    return { pageId, slug: uniqueSlug };
  },
});

// Update existing SEO page
export const updatePage = mutation({
  args: {
    pageId: v.id("seoPages"),
    pageType: v.optional(
      v.union(
        v.literal("brand"),
        v.literal("device"),
        v.literal("product"),
        v.literal("skin-type"),
        v.literal("keyword")
      )
    ),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    slug: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    h1Heading: v.optional(v.string()),
    contentHTML: v.optional(v.string()),
    faqs: v.optional(
      v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
        })
      )
    ),
    keywords: v.optional(v.array(v.string())),
    imageAltTexts: v.optional(v.array(v.string())),
    filterConfig: v.optional(
      v.object({
        brandName: v.optional(v.string()),
        gadgetCategory: v.optional(v.string()),
        productType: v.optional(v.string()),
        designType: v.optional(v.string()),
        autoCategorize: v.optional(v.boolean()),
        showModelSelector: v.optional(v.boolean()),
      })
    ),
    layoutOverrides: v.optional(
      v.object({
        sections: v.optional(
          v.array(
            v.object({
              id: v.string(),
              label: v.string(),
              enabled: v.boolean(),
              order: v.number(),
            })
          )
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db.get(args.pageId);
    if (!existing) {
      throw new Error("Page not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: identity.email,
    };

    if (args.pageType !== undefined) updates.pageType = args.pageType;
    if (args.metaTitle !== undefined)
      updates.metaTitle = args.metaTitle.slice(0, 70);
    if (args.metaDescription !== undefined)
      updates.metaDescription = args.metaDescription.slice(0, 160);
    if (args.h1Heading !== undefined) updates.h1Heading = args.h1Heading;
    if (args.contentHTML !== undefined) updates.contentHTML = args.contentHTML;
    if (args.canonicalUrl !== undefined)
      updates.canonicalUrl = args.canonicalUrl;
    if (args.faqs !== undefined) updates.faqs = args.faqs;
    if (args.keywords !== undefined) updates.keywords = args.keywords;
    if (args.imageAltTexts !== undefined)
      updates.imageAltTexts = args.imageAltTexts;
    if (args.filterConfig !== undefined)
      updates.filterConfig = args.filterConfig;
    if (args.layoutOverrides !== undefined)
      updates.layoutOverrides = args.layoutOverrides;

    // Handle slug change
    if (args.slug !== undefined && args.slug !== existing.slug) {
      const baseSlug = generateSlug(args.slug);
      const allPages = await ctx.db.query("seoPages").collect();
      const uniqueSlug = await generateUniqueSlug(allPages, baseSlug, args.pageId);
      updates.slug = uniqueSlug;
    }

    await ctx.db.patch(args.pageId, updates);

    return { success: true };
  },
});

// Delete SEO page
export const deletePage = mutation({
  args: { pageId: v.id("seoPages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.pageId);
    return { success: true };
  },
});

// Clone SEO page
export const clonePage = mutation({
  args: { pageId: v.id("seoPages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const original = await ctx.db.get(args.pageId);
    if (!original) {
      throw new Error("Page not found");
    }

    // Generate unique slug for clone
    const baseSlug = `${original.slug}-copy`;
    const allPages = await ctx.db.query("seoPages").collect();
    const uniqueSlug = await generateUniqueSlug(allPages, baseSlug);

    const newPageId = await ctx.db.insert("seoPages", {
      ...original,
      slug: uniqueSlug,
      metaTitle: `${original.metaTitle} (Copy)`.slice(0, 70),
      isPublished: false, // Clones start as draft
      publishedAt: undefined,
      createdAt: Date.now(),
      createdBy: identity.email,
      updatedAt: undefined,
      updatedBy: undefined,
    });

    return { pageId: newPageId, slug: uniqueSlug };
  },
});

// Publish/unpublish page
export const togglePublish = mutation({
  args: {
    pageId: v.id("seoPages"),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.pageId, {
      isPublished: args.isPublished,
      publishedAt: args.isPublished ? Date.now() : undefined,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { success: true };
  },
});

// Bulk publish/unpublish pages
export const bulkTogglePublish = mutation({
  args: {
    pageIds: v.array(v.id("seoPages")),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    for (const pageId of args.pageIds) {
      await ctx.db.patch(pageId, {
        isPublished: args.isPublished,
        publishedAt: args.isPublished ? Date.now() : undefined,
        updatedAt: Date.now(),
        updatedBy: identity.email,
      });
    }

    return { success: true, count: args.pageIds.length };
  },
});

// Bulk delete pages
export const bulkDeletePages = mutation({
  args: { pageIds: v.array(v.id("seoPages")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    for (const pageId of args.pageIds) {
      await ctx.db.delete(pageId);
    }

    return { success: true, count: args.pageIds.length };
  },
});

// Change page type
export const changePageType = mutation({
  args: {
    pageId: v.id("seoPages"),
    newPageType: v.union(
      v.literal("brand"),
      v.literal("device"),
      v.literal("product"),
      v.literal("skin-type"),
      v.literal("keyword")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.pageId, {
      pageType: args.newPageType,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { success: true };
  },
});

// Update hero image
export const updateHeroImage = mutation({
  args: {
    pageId: v.id("seoPages"),
    heroImageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const page = await ctx.db.get(args.pageId);
    if (!page) {
      throw new Error("Page not found");
    }

    await ctx.db.patch(args.pageId, {
      heroImageUrl: args.heroImageUrl,
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { success: true };
  },
});

// Sync a single page with its template
export const syncPageWithTemplate = mutation({
  args: {
    pageId: v.id("seoPages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const page = await ctx.db.get(args.pageId);
    if (!page) {
      throw new Error("Page not found");
    }

    // Get the template for this page type
    const templates = await ctx.db
      .query("seoPageTemplates")
      .filter((q) => q.eq(q.field("pageType"), page.pageType))
      .collect();

    if (templates.length === 0) {
      throw new Error("Template not found for page type");
    }

    const template = templates[0];
    const templateSections = template.layoutConfig.sections;

    // Merge page overrides with template sections
    // Keep existing page overrides, add new sections from template
    const existingOverrides = page.layoutOverrides?.sections || [];
    const existingSectionIds = new Set(existingOverrides.map(s => s.id));

    // Add template sections that don't exist in page overrides
    const mergedSections = [...existingOverrides];
    
    for (const templateSection of templateSections) {
      if (!existingSectionIds.has(templateSection.id)) {
        mergedSections.push(templateSection);
      }
    }

    // Update the page with merged sections
    await ctx.db.patch(args.pageId, {
      layoutOverrides: {
        sections: mergedSections,
      },
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { 
      success: true, 
      addedSections: mergedSections.length - existingOverrides.length 
    };
  },
});

// Sync all pages with their templates
export const syncAllPagesWithTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pages = await ctx.db.query("seoPages").collect();
    const templates = await ctx.db.query("seoPageTemplates").collect();
    
    // Create a map of templates by page type for quick lookup
    const templateMap = new Map();
    for (const template of templates) {
      templateMap.set(template.pageType, template);
    }

    let syncedCount = 0;
    let totalAddedSections = 0;

    for (const page of pages) {
      const template = templateMap.get(page.pageType);
      if (!template) continue;

      const templateSections = template.layoutConfig.sections;
      const existingOverrides = page.layoutOverrides?.sections || [];
      const existingSectionIds = new Set(existingOverrides.map(s => s.id));

      // Add template sections that don't exist in page overrides
      const mergedSections = [...existingOverrides];
      
      for (const templateSection of templateSections) {
        if (!existingSectionIds.has(templateSection.id)) {
          mergedSections.push(templateSection);
          totalAddedSections++;
        }
      }

      // Only update if there are new sections to add
      if (mergedSections.length > existingOverrides.length) {
        await ctx.db.patch(page._id, {
          layoutOverrides: {
            sections: mergedSections,
          },
          updatedAt: Date.now(),
          updatedBy: identity.email,
        });
        syncedCount++;
      }
    }

    return { 
      success: true, 
      syncedPages: syncedCount,
      totalAddedSections: totalAddedSections,
      totalPages: pages.length
    };
  },
});

// Regenerate content for a page (to fix poor quality content)
export const regeneratePageContent = mutation({
  args: {
    pageId: v.id("seoPages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const page = await ctx.db.get(args.pageId);
    if (!page) {
      throw new Error("Page not found");
    }

    // Extract the value from the page's heading or slug
    // This will be used as the input for regeneration
    const value = page.h1Heading
      .replace(/Skins for |Phone Skins for |Skins & Wraps|Device Skins|Skins/gi, "")
      .trim();

    // Mark page for regeneration
    // The actual regeneration will be done by the frontend calling the AI action
    await ctx.db.patch(args.pageId, {
      updatedAt: Date.now(),
      updatedBy: identity.email,
    });

    return { 
      success: true,
      pageType: page.pageType,
      value: value
    };
  },
});
