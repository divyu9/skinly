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

  // Meta Pixel — eventID lets Meta drop a second report of the same order.
  if (window.fbq) {
    // The typing stops at three arguments; the Pixel's fourth takes the eventID.
    (window.fbq as (...args: unknown[]) => void)("track", "Purchase", {
      content_ids: items.map((i) => i.id),
      content_type: "product",
      value: total,
      currency: "INR",
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    }, { eventID: `purchase-${orderId}` });
  }
}

/**
 * The purchase, reported once, from the order's own page.
 *
 * trackPurchase used to run only on /payment/callback, which the checkout
 * never opens: PhonePe pays in an overlay and the checkout goes straight to
 * /orders/<id>, and COD goes there too. So GA4 and the Meta Pixel had never
 * recorded a single purchase. Now the order page reports it when the order is
 * confirmed (numbered, paid or COD), once per order in this browser, and only
 * while the order is new — a customer reopening an old order is not a sale.
 */
/** Called by the checkout the moment an order is written, so trackPurchaseOnce knows this browser placed it. */
export function markOrderPlacedHere(orderId: unknown) {
  try { if (orderId) localStorage.setItem(`skinly_placed_${String(orderId)}`, String(Date.now())); } catch { /* storage blocked */ }
}

export function trackPurchaseOnce(order: any) {
  try {
    if (!order?._id || !order.orderNumber || order.isDeleted) return;
    if (order.status === "pending_payment" || order.paymentStatus === "failed") return;
    const placed = Number(order.createdAt || order._creationTime) || 0;
    if (!placed || Date.now() - placed > 48 * 3600 * 1000) return;
    // Only the browser that placed it: an admin opening "View as customer",
    // or the customer on another device, is not the sale happening.
    if (!localStorage.getItem(`skinly_placed_${order._id}`)) return;
    const key = `skinly_purchase_sent_${order._id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
    const items = (Array.isArray(order.items) ? order.items : []).map((i: any) => ({
      id: String(i.productId || i.sku || ""), name: String(i.productTitle || ""), price: Number(i.price) || 0, quantity: Number(i.quantity) || 1,
    }));
    trackPurchase(String(order.orderNumber), Number(order.total ?? order.amountPayable) || 0, items);
  } catch {
    /* storage blocked or no analytics: nothing to report */
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
