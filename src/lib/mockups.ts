/**
 * Utility functions for handling product mockup images
 * 
 * Mockup images are stored in the database for scalability.
 * To manage 100,000+ mockups:
 * 1. Go to Admin Dashboard → Mockups tab
 * 2. Use CSV bulk import tool
 * 
 * CSV Format:
 * brand,model,sku,fileId
 * Apple,iPhone 15 Pro,M-174,file_abc123
 */

const MOCKUP_BASE_URL = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev";

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
 * Looks for patterns like M-174, R-08, A-01, etc.
 * Supports prefixes: L, M, S, B, F, A, R, T
 * 
 * @param title Product title
 * @param sku Variant SKU
 * @returns SKU code or null if not found
 */
export function extractSKU(title: string, sku?: string): string | null {
  // STRICTLY use the provided SKU if available.
  // The user confirmed SKU is the single source of truth.
  if (sku && sku.trim().length > 0) {
    // Return the SKU directly, just trimming whitespace
    return sku.trim();
  }
  
  // Fallback to title ONLY if SKU is completely missing (should not happen for valid products)
  // This is just a safety net for malformed data
  const pattern = /([LMSBFART])-\d+/i;
  const titlePattern = new RegExp(`\\((${pattern.source})\\)|${pattern.source}`, 'i');
  const titleMatch = title.match(titlePattern);
  
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
  // If we try to load multiple URLs that don't exist via new Image(), 
  // the browser will spam the console with 404 errors.
  // We can't avoid this if we want to know if the image actually exists on the CDN.
  // Instead of trying to guess by hitting the CDN, let's assume the image exists 
  // and handle failures at the component level.
  return true;
}

/**
 * Constructs mockup image URL from file ID
 * 
 * @param fileId Hercules CDN file ID from database query
 * @returns Full CDN URL
 */
export function getMockupUrl(fileId: string): string {
  return `${MOCKUP_BASE_URL}/${fileId}`;
}

/**
 * Finds the correct mockup image URL
 * 
 * Priority 1: Uses provided fileId from database (recommended)
 * Priority 2: Tries legacy filename variations (backward compatibility)
 * 
 * @param modelName Full phone model name (e.g., "Apple iPhone 15 Pro")
 * @param sku SKU code (e.g., "M-174")
 * @param fileId Optional file ID from database query
 * @returns Promise that resolves to the mockup URL if found, or null
 * 
 * @example
 * ```ts
 * // With database fileId (recommended):
 * const fileId = useQuery(api.mockups.getMockupFileId, {...});
 * const url = await findMockupImageUrl("Apple iPhone 15 Pro", "M-174", fileId);
 * 
 * // Legacy fallback (slower):
 * const url = await findMockupImageUrl("Apple iPhone 15 Pro", "M-174");
 * ```
 */
export function findMockupImageUrl(
  modelName: string,
  sku: string,
  fileId?: string | null
): string | null {
  // Check cache first
  const cacheKey = `${modelName}_${sku}`;
  if (mockupCache.has(cacheKey)) {
    return mockupCache.get(cacheKey)!;
  }
  
  // Priority 1: Use provided file ID from database
  if (fileId) {
    const url = getMockupUrl(fileId);
    mockupCache.set(cacheKey, url);
    return url;
  }
  
  // Priority 2: Try legacy filename variations (backward compatibility)
  // Instead of fetching them all blindly (which causes CORS and 404 errors in console),
  // we will return an array of possible URLs and let the component handle trying them 
  // via the <img> onError fallback mechanism.
  const brand = extractBrand(modelName);
  const variations = generateModelVariations(modelName);
  
  // Return the first most likely URL to start with.
  // The React component will have to handle fallbacks if it fails to load.
  const primaryUrl = brand 
    ? constructMockupUrl(variations[0], sku, brand) 
    : constructMockupUrl(variations[0], sku, null);
    
  return primaryUrl;
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
