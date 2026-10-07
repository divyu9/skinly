import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BadgeCheckIcon } from "lucide-react";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";
import { ReviewCard, Stars } from "@/components/customer-reviews.tsx";
import { readActiveDevice } from "@/lib/active-device";
import { reviewStats, useApprovedReviews } from "@/lib/public-reviews";
import { cn } from "@/lib/utils.ts";

/**
 * /reviews: every approved review, from buyers only (each is tied to a
 * delivered order). Filter to the ones with photos, a star rating, or the
 * shopper's own phone. Nothing is hidden for being low — a page of only
 * five-stars reads as curated, and is not allowed to be.
 */

const PAGE = 24;

export default function ReviewsPage() {
  const all = useApprovedReviews();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [shown, setShown] = useState(PAGE);
  const device = useMemo(() => { const d = readActiveDevice(); return d && d.isConfirmed !== false ? d : null; }, []);

  const stats = reviewStats(all || []);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: (all || []).filter((r) => Math.round(r.rating) === n).length }));
  const list = useMemo(() => {
    const l = all || [];
    if (filter === "photos") return l.filter((r) => r.imageUrls?.length);
    if (filter === "mine" && device) return l.filter((r) => String(r.device || "").toLowerCase().includes(device.model.toLowerCase()));
    if (/^\d$/.test(filter)) return l.filter((r) => Math.round(r.rating) === Number(filter));
    // Something to see or read first; stars-only reviews still count and still show, after them.
    const rank = (r: typeof l[number]) => (r.imageUrls?.length ? 0 : r.comment?.trim() || r.title?.trim() ? 1 : 2);
    return [...l].sort((a, b) => rank(a) - rank(b));
  }, [all, filter, device]);

  const chip = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => { setFilter(id); setShown(PAGE); }}
      className={cn("shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors",
        filter === id ? "border-ink bg-brand text-brand-foreground shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 bg-card hover:border-ink/40")}>
      {label}
    </button>
  );

  return (
    <div className="halftone min-h-screen">
      <Helmet>
        <title>Customer Reviews | GoSkinly</title>
        <meta name="description" content="Reviews and photos from verified GoSkinly buyers — every review is tied to a delivered order." />
        <link rel="canonical" href="https://goskinly.com/reviews" />
      </Helmet>
      <AnnouncementBar />
      <MobileHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} />

      <main className="container mx-auto px-4 pb-16 pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sunny px-3 py-1 text-xs font-extrabold text-ink">
            <BadgeCheckIcon className="size-3.5" /> Only verified buyers
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">Customer reviews</h1>
          <p className="mt-3 text-muted-foreground md:text-lg">Every review here comes from a delivered order — nobody else can write one.</p>
        </div>

        {all === undefined ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : !all.length ? (
          <div className="mx-auto mt-12 max-w-md text-center text-muted-foreground">
            <p>Our first orders are just being delivered — reviews will appear here soon.</p>
            <Link to="/real-photos" className="mt-4 inline-block font-bold text-brand-deep underline">Meanwhile, see real photos of our skins →</Link>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-8 grid max-w-3xl items-center gap-6 rounded-2xl border-2 border-ink bg-card p-5 shadow-[3px_3px_0_0_var(--ink)] sm:grid-cols-2">
              <div className="text-center">
                <p className="text-5xl font-extrabold">{stats.averageRating.toFixed(1)}</p>
                <div className="mt-1 flex justify-center"><Stars n={stats.averageRating} size="size-5" /></div>
                <p className="mt-1 text-sm text-muted-foreground">{stats.total} verified {stats.total === 1 ? "review" : "reviews"}</p>
              </div>
              <div className="space-y-1.5">
                {dist.map(({ n, c }) => (
                  <button key={n} type="button" onClick={() => { setFilter(String(n)); setShown(PAGE); }} className="flex w-full items-center gap-2 text-sm">
                    <span className="w-3">{n}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${stats.total ? (c / stats.total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 text-right text-muted-foreground">{c}</span>
                  </button>
                ))}
              </div>
            </div>

            <div data-drag-scroll className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 md:justify-center">
              {chip("all", "All")}
              {chip("photos", "With photos")}
              {device && chip("mine", `Your ${device.model}`)}
              {[5, 4, 3, 2, 1].map((n) => chip(String(n), `${n}★`))}
            </div>

            {list.length === 0 ? (
              <p className="mt-12 text-center text-muted-foreground">No reviews match this filter yet.</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.slice(0, shown).map((r) => (
                  r.productSlug
                    ? <Link key={r._id} to={`/products/${r.productSlug}`} className="block"><ReviewCard r={r} clamp={false} /></Link>
                    : <ReviewCard key={r._id} r={r} clamp={false} />
                ))}
              </div>
            )}
            {shown < list.length && (
              <div className="mt-8 flex justify-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="sticker-sm sticker-press rounded-full bg-card px-6 py-2.5 text-sm font-bold">
                  Show more ({list.length - shown} left)
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
