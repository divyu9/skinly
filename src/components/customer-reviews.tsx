import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { BadgeCheckIcon, StarIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { responsiveImg } from "@/lib/image-cdn";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";

/**
 * Homepage › Customer reviews: what buyers wrote, once an admin approved it
 * (Admin › Reviews). Reviews with a photo and four or five stars lead, newest
 * first. Hidden until there is one to show.
 */
type Review = {
  _id: string; productTitle?: string; productSlug?: string; rating: number; comment?: string; title?: string;
  imageUrls?: string[]; userName?: string; device?: string; createdAt?: number;
};

export function CustomerReviews() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  useEffect(() => {
    let live = true;
    // The rules let the public read approved reviews only, so the query says so.
    getDocs(query(collection(db, "reviews"), where("status", "==", "approved"), limit(60)))
      .then((s) => {
        const rows = s.docs.map((d) => ({ _id: d.id, ...d.data() } as Review))
          .filter((r) => r.rating >= 4 && (r.comment?.trim() || r.imageUrls?.length))
          .sort((a, b) =>
            Number(!!b.imageUrls?.length) - Number(!!a.imageUrls?.length) || (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 16);
        if (live) setReviews(rows);
      })
      .catch(() => { if (live) setReviews([]); });
    return () => { live = false; };
  }, []);

  if (!reviews?.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-center gap-6">
        <div className="flex-1 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">What our customers say</h2>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground md:text-base">
            <StarIcon className="size-4 fill-yellow-400 text-yellow-400" /> {avg.toFixed(1)} from verified buyers
          </p>
        </div>
        {reviews.length > 3 && <ScrollNavButtons containerId="customer-reviews-scroll" />}
      </div>
      <div id="customer-reviews-scroll" className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
        {reviews.map((r) => {
          const photo = r.imageUrls?.[0];
          const body = (
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-ink/15 bg-card transition-shadow hover:shadow-xl">
              {photo && (
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img {...responsiveImg(photo, [320, 480, 640], "280px")} alt={`${r.productTitle || "Skin"} — customer photo`}
                    loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarIcon key={n} className={`size-4 ${n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  ))}
                </div>
                {r.comment && <p className={`text-sm ${photo ? "line-clamp-3" : "line-clamp-6"}`}>“{r.comment}”</p>}
                <div className="mt-auto pt-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1 font-semibold text-foreground">
                    {r.userName || "Verified buyer"} <BadgeCheckIcon className="size-3.5 text-brand" />
                  </p>
                  <p className="line-clamp-1">{[r.productTitle, r.device].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            </div>
          );
          return r.productSlug ? (
            <Link key={r._id} to={`/products/${r.productSlug}`} className="w-[260px] shrink-0 snap-start md:w-[280px]">{body}</Link>
          ) : (
            <div key={r._id} className="w-[260px] shrink-0 snap-start md:w-[280px]">{body}</div>
          );
        })}
      </div>
    </section>
  );
}
