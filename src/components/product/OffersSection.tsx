import { useState } from "react";
import { toast } from "sonner";
import {
  TagIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CoinsIcon,
  SparklesIcon,
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

interface CashbackInfo {
  hasCashback: boolean;
  displayText: string | null;
}

interface OffersSectionProps {
  coupons?: Coupon[] | null;
  cashbackInfo?: CashbackInfo | null;
}

export function OffersSection({ coupons, cashbackInfo }: OffersSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  
  const hasCoupons = coupons && coupons.length > 0;
  const hasCashback = cashbackInfo && cashbackInfo.hasCashback;
  
  if (!hasCoupons && !hasCashback) return null;
  
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
      
      {/* Cashback Section */}
      {hasCashback && (
        <div className="border border-amber-500/50 rounded-lg p-3 bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-amber-500/20 shrink-0">
              <CoinsIcon className="size-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Earn {cashbackInfo.displayText ?? ""} Skinly Coins
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Get cashback on this purchase! Redeem on your next order.
              </p>
            </div>
            <SparklesIcon className="size-5 text-amber-500 shrink-0" />
          </div>
        </div>
      )}
    </div>
  );
}
