import { memo } from "react";
import { BrandBadge } from "@/components/products/BrandBadge.tsx";
import { brandInScope, productFitsDevice } from "@/lib/device-fit";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card.tsx";
import { ProductThumb } from "@/components/product-thumb.tsx";
import { PackageIcon, BellIcon, Sparkles, CameraIcon } from "lucide-react";
import { useRealPhotoCount } from "@/lib/real-photos";
import type { Product } from "@/hooks/useProductsData";

interface ProductCardProps {
  product: Product;
  brandFilter: string | null;
  modelFilter: string | null;
  /**
   * The brand this listing is about, when no particular device is chosen.
   *
   * Somebody on /vivo-phone-skins has told us they own a Vivo. Following a
   * card from there and being asked "which brand?" throws that away and makes
   * them answer a question the page they came from already answered. Separate
   * from `brandFilter`, which is half of a chosen device and decides whether
   * a card says "fits yours" — this only rides along in the link.
   */
  brandHint?: string | null;
  /** What kind of gadget the device is — "phone", "tablet". */
  deviceCategory?: string | null;
  autoSortOOS: boolean;
}

// Memoized product card - uses mockupUrl from parent (batch loaded)
// NO individual queries - mockups come from batch API via parent
export const ProductCard = memo(function ProductCard({
  product,
  brandFilter,
  modelFilter,
  brandHint = null,
  deviceCategory,
  autoSortOOS,
}: ProductCardProps) {
  const mainImage = product.images?.[0];

  /*
   * Does the saved device actually fit this product?
   *
   * On skins the listing is already filtered to the model, so any product
   * shown fits. Cases, camera rings and screen guards are a different shape:
   * they are stocked per model as variants titled "Samsung Galaxy S24 Ultra /
   * Black", and the listing shows all of them at once. Someone who has already
   * told us they own an iPhone 12 was still asked to pick a device on every
   * card.
   *
   * The variant titles are the honest signal here — `gadgetCategory` says
   * "accessory" for all of these and never names a device type, so it cannot
   * answer the question. Matching on variants also fails safe: a saved
   * Alienware matches no camera-ring variant, so that card keeps asking
   * rather than promising a ring cut for a laptop.
   */
  const deviceFitsProduct = productFitsDevice(product, brandFilter, modelFilter, deviceCategory);

  const hasDeviceSelected = deviceFitsProduct;
  
  // Use mockupUrl if available (batch loaded), else fall back to default image
  // If we have a mockupUrl from batch loading, use it
  // Otherwise, use main image
  const displayImageUrl = product.mockupUrl || mainImage?.url;
  const hasMockup = !!product.mockupUrl;
  /*
   * The badge names the phone in the picture. It used to name the chosen
   * model whatever the picture was — "Galaxy A51" over an iPhone 17 Pro Max.
   * The hero fallback gets no badge: it only shows the design.
   */
  const badgeModel = product.mockupMatch === "sibling" ? product.mockupModel
    : product.mockupMatch === "hero" ? null
    : modelFilter;
  
  const variants = product.variants || [];
  // Photos of this design cut for real orders (src/lib/real-photos.ts).
  const realPhotoCount = useRealPhotoCount(variants[0]?.sku, product.gadgetCategory);
  const minPrice = variants.length > 0 ? Math.min(...variants.map(v => v.price || 0)) : 0;
  const maxPrice = variants.length > 0 ? Math.max(...variants.map(v => v.price || 0)) : 0;
  
  const priceDisplay = minPrice === maxPrice 
    ? `₹${minPrice.toFixed(0)}`
    : `₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}`;
  
  // Check if all variants are out of stock
  const isOutOfStock = variants.length > 0 && variants.every(v => !v.available || v.inventory_quantity === 0);

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
  // Carry the device only onto a product it fits. Passing it everywhere is how
  // a PS5 skin opened as "Preview on iPhone 12".
  // The canonical path, so every internal link points where the page's own
  // canonical does; /products/detail?slug= split the signal between two URLs.
  const deviceQuery = deviceFitsProduct && modelFilter && brandFilter
    ? `?${new URLSearchParams({ model: modelFilter, brand: brandFilter }).toString()}`
    // No model, but we know whose phone it is. `brandInScope` keeps the hint
    // off a listing that brand has no version of, for the same reason the
    // device is not carried onto a product it does not fit.
    : brandHint && brandInScope(product, brandHint)
      ? `?${new URLSearchParams({ brand: brandHint }).toString()}`
      : '';
  const productUrl = `/products/${product.slug}${deviceQuery}`;
  
  return (
    <Link to={productUrl}>
      <Card className="group cursor-pointer overflow-hidden rounded-2xl border-2 border-ink/15 p-0 transition-all duration-200 hover:border-ink hover:shadow-xl">
        {/* Product Image */}
        <div className={`relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800 ${
          isOutOfStock && autoSortOOS ? 'opacity-30' : ''
        }`}>
          {/* Mockup Badge - Show when mockup is displayed */}
          {hasMockup && badgeModel && (
            <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[7px] sm:text-[10px] font-bold rounded-full shadow-md flex items-center gap-0.5">
              <Sparkles className="size-2.5 sm:size-3" />
              <span>{badgeModel?.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          )}
          
          {realPhotoCount > 0 && (
            <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-ink/85 px-1.5 py-0.5 text-[8px] font-semibold text-white shadow-sm sm:bottom-2 sm:left-2 sm:px-2 sm:text-[11px]">
              <CameraIcon className="size-2.5 sm:size-3" />
              {realPhotoCount} real photo{realPhotoCount > 1 ? "s" : ""}
            </div>
          )}

          {/* A brand listing says which brand it is for, with the admin's logo. */}
          {product.modelBrands?.[0] && <BrandBadge brand={product.modelBrands[0]} />}

          {/* Product Image */}
          <ProductThumb
            src={displayImageUrl}
            alt={mainImage?.alt || product.title}
            className="group-hover:scale-110 transition-transform duration-300"
          />
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
            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-brand-foreground font-bold transition-all duration-200 bg-brand shadow-lg hover:shadow-xl active:scale-[0.98]">
              <BellIcon className="size-3 sm:size-4 mr-1" />
              <span className="hidden sm:inline">Request Restock</span>
              <span className="sm:hidden">Restock</span>
            </div>
          ) : (
            <div className="w-full text-[10px] sm:text-sm h-5 sm:h-10 px-0.5 sm:px-4 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-brand-foreground font-bold transition-all duration-200 bg-brand hover:shadow-lg active:scale-[0.98]">
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
