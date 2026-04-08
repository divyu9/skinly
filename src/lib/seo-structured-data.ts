import type { Doc } from "@/lib/firebase-api";

/**
 * Product with variant data for structured data generation
 */
export interface ProductWithVariant {
  product: Doc<"products">;
  variant?: Doc<"variants">;
}

/**
 * Generate Product structured data for a single product
 */
export function generateProductStructuredData(data: ProductWithVariant) {
  const { product, variant } = data;
  const image = product.images?.[0];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "description": product.description || "",
    "image": image?.url || "",
    "sku": variant?.sku || "",
    "brand": {
      "@type": "Brand",
      "name": "GoSkinly"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://www.goskinly.com/products/${product._id}`,
      "priceCurrency": "INR",
      "price": variant?.price || 0,
      "availability": variant && variant.inventoryQuantity > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
    }
  };
}

/**
 * Generate ItemList structured data for a collection of products
 */
export function generateProductListStructuredData(
  products: ProductWithVariant[],
  listName: string,
  listUrl: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "url": listUrl,
    "numberOfItems": products.length,
    "itemListElement": products.map(({ product, variant }, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Product",
        "name": product.title,
        "url": `https://www.goskinly.com/products/${product._id}`,
        "image": product.images?.[0]?.url || "",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": variant?.price || 0
        }
      }
    }))
  };
}

/**
 * Generate BreadcrumbList structured data
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

/**
 * Generate Organization structured data
 */
export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "GoSkinly",
    "url": "https://www.goskinly.com",
    "logo": "https://www.goskinly.com/logo.png",
    "description": "Premium phone skins and protection accessories for all devices",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@goskinly.com"
    },
    "sameAs": []
  };
}

/**
 * Generate WebSite structured data with site search
 */
export function generateWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "GoSkinly",
    "url": "https://www.goskinly.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://www.goskinly.com/shop?search={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * Helper to safely stringify JSON-LD data
 */
export function stringifyStructuredData(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}
