/**
 * Extracts R-number from SKU
 * Only extracts R-numbers from SKUs that explicitly start with "R-"
 * M-, L-, T- prefixes are NOT related to R-numbers
 * 
 * Examples:
 * - "R-59-MM" → "R-59"
 * - "R-1" → "R-1"
 * - "M-174" → null (M-SKUs are separate from R-numbers)
 * - "L-12-LPT" → null (L-SKUs are separate from R-numbers)
 */
export function extractRNumber(sku: string): string | null {
  if (!sku) return null;
  
  // Normalize to uppercase
  const normalizedSku = sku.toUpperCase().trim();
  
  // Only match SKUs that start with R-
  const rPattern = /^R-(\d+)/i;
  const rMatch = normalizedSku.match(rPattern);
  if (rMatch) {
    return `R-${rMatch[1]}`;
  }
  
  // No match - M-, L-, T- and other prefixes are NOT related to R-numbers
  return null;
}

/**
 * Normalizes R-number format
 * Examples:
 * - "r-59" → "R-59"
 * - "R59" → "R-59"
 * - "59" → "R-59"
 */
export function normalizeRNumber(input: string): string {
  if (!input) return "";
  
  const normalized = input.toUpperCase().trim();
  
  // Already in correct format
  if (/^R-\d+$/.test(normalized)) {
    return normalized;
  }
  
  // Extract just the number
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    return `R-${numMatch[1]}`;
  }
  
  return input;
}
