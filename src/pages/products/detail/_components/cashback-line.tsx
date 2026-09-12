import { CoinsIcon } from "lucide-react";

/**
 * What the coins are worth, said next to the price.
 *
 * The cashback lived in the offers block 665px below the Buy button — an
 * incentive to buy, placed after the point where someone decides. Almost
 * nobody scrolled that far before choosing, so a rule the shop is paying for
 * was doing no work.
 *
 * It says the effective price because "earn ₹49 in coins" is an abstraction
 * and "₹200 effective" is a number you can compare against another shop. What
 * it must not do is imply ₹200 is what you pay today: the coins land in a
 * wallet and buy the *next* order, so the wording keeps the real price first
 * and the effective figure explicitly conditional on spending them.
 */

export interface CashbackInfo {
  hasCashback?: boolean;
  cashbackType?: "fixed" | "percentage" | string;
  cashbackValue?: number;
  maxCashback?: number;
  displayText?: string | null;
}

/** Rupees back on a purchase at this price, or 0 when the rule cannot apply. */
export function cashbackAmount(info: CashbackInfo | null | undefined, price: number): number {
  if (!info?.hasCashback || !(price > 0)) return 0;
  const value = Number(info.cashbackValue) || 0;
  if (value <= 0) return 0;

  const raw = info.cashbackType === "percentage" ? (price * value) / 100 : value;
  const capped = info.maxCashback ? Math.min(raw, Number(info.maxCashback)) : raw;
  // Never promise back more than the thing costs.
  return Math.floor(Math.min(capped, price));
}

export function CashbackLine({
  info,
  price,
}: {
  info: CashbackInfo | null | undefined;
  price: number;
}) {
  const back = cashbackAmount(info, price);
  if (!back) return null;
  const effective = price - back;

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-sunny/70 bg-sunny/15 px-3 py-2.5">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sunny">
        <CoinsIcon className="size-4 text-ink" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 text-[13px] leading-snug">
        <p className="font-bold text-foreground">
          ₹{back} back in Skinly Coins
          <span className="font-semibold text-muted-foreground">
            {" "}— ₹{effective} effective
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          You pay ₹{price} today; the coins land in your wallet and come off your next order.
        </p>
      </div>
    </div>
  );
}
