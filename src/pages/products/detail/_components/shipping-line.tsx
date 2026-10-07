import { TruckIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { shippingFor, shippingRule } from "@/lib/shipping-config.mjs";

/**
 * What delivery costs, said beside the price. A ₹299 skin became ₹369 at
 * checkout with nothing before it saying so; the cart and this line now show
 * the same rule placeOrder charges (src/lib/shipping-config.mjs).
 */
export function ShippingLine({ price }: { price: number }) {
  const settings = useQuery(api.shipping.getShippingSettings) as { flatShippingFee?: number; freeShippingThreshold?: number } | null | undefined;
  if (settings === undefined || !(price > 0)) return null;
  const { threshold } = shippingRule(settings);
  const fee = shippingFor(price, settings);
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <TruckIcon className="size-4 shrink-0 text-brand" />
      {fee === 0 ? (
        <span><b className="text-foreground">Free delivery</b> on this order</span>
      ) : (
        <span>
          <b className="text-foreground">+ ₹{fee} shipping</b>
          {threshold > 0 && <> · free on orders of ₹{threshold}+</>}
        </span>
      )}
    </p>
  );
}
