/**
 * Shipping, in one place for the storefront.
 *
 * The live numbers are settings/shipping (Admin › Shipping): placeOrder
 * charges from that document, so it is the knob for testing thresholds — a
 * change there reaches the product page, cart, checkout and the server's
 * charge together. SHIPPING_DEFAULTS is what everything assumes when that
 * document is missing; functions/src/placeorder.ts carries the same two
 * numbers (it cannot import from src/) — keep them in step.
 *
 * Plain JS: shared by the app, scripts/prerender.mjs and merchant-schema.mjs.
 */

export const SHIPPING_DEFAULTS = {
  flatShippingFee: 70,
  freeShippingThreshold: 500,
};

/** The rule in force: the settings document's numbers, or the defaults. */
export function shippingRule(settings) {
  const fee = Number(settings?.flatShippingFee ?? SHIPPING_DEFAULTS.flatShippingFee);
  const threshold = Number(settings?.freeShippingThreshold ?? SHIPPING_DEFAULTS.freeShippingThreshold);
  return {
    fee: Number.isFinite(fee) && fee > 0 ? fee : 0,
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 0,
  };
}

/** What shipping costs on an order of `subtotal` — free at or above the threshold. */
export function shippingFor(subtotal, settings) {
  const { fee, threshold } = shippingRule(settings);
  if (threshold > 0 && Number(subtotal) >= threshold) return 0;
  return fee;
}
