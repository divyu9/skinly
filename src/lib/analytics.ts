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
    fbqTrack("ViewContent", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      value: price,
      currency: "INR",
    }, newEventId("vc"));
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
    fbqTrack("AddToCart", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      value: price * quantity,
      currency: "INR",
    }, newEventId("atc"));
  }
}

/**
 * The checkout page was opened with something in the cart — the funnel step
 * between "added to cart" and "paid" (dashboard funnel, functions/src/funnel.ts).
 * Once per tab session, so a reload or a return from PhonePe is not a second start.
 */
export function trackBeginCheckout(items: Array<{ productId: string; productTitle?: string; price: number; quantity: number }>) {
  try {
    if (!items.length || sessionStorage.getItem("skinly_begin_checkout")) return;
    sessionStorage.setItem("skinly_begin_checkout", "1");
    sessionStorage.setItem("skinly_ic_at", String(Date.now()));
    sessionStorage.removeItem("skinly_checkout_done");
  } catch { /* storage blocked: send anyway */ }
  const value = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  if (window.gtag) {
    window.gtag("event", "begin_checkout", {
      currency: "INR",
      value,
      items: items.map((i) => ({ item_id: i.productId, item_name: i.productTitle || "", price: i.price, quantity: i.quantity })),
    });
  }
  if (window.fbq) {
    // The same event_id goes to the Conversions API with the order (placeOrder), so Meta keeps one.
    fbqTrack("InitiateCheckout", { value, currency: "INR", num_items: items.length, content_ids: items.map((i) => i.productId), content_type: "product" },
      `ic-${checkoutSessionId()}`);
  }
}

type FunnelItem = { productId: string; productTitle?: string; price: number; quantity: number };
const sumOf = (items: FunnelItem[]) => items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);

/**
 * Place Order tapped with a valid form — Meta's AddPaymentInfo, GA4's
 * add_payment_info. The server repeats it with the same event_id once the
 * order is written (functions/src/metaCapi.ts), so Meta dedupes the pair.
 */
export function trackAddPaymentInfo(items: FunnelItem[], value: number, paymentType: string) {
  const eventId = `api-${checkoutSessionId()}`;
  gtagEvent("add_payment_info", {
    currency: "INR", value, payment_type: paymentType,
    items: items.map((i) => ({ item_id: i.productId, item_name: i.productTitle || "", price: i.price, quantity: i.quantity })),
  });
  fbqTrack("AddPaymentInfo", {
    value, currency: "INR", content_ids: items.map((i) => i.productId), content_type: "product",
    num_items: items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
  }, eventId);
}

/** A checkout field that stopped Place Order: which one, never its value. */
export function trackCheckoutValidationError(field: string) {
  gtagEvent("checkout_validation_error", { field });
  fbqCustom("CheckoutValidationError", { field });
}

/**
 * A payment that did not go through, once per order and outcome.
 * kind "cancelled" when the buyer backed out (PhonePe's USER_CANCEL /
 * PAYMENT_CANCELLED / dropped codes), "failed" for a decline or an error.
 */
