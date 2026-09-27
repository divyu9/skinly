import { useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { ProductThumb } from "@/components/product-thumb.tsx";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import type { Id } from "@/lib/firebase-api";

interface SuggestedProductsSectionProps {
  productId: Id<"products">;
  /** The shopper's device brand, when chosen: only listings that fit it are shown. */
  brand?: string | null;
}

export function SuggestedProductsSection({ productId, brand }: SuggestedProductsSectionProps) {
  const data = useQuery(api.productSections.getSuggestedProducts, { productId, ...(brand ? { brand } : {}) } as any);
  const [finish, setFinish] = useState("all");

  // Don't render anything if no config or no products
  if (data === undefined) {
    return <SuggestedProductsSkeleton />;
  }

  if (!data.config || data.products.length === 0) {
    return null;
  }

  const { config } = data;
  const all: any[] = data.products;
  /*
   * Tabs by finish when the row mixes them: Matte (₹199) and 3D Textured
   * (₹299) are the first choice a phone-skin shopper makes, and one row of
   * both made them hunt. A tab shows only with three or more designs in it.
   */
  const finishOf = (p: any) => {
    const f = String(p.finishType || "").toLowerCase();
    return f === "matte" ? "matte" : f === "embossed" || f === "3d" ? "3d" : f === "transparent" ? "tranzy" : "";
  };
  const FINISH_TABS: Array<[string, string]> = [["matte", "Matte"], ["3d", "3D Textured"], ["tranzy", "Tranzy"]];
  const finishTabs = FINISH_TABS.filter(([k]) => all.filter((p) => finishOf(p) === k).length >= 3);
  const showTabs = finishTabs.length >= 2;
  const products = showTabs && finish !== "all" ? all.filter((p) => finishOf(p) === finish) : all;

  return (
    <section className="py-8 md:py-12">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{config.sectionTitle}</h2>
            {config.sectionDescription && (
              <p className="text-muted-foreground mt-1">{config.sectionDescription}</p>
            )}
          </div>
          {products.length > 3 && (
            <ScrollNavButtons containerId="suggested-products-scroll" />
          )}
        </div>

        {showTabs && (
          <div data-drag-scroll className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {[["all", "All"] as [string, string], ...finishTabs].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFinish(k)}
                className={cn(
                  "shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors",
                  finish === k ? "border-ink bg-brand text-brand-foreground shadow-[2px_2px_0_0_var(--ink)]" : "border-ink/15 bg-card hover:border-ink/40",
                )}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Products Horizontal Scroll */}
        <div className="relative -mx-4 px-4">
          <div
            id="suggested-products-scroll"
            data-drag-scroll className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory"
          >
            {products.map((product: any) => {
            const firstVariant = product.variants && product.variants[0];
            const isOutOfStock = firstVariant?.inventoryQuantity === 0 || firstVariant?.inventory_quantity === 0;
            const price = firstVariant?.price || 0;
              const compareAtPrice = firstVariant?.compareAtPrice;
              const hasDiscount = compareAtPrice && compareAtPrice > price;
              const discountPercent = hasDiscount
                ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
                : 0;

              return (
                <Link
                  key={product._id}
                  to={`/products/${product.slug}`}
                  className="flex-shrink-0 w-[200px] md:w-[240px] snap-start group"
                >
                  <Card className="border-2 hover:border-primary transition-all hover:shadow-xl overflow-hidden">
                    <CardContent className="p-0">
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden bg-muted">
                        <ProductThumb
                          src={product.images?.[0]?.url}
                          alt={product.title}
                          className="transition-transform group-hover:scale-110"
                          dimmed={isOutOfStock}
                        />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {hasDiscount && (
                            <span className="rounded-full border-2 border-ink bg-sunny font-bold text-ink px-2 py-0.5 text-[11px]">
                              {discountPercent}% OFF
                            </span>
                          )}
                        </div>

                        {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="px-3 py-1.5 bg-background text-foreground text-sm font-bold rounded-full shadow-lg">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 space-y-1.5">
                        {/* Title */}
                        <h3 className="font-semibold line-clamp-2 text-sm">
                          {product.title}
                        </h3>

                        {/* Price */}
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold">
                            ₹{price.toLocaleString()}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-muted-foreground line-through">
                              ₹{compareAtPrice.toLocaleString()}
                            </span>
                          )}
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SuggestedProductsSkeleton() {
  return (
    <section className="py-8 md:py-12">
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div data-drag-scroll className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[200px] md:w-[240px]">
              <Skeleton className="aspect-square rounded-xl mb-3" />
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
