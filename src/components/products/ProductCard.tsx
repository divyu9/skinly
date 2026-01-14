import { memo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card.tsx";
import { PackageIcon, BellIcon, Sparkles } from "lucide-react";
import type { Product } from "@/hooks/useProductsData";

interface ProductCardProps {
  product: Product;
  brandFilter: string | null;
  modelFilter: string | null;
  autoSortOOS: boolean;
}

// Memoized product card - uses mockupUrl from parent (batch loaded)
// NO individual queries - mockups come from batch API via parent
export const ProductCard = memo(function ProductCard({
  product,
  brandFilter,
  modelFilter,
  autoSortOOS,
}: ProductCardProps) {
  const mainImage = product.images[0];
  
  // Check if device is selected
  const hasDeviceSelected = !!(brandFilter && modelFilter);
  
  // Use mockupUrl if available (batch loaded), else fall back to default image
  // If we have a mockupUrl from batch loading, use it
  // Otherwise, use main image
  const displayImageUrl = product.mockupUrl || mainImage?.url;
  const hasMockup = !!product.mockupUrl;
  
  const minPrice = Math.min(...product.variants.map(v => v.price));
  const maxPrice = Math.max(...product.variants.map(v => v.price));
  
  const priceDisplay = minPrice === maxPrice 
    ? `₹${minPrice.toFixed(0)}`
    : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;
  
  // Check if all variants are out of stock
  const isOutOfStock = product.variants.every(v => !v.available || v.inventory_quantity === 0);

  // Get finish type display name
  const finishTypeDisplay = product.finishType 
    ? product.finishType === 'matte' 
      ? 'Matte' 
      : product.finishType === 'embossed' 
        ? '3D' 
        : product.finishType === 'transparent' 
          ? 'Transparent' 
          : 'Sparkling'
    : null;

  // Build product URL
  const productUrl = `/products/detail?slug=${product.slug}${
    modelFilter ? `&model=${encodeURIComponent(modelFilter)}` : ''
  }${brandFilter ? `&brand=${brandFilter}` : ''}`;
  
  return (
    <Link to={productUrl}>
      <Card className="group overflow-hidden border-2 border-gray-200 hover:border-black transition-all duration-200 hover:shadow-xl p-0 cursor-pointer dark:border-gray-700 dark:hover:border-white">
        {/* Product Image */}
        <div className={`relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800 ${
          isOutOfStock && autoSortOOS ? 'opacity-30' : ''
        }`}>
          {/* Mockup Badge - Show when mockup is displayed */}
          {hasMockup && (
            <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[7px] sm:text-[10px] font-bold rounded-full shadow-md flex items-center gap-0.5">
              <Sparkles className="size-2.5 sm:size-3" />
              <span>{modelFilter?.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          )}
          
          {/* Product Image */}
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt={mainImage?.alt || product.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PackageIcon className="size-8 sm:size-16 text-muted-foreground" />
            </div>
          )}
        </div>
        
        {/* Product Info */}
        <div className="px-1.5 pt-1 pb-1 sm:p-4 space-y-0.5 sm:space-y-2">
          {/* Finish Badge */}
          {finishTypeDisplay && (
            <div className="flex items-center">
              <span className="inline-block px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[8px] sm:text-xs font-medium bg-muted/50 text-muted-foreground border border-border">
                {finishTypeDisplay}
              </span>
            </div>
          )}
          
          {/* Title */}
          <h3 className="font-semibold text-[9px] leading-[1.2] sm:text-sm sm:leading-snug line-clamp-2">
            {product.title}
          </h3>
          
          {/* Price */}
          <span className="text-[11px] sm:text-lg font-bold sm:font-extrabold text-black dark:text-white block">
            {priceDisplay}
          </span>
          
          {/* CTA Button */}
          {isOutOfStock && autoSortOOS ? (
            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-white dark:text-black font-semibold transition-all duration-200 bg-black dark:bg-white shadow-lg hover:shadow-xl active:scale-[0.98]">
              <BellIcon className="size-3 sm:size-4 mr-1" />
              <span className="hidden sm:inline">Request Restock</span>
              <span className="sm:hidden">Restock</span>
            </div>
          ) : (
            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-white dark:text-black font-semibold transition-all duration-200 bg-black dark:bg-white hover:shadow-lg active:scale-[0.98]">
              <span className="hidden sm:inline">{hasDeviceSelected ? 'View Details' : 'Select Your Device'}</span>
              <span className="sm:hidden">{hasDeviceSelected ? 'View' : 'Select'}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
});

// Skeleton loader for product cards
export function ProductCardSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="aspect-square w-full bg-muted animate-pulse rounded-t-xl" />
      <div className="px-1.5 pt-1 pb-1 sm:p-4 space-y-0.5 sm:space-y-2">
        <div className="h-3 sm:h-5 w-12 sm:w-16 bg-muted animate-pulse rounded" />
        <div className="h-3 sm:h-5 w-full bg-muted animate-pulse rounded" />
        <div className="h-3 sm:h-4 w-12 sm:w-20 bg-muted animate-pulse rounded" />
        <div className="h-5 sm:h-10 w-full bg-muted animate-pulse rounded" />
      </div>
    </Card>
  );
}
