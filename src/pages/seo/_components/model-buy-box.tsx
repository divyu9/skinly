import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StarIcon, CheckIcon } from "lucide-react";
import { QuickBuyBody } from "@/components/home/quick-buy.tsx";
import { responsiveImg } from "@/lib/image-cdn";
import type { SeoPageData } from "../use-seo-page-data";

/**
 * Buy on the model page itself: the chosen design on this very phone, a row of
 * designs to pick from, and the same finish / coverage / Smart Setup / Add to
 * cart as the product page (QuickBuyBody), with the phone already set.
 *
 * Only where the build gave the page a buy box (scripts/prerender.mjs
 * buyBoxFor: the top 100 models with mockups done). It sits above the design
 * grid and adds nothing the page's H1, copy or FAQ depended on. `?design=`
 * opens on that design: the variant URLs in the page's ProductGroup point
 * here, so Google's link lands on the design it showed.
 */
export default function ModelBuyBox({ data, hasH1 = false, onSeeAll }: {
  data: SeoPageData; hasH1?: boolean;
  /** Scroll to the grid below, showing this finish (null: all). */
  onSeeAll?: (finish: string | null) => void;
}) {
  const box = data.buyBox!;
  const t = data.target;
  const [params, setParams] = useSearchParams();
  const bySlug = new Map(box.designs.map((x) => [x.slug, x]));
  const [slug, setSlug] = useState(() => (bySlug.has(params.get("design") || "") ? params.get("design")! : box.designs[0].slug));
  const d = bySlug.get(slug) || box.designs[0];
  const minPrice = Math.min(...box.designs.map((x) => x.price));
  // Older seo-data (before the tabs) has none: one "Best sellers" row of all.
  const tabs = box.tabs?.length ? box.tabs : [{ key: "best", label: "Best sellers", count: data.total, slugs: box.designs.map((x) => x.slug) }];
  const [tabKey, setTabKey] = useState(tabs[0].key);
  const tab = tabs.find((x) => x.key === tabKey) || tabs[0];
  const SHOW = 17;  // three rows of six on desktop, the last tile is "+N more"
  const swatches = tab.slugs.slice(0, SHOW).map((x) => bySlug.get(x)).filter(Boolean) as typeof box.designs;
  const more = Math.max(0, tab.count - swatches.length);
  // Every design is on this page, in the grid below (with its "Show more").
  const toGrid = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSeeAll) onSeeAll(tab.key === "best" ? null : tab.key);
    else document.getElementById("all-designs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pick = (next: string) => {
    setSlug(next);
    const q = new URLSearchParams(params);
    q.set("design", next);
    setParams(q, { replace: true, preventScrollReset: true });
  };

  return (
    <section className="border-b-2 border-ink/10 bg-background" aria-label={`Buy ${box.name}`}>
      <div className={`container mx-auto max-w-6xl px-3 sm:px-4 ${hasH1 ? "pb-8 pt-4 md:pb-12 md:pt-6" : "py-8 md:py-12"}`}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
          {/* The design on this phone */}
          <div>
            <div className="sticker overflow-hidden rounded-3xl border-2 border-ink bg-card">
              <img
                key={d.mockupUrl}
                {...responsiveImg(d.mockupUrl, [480, 720, 960], "(min-width: 768px) 560px, calc(100vw - 24px)")}
                alt={`${t.brand} ${t.model} skin: ${d.title}`}
                width={960}
                height={960}
                className="aspect-square w-full object-contain"
              />
            </div>
            {/* One line, always: a long title wrapping to two moved everything below it. */}
            <p className="mt-2 truncate text-center text-xs text-muted-foreground" title={`${d.title} on the ${t.brand} ${t.model}`}>
              On the {t.brand} {t.model}
            </p>
          </div>

          {/* Pick and buy */}
          <div className="min-w-0">
            {/* The page's H1 sits just above when the hero is gone; no second title then. */}
            {!hasH1 && <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{box.name}</h2>}
            <div className={`${hasH1 ? "" : "mt-2 "}flex flex-wrap items-center gap-x-3 gap-y-1 text-sm`}>
              {box.rating && (
                <Link to="/reviews" className="inline-flex items-center gap-1 font-semibold hover:underline">
                  <StarIcon className="size-4 fill-sunny text-ink" />
                  {box.rating.value} · {box.rating.count} review{box.rating.count === 1 ? "" : "s"}
                </Link>
              )}
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-600" /> In stock
              </span>
              <span className="text-muted-foreground">from ₹{minPrice}</span>
            </div>

            {/* Finish tabs: each says how many designs it has for this phone. */}
            <div role="tablist" aria-label="Finish" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {tabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="tab"
                  aria-selected={x.key === tab.key}
                  onClick={() => {
                    setTabKey(x.key);
                    // The big photo follows the tab, unless the chosen design is in it.
                    if (!x.slugs.includes(d.slug) && x.slugs[0]) pick(x.slugs[0]);
                  }}
                  className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition ${x.key === tab.key ? "border-ink bg-ink text-background" : "border-ink/20 bg-card hover:border-ink"}`}
                >
                  {x.label} <span className={x.key === tab.key ? "opacity-80" : "text-muted-foreground"}>{x.count}</span>
                </button>
              ))}
            </div>

            <p className="mt-3 truncate text-sm font-bold" title={d.title}>
              Design: <span className="font-semibold text-muted-foreground">{d.title}</span>
            </p>
            <div className="mt-2 grid grid-cols-6 gap-1.5 sm:gap-2">
              {swatches.map((x) => (
                <button
                  key={x.slug}
                  type="button"
                  onClick={() => pick(x.slug)}
                  aria-label={x.title}
                  aria-pressed={x.slug === d.slug}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-card transition ${x.slug === d.slug ? "border-ink ring-2 ring-brand" : "border-ink/15 hover:border-ink"}`}
                >
                  <img
                    {...responsiveImg(x.mockupUrl, [120, 180], "72px")}
                    alt=""
                    loading="lazy"
                    width={120}
                    height={120}
                    className="size-full object-cover"
                  />
                  {x.slug === d.slug && (
                    <span className="absolute right-0.5 top-0.5 rounded-full bg-ink p-0.5 text-background">
                      <CheckIcon className="size-3" />
                    </span>
                  )}
                </button>
              ))}
              {more > 0 && (
                <a
                  href="#all-designs"
                  onClick={toGrid}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink bg-sunny text-center leading-tight text-ink hover:brightness-95"
                  aria-label={`See all ${tab.count} designs for the ${t.model} below`}
                >
                  <span className="text-sm font-extrabold">+{more}</span>
                  <span className="text-[10px] font-bold">more</span>
                </a>
              )}
            </div>
            {more > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {tab.count} {tab.key === "best" ? "" : `${tab.label} `}designs for the {t.model} ·{" "}
                <a href="#all-designs" onClick={toGrid} className="font-semibold text-brand hover:underline">see all ↓</a>
              </p>
            )}

            <div className="mt-5">
              <QuickBuyBody slug={d.slug} onDone={() => {}} fixedDevice={{ brand: t.brand!, model: t.model! }} hideThumb />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
