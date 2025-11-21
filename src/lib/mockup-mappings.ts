/**
 * Mockup Image Mappings
 * 
 * Maps phone models and SKUs to their Hercules CDN file IDs
 * 
 * How to add mockups:
 * 1. Upload image to Files & Media tab
 * 2. Copy the file ID from the URL (starts with "file_")
 * 3. Add entry below in format: "Brand|Model|SKU": "file_id"
 * 
 * Examples:
 * - "Apple|iPhone 15 Pro|M-174": "file_abc123"
 * - "Samsung|Galaxy S24|M-174": "file_xyz789"
 * 
 * The system will automatically try multiple model name variations,
 * so you only need one entry per model+SKU combination.
 */

export const mockupMappings: Record<string, string> = {
  // Add your mockup mappings here
  // Format: "Brand|Model|SKU": "file_id"
  
  // Example:
  // "Apple|iPhone 15 Pro|M-174": "file_example123",
  // "Samsung|Galaxy S24 5G|M-174": "file_example456",
};

/**
 * Gets file ID for a specific brand, model, and SKU combination
 * Tries multiple model name variations automatically
 * 
 * @param brand Phone brand (e.g., "Apple")
 * @param model Phone model (e.g., "iPhone 15 Pro")
 * @param sku SKU code (e.g., "M-174")
 * @returns File ID if found, or null
 */
export function getMockupFileId(
  brand: string,
  model: string,
  sku: string
): string | null {
  // Try exact match first
  const exactKey = `${brand}|${model}|${sku}`;
  if (mockupMappings[exactKey]) {
    return mockupMappings[exactKey];
  }
  
  // Try case-insensitive search
  const searchKey = exactKey.toLowerCase();
  for (const [key, fileId] of Object.entries(mockupMappings)) {
    if (key.toLowerCase() === searchKey) {
      return fileId;
    }
  }
  
  return null;
}
