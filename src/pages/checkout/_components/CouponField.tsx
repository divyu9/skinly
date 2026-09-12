import { TagIcon, CheckCircleIcon, AlertCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import type { AppliedCoupon } from "./OrderSummaryPanel.tsx";

/**
 * Coupon entry, standing on its own.
 *
 * It used to live inside the order summary, which on a phone is folded shut —
 * so the one field a shopper hunts for when they have a code was behind a tap,
 * inside something labelled "Order summary". A code they cannot find is a
 * checkout they abandon to go looking for it.
 */
export function CouponField({
  couponCode,
  appliedCoupon,
  isApplyingCoupon,
  couponMessage,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
}: {
  couponCode: string;
  appliedCoupon: AppliedCoupon | null;
  isApplyingCoupon: boolean;
  couponMessage: { type: "success" | "error"; text: string } | null;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
}) {
  return (
    <Card className="rounded-2xl border-2 border-ink/15">
      <CardContent className="space-y-3 p-4">
        {!appliedCoupon ? (
          <>
            <div className="flex items-center gap-2 text-sm font-medium">
              <TagIcon className="size-4" />
              Have a coupon?
            </div>
            <div className="flex gap-2">
              <Input
                // No placeholder. `uppercase` shouts placeholder text as
                // ENTER COUPON CODE, which reads like a filled-in value the
                // shopper has to clear before typing. The label above already
                // says what the field is for.
                value={couponCode}
                onChange={(e) => onCouponCodeChange(e.target.value.toUpperCase())}
                disabled={isApplyingCoupon}
                // A code is never lower case, and a phone keyboard that starts
                // in caps saves the shopper a shift key they will not press.
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 uppercase"
              />
              <Button
                type="button"
                variant="outline"
                onClick={onApplyCoupon}
                disabled={!couponCode.trim() || isApplyingCoupon}
                className="sticker-sm sticker-press rounded-lg border-ink font-bold"
              >
                {isApplyingCoupon ? "Applying…" : "Apply"}
              </Button>
            </div>
            {couponMessage && (
              <div
                className={`flex items-start gap-2 rounded-lg p-2 text-xs ${
                  couponMessage.type === "success"
                    ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                }`}
              >
                {couponMessage.type === "success" ? (
                  <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-green-600" />
                ) : (
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600" />
                )}
                <p>{couponMessage.text}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
            <TagIcon className="mt-0.5 size-4 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  {appliedCoupon.coupon.code}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveCoupon}
                  className="size-6 p-0 text-green-600 hover:text-green-700"
                  aria-label="Remove coupon"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs font-medium text-green-700 dark:text-green-300">
                {appliedCoupon.isWalletCredit
                  ? `₹${appliedCoupon.walletCreditAmount} wallet credit on delivery`
                  : `You're saving ₹${appliedCoupon.discountAmount.toFixed(0)}`}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
