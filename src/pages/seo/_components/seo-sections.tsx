import { Link } from "react-router-dom";
import { brandGadgetLabel } from "@/lib/seo-pages.mjs";
import { ProductCard } from "@/components/products/ProductCard.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { SeoPageData } from "../use-seo-page-data";

/**
 * The products an SEO page is about.
 *
 * These pages used to show the first eight products in the catalogue whatever
 * the page was for, from a live listener on every product and variant. Now the
 * list is the page's own — its device, brand, finish or theme — built with the
 * site's product card, so on a model page each design shows on that model when
 * we have the photo and opens with the model already chosen.
 */
export function SeoProductsSection({ data, heading }: { data: SeoPageData | undefined; heading: string }) {
  if (data === undefined) {
    return (
      <section className="border-y-2 border-ink/10 bg-card/60">
        <div className="container mx-auto px-3 py-10 sm:px-4 md:py-14">
          <Skeleton className="mx-auto mb-8 h-8 w-64" />
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const t = data.target;
  const onDevice = t.kind === "model" && t.brand && t.model;

  if (data.total === 0) {
    return (
      <section className="border-y-2 border-ink/10 bg-card/60">
        <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
          <h2 className="mb-3 text-2xl font-bold">No designs in this style right now</h2>
          <p className="mb-6 text-muted-foreground">
            We print in small batches and this one is between runs. Browse what is in stock today.
          </p>
          <Link
            to="/products?productType=skin"
            className="sticker sticker-press inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground"
          >
            Shop all skins
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border-y-2 border-ink/10 bg-card/60">
      <div className="container mx-auto px-3 py-10 sm:px-4 md:py-14">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl text-balance">{heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.total} designs
            {data.minPrice ? ` · from ₹${data.minPrice}` : ""}
            {onDevice ? ` · each cut for the ${t.model}` : " · each cut for your exact device"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {data.products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              brandFilter={onDevice ? t.brand! : null}
              modelFilter={onDevice ? t.model! : null}
              deviceCategory={onDevice ? t.gadget : null}
              autoSortOOS={false}
            />
          ))}
        </div>
        {data.total > data.products.length && (
          <div className="mt-8 text-center">
            <Link
              to={data.listing}
              className="sticker sticker-press inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-brand-foreground"
            >
              See all {data.total} designs
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The models a brand page covers, each linking to its own page where one
 * exists and otherwise to the listing already filtered to it.
 */
export function SeoModelsSection({ data }: { data: SeoPageData | undefined }) {
  const models = data?.models || [];
  if (!data || models.length === 0) return null;
  const brand = data.target.brand || "";
  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">{brand} models we cut for</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Pick yours — every design is printed and cut to its exact size.
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {models.map((m) => (
            <li key={`${m.brand}-${m.model}`}>
              <Link
                to={m.href}
                className="inline-flex rounded-full border-2 border-ink/15 bg-card px-3 py-1.5 text-sm font-semibold text-ink/80 transition-colors hover:border-ink/40"
              >
                {m.model.toLowerCase().startsWith(brand.toLowerCase()) ? m.model : `${brand} ${m.model}`}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The brand's other shelves.
 *
 * A brand page is about whichever gadget that brand mostly makes, so Samsung's
 * page is phones and its 74 tablets appear nowhere on it. What was offered
 * instead was the whole brand grid — every competitor's name on a page
 * somebody reached by searching for this one.
 */
export function SeoBrandGadgetsSection({ data }: { data: SeoPageData | undefined }) {
  const rows = data?.brandGadgets || [];
  const brand = data?.target?.brand || "";
  // One shelf is not a hub; it is the page you are already on.
  if (!data || !brand || rows.length < 2) return null;
  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">More from {brand}</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Every {brand} gadget we cut skins for.
        </p>
        <ul className="flex flex-wrap justify-center gap-3">
          {rows.map((g: any) => (
            <li key={g.gadget}>
              <Link
                to={g.href}
                className="inline-flex flex-col items-center rounded-xl border-2 border-ink/15 bg-card px-5 py-3 transition-colors hover:border-ink/40"
              >
                {/* "Apple Phones" is a phrase nobody says; it is iPhones. */}
                <span className="text-sm font-semibold">{brandGadgetLabel(brand, g.gadget, true)}</span>
                <span className="text-xs text-muted-foreground">{g.count} models</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
