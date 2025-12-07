import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate sitemap entries for all public pages
 * Returns array of URLs with priority and change frequency
 */
export const getSitemapUrls = query({
  args: {},
  handler: async (ctx) => {
    const baseUrl = "https://skinly.onhercules.app";
    
    const urls: Array<{
      url: string;
      lastmod: string;
      changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
      priority: number;
    }> = [];

    // Static pages
    const staticPages = [
      { path: "/", priority: 1.0, changefreq: "daily" as const },
      { path: "/shop", priority: 0.9, changefreq: "daily" as const },
      { path: "/devices", priority: 0.9, changefreq: "weekly" as const },
      { path: "/policies/privacy", priority: 0.3, changefreq: "monthly" as const },
      { path: "/policies/terms", priority: 0.3, changefreq: "monthly" as const },
      { path: "/policies/shipping", priority: 0.4, changefreq: "monthly" as const },
      { path: "/policies/returns", priority: 0.4, changefreq: "monthly" as const },
    ];

    const now = new Date().toISOString();

    staticPages.forEach((page) => {
      urls.push({
        url: `${baseUrl}${page.path}`,
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
      });
    });

    // Get all products
    const products = await ctx.db.query("products").collect();
    
    products.forEach((product) => {
      urls.push({
        url: `${baseUrl}/products/${product._id}`,
        lastmod: new Date(product._creationTime).toISOString(),
        changefreq: "weekly",
        priority: 0.8,
      });
    });

    // Get all collections
    const collections = await ctx.db.query("collections").collect();
    
    collections.forEach((collection) => {
      urls.push({
        url: `${baseUrl}/shop?collection=${collection.slug}`,
        lastmod: new Date(collection._creationTime).toISOString(),
        changefreq: "daily",
        priority: 0.7,
      });
    });

    return urls;
  },
});
