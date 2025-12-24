import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
 * Store mockup file with metadata
 * Called after file is uploaded to storage
 */
export const storeMockupFile = mutation({
  args: {
    fileId: v.id("_storage"),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    // Parse filename: Brand_Model_SKU.jpg or Model_SKU.jpg
    const nameWithoutExt = args.filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 2) {
      throw new Error(`Invalid filename format: ${args.filename}. Expected at least Model_SKU.jpg`);
    }
    
    // Last part is always SKU
    const sku = parts[parts.length - 1];
    
    // Model portion is everything before the SKU (joined with spaces to handle underscores or spaces)
    const modelPortion = parts.slice(0, -1).join(' ');
    const modelPortionLower = modelPortion.toLowerCase();
    
    // Check if filename contains iPhone, iPad, Google, Nothing, CMF, OnePlus, or Samsung to auto-detect brand
    const isAppleDevice = modelPortionLower.includes('iphone') || modelPortionLower.includes('ipad');
    const isGoogleDevice = modelPortionLower.startsWith('google');
    const isNothingDevice = modelPortionLower.startsWith('nothing');
    const isCMFDevice = modelPortionLower.startsWith('cmf');
    const isOnePlusDevice = modelPortionLower.startsWith('oneplus');
    const isSamsungDevice = modelPortionLower.startsWith('samsung') || modelPortionLower.startsWith('galaxy');
    
    let brand: string;
    let model: string;
    
    if (isAppleDevice) {
      // Auto-detect Apple brand
      brand = 'Apple';
      model = modelPortion;
    } else if (isGoogleDevice) {
      // Auto-detect Google brand
      brand = 'Google';
      // Extract model after "Google" - handle both "Google Pixel" and "GooglePixel"
      // Remove "Google" from the start (case insensitive)
      model = modelPortion.replace(/^google\s*/i, '').trim();
      if (!model) {
        throw new Error(`Invalid filename format: ${args.filename}. Google device must have a model name.`);
      }
    } else if (isNothingDevice) {
      // Auto-detect Nothing brand
      brand = 'Nothing';
      // Extract model after "Nothing" - handle both "Nothing Phone 1" and "NothingPhone1"
      // Remove "Nothing" from the start (case insensitive)
      model = modelPortion.replace(/^nothing\s*/i, '').trim();
      if (!model) {
        throw new Error(`Invalid filename format: ${args.filename}. Nothing device must have a model name.`);
      }
    } else if (isCMFDevice) {
      // Auto-detect CMF brand
      brand = 'CMF';
      // Extract model after "CMF" - handle both "CMF Phone 1" and "CMFPhone1"
      // Remove "CMF" from the start (case insensitive)
      model = modelPortion.replace(/^cmf\s*/i, '').trim();
      if (!model) {
        throw new Error(`Invalid filename format: ${args.filename}. CMF device must have a model name.`);
      }
    } else if (isOnePlusDevice) {
      // Auto-detect OnePlus brand
      brand = 'OnePlus';
      // Extract model after "OnePlus" - handle both "OnePlus 12R" and "OnePlus12R"
      // Remove "OnePlus" from the start (case insensitive)
      model = modelPortion.replace(/^oneplus\s*/i, '').trim();
      if (!model) {
        throw new Error(`Invalid filename format: ${args.filename}. OnePlus device must have a model name.`);
      }
    } else if (isSamsungDevice) {
      // Auto-detect Samsung brand
      brand = 'Samsung';
      let cleanedModel = modelPortion;
      // Strip "Samsung" if present (case insensitive)
      cleanedModel = cleanedModel.replace(/^samsung\s*/i, '').trim();
      // Strip "Galaxy" if present (case insensitive)
      cleanedModel = cleanedModel.replace(/^galaxy\s*/i, '').trim();
      // Strip network indicators like (5G), (4G), (LTE), etc.
      cleanedModel = cleanedModel.replace(/\s*\([0-9]?G\)/gi, '').trim();
      cleanedModel = cleanedModel.replace(/\s*\(LTE\)/gi, '').trim();
      
      if (!cleanedModel) {
        throw new Error(`Invalid filename format: ${args.filename}. Samsung device must have a model name.`);
      }
      model = cleanedModel;
    } else if (parts.length === 2) {
      // Format: Model_SKU.jpg (no brand specified)
      throw new Error(`Invalid filename format: ${args.filename}. Non-Apple/Google/Nothing/CMF/OnePlus/Samsung devices must include brand: Brand_Model_SKU.jpg`);
    } else {
      // Format: Brand_Model_SKU.jpg (3+ parts)
      brand = parts[0];
      // Model is everything between brand and SKU
      model = parts.slice(1, -1).join(' ');
    }
    
    // Validate we have all required parts
    if (!brand || !model || !sku) {
      throw new Error(`Invalid filename format: ${args.filename}. Could not extract brand, model, and SKU.`);
    }
    
    // Normalize model name for comparison with brand-aware logic
    const normalizedModel = normalizeModelName(model, brand);
    
    // Check if mockup already exists (space-insensitive match)
    const allMockups = await ctx.db
      .query("mockups")
      .withIndex("by_brand_model_sku", (q) =>
        q.eq("brand", brand)
      )
      .collect();
    
    const existing = allMockups.find((m) => 
      normalizeModelName(m.model, brand) === normalizedModel && m.sku === sku
    );
    
    if (existing) {
      // Update file ID if changed
      if (existing.fileId !== args.fileId) {
        await ctx.db.patch(existing._id, { fileId: args.fileId });
        return { action: "updated", brand, model, sku };
      }
      return { action: "skipped", brand, model, sku };
    }
    
    // Insert new mockup (preserve original model name formatting)
    await ctx.db.insert("mockups", {
      brand,
      model,
      sku,
      fileId: args.fileId,
    });
    
    return { action: "created", brand, model, sku };
  },
});
