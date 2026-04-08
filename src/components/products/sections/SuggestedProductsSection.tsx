import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";
import type { Id } from "@/lib/firebase-api";

interface SuggestedProductsSectionProps {
  productId: Id<"products">;
}

export function SuggestedProductsSection({ productId }: SuggestedProductsSectionProps) {
  const data = useQuery(api.productSections.getSuggestedProducts, { productId });

  // Don't render anything if no config or no products
  if (data === undefined) {
    return <SuggestedProductsSkeleton />;
  }

  if (!data.config || data.products.length === 0) {
    return null;
  }

  const { config, products } = data;

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

        {/* Products Horizontal Scroll */}
        <div className="relative -mx-4 px-4">
          <div
            id="suggested-products-scroll"
            className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory"
          >
            {products.map((product) => {
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
                  to={`/products/detail?slug=${product.slug}`}
                  className="flex-shrink-0 w-[200px] md:w-[240px] snap-start group"
                >
                  <Card className="border-2 hover:border-primary transition-all hover:shadow-xl overflow-hidden">
                    <CardContent className="p-0">
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden bg-muted">
                        {product.images?.[0] && (
                          <img
                            src={product.images[0].url}
                            alt={product.title}
                            loading="lazy"
                            decoding="async"
                            className={cn(
                              "w-full h-full object-cover transition-transform group-hover:scale-110",
                              isOutOfStock && "opacity-30"
                            )}
                          />
                        )}

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {hasDiscount && (
                            <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full shadow-lg">
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

                        {/* Rating placeholder */}
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              className={cn(
                                "size-3",
                                i < 4 ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                              )}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">(4.0)</span>
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
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
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
