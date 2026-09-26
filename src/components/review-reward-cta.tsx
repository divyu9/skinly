import { Link, useLocation } from "react-router-dom";
import { CameraIcon, StarIcon } from "lucide-react";
import { orderGoodsValue, rewardAmount, useReviewRewardRules } from "@/lib/review-rewards";

/**
 * On a delivered order's page: ask for a review, and say what it earns.
 * Carries the page's own link key (?k=) to the review page, so a guest who
 * opened their order from our message can review without signing in.
 */
export function ReviewRewardCta({ order, orderId }: { order: any; orderId: string }) {
  const rules = useReviewRewardRules();
  const { search } = useLocation();
  if (order?.status !== "delivered" || order?.isDeleted) return null;

  const k = new URLSearchParams(search).get("k");
  const href = `/review/${orderId}${k ? `?k=${encodeURIComponent(k)}` : ""}`;
  const value = orderGoodsValue(order);
  const withPhoto = rules ? rewardAmount(rules, value, true) : 0;
  const textOnly = rules ? rewardAmount(rules, value, false) : 0;
  const paid = Number(order?.reviewRewardPaid) || 0;
  const reviewed = !!order?.reviewedAt;

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-ink bg-sunny/40 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-background">
          <StarIcon className="size-5 fill-yellow-300 text-yellow-300" />
        </span>
        <div className="min-w-0 flex-1">
          {paid > 0 ? (
            <>
              <h2 className="text-base font-bold">Thanks for your review! ₹{paid} added to your wallet</h2>
              <p className="text-sm text-muted-foreground">Use it on your next order. You can still add photos to your review.</p>
            </>
          ) : reviewed ? (
            <>
              <h2 className="text-base font-bold">Thanks! Your review is with us</h2>
              <p className="text-sm text-muted-foreground">
                Once it's approved{withPhoto > 0 ? `, up to ₹${withPhoto} goes to your wallet` : ""}. Add a photo to earn the most.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold">
                Loved it? Tell others{withPhoto > 0 ? <> — get up to <span className="whitespace-nowrap">₹{withPhoto} back</span></> : ""}
              </h2>
              {rules?.enabled && withPhoto > 0 && (
                <p className="mt-0.5 text-sm">
                  <b>{rules.photoPct}%</b> of your order back with a photo, <b>{rules.textPct}%</b> for a written review
                  <span className="text-muted-foreground"> (max ₹{rules.maxAmount}). Takes 30 seconds.</span>
                </p>
              )}
            </>
          )}
          <Link to={href}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border-2 border-ink bg-brand px-4 text-sm font-bold text-brand-foreground">
            <CameraIcon className="size-4" /> {reviewed ? "Edit / add photos" : "Rate & review"}
          </Link>
          {!reviewed && textOnly > 0 && withPhoto > textOnly && (
            <span className="ml-3 text-xs text-muted-foreground">₹{textOnly} without a photo</span>
          )}
        </div>
      </div>
    </section>
  );
}
