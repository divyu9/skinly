/**
 * Extracts R-number from SKU
 * Examples:
 * - "R-59-MM" → "R-59"
 * - "M-174" → "R-174" (convert M to R)
 * - "L-12-LPT" → "R-12" (convert L to R)
 * - "T-5" → "R-5" (convert T to R)
 * - "R-1" → "R-1"
 */
export function extractRNumber(sku: string): string | null {
  if (!sku) return null;
  
  // Normalize to uppercase
  const normalizedSku = sku.toUpperCase().trim();
  
  // Pattern 1: Already starts with R- (e.g., "R-59", "R-1-MM")
  const rPattern = /^R-(\d+)/i;
  const rMatch = normalizedSku.match(rPattern);
  if (rMatch) {
    return `R-${rMatch[1]}`;
  }
  
  // Pattern 2: Starts with M-, L-, or T- (e.g., "M-174", "L-12-LPT", "T-5")
  const mlPattern = /^[MLT]-(\d+)/i;
  const mlMatch = normalizedSku.match(mlPattern);
  if (mlMatch) {
    return `R-${mlMatch[1]}`;
  }
  
  // Pattern 3: Just a number (e.g., "174")
  const numPattern = /^(\d+)/;
  const numMatch = normalizedSku.match(numPattern);
  if (numMatch) {
    return `R-${numMatch[1]}`;
  }
  
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
