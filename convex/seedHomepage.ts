import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Seed homepage with initial data
 * Run this once to set up the homepage
 */
export const seedHomepage = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Create homepage settings
    const existingSettings = await ctx.db.query("homepageSettings").first();
    if (!existingSettings) {
      await ctx.db.insert("homepageSettings", {
        logoImageUrl: "https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv",
        logoRedirectLink: "/",
        showSearchIcon: true,
        marqueeEnabled: true,
        marqueeMaxModels: 20,
        announcementEnabled: true,
        announcementText: "Buy 2 & get 10% OFF →",
        announcementLink: undefined,
        updatedBy: "system",
        updatedAt: Date.now(),
      });
    }

    // 2. Create hero slides (only if none exist)
    const existingSlides = await ctx.db.query("heroSlides").first();
    if (!existingSlides) {
      await ctx.db.insert("heroSlides", {
        imageUrl: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1920&h=1080&fit=crop",
        heading: "Premium Device Skins",
        subheading: "Protect your devices in style",
        ctaText: "Shop Now",
        ctaLink: "/products",
        isActive: true,
        order: 1,
        createdBy: "system",
        createdAt: Date.now(),
      });

      await ctx.db.insert("heroSlides", {
        imageUrl: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1920&h=1080&fit=crop",
        heading: "New Collection",
        subheading: "Discover our latest designs",
        ctaText: "Explore",
        ctaLink: "/products",
        isActive: true,
        order: 2,
        createdBy: "system",
        createdAt: Date.now(),
      });
    }

    // 3. Create category display settings (only if none exist)
    const existingCategories = await ctx.db.query("categoryDisplaySettings").first();
    if (!existingCategories) {
      const categories = [
        { name: "skin", displayName: "Skins", order: 1 },
        { name: "case-cover", displayName: "Cases & Covers", order: 2 },
        { name: "camera-ring", displayName: "Camera Rings", order: 3 },
        { name: "magneto-x", displayName: "Magneto X", order: 4 },
        { name: "glass", displayName: "Glass Protectors", order: 5 },
        { name: "accessory", displayName: "Accessories", order: 6 },
      ];

      for (const category of categories) {
        await ctx.db.insert("categoryDisplaySettings", {
          categoryName: category.name,
          displayName: category.displayName,
          imageUrl: undefined,
          isActive: true,
          order: category.order,
          updatedBy: "system",
          updatedAt: Date.now(),
        });
      }
    }

    // 4. Create homepage sections (only if none exist)
    const existingSections = await ctx.db.query("homepageSections").first();
    if (!existingSections) {
      const now = Date.now();
      const sections = [
        {
          sectionType: "explore_models" as const,
          sectionName: "Explore by Models",
          isActive: true,
          order: 1,
          config: {
            title: "Select Your Device",
            placeholderText: "Search for your device",
            showRequestButton: true,
          },
        },
        {
          sectionType: "category_explorer" as const,
          sectionName: "Category Explorer",
          isActive: true,
          order: 2,
          config: { title: "Shop by Category" },
        },
        {
          sectionType: "most_trendy" as const,
          sectionName: "Most Trendy",
          isActive: true,
          order: 3,
          config: {
            title: "Most Trendy",
            tags: ["trending", "new", "popular"],
          },
        },
        {
          sectionType: "explore_by_brand" as const,
          sectionName: "Explore by Brand",
          isActive: true,
          order: 4,
          config: { title: "Explore by Brand" },
        },
        {
          sectionType: "explore_by_gadget" as const,
          sectionName: "Explore by Gadget",
          isActive: true,
          order: 5,
          config: { title: "Explore by Gadget" },
        },
        {
          sectionType: "top_picks" as const,
          sectionName: "Top Picks",
          isActive: true,
          order: 6,
          config: {
            title: "Our Top Picks",
            tabs: [
              {
                tabName: "Skins",
                sourceType: "collection" as const,
                sourceValue: "all",
              },
            ],
          },
        },
        {
          sectionType: "why_skinly" as const,
          sectionName: "Why Skinly",
          isActive: true,
          order: 7,
          config: {
            title: "Why Choose Skinly",
            items: [
              {
                iconUrl: "https://cdn.hercules.app/file_example",
                title: "Premium Quality",
                description: "3M vinyl material for durability",
              },
            ],
          },
        },
        {
          sectionType: "feature_banner" as const,
          sectionName: "Feature Banner",
          isActive: false,
          order: 8,
          config: {
            backgroundImageUrl: "https://images.unsplash.com/photo-example",
            heading: "Special Offer",
            subheading: "Limited time only",
            ctaText: "Shop Now",
            ctaLink: "/products",
          },
        },
      ];

      for (const section of sections) {
        await ctx.db.insert("homepageSections", {
          sectionType: section.sectionType,
          sectionName: section.sectionName,
          isActive: section.isActive,
          order: section.order,
          config: section.config,
          createdBy: "system",
          createdAt: now,
        });
      }
    }

    return { success: true, message: "Homepage seeded successfully" };
  },
});
