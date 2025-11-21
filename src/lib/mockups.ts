/**
 * Utility functions for handling product mockup images
 * 
 * Mockup images should be uploaded to Files & Media with this folder structure:
 * /mockups/{Brand}/{ModelVariation}_{SKU}.jpg
 * 
 * Examples:
 * - /mockups/Apple/15pro_M-174.jpg
 * - /mockups/Samsung/S24_M-174.jpg
 * - /mockups/Oppo/15Pro_M-174.jpg
 * 
 * Fallback: Will also check /mockups/{ModelVariation}_{SKU}.jpg for backward compatibility
 */

const MOCKUP_BASE_URL = "https://cdn.hercules.app";

// Cache for successful mockup URL patterns
const mockupCache = new Map<string, string>();

/**
 * List of supported phone brands
 * Used to extract brand from model name and organize mockups by brand folder
 */
const PHONE_BRANDS = [
  'Apple',
  'Samsung',
  'Xiaomi',
  'Redmi',
  'Realme',
  'Oppo',
  'Vivo',
  'OnePlus',
  'Nothing',
  'CMF',
  'Motorola',
  'Google',
  'Nokia',
  'Sony',
  'Asus',
  'iQOO',
  'Honor',
  'Huawei',
  'Lenovo',
] as const;

/**
 * Extracts brand name from phone model string
 * 
 * @param modelName Full phone model name (e.g., "Apple iPhone 15 Pro", "Samsung Galaxy S24")
 * @returns Brand name or null if not found
 * 
 * @example
 * extractBrand("Apple iPhone 15 Pro") → "Apple"
 * extractBrand("Samsung Galaxy S24") → "Samsung"
 * extractBrand("iPhone 15 Pro") → "Apple" (infers from model pattern)
 */
