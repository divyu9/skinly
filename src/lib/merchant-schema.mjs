/**
 * Shipping and returns for a Product's Offer, as schema.org wants them.
 *
 * Plain JS so scripts/prerender.mjs and the React app build the same object:
 * Helmet replaces the prerendered JSON-LD when the page mounts, so anything
 * only one of them wrote would vanish from the page Google renders.
 *
 * Facts, from the policy pages and settings/shipping:
 * - ships within India only; 2–3 business days to dispatch, 4–6 in transit
 * - free at or above freeShippingThreshold, flatShippingFee below it
 * - returns within 48 hours of delivery, unopened packaging, by courier
 */
export function offerShippingAndReturns(price, shipping) {
  const threshold = Number(shipping?.freeShippingThreshold ?? 500);
  const fee = Number(shipping?.flatShippingFee ?? 50);
  const rate = Number(price) >= threshold ? 0 : fee;
  return {
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: rate, currency: "INR" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 3, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 4, maxValue: 6, unitCode: "DAY" },
      },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "IN",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 2,
      returnMethod: "https://schema.org/ReturnByMail",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