export function trackPaymentIssue(kind: "failed" | "cancelled", reason: string, orderKey: string, value?: number) {
  try {
    const key = `skinly_payissue_${orderKey}_${kind}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch { /* storage blocked: send anyway */ }
  const params = { reason: String(reason || "unknown").slice(0, 100), currency: "INR", ...(value ? { value } : {}) };
  gtagEvent(kind === "cancelled" ? "payment_cancelled" : "payment_failed", params);
  fbqCustom(kind === "cancelled" ? "PaymentCancelled" : "PaymentFailed", params);
}

/** PhonePe's codes that mean the buyer backed out rather than being declined. */
export const isCancelCode = (code: unknown) => /CANCEL|USER_DROPPED|DROPPED|ABANDON|TIMED_OUT|TIMEOUT/i.test(String(code || ""));

/**
 * Left the checkout after InitiateCheckout without placing an order: once per
 * checkout session, sent as a beacon so it survives the page going away.
 * Not sent when the page is leaving for PhonePe (markCheckoutDone first).
 */
export function trackCheckoutAbandoned(items: FunnelItem[], step: string) {
  try {
    if (!sessionStorage.getItem("skinly_begin_checkout") || sessionStorage.getItem("skinly_checkout_done")) return;
    if (sessionStorage.getItem("skinly_checkout_abandoned")) return;
    sessionStorage.setItem("skinly_checkout_abandoned", "1");
  } catch { return; }
  const value = sumOf(items);
  gtagEvent("checkout_abandoned", { currency: "INR", value, step, transport_type: "beacon" });
  fbqCustom("CheckoutAbandoned", { currency: "INR", value, step });
}

/** The checkout ended in an order (or is on its way to PhonePe): no abandonment from here. */
export function markCheckoutDone() {
  try { sessionStorage.setItem("skinly_checkout_done", "1"); } catch { /* storage blocked */ }
}

/**
 * One id per checkout visit, the root of its event_ids (ic-…, api-…), and
 * sent with placeOrder so the server's events carry the same ones.
 */
export function checkoutSessionId(): string {
  try {
    let id = sessionStorage.getItem("skinly_checkout_id");
    if (!id) { id = newEventId("ck"); sessionStorage.setItem("skinly_checkout_id", id); }
    return id;
  } catch { return "nostorage"; }
}

/** What placeOrder needs to repeat the checkout's browser events server-side. */
export function checkoutEventContext() {
  const id = checkoutSessionId();
  let at = 0;
  try { at = Number(sessionStorage.getItem("skinly_ic_at")) || 0; } catch { /* storage blocked */ }
  return {
    checkoutId: id,
    initiateCheckoutEventId: `ic-${id}`,
    addPaymentInfoEventId: `api-${id}`,
    initiateCheckoutAt: at || undefined,
    eventSourceUrl: location.href.split("#")[0].slice(0, 500),
  };
}

export function newEventId(prefix: string): string {
  const rnd = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `${prefix}-${rnd}`;
}

function gtagEvent(name: string, params: Record<string, unknown>) {
  try { window.gtag?.("event", name, params); } catch { /* no analytics */ }
}
// The Pixel's fourth argument carries the eventID; the typing stops at three.
function fbqTrack(name: string, params: Record<string, unknown>, eventID: string) {
  try { (window.fbq as ((...a: unknown[]) => void) | undefined)?.("track", name, params, { eventID }); } catch { /* no pixel */ }
}
function fbqCustom(name: string, params: Record<string, unknown>) {
  try { window.fbq?.("trackCustom", name, params); } catch { /* no pixel */ }
}

/**
 * Track purchase/conversion.
 *
 * `orderId` is the order NUMBER (trackPurchaseOnce passes order.orderNumber):
 * GA4's transaction_id and Meta's eventID `purchase-<number>`. The Conversions
 * API sends the same eventID and value (functions/src/metaCapi.ts,
 * purchaseEventId / purchaseValue), so Meta keeps one of the pair.
 * `opts.eventId` / `opts.skipGa` are for the payment test mode only.
 */
export function trackPurchase(
  orderId: string,
  total: number,
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>,
  opts: { eventId?: string; skipGa?: boolean } = {}
) {
  // Google Analytics — the deferred script is fetched now, so a buyer who
  // closes the page within seconds does not take the queued purchase with them.
  try { (window as any).__skinlyLoadGA?.(); } catch { /* no loader */ }
  if (window.gtag && !opts.skipGa) {
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
    }, { eventID: opts.eventId || `purchase-${orderId}` });
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
  // The next checkout in this tab is a new one.
  try {
    for (const k of ["skinly_begin_checkout", "skinly_ic_at", "skinly_checkout_id", "skinly_checkout_abandoned"]) sessionStorage.removeItem(k);
    sessionStorage.setItem("skinly_checkout_done", "1");
  } catch { /* storage blocked */ }
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
