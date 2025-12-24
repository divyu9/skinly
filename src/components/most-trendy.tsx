import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface MostTrendyProps {
  sectionId: Id<"homepageSections">;
  config: {
    title: string;
    subtitle?: string;
    tags: string[];
    maxProducts: number;
    cardWidth: number;
    cardHeight: number;
  };
}

export function MostTrendy({ config }: MostTrendyProps) {
  const products = useQuery(api.homepage.getProductsByTags, {
    tags: config.tags,
    maxProducts: config.maxProducts,
  });

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">{config.title}</h2>
          {config.subtitle && (
            <p className="text-muted-foreground">{config.subtitle}</p>
          )}
        </div>

        {/* Horizontal Scroll Container */}
        <div 
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
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
                className="flex-shrink-0 snap-start group"
                style={{ width: config.cardWidth }}
              >
                <Card className="border-2 hover:border-primary transition-all hover:shadow-xl overflow-hidden">
                  <CardContent className="p-0">
                    {/* Image */}
                    <div 
                      className="relative overflow-hidden bg-muted"
                      style={{
                        width: config.cardWidth,
                        height: config.cardHeight - 120, // Reserve space for content below
                      }}
                    >
                      {product.images[0] && (
                        <img
                          src={product.images[0].url}
                          alt={product.title}
                          loading="lazy"
                          decoding="async"
                          width={config.cardWidth}
                          height={config.cardHeight - 120}
                          className={cn(
                            "w-full h-full object-cover transition-transform group-hover:scale-110",
                            isOutOfStock && "opacity-30"
                          )}
                        />
                      )}
                      
                      {/* Badges */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {isOutOfStock && (
                          <Badge variant="destructive" className="text-xs">
                            Out of Stock
                          </Badge>
                        )}
                        {hasDiscount && !isOutOfStock && (
                          <Badge className="bg-green-500 text-white text-xs">
                            {discountPercent}% OFF
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                        {product.title}
                      </h3>
                      
                      {/* Price */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold">
                          ₹{price.toLocaleString()}
                        </span>
                        {hasDiscount && (
                          <span className="text-sm text-muted-foreground line-through">
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
    </section>
  );
}