export function extractBrand(modelName: string): string | null {
  const modelLower = modelName.toLowerCase();
  
  // Check each brand (case-insensitive)
  for (const brand of PHONE_BRANDS) {
    if (modelLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // Special inference rules for models without explicit brand
  if (modelLower.includes('iphone') || modelLower.includes('ipad')) {
    return 'Apple';
  }
  if (modelLower.includes('galaxy')) {
    return 'Samsung';
  }
  if (modelLower.includes('pixel')) {
    return 'Google';
  }
  
  return null;
}

/**
 * Normalizes phone model name to match image filename format
 * Removes spaces, hyphens, and special characters
 * 
 * Examples:
 * "Redmi Note 11 Pro" → "RedmiNote11Pro"
 * "iPhone 14 Pro Max" → "iPhone14ProMax"
 * "Samsung Galaxy S24 FE (5G)" → "SamsungGalaxyS24FE5G"
 */
export function normalizeModelName(modelName: string): string {
  return modelName
    .replace(/[\s-()]/g, '') // Remove spaces, hyphens, parentheses
    .replace(/[^a-zA-Z0-9]/g, ''); // Remove any other special characters
}

/**
 * Generates multiple possible filename variations for a model
 * Handles cases like:
 * - "Apple iPhone 15 Pro" → ["AppleiPhone15Pro", "iPhone15Pro", "15Pro", "15pro"]
 * - "Samsung Galaxy S24 5G" → ["SamsungGalaxyS245G", "SamsungS245G", "SamsungS24", "S245G", "S24"]
 * 
 * @param modelName Full phone model name
 * @returns Array of possible filename variations (without extension)
 */
export function generateModelVariations(modelName: string): string[] {
  const variations = new Set<string>();
  const normalized = normalizeModelName(modelName);
  
  // 1. Full normalized name
  variations.add(normalized);
  
  // 2. Remove common suffixes (5G, 4G, LTE, Plus, Pro Max, etc.)
  const withoutSuffixes = normalized
    .replace(/5G$/i, '')
    .replace(/4G$/i, '')
    .replace(/LTE$/i, '')
    .replace(/Plus$/i, '');
  if (withoutSuffixes !== normalized) {
    variations.add(withoutSuffixes);
  }
  
  // 3. Extract brand and model parts
  const brands = ['Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Realme', 'Oppo', 'Vivo', 'OnePlus', 'Nokia', 'Motorola', 'Google', 'Sony', 'Asus', 'iQOO'];
  
  for (const brand of brands) {
    const brandRegex = new RegExp(`^${brand}`, 'i');
    if (brandRegex.test(normalized)) {
      // Without brand prefix
      const withoutBrand = normalized.replace(brandRegex, '');
      if (withoutBrand) {
        variations.add(withoutBrand);
        
        // Also try without suffixes
        const withoutBrandAndSuffixes = withoutBrand
          .replace(/5G$/i, '')
          .replace(/4G$/i, '')
          .replace(/LTE$/i, '')
          .replace(/Plus$/i, '');
        if (withoutBrandAndSuffixes !== withoutBrand) {
          variations.add(withoutBrandAndSuffixes);
        }
      }
      
      // Brand + shortened model (e.g., SamsungS24 from SamsungGalaxyS24)
      const shortened = normalized.replace(/Galaxy/i, '').replace(/Note/i, '');
      if (shortened !== normalized) {
        variations.add(shortened);
      }
      
      break; // Only match one brand
    }
  }
  
  // 4. Extract just numbers and key identifiers (e.g., "15Pro" from "iPhone15ProMax")
  const numberMatch = normalized.match(/\d+[A-Za-z]*/);
  if (numberMatch) {
    const coreModel = numberMatch[0];
    variations.add(coreModel);
    
    // Also try lowercase version
    variations.add(coreModel.toLowerCase());
  }
  
  // 5. Special handling for common patterns
  // iPhone patterns: "iPhone15Pro" → "15Pro", "15pro"
  if (/iPhone/i.test(normalized)) {
    const withoutIPhone = normalized.replace(/iPhone/i, '');
    if (withoutIPhone) {
      variations.add(withoutIPhone);
      variations.add(withoutIPhone.toLowerCase());
    }
  }
  
  // Samsung patterns: "GalaxyS24" → "S24"
  if (/Samsung/i.test(normalized)) {
    const withoutGalaxy = normalized.replace(/Samsung/i, '').replace(/Galaxy/i, '');
    if (withoutGalaxy) {
      variations.add(withoutGalaxy);
      
      // Also try with "Samsung" prefix but no "Galaxy"
      const samsungShort = 'Samsung' + withoutGalaxy;
      variations.add(samsungShort);
    }
  }
  
  return Array.from(variations).filter(v => v.length > 0);
}

/**
 * Extracts SKU code from product title or variant SKU
 * Looks for patterns like M-174, M-75, etc.
 * 
 * @param title Product title
 * @param sku Variant SKU
 * @returns SKU code or null if not found
 */
export function extractSKU(title: string, sku?: string): string | null {
  // First try the variant SKU if provided
  if (sku) {
    const skuMatch = sku.match(/M-\d+/i);
    if (skuMatch) return skuMatch[0];
  }
  
  // Then try to extract from title
  const titleMatch = title.match(/\(M-\d+\)/i) || title.match(/M-\d+/i);
  if (titleMatch) {
    return titleMatch[0].replace(/[()]/g, '');
  }
  
  return null;
}

/**
 * Constructs a single mockup image URL based on model variation and SKU
 * 
 * @param modelVariation Normalized model name variation
 * @param sku SKU code (e.g., "M-174")
 * @param brand Optional brand name for folder organization
 * @returns Constructed mockup image URL
 */
function constructMockupUrl(modelVariation: string, sku: string, brand?: string | null): string {
  const filename = `${modelVariation}_${sku}.jpg`;
  
  // Use brand folder if provided
  if (brand) {
    return `${MOCKUP_BASE_URL}/mockups/${brand}/${filename}`;
  }
  
  // Fallback to root mockups folder
  return `${MOCKUP_BASE_URL}/mockups/${filename}`;
}

/**
 * Checks if a mockup image exists by trying to load it
 * 
 * @param imageUrl URL to check
 * @returns Promise that resolves to true if image exists, false otherwise
 */
export async function mockupImageExists(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Finds the correct mockup image URL by trying multiple filename variations
 * Uses a cache to speed up subsequent lookups
 * 
 * Tries brand folders first (e.g., /mockups/Apple/15pro_M-174.jpg)
 * Falls back to root mockups folder (e.g., /mockups/15pro_M-174.jpg)
 * 
 * @param modelName Full phone model name (e.g., "Apple iPhone 15 Pro")
 * @param sku SKU code (e.g., "M-174")
 * @returns Promise that resolves to the mockup URL if found, or null
 * 
 * @example
 * ```ts
 * // Will try:
 * // - /mockups/Apple/15pro_M-174.jpg
 * // - /mockups/Apple/iPhone15Pro_M-174.jpg
 * // - /mockups/15pro_M-174.jpg (fallback)
 * const url = await findMockupImageUrl("Apple iPhone 15 Pro", "M-174");
 * ```
 */
export async function findMockupImageUrl(
  modelName: string,
  sku: string
): Promise<string | null> {
  // Check cache first
  const cacheKey = `${modelName}_${sku}`;
  if (mockupCache.has(cacheKey)) {
    return mockupCache.get(cacheKey)!;
  }
  
  // Extract brand for folder organization
  const brand = extractBrand(modelName);
  
  // Generate all possible filename variations
  const variations = generateModelVariations(modelName);
  
  // Priority 1: Try brand folder first (most specific)
  if (brand) {
    for (const variation of variations) {
      const url = constructMockupUrl(variation, sku, brand);
      const exists = await mockupImageExists(url);
      
      if (exists) {
        mockupCache.set(cacheKey, url);
        return url;
      }
    }
  }
  
  // Priority 2: Fall back to root mockups folder (backward compatibility)
  for (const variation of variations) {
    const url = constructMockupUrl(variation, sku, null);
    const exists = await mockupImageExists(url);
    
    if (exists) {
      mockupCache.set(cacheKey, url);
      return url;
    }
  }
  
  // No mockup found
  return null;
}

/**
 * Constructs mockup image URL based on model name and SKU
 * Note: This returns the first variation without checking if it exists.
 * For automatic fallback checking, use findMockupImageUrl instead.
 * 
 * @param modelName Phone model name (e.g., "Redmi Note 11 Pro")
 * @param sku SKU code (e.g., "M-174")
 * @param fileId Optional: specific file ID if you know it
 * @returns Constructed mockup image URL
 * 
 * @deprecated Use findMockupImageUrl for automatic variation checking
 */
export function getMockupImageUrl(
  modelName: string, 
  sku: string,
  fileId?: string
): string {
  if (fileId) {
    return `${MOCKUP_BASE_URL}/${fileId}`;
  }
  
  const normalizedModel = normalizeModelName(modelName);
  return constructMockupUrl(normalizedModel, sku);
}
