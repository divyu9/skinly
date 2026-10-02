import { useEffect, useState } from "react";
import { getDocsOf } from "@/lib/fs";

/**
 * Approved reviews, as the shop shows them.
 *
 * A design is listed once per brand (the Apple, Samsung, OnePlus and Android
 * listings of one design are four pages), so a review is shown on every
 * listing of its design for the same gadget, not only the one it was written
 * from. Reviews carry `designCode` and `gadget` from submitOrderReview
 * (functions/src/reviews.ts); older ones without them still show on their
 * own listing. The rules let the public read approved reviews only, so every
 * query names that status.
 */

export type PublicReview = {
  _id: string;
  productId?: string;
  productSlug?: string;
  productTitle?: string;
  designCode?: string;
  gadget?: string;
  rating: number;
  title?: string;
  comment?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  userName?: string;
  city?: string;
  device?: string;
  verified?: boolean;
  createdAt?: number;
  _creationTime?: number;
};

const whenOf = (r: PublicReview) => Number(r.createdAt || r._creationTime || 0);

/** "just now", "5 hours ago", "3 days ago", "2 weeks ago", "4 months ago". */
export function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`;
  if (s < 3600) return "just now";
  if (s < 86400) return unit(Math.floor(s / 3600), "hour");
  if (s < 86400 * 14) return unit(Math.floor(s / 86400), "day");
  if (s < 86400 * 60) return unit(Math.floor(s / 86400 / 7), "week");
  if (s < 86400 * 365) return unit(Math.floor(s / 86400 / 30), "month");
  return unit(Math.floor(s / 86400 / 365), "year");
}
export const reviewAge = (r: PublicReview) => timeAgo(whenOf(r));

/** Photos first, then the newest. */
export const sortReviews = (list: PublicReview[]) =>
  [...list].sort((a, b) => Number(!!b.imageUrls?.length) - Number(!!a.imageUrls?.length) || whenOf(b) - whenOf(a));

export function reviewStats(list: PublicReview[]) {
  const rated = list.filter((r) => Number(r.rating) >= 1);
  const total = rated.length;
  const averageRating = total ? Math.round((rated.reduce((s, r) => s + Number(r.rating), 0) / total) * 10) / 10 : 0;
  return { total, averageRating };
}

/** Approved reviews of this listing and of every listing of its design on the same gadget. */
export function useDesignReviews(productId: string | null | undefined, designCode: string | null | undefined, gadget: string | null | undefined) {
  const [reviews, setReviews] = useState<PublicReview[] | undefined>(undefined);
  useEffect(() => {
    if (!productId) return;
    let live = true;
    Promise.all([
      getDocsOf(({ query, collection, db, where, limit }) => query(collection(db, "reviews"), where("status", "==", "approved"), where("productId", "==", productId), limit(100))),
      designCode ? getDocsOf(({ query, collection, db, where, limit }) => query(collection(db, "reviews"), where("status", "==", "approved"), where("designCode", "==", designCode), limit(200))) : null,
    ])
      .then(([own, family]) => {
        const byId = new Map<string, PublicReview>();
        for (const s of [own, family]) s?.docs.forEach((d) => byId.set(d.id, { _id: d.id, ...(d.data() as any) }));
        const rows = [...byId.values()].filter((r) => r.productId === productId || !gadget || !r.gadget || r.gadget === gadget);
        if (live) setReviews(sortReviews(rows));
      })
      .catch(() => live && setReviews([]));
    return () => { live = false; };
  }, [productId, designCode, gadget]);
  return reviews;
}

/** Every approved review, newest first (homepage and /reviews). */
let allOnce: Promise<PublicReview[]> | null = null;
export function loadApprovedReviews(): Promise<PublicReview[]> {
  return (allOnce ||= getDocsOf(({ query, collection, db, where, limit }) => query(collection(db, "reviews"), where("status", "==", "approved"), limit(500)))
    .then((s) => s.docs.map((d) => ({ _id: d.id, ...(d.data() as any) } as PublicReview)).sort((a, b) => whenOf(b) - whenOf(a)))
    .catch(() => []));
}
export function useApprovedReviews() {
  const [list, setList] = useState<PublicReview[] | undefined>(undefined);
  useEffect(() => { let live = true; loadApprovedReviews().then((r) => live && setList(r)); return () => { live = false; }; }, []);
  return list;
}
