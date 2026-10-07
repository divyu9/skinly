export declare const SHIPPING_DEFAULTS: { flatShippingFee: number; freeShippingThreshold: number };
type ShippingSettings = { flatShippingFee?: number; freeShippingThreshold?: number } | null | undefined;
export declare function shippingRule(settings: ShippingSettings): { fee: number; threshold: number };
export declare function shippingFor(subtotal: number, settings: ShippingSettings): number;
