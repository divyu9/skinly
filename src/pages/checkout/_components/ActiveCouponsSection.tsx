import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SparklesIcon, WalletIcon } from "lucide-react";

interface ActiveCouponsSectionProps {
  onCouponSelect: (code: string) => Promise<void>;
  appliedCouponCode?: string;
}

export function ActiveCouponsSection({
  onCouponSelect,
  appliedCouponCode,
}: ActiveCouponsSectionProps) {
  const activeCoupons = useQuery(api.coupons.getActiveCoupons);

  if (!activeCoupons || activeCoupons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-amber-600" />
          Active Offers & Coupons
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCoupons.slice(0, 5).map((coupon) => {
          const isApplied = appliedCouponCode === coupon.code;
          const isWalletCredit = coupon.effectType === "wallet_credit";
          const discountText =
            coupon.discountType === "percentage"
              ? `${coupon.discountValue}% OFF`
              : isWalletCredit
                ? `₹${coupon.discountValue} CREDIT`
                : `₹${coupon.discountValue} OFF`;

          return (
            <div
              key={coupon._id}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                isApplied
                  ? "bg-green-500/10 border-green-500/50"
                  : "bg-muted/50 border-muted hover:border-primary/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {coupon.code}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${isWalletCredit ? "bg-purple-500/10 border-purple-500/50 text-purple-700 dark:text-purple-300" : ""}`}
                  >
                    {discountText}
                  </Badge>
                  {isWalletCredit && (
                    <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/50 text-purple-700 dark:text-purple-300">
                      <WalletIcon className="size-3 mr-1" />
                      On Delivery
                    </Badge>
                  )}
                  {isApplied && (
                    <Badge className="bg-green-600 text-white text-xs">Applied</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{coupon.description}</p>
                {isWalletCredit && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">
                    Credit will be added to your wallet when order is delivered
                  </p>
                )}
                {coupon.minCartValue && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Min. cart value: ₹{coupon.minCartValue}
                  </p>
                )}
                {coupon.maxDiscount && coupon.discountType === "percentage" && (
                  <p className="text-xs text-muted-foreground">
                    Max discount: ₹{coupon.maxDiscount}
                  </p>
                )}
              </div>
              {!isApplied && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onCouponSelect(coupon.code)}
                  className="shrink-0"
                >
                  Apply
                </Button>
              )}
            </div>
          );
        })}
        {activeCoupons.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Showing top {Math.min(5, activeCoupons.length)} of {activeCoupons.length} active offers
          </p>
        )}
      </CardContent>
    </Card>
  );
}
