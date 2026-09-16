export function offerShippingAndReturns(
  price: number,
  shipping?: { freeShippingThreshold?: number; flatShippingFee?: number } | null,
): {
  shippingDetails: Record<string, unknown>;
  hasMerchantReturnPolicy: Record<string, unknown>;
};
