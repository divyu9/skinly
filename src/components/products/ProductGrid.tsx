import { memo } from "react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Loader2Icon, Sparkles } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import type { Product } from "@/hooks/useProductsData";

interface ProductGridProps {
  products: Product[];
  brandFilter: string | null;
  modelFilter: string | null;
  autoSortOOS: boolean;
  isLoading: boolean;
  loadingMessage?: string;
  isMockupsLoading?: boolean;
}

export const ProductGrid = memo(function ProductGrid({
  products,
  brandFilter,
  modelFilter,
  autoSortOOS,
  isLoading,
  loadingMessage = "Loading products...",
  isMockupsLoading = false,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <>
        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-3 py-8 mb-4 bg-muted/30 rounded-lg">
          <Loader2Icon className="size-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {loadingMessage}
          </p>
        </div>
        
        {/* Skeleton grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }
  
  return (
    <>
      {/* Mockup Loading Banner - Shows when batch mockups are loading */}
      {isMockupsLoading && brandFilter && modelFilter && (
        <div className="flex items-center justify-center gap-3 py-4 mb-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-lg border border-purple-200 dark:border-purple-800">
          <Sparkles className="size-5 text-purple-500 animate-pulse" />
          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
            ✨ Loading {modelFilter} mockups...
          </p>
          <Loader2Icon className="size-4 animate-spin text-pink-500" />
        </div>
      )}
      
      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            brandFilter={brandFilter}
            modelFilter={modelFilter}
            autoSortOOS={autoSortOOS}
          />
        ))}
      </div>
    </>
  );
});

interface PaginationControlsProps {
  isCollection: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  canLoadMore: boolean;
  isExhausted: boolean;
  totalProducts: number;
  onLoadMore: () => void;
  observerRef: RefObject<HTMLDivElement | null>;
}

export function PaginationControls({
  isCollection,
  hasMore,
  isLoadingMore,
  canLoadMore,
  isExhausted,
  totalProducts,
  onLoadMore,
  observerRef,
}: PaginationControlsProps) {
  if (isCollection) {
    return (
      <div className="py-8 flex justify-center">
        {hasMore ? (
          <Button 
            onClick={onLoadMore} 
            variant="outline" 
            size="lg"
          >
            Load More Products
          </Button>
        ) : totalProducts > 30 ? (
          <p className="text-muted-foreground text-sm">
            You've reached the end! 🎉
          </p>
        ) : null}
      </div>
    );
  }
  
  return (
    <div ref={observerRef} className="py-8 flex justify-center">
      {isLoadingMore && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
          <span>Loading more products...</span>
        </div>
      )}
      {canLoadMore && !isLoadingMore && (
        <Button 
          onClick={onLoadMore} 
          variant="outline" 
          size="lg"
        >
          Load More Products
        </Button>
      )}
      {isExhausted && totalProducts > 30 && (
        <p className="text-muted-foreground text-sm">
          You've reached the end! 🎉
        </p>
      )}
    </div>
  );
}
