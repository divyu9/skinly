import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Normalize model name for matching (removes spaces, lowercase)
 * For Samsung: also strips "Galaxy" and network indicators like (5G), 5G, etc.
 */
function normalizeModelName(model: string, brand?: string): string {
  let normalized = model;
  
  // Samsung-specific normalization
  if (brand?.toLowerCase() === 'samsung') {
    // Strip "Galaxy" prefix (case-insensitive)
    normalized = normalized.replace(/^galaxy\s*/i, '').trim();
    // Strip network indicators: (5G), (4G), (LTE), or standalone 5G, 4G, LTE
    normalized = normalized.replace(/\s*\([0-9]?G\)/gi, '').trim();
    normalized = normalized.replace(/\s*\(LTE\)/gi, '').trim();
    normalized = normalized.replace(/\s+(5G|4G|LTE)$/gi, '').trim();
  }
  
  // Standard normalization: lowercase and remove spaces
  return normalized.toLowerCase().replace(/\s+/g, '');
}

/**
 * Get mockup file URL for a specific brand, model, and SKU
 * Returns Cloudinary URL if available, otherwise falls back to Convex storage
 * Uses space-insensitive matching for model names
 */
export const getMockupFileId = query({
  args: {
    brand: v.string(),
    model: v.string(),
    sku: v.string(),
  },
  handler: async (ctx, args) => {
    // First try exact match with full index (most efficient)
    const exactMatch = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", args.brand).eq("model", args.model).eq("sku", args.sku)
      )
      .first();

    if (exactMatch) {
      // 1. Check for R2 (Preferred for new uploads)
      if (exactMatch.r2Key) {
        // Use configured domain or fallback to the R2.dev URL
        const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
        return `${R2_PUBLIC_DOMAIN}/${exactMatch.r2Key}`;
      }
      // 2. Fallback to Cloudinary (Legacy preferred)
      if (exactMatch.cloudinaryUrl) {
        return exactMatch.cloudinaryUrl;
      }
      // 3. Fallback to Convex Storage (Legacy)
      if (exactMatch.fileId) {
        return await ctx.storage.getUrl(exactMatch.fileId);
      }
      return null;
    }

    // Fallback: Try normalized model matching (for model name variations)
    // Use by_brand_model index with pagination to avoid full table scan
    const normalizedSearchModel = normalizeModelName(args.model, args.brand);

    const mockups = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model", (q) => q.eq("brand", args.brand))
      .take(500); // Safety limit

    // Find mockup with matching normalized model name and SKU
    const mockup = mockups.find((m) =>
      normalizeModelName(m.model, args.brand) === normalizedSearchModel && m.sku === args.sku
    );

    if (!mockup) return null;

    // 1. R2
    if (mockup.r2Key) {
      const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
      return `${R2_PUBLIC_DOMAIN}/${mockup.r2Key}`;
    }

    // 2. Cloudinary
    if (mockup.cloudinaryUrl) {
      return mockup.cloudinaryUrl;
    }

    // 3. Convex Storage
    if (mockup.fileId) {
      return await ctx.storage.getUrl(mockup.fileId);
    }

    return null;
  },
});

/**
 * Get all mockups (paginated)
 */
export const getAllMockups = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mockups").collect();
  },
});

/**
 * Get mockups count (lightweight - doesn't load all data)
 * Returns an estimate for large tables to avoid timeout
 */
export const getMockupsCount = query({
  args: {},
  handler: async (ctx) => {
    // Take a small sample to estimate if table is large
    const sample = await ctx.db.query("mockups").take(1000);
    
    // If we got less than 1000, that's the exact count
    if (sample.length < 1000) {
      return sample.length;
    }
    
    // For large tables, return "1000+" to avoid expensive full scan
    // This prevents timeout on huge tables
    return 1000;
  },
});

/**
 * Get recent mockups (last N mockups)
 */
export const getRecentMockups = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    return await ctx.db.query("mockups").order("desc").take(limit);
  },
});

