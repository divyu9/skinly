import { useState } from "react";
import { toast } from "sonner";
import {
  TagIcon,
  CopyIcon,
  CheckIcon,
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
 *
 * A white card on a white page said "there is an offer here" as quietly as it
 * is possible to say it. The block is tinted now, and the code itself is the
 * button: a dashed sunny ticket you press, rather than a label sitting beside
 * a small grey icon that most people never read as clickable.
 */
export function OffersSection({ coupons }: OffersSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const hasCoupons = coupons && coupons.length > 0;
  if (!hasCoupons) return null;

  const handleCopyCoupon = async (code: string) => {
    /*
     * Two ways, because the modern one is not always available.
     * `navigator.clipboard` needs a secure context and is refused outright by
     * some in-app browsers — the ones people arrive in from Instagram, which
     * is most of this traffic. Falling back to a hidden textarea and
     * execCommand is deprecated but works there, and a coupon that will not
     * copy on a phone is a discount nobody can spend.
     */
    const viaClipboardApi = async () => {
      if (!navigator.clipboard?.writeText) return false;
      try {
        await navigator.clipboard.writeText(code);
        return true;
      } catch {
        return false;
      }
    };

    const viaTextarea = () => {
      try {
        const el = document.createElement("textarea");
        el.value = code;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, code.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        return ok;
      } catch {
        return false;
      }
    };

    const ok = (await viaClipboardApi()) || viaTextarea();
    if (!ok) {
      // Both refused. The code is on screen anyway, so say it rather than
      // leaving a button that appears to do nothing.
      toast.error(`Couldn't copy — enter ${code} at checkout`);
      return;
    }
    setCopied(code);
    toast.success(`${code} copied`);
    window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
  };

  const getDiscountText = (coupon: Coupon) =>
    coupon.discountType === "percentage"
      ? `${coupon.discountValue}% OFF${coupon.maxDiscount ? ` up to ₹${coupon.maxDiscount}` : ""}`
      : `₹${coupon.discountValue} OFF`;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ink/15 bg-brand/[0.07]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <TagIcon className="size-3.5" strokeWidth={2.4} />
          </span>
          <span>
            {coupons.length === 1 ? "1 offer available" : `${coupons.length} offers available`}
          </span>
        </div>
        {collapsed ? (
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUpIcon className="size-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-2 px-3 pb-3">
          {coupons.map((coupon) => {
            const isCopied = copied === coupon.code;
            return (
              <div
                key={coupon._id}
                className="flex items-stretch gap-3 rounded-xl border-2 border-ink/15 bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold leading-tight text-brand">
                    {getDiscountText(coupon)}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {coupon.description}
                  </p>
                  {coupon.minPurchase ? (
                    <p className="mt-1 text-[11px] font-medium text-ink/60">
                      On orders over ₹{coupon.minPurchase}
                    </p>
                  ) : null}
                </div>

                {/* The code is the button. A dashed ticket edge reads as
                    "tear this off" without needing a caption. */}
                <button
                  type="button"
                  onClick={() => handleCopyCoupon(coupon.code)}
                  aria-label={`Copy coupon code ${coupon.code}`}
                  className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-2 transition-colors ${
                    isCopied
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-ink/30 bg-sunny/40 text-ink hover:bg-sunny/70"
                  }`}
                >
                  <span className="font-mono text-[13px] font-extrabold tracking-wide">
                    {coupon.code}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide opacity-80">
                    {isCopied ? (
                      <>
                        <CheckIcon className="size-3" strokeWidth={3} />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" strokeWidth={2.5} />
                        Tap to copy
                      </>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
