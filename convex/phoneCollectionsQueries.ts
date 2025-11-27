import { query } from "./_generated/server";

// Get all phone collections
export const getPhoneCollections = query({
  args: {},
  handler: async (ctx) => {
    const collections = await ctx.db
      .query("collections")
      .filter((q) => q.eq(q.field("category"), "phone"))
      .collect();
    return collections;
  },
});

// Get collection with product count
export const getPhoneCollectionsWithCounts = query({
  args: {},
  handler: async (ctx) => {
    // Get all collections and filter for phone category  
    const allCollections = await ctx.db.query("collections").take(100); // Limit to first 100
    console.log(`Found ${allCollections.length} total collections`);
    
    const phoneCollections = allCollections.filter(c => c.category === "phone");
    console.log(`Found ${phoneCollections.length} phone collections`);
    
    const collectionsWithCounts = [];
    
    for (const collection of phoneCollections) {
      const productLinks = await ctx.db
        .query("collectionProducts")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .take(1000); // Limit product links
      
      collectionsWithCounts.push({
        _id: collection._id,
        name: collection.name,
        slug: collection.slug,
        category: collection.category,
        deviceType: collection.deviceType,
        keywords: collection.keywords || [],
        productCount: productLinks.length,
      });
    }
    
    console.log(`Returning ${collectionsWithCounts.length} collections with counts`);
    return collectionsWithCounts;
  },
});
