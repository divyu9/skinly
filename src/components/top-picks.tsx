import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { StarIcon, ShoppingCartIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface TopPicksProps {
  title?: string;
  tabs?: Array<{
    label: string;
    collectionSlug?: string;
    tag?: string;
  }>;
}

export function TopPicks({ 
  title = "Top Picks For You",
  tabs = [
    { label: "Bestsellers", tag: "bestseller" },
    { label: "New Arrivals", tag: "new" },
    { label: "Trending", tag: "trending" }
  ]
}: TopPicksProps) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Get current tab config
  const currentTab = tabs[activeTab];
  
  // Fetch products based on current tab
  const products = useQuery(
    api.products.getProductsByTag,
    currentTab.tag 
      ? { tag: currentTab.tag, limit: 12 }
      : "skip"
  );

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="space-y-6">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={cn(
                "px-6 py-3 rounded-full font-medium transition-all text-sm md:text-base",
                activeTab === index
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Products Horizontal Scroll */}
        <div className="relative -mx-4 px-4">
          {products === undefined ? (
            // Loading state
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[280px]">
                  <Skeleton className="aspect-square rounded-2xl mb-3" />
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : (
            // Products
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
              {products.map((product) => {
                const firstVariant = product.variants[0];
                const isOutOfStock = firstVariant?.inventoryQuantity === 0;
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
                    className="flex-shrink-0 w-[280px] snap-start group"
                  >
                    <Card className="border-2 hover:border-primary transition-all hover:shadow-xl overflow-hidden">
                      <CardContent className="p-0">
                        {/* Image */}
                        <div className="relative aspect-square overflow-hidden bg-muted">
                          {product.images[0] && (
                            <img
                              src={product.images[0].url}
                              alt={product.title}
                              loading="lazy"
                              decoding="async"
                              width="280"
                              height="280"
                              className={cn(
                                "w-full h-full object-cover transition-transform group-hover:scale-110",
                                isOutOfStock && "opacity-30"
                              )}
                            />
                          )}
                          
                          {/* Badges */}
                          <div className="absolute top-3 left-3 flex flex-col gap-2">
                            {hasDiscount && (
                              <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full shadow-lg">
                                {discountPercent}% OFF
                              </span>
                            )}
                            {product.tags.includes("new") && (
                              <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg">
                                NEW
                              </span>
                            )}
                          </div>

                          {isOutOfStock && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="px-4 py-2 bg-background text-foreground font-bold rounded-full shadow-lg">
                                Out of Stock
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-4 space-y-2">
                          {/* Title */}
                          <h3 className="font-semibold line-clamp-2 text-sm">
                            {product.title}
                          </h3>

                          {/* Price */}
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">
                              ₹{price.toLocaleString()}
                            </span>
                            {hasDiscount && (
                              <span className="text-sm text-muted-foreground line-through">
                                ₹{compareAtPrice.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Rating (placeholder) */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <StarIcon
                                key={i}
                                className={cn(
                                  "size-3",
                                  i < 4 ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                                )}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">
                              (4.0)
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* View All Button */}
        <div className="flex justify-center pt-4">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-8"
          >
            <Link to="/products">
              View All Products
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
