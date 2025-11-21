/**
 * Utility functions for handling product mockup images
 * 
 * Mockup images should be uploaded to Files & Media with naming convention:
 * {NormalizedModelName}_{SKU}.jpg
 * 
 * Example: RedmiNote11Pro_M-174.jpg
 */

const MOCKUP_BASE_URL = "https://cdn.hercules.app";

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
 * Constructs mockup image URL based on model name and SKU
 * 
 * @param modelName Phone model name (e.g., "Redmi Note 11 Pro")
 * @param sku SKU code (e.g., "M-174")
 * @param fileId Optional: specific file ID if you know it
 * @returns Constructed mockup image URL
 */
export function getMockupImageUrl(
  modelName: string, 
  sku: string,
  fileId?: string
): string {
  const normalizedModel = normalizeModelName(modelName);
  const filename = `${normalizedModel}_${sku}.jpg`;
  
  if (fileId) {
    return `${MOCKUP_BASE_URL}/${fileId}`;
  }
  
  // If you store all mockups in a specific folder, use that folder's ID
  // Otherwise, construct a predictable URL
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
