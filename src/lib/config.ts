// Central configuration for application constants

// CDN Domain for static assets and mockups
// Prefer using the environment variable VITE_CDN_DOMAIN if available
// Otherwise fallback to empty string (relative paths) or a specific default if needed
export const CDN_DOMAIN = import.meta.env.VITE_CDN_DOMAIN || "https://cdn.goskinly.com";

// Helper to construct full CDN URLs
export const getCdnUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  
  // Ensure path starts with slash if domain doesn't end with one
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  // If no domain configured, return relative path
  if (!CDN_DOMAIN) return cleanPath;
  
  // Remove trailing slash from domain if present
  const cleanDomain = CDN_DOMAIN.endsWith("/") ? CDN_DOMAIN.slice(0, -1) : CDN_DOMAIN;
  
  return `${cleanDomain}${cleanPath}`;
};
