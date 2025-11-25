/**
 * Analytics tracking utilities for Google Analytics and Meta Pixel
 */

// Google Analytics types
declare global {
  interface Window {
    gtag?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
    fbq?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

/**
 * Track a search event on both Google Analytics and Meta Pixel
 */
export function trackSearch(searchTerm: string, resultsCount?: number) {
  // Google Analytics
  if (window.gtag) {
    window.gtag("event", "search", {
      search_term: searchTerm,
      results_count: resultsCount,
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq("track", "Search", {
      search_string: searchTerm,
      content_category: "products",
    });
  }

  console.log("Search tracked:", searchTerm, "Results:", resultsCount);
}

/**
 * Track a product view
 */
export function trackProductView(
  productId: string,
  productName: string,
  price: number
) {
  // Google Analytics
  if (window.gtag) {
    window.gtag("event", "view_item", {
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
        },
      ],
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      value: price,
      currency: "INR",
    });
  }
}

/**
 * Track add to cart
 */
export function trackAddToCart(
  productId: string,
  productName: string,
  price: number,
  quantity: number = 1
) {
  // Google Analytics
  if (window.gtag) {
    window.gtag("event", "add_to_cart", {
      items: [
        {
          item_id: productId,
          item_name: productName,
          price: price,
          quantity: quantity,
        },
      ],
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq("track", "AddToCart", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      value: price * quantity,
      currency: "INR",
    });
  }
}

/**
 * Track purchase/conversion
 */
export function trackPurchase(
  orderId: string,
  total: number,
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>
) {
  // Google Analytics
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: orderId,
      value: total,
      currency: "INR",
      items: items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq("track", "Purchase", {
      content_ids: items.map((i) => i.id),
      content_type: "product",
      value: total,
      currency: "INR",
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    });
  }
}

/**
 * Track collection/category view
 */
export function trackCollectionView(
  collectionName: string,
  productCount?: number
) {
  // Google Analytics
  if (window.gtag) {
    window.gtag("event", "view_item_list", {
      item_list_name: collectionName,
      items_count: productCount,
    });
  }

  // Meta Pixel
  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_name: collectionName,
      content_category: "collection",
      content_type: "product_group",
    });
  }
}