/**
 * Bulk import mockups from CSV data
 * Expected format: brand,model,sku,fileId
 * Uses space-insensitive matching for model names
 */
export const bulkImportMockups = mutation({
  args: {
    mockups: v.array(
      v.object({
        brand: v.string(),
        model: v.string(),
        sku: v.string(),
        fileId: v.id("_storage"),
      })
    ),
  },
  handler: async (ctx, args) => {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const mockup of args.mockups) {
      // Normalize model name for comparison with brand-aware logic
      const normalizedModel = normalizeModelName(mockup.model, mockup.brand);
      
      // Check if mockup already exists (space-insensitive match)
      const allMockups = await ctx.db
        .query("mockups")
        .withIndex("by_brand_model_sku", (q) =>
          q.eq("brand", mockup.brand)
        )
        .collect();
      
      const existing = allMockups.find((m) => 
        normalizeModelName(m.model, mockup.brand) === normalizedModel && m.sku === mockup.sku
      );

      if (existing) {
        // Update if fileId changed
        if (existing.fileId !== mockup.fileId) {
          await ctx.db.patch(existing._id, { fileId: mockup.fileId });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new mockup (preserve original model name formatting)
        await ctx.db.insert("mockups", mockup);
        imported++;
      }
    }

    return { imported, updated, skipped };
  },
});

/**
 * Delete a mockup
 */
export const deleteMockup = mutation({
  args: { id: v.id("mockups") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Clear a batch of mockups (up to 1000 at a time)
 * Returns number deleted and whether more remain
 */
export const clearAllMockups = mutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 1000;
    const mockups = await ctx.db.query("mockups").take(BATCH_SIZE);
    
    for (const mockup of mockups) {
      await ctx.db.delete(mockup._id);
    }
    
    // Check if there are more mockups remaining
    const remaining = await ctx.db.query("mockups").first();
    
    return { 
      deleted: mockups.length,
      hasMore: remaining !== null
    };
  },
});

/**
 * Generate upload URL for mockup files
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Keep-alive ping mutation
 * Lightweight mutation to prevent dev machine from sleeping during uploads
 */
export const keepAlivePing = mutation({
  args: {},
  handler: async () => {
    // Do nothing - just keep the connection alive
    return { timestamp: Date.now() };
  },
});

/**
 * Get all products (SKUs) that have mockups for a specific model
 * Returns array of { sku, imageUrl }
 */
export const getProductsWithMockupsForModel = query({
  args: {
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize model name for search (remove spaces, lowercase)
    const normalizedSearch = args.model.toLowerCase().replace(/\s+/g, "");
    
    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();
    
    // Filter mockups that match the model (case-insensitive, flexible matching)
    const matchingMockups = allMockups.filter((mockup) => {
      const normalizedMockupModel = mockup.model.toLowerCase().replace(/\s+/g, "");
      return normalizedMockupModel.includes(normalizedSearch) || 
             normalizedSearch.includes(normalizedMockupModel);
    });
    
    // Group by SKU to get unique products with their image URLs
    const uniqueProducts = new Map<string, string>();
    for (const mockup of matchingMockups) {
      if (!uniqueProducts.has(mockup.sku)) {
        // Prefer R2, then Cloudinary, then Convex storage
          let url: string | null = null;
          if (mockup.r2Key) {
            const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
            url = `${R2_PUBLIC_DOMAIN}/${mockup.r2Key}`;
          } else if (mockup.cloudinaryUrl) {
          url = mockup.cloudinaryUrl;
        } else if (mockup.fileId) {
          url = await ctx.storage.getUrl(mockup.fileId);
        }

        if (url) {
          uniqueProducts.set(mockup.sku, url);
        }
      }
    }
    
    return Array.from(uniqueProducts.entries()).map(([sku, imageUrl]) => ({
      sku,
      imageUrl,
    }));
  },
});

