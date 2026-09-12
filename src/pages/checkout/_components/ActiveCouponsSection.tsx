import { useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SparklesIcon, WalletIcon, ChevronDownIcon } from "lucide-react";

interface ActiveCouponsSectionProps {
  onCouponSelect: (code: string) => Promise<void>;
  appliedCouponCode?: string;
  /**
   * What the basket is worth right now, before any discount.
   *
   * A coupon with a minimum the shopper has not reached is not a dead row —
   * it is the reason to add another skin. Told "₹300 away", they can act on
   * it; shown a bare "Min. cart value ₹999", they can only feel refused.
   */
  cartValue?: number;
}

/**
 * Every live offer, listed under the code field.
 *
 * A shopper who has no code is the one who most needs to see the offers, and
 * the codes are not a secret — they are the store's own promotions. Hiding
 * them behind a field you can only use if you already know the answer wastes
 * the discount the store already agreed to give.
 */
export function ActiveCouponsSection({
  onCouponSelect,
  appliedCouponCode,
  cartValue = 0,
}: ActiveCouponsSectionProps) {
  const activeCoupons = useQuery(api.coupons.getActiveCoupons);
  const [expanded, setExpanded] = useState(false);

  if (!activeCoupons || activeCoupons.length === 0) {
    return null;
  }

  // Reachable offers first: the ones the shopper can take right now are worth
  // more than the ones they must grow the basket for, and both beat none.
  // The admin form writes the minimum as `minPurchase`, the cart-value rule as
  // `minCartValue`, and some older rows carry `minPurchaseAmount`. Reading only
  // one of the three made every real coupon look like it had no minimum.
  const minOf = (c: any) =>
    Number(c?.minPurchase ?? c?.minCartValue ?? c?.minPurchaseAmount ?? 0) || 0;

  const sorted = [...activeCoupons].sort((a: any, b: any) => {
    const aShort = Math.max(0, minOf(a) - cartValue);
    const bShort = Math.max(0, minOf(b) - cartValue);
    if (aShort !== bShort) return aShort - bShort;
    return (Number(b.discountValue) || 0) - (Number(a.discountValue) || 0);
  });

  const COLLAPSED = 3;
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED);
  const hidden = sorted.length - visible.length;

  return (
    // Carries the logo's green, because this is the one block on the page a
    // shopper benefits from noticing. Everything else at checkout is neutral
    // by design; the offers earn the colour by saving them money.
    <Card className="sticker gap-0 overflow-hidden rounded-2xl py-0">
      {/* A solid bar in the logo's green. A tint alone got lost between two
          white cards; this is the one block on the page a shopper is better
          off noticing, so it is allowed to be the thing they see first. */}
      <div className="flex items-center gap-2 border-b-2 border-ink bg-brand px-4 py-2 text-brand-foreground">
        <SparklesIcon className="size-4 shrink-0" />
        <span className="text-sm font-semibold">Available offers</span>
        <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold leading-none">
          {sorted.length}
        </span>
      </div>
      <CardContent className="space-y-2 bg-blush/15 p-3">

        {visible.map((coupon: any) => {
          const isApplied = appliedCouponCode === coupon.code;
          const isWalletCredit = coupon.effectType === "wallet_credit";
          const min = minOf(coupon);
          const shortfall = Math.max(0, min - cartValue);
          const discountText =
            coupon.discountType === "percentage"
              ? `${coupon.discountValue}% OFF`
              : isWalletCredit
                ? `₹${coupon.discountValue} CREDIT`
                : `₹${coupon.discountValue} OFF`;

          return (
            <div
              key={coupon._id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                isApplied
                  ? "border-ink bg-brand/15"
                  : "border-dashed border-ink/35 bg-background"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold tracking-wide text-brand">
                    {coupon.code}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {discountText}
                  </span>
                  {isWalletCredit && (
                    <span className="flex items-center gap-0.5 text-[11px] text-purple-600 dark:text-purple-400">
                      <WalletIcon className="size-3" />
                      on delivery
                    </span>
                  )}
                </div>
                {shortfall > 0 ? (
                  <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Add ₹{shortfall.toFixed(0)} more to unlock
                  </p>
                ) : coupon.description ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {coupon.description}
                  </p>
                ) : null}
              </div>
              {isApplied ? (
                <span className="shrink-0 text-xs font-semibold text-brand">
                  Applied
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onCouponSelect(coupon.code)}
                  disabled={shortfall > 0}
                  className="sticker-sm sticker-press h-7 shrink-0 rounded-lg bg-brand px-3 text-xs font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-40"
                >
                  Apply
                </Button>
              )}
            </div>
          );
        })}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center justify-center gap-1 pt-0.5 text-xs font-semibold text-brand hover:underline"
          >
            View {hidden} more offer{hidden === 1 ? "" : "s"}
            <ChevronDownIcon className="size-3.5" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
