import { StarIcon } from "lucide-react";
import type { PublicReview } from "@/lib/public-reviews";

/**
 * One line from a real buyer, under the buy buttons — a DEMO for now.
 *
 * Shown only with ?quoteDemo=1 in the URL, so the owner can judge it on a
 * live page before any shopper sees it. It takes the best review of this
 * design that has words in it (4★+, shortest-first so it fits one line);
 * with none yet, a clearly marked sample.
 */
export function ReviewQuote({ reviews }: { reviews: PublicReview[] | undefined }) {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("quoteDemo") !== "1") return null;
  const real = (reviews || [])
    .filter((r) => r.rating >= 4 && (r.comment || "").trim().length >= 12)
    .sort((a, b) => (a.comment || "").length - (b.comment || "").length)[0];
  const q = real
    ? { text: String(real.comment).trim(), who: real.userName || "Verified buyer", city: real.city, rating: real.rating }
    : { text: "Fits perfectly, the edges are clean and the matte feels premium.", who: "Priya S.", city: "Pune", rating: 5 };
  return (
    <div className="relative flex items-start gap-3 rounded-2xl border-2 border-ink/10 bg-card px-3.5 py-3">
      <span className="absolute -top-2.5 right-3 rounded-full border-2 border-ink bg-sunny px-2 text-[10px] font-extrabold text-ink">
        DEMO{real ? "" : " · sample text"}
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-extrabold text-brand-deep">
        {q.who.charAt(0)}
      </span>
      <div className="min-w-0">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} className={`size-3 ${i <= q.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`} />)}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug">“{q.text}”</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {q.who}{q.city ? `, ${q.city}` : ""} · <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Verified Buyer</span>
        </p>
      </div>
    </div>
  );
}