/**
 * Verify all mockup file IDs and identify broken links
 * Returns list of mockups with broken file links
 */
export const verifyMockupFiles = query({
  args: {},
  handler: async (ctx) => {
    const mockups = await ctx.db.query("mockups").collect();
    const brokenMockups = [];
    
    for (const mockup of mockups) {
      // Skip mockups that use Cloudinary (they're not broken)
      if (mockup.cloudinaryUrl) {
        continue;
      }

      try {
        // Try to get the storage URL - if file doesn't exist, this will be null
        if (mockup.fileId) {
          const url = await ctx.storage.getUrl(mockup.fileId);
          if (!url) {
            brokenMockups.push({
              id: mockup._id,
              brand: mockup.brand,
              model: mockup.model,
              sku: mockup.sku,
              fileId: mockup.fileId,
            });
          }
        } else {
          // No fileId and no cloudinaryUrl
          brokenMockups.push({
            id: mockup._id,
            brand: mockup.brand,
            model: mockup.model,
            sku: mockup.sku,
            fileId: mockup.fileId,
          });
        }
      } catch (error) {
        // File definitely doesn't exist
        brokenMockups.push({
          id: mockup._id,
          brand: mockup.brand,
          model: mockup.model,
          sku: mockup.sku,
          fileId: mockup.fileId,
        });
      }
    }
    
    return {
      total: mockups.length,
      broken: brokenMockups.length,
      brokenMockups,
    };
  },
});

/**
 * Check which filenames already exist in the database
 * Used to resume interrupted uploads by skipping already uploaded files
 */
export const checkExistingMockupFilenames = query({
  args: {
    filenames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all mockups
    const allMockups = await ctx.db.query("mockups").collect();
    
    // Create a set of existing filename combinations for fast lookup
    // Normalize filenames: brand_model_sku format (case-insensitive, no extension)
    const existingSet = new Set<string>();
    
    for (const mockup of allMockups) {
      // Reconstruct the filename pattern from database records
      // Handle both formats: Brand_Model_SKU and Model_SKU (for Apple auto-detection)
      const normalizedModel = mockup.model.replace(/\s+/g, '_');
      const filename1 = `${mockup.brand}_${normalizedModel}_${mockup.sku}`.toLowerCase();
      const filename2 = `${normalizedModel}_${mockup.sku}`.toLowerCase(); // Without brand
      existingSet.add(filename1);
      existingSet.add(filename2);
    }
    
    // Check which input filenames already exist
    const existingFilenames: string[] = [];
    const missingFilenames: string[] = [];
    
    for (const filename of args.filenames) {
      // Remove extension and normalize
      const normalized = filename
        .replace(/\.(jpg|jpeg|png|webp)$/i, '')
        .toLowerCase();
      
      if (existingSet.has(normalized)) {
        existingFilenames.push(filename);
      } else {
        missingFilenames.push(filename);
      }
    }
    
    return {
      total: args.filenames.length,
      existing: existingFilenames.length,
      missing: missingFilenames.length,
      existingFilenames,
      missingFilenames,
    };
  },
});

/**
 * Get missing mockups statistics (lightweight - only counts, no detailed results)
 * Used for displaying summary stats without loading full dataset
 */
export const getMissingMockupsStats = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = args.category || "phone";

    // Get ALL supported models for the category using index
    const supportedModels = await ctx.db
      .query("supportedModels")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();

    // Filter to active models only
    const activeModels = supportedModels.filter(m => m.isActive);

    // Count models with mockups vs without
    let modelsWithMockups = 0;
    let modelsWithoutMockups = 0;

    for (const model of activeModels) {
      const hasMockup = await ctx.db
        .query("mockups")
        .withIndex("by_supported_model", (q) => q.eq("supportedModelId", model._id))
        .first();

      if (hasMockup) {
        modelsWithMockups++;
      } else {
        modelsWithoutMockups++;
      }
    }

    // Get unique brands
    const uniqueBrands = new Set(activeModels.map(m => m.brandName)).size;

    return {
      totalMissingCombinations: modelsWithoutMockups, // Models without any mockups
      modelsAffected: activeModels.length, // Total models in category
      brandsAffected: uniqueBrands,
      totalSKUs: modelsWithMockups, // Models that have mockups
      modelsWithMockups,
      modelsWithoutMockups,
    };
  },
});

