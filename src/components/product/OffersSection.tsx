import { useState } from "react";
import { toast } from "sonner";
import {
  TagIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

interface Coupon {
  _id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount?: number;
  description: string;
  minPurchase?: number;
}

interface OffersSectionProps {
  coupons?: Coupon[] | null;
}

/*
 * Coupons only. The cashback used to be announced here too, which put it
 * below the Buy button — so it now sits beside the price, where it can
 * actually affect the decision, and saying it twice would only make the
 * second telling the weaker one.
 */
export function OffersSection({ coupons }: OffersSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const hasCoupons = coupons && coupons.length > 0;
  if (!hasCoupons) return null;
  
  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Coupon code copied!");
  };
  
  const getDiscountText = (coupon: Coupon) => {
    return coupon.discountType === "percentage" 
      ? `${coupon.discountValue}% OFF${coupon.maxDiscount ? ` (max ₹${coupon.maxDiscount})` : ''}`
      : `₹${coupon.discountValue} OFF`;
  };
  
  return (
    <div className="space-y-4">
      {/* Coupons Section */}
      {hasCoupons && (
        <div className="border border-border rounded-lg">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TagIcon className="size-4 text-primary" />
              <span>Offers ({coupons.length})</span>
            </div>
            {collapsed ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronUpIcon className="size-4" />
            )}
          </button>
          
          {!collapsed && (
            <div className="px-4 pb-4 space-y-2">
              {coupons.map((coupon) => (
                <div 
                  key={coupon._id}
                  className="border border-primary/30 rounded-lg p-3 bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-bold">
                          {coupon.code}
                        </code>
                        <span className="text-xs font-bold text-primary">
                          {getDiscountText(coupon)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {coupon.description}
                      </p>
                      {coupon.minPurchase && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Min. purchase: ₹{coupon.minPurchase}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopyCoupon(coupon.code)}
                      className="shrink-0 p-2 hover:bg-primary/10 rounded transition-colors"
                    >
                      <CopyIcon className="size-4 text-primary" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}
