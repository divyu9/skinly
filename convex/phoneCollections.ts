"use node";

import { action, internalAction, internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const PHONE_COLLECTIONS = [
  {
    name: "Anime",
    keywords: ["naruto", "luffy", "gojo", "goku", "anime", "manga", "otaku", "eren", "itachi", "kakashi", "saitama", "vegeta", "sasuke", "zoro", "jujutsu", "demon slayer", "attack on titan", "one piece", "dragon ball"],
  },
  {
    name: "Marvel",
    keywords: ["spiderman", "spider-man", "iron man", "ironman", "thor", "captain america", "hulk", "avengers", "marvel", "deadpool", "venom", "black panther", "doctor strange", "black widow", "hawkeye", "ant-man", "guardians"],
  },
  {
    name: "DC",
    keywords: ["batman", "superman", "wonder woman", "joker", "flash", "aquaman", "dc comics", "dc", "harley quinn", "green lantern", "cyborg", "green arrow", "nightwing", "batgirl"],
  },
  {
    name: "Black Specials",
    keywords: ["black"],
  },
  {
    name: "Abstract",
    keywords: ["abstract", "geometric", "pattern", "minimalist", "modern art", "shapes", "lines", "minimal design"],
  },
  {
    name: "Cars & Bikes",
    keywords: ["car", "ferrari", "lamborghini", "porsche", "bmw", "bike", "motorcycle", "racing", "audi", "mercedes", "mustang", "bugatti", "mclaren", "ducati", "harley", "auto"],
  },
  {
    name: "Nature",
    keywords: ["nature", "mountain", "forest", "ocean", "sunset", "flowers", "landscape", "trees", "river", "lake", "beach", "sky", "clouds", "sunrise", "wildlife"],
  },
  {
    name: "God & Religious",
    keywords: ["god", "shiva", "krishna", "buddha", "ganesh", "religious", "spiritual", "om", "hanuman", "jesus", "allah", "cross", "temple", "mosque", "church", "divine"],
  },
  {
    name: "Gaming",
    keywords: ["gaming", "xbox", "playstation", "controller", "gamer", "pubg", "fortnite", "minecraft", "game", "console", "nintendo", "pc gaming", "esports", "streamer"],
  },
  {
    name: "Quotes & Typography",
    keywords: ["quote", "typography", "text", "motivational", "inspirational", "word", "letter", "font", "saying", "phrase"],
  },
  {
    name: "Minimal",
    keywords: ["minimal", "clean", "simple", "solid color", "plain", "basic", "minimalism"],
  },
  {
    name: "Space & Cosmic",
    keywords: ["space", "galaxy", "cosmic", "planet", "astronaut", "nebula", "stars", "moon", "universe", "astronomy", "cosmos", "milky way", "solar system"],
  },
  {
    name: "Animals",
    keywords: ["animal", "tiger", "lion", "wolf", "eagle", "panda", "cat", "dog", "elephant", "bear", "leopard", "deer", "bird", "snake", "dragon", "phoenix"],
  },
  {
    name: "Music",
    keywords: ["music", "guitar", "piano", "headphones", "notes", "band", "rock", "musical", "instrument", "singer", "song", "melody", "beat", "dj"],
  },
  {
    name: "Sports",
    keywords: ["football", "basketball", "cricket", "sports", "athlete", "fitness", "gym", "soccer", "tennis", "baseball", "hockey", "running", "boxing", "wrestling"],
  },
];

export const createPhoneCollectionsAndAssign = internalAction({
  args: {},
  handler: async (ctx) => {
    const results = {
      collectionsCreated: 0,
      productsAssigned: 0,
      errors: [] as string[],
    };

    try {
      // Get all products
      const products = await ctx.runQuery(internal.phoneCollectionsHelpers.getAllProductsInternal, {});
      
      console.log(`Found ${products.length} total products`);

      // Create collections and assign products
      for (const collectionData of PHONE_COLLECTIONS) {
        try {
          const slug = collectionData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          
          // Check if collection already exists
          const existing = await ctx.runQuery(internal.phoneCollectionsHelpers.getCollectionBySlugInternal, { slug });
          
          let collectionId;
          if (existing) {
            console.log(`Collection "${collectionData.name}" already exists, updating...`);
            collectionId = existing._id;
            
            // Update with new fields
            await ctx.runMutation(internal.phoneCollectionsHelpers.updateCollectionInternal, {
              collectionId,
              category: "phone",
              deviceType: "phone",
              keywords: collectionData.keywords,
            });
          } else {
            // Create new collection
            collectionId = await ctx.runMutation(internal.phoneCollectionsHelpers.createCollectionInternal, {
              name: collectionData.name,
              slug,
              category: "phone",
              deviceType: "phone",
              keywords: collectionData.keywords,
            });
            results.collectionsCreated++;
            console.log(`Created collection "${collectionData.name}"`);
          }

          // Assign products based on keywords
          const keywordsLower = collectionData.keywords.map(k => k.toLowerCase());
          
          for (const product of products) {
            const titleLower = product.title.toLowerCase();
            
            // Check if any keyword matches
            const matches = keywordsLower.some(keyword => titleLower.includes(keyword));
            
            if (matches) {
              // Check if already assigned
              const existingLink = await ctx.runQuery(internal.phoneCollectionsHelpers.checkProductInCollectionInternal, {
                collectionId,
                productId: product._id,
              });
              
              if (!existingLink) {
                await ctx.runMutation(internal.phoneCollectionsHelpers.addProductToCollectionInternal, {
                  collectionId,
                  productId: product._id,
                });
                results.productsAssigned++;
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error processing collection "${collectionData.name}": ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      console.log(`Migration complete: ${results.collectionsCreated} collections created, ${results.productsAssigned} products assigned`);
      return results;
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  },
});

// Public action to trigger the migration
export const runPhoneCollectionsMigration = action({
  args: {},
  handler: async (ctx): Promise<{ collectionsCreated: number; productsAssigned: number; errors: string[] }> => {
    return await ctx.runAction(internal.phoneCollections.createPhoneCollectionsAndAssign, {});
  },
});