/**
 * Get missing mockups - shows ALL models in category with their mockup status
 * Returns models grouped by brand showing which have mockups and which don't
 * Real-time: checks actual mockup records for each model
 */
export const getMissingMockups = query({
  args: {
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const category = args.category || "phone";
    const limit = args.limit || 100; // Default to 100 models at a time

    // Get ALL supported models for the category using index
    const supportedModels = await ctx.db
      .query("supportedModels")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();

    // Filter to active models only
    const activeModels = supportedModels.filter(m => m.isActive);

    // Filter by brand if specified
    const filteredModels = args.brand && args.brand !== "all"
      ? activeModels.filter(m => m.brandName === args.brand)
      : activeModels;

    // Sort by brand then model name
    filteredModels.sort((a, b) => {
      if (a.brandName !== b.brandName) {
        return a.brandName.localeCompare(b.brandName);
      }
      return a.modelName.localeCompare(b.modelName);
    });

    // Take only the requested limit
    const limitedModels = filteredModels.slice(0, limit);

    // Check mockup status for each model (real-time)
    const results = [];

    for (const model of limitedModels) {
      // Check if model has any mockups using the supportedModelId index
      const mockups = await ctx.db
        .query("mockups")
        .withIndex("by_supported_model", (q) => q.eq("supportedModelId", model._id))
        .collect();

      const mockupCount = mockups.length;
      const uniqueSKUs = [...new Set(mockups.map(m => m.sku))];

      // Include ALL models - both with and without mockups
      results.push({
        brand: model.brandName,
        model: model.modelName,
        modelId: model._id,
        hasMockups: mockupCount > 0,
        mockupCount,
        uniqueSKUs: uniqueSKUs.length,
        missingSKUs: mockupCount === 0 ? ["No mockups uploaded"] : [],
        totalMissing: mockupCount === 0 ? 1 : 0, // 1 if missing, 0 if has mockups
      });
    }

    // Calculate stats
    const modelsWithMockups = results.filter(r => r.hasMockups).length;
    const modelsWithoutMockups = results.filter(r => !r.hasMockups).length;
    const uniqueBrands = new Set(results.map(r => r.brand)).size;

    return {
      results,
      hasMore: filteredModels.length > limit,
      totalAvailable: filteredModels.length,
      stats: {
        totalMissingCombinations: modelsWithoutMockups,
        modelsAffected: results.length,
        brandsAffected: uniqueBrands,
        totalSKUs: modelsWithMockups,
        modelsWithMockups,
        modelsWithoutMockups,
      }
    };
  },
});
/**
 * Batch fetch mockups - paginated to avoid read limits
 * Returns map of sku -> url
 *
 * IMPORTANT: Uses by_brand_model index for efficient queries.
 * Hard limit of 100 documents per call to prevent "Too many documents read" error.
 */
