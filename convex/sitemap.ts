import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Escape special XML characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate sitemap entries for all public pages
 * Returns array of URLs with priority and change frequency
 */
export const getSitemapUrls = query({
  args: {},
  handler: async (ctx) => {
    const baseUrl = "https://goskinly.com";
    
    const urls: Array<{
      url: string;
      lastmod: string;
      changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
      priority: number;
    }> = [];

    // Static pages
    const staticPages = [
      { path: "/", priority: 1.0, changefreq: "daily" as const },
      { path: "/products", priority: 0.9, changefreq: "daily" as const },
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

    // Get all active products
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    
    products.forEach((product) => {
      urls.push({
        url: escapeXml(`${baseUrl}/products/${product.slug}`),
        lastmod: new Date(product._creationTime).toISOString(),
        changefreq: "weekly",
        priority: 0.8,
      });
    });

    // Get all collections
    const collections = await ctx.db.query("collections").collect();
    
    collections.forEach((collection) => {
      urls.push({
        url: escapeXml(`${baseUrl}/shop?collection=${collection.slug}`),
        lastmod: new Date(collection._creationTime).toISOString(),
        changefreq: "daily",
        priority: 0.7,
      });
    });

    // Get all published SEO pages
    const seoPages = await ctx.db
      .query("seoPages")
      .filter((q) => q.eq(q.field("isPublished"), true))
      .collect();

    seoPages.forEach((page) => {
      // All SEO pages use root-level URLs
      urls.push({
        url: escapeXml(`${baseUrl}/${page.slug}`),
        lastmod: new Date(page.updatedAt || page.createdAt).toISOString(),
        changefreq: "weekly",
        priority: 0.85, // High priority for SEO landing pages
      });
    });

    return urls;
  },
});