export const getBatchMockups = query({
  args: {
    brand: v.string(),
    model: v.string(),
    skus: v.optional(v.array(v.string())),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // If skus is provided but empty, return empty result immediately
    if (args.skus && args.skus.length === 0) {
      return {
        mockups: {},
        cursor: "",
        isDone: true,
      };
    }

    // Optimization: If specific SKUs are provided, we don't need to limit to 100
    // We can fetch exactly those SKUs.
    // However, if NO skus provided (full list), we must keep the limit.
    const isTargetedFetch = !!(args.skus && args.skus.length > 0);
    const limit = isTargetedFetch ? 200 : (args.limit || 100);

    // FIX: Use withIndex to avoid full table scan
    // We still use by_brand_model because we want to filter by brand+model first
    const mockupsQuery = ctx.db
      .query("mockups")
      .withIndex("by_brand_model", (q) =>
        q.eq("brand", args.brand).eq("model", args.model)
      );
    
    // If we have specific SKUs, we can't efficiently filter in the DB query itself 
    // without a complex "or" filter which Convex doesn't support well for arrays.
    // So we paginate through the results.
    
    // If targeted fetch, we might need to scan more to find our specific SKUs
    // But we shouldn't scan the WHOLE table.
    // Strategy: 
    // 1. If we have SKUs, use collect() with a reasonable limit (e.g. 1000) to find them all
    //    since we know the model has <1000 mockups usually.
    // 2. If no SKUs, use paginate() for infinite scroll.

    if (isTargetedFetch) {
       // Targeted fetch strategy: Get all mockups for this model (up to 1000)
       // and filter in memory. This ensures we don't miss SKUs that are "deep" in the list.
       const allModelMockups = await mockupsQuery.take(1000);
       
       const result: Record<string, string> = {};
       const targetSkus = new Set(args.skus!.map(s => s.toUpperCase())); // Normalize input SKUs

       for (const mockup of allModelMockups) {
         // Flexible matching:
         // 1. Exact match
         // 2. Mockup is prefix (DB: R-01, Product: R-01-PH) -> match
         // 3. Product is prefix (DB: R-01-PH, Product: R-01) -> match
         
         const mockupSku = mockup.sku.toUpperCase();
         
         // Check if this mockup matches ANY of our target SKUs
         let matchedSku: string | null = null;
         
         if (targetSkus.has(mockupSku)) {
            matchedSku = mockup.sku; // Use original case from DB? or input?
            // Actually we want to map the INPUT sku to the URL.
            // So if input is R-01-PH and match is R-01, we want result['R-01-PH'] = url
         }
         
         // We need to find WHICH target SKU this mockup corresponds to
         // Iterate targets (smaller list)
         for (const target of args.skus!) {
            const targetUpper = target.toUpperCase();
            
            // Match logic from bidirectional fix
            if (mockupSku === targetUpper || 
                mockupSku.startsWith(targetUpper + "-") || 
                targetUpper.startsWith(mockupSku + "-")) {
                
                // Prefer R2, then Cloudinary, then Convex storage
                  let url: string | null = null;
                  if (mockup.r2Key) {
                      const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
                      url = `${R2_PUBLIC_DOMAIN}/${mockup.r2Key}`;
                  } else if (mockup.cloudinaryUrl) {
                    url = mockup.cloudinaryUrl;
                } else if (mockup.fileId) {
                    url = await ctx.storage.getUrl(mockup.fileId);
                }

                if (url) {
                    result[target] = url; // Map the REQUESTED sku to the url
                }
            }
         }
       }

       return {
         mockups: result,
         cursor: "",
         isDone: true,
       };
    }

    // Default Paginated Strategy (for browsing all mockups without specific SKUs)
    const { page, isDone, continueCursor } = await mockupsQuery.paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    });

    const result: Record<string, string> = {};
    
    for (const mockup of page) {
      // If specific SKUs requested, filter for them
      if (args.skus && !args.skus.includes(mockup.sku)) {
        continue;
      }

      // Prefer R2, then Cloudinary, then Convex storage
      let url: string | null = null;
      if (mockup.r2Key) {
        const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";
        url = `${R2_PUBLIC_DOMAIN}/${mockup.r2Key}`;
      } else if (mockup.cloudinaryUrl) {
        url = mockup.cloudinaryUrl;
      } else if (mockup.fileId) {
        url = await ctx.storage.getUrl(mockup.fileId);
      }

      if (url) {
        result[mockup.sku] = url;
      }
    }

    // Return pagination info along with data
    return {
      mockups: result,
      cursor: continueCursor,
      isDone,
    };
  },
});