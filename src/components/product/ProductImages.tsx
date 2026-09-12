import { useMemo, useCallback, useState } from "react";
import { PackageIcon, SmartphoneIcon } from "lucide-react";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

interface ProductImage {
  url: string;
  alt?: string;
  phoneModel?: string;
}

interface ProductImagesProps {
  images: ProductImage[];
  selectedImage: string;
  onImageSelect: (url: string) => void;
  productTitle: string;
  phoneModel?: string | null;
  mockupUrl?: string | null;
  /** True while the mockup for a newly chosen device is being fetched. */
  mockupLoading?: boolean;
  /** The model actually pictured — not always the one the shopper chose. */
  shownModel?: string | null;
  /** False when the picture is a stand-in. */
  mockupExact?: boolean;
}

export function ProductImages({
  images,
  selectedImage,
  onImageSelect,
  productTitle,
  phoneModel,
  mockupUrl,
  mockupLoading = false,
  shownModel,
  mockupExact = true,
}: ProductImagesProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const failedUrl = e.currentTarget.src;
    
    // Add to failed images list so we don't render it in the thumbnails
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(failedUrl);
      return newSet;
    });

    // If the failed image was the currently selected one, select the next available one
    if (selectedImage === failedUrl) {
      const fallbackImage = images.find(img => img.url !== failedUrl && !failedImages.has(img.url));
      if (fallbackImage) {
        onImageSelect(fallbackImage.url);
      }
    }
  }, [images, selectedImage, failedImages, onImageSelect]);
  
  // Filter out images that have failed to load
  const validImages = useMemo(() => {
    return images.filter(img => !failedImages.has(img.url));
  }, [images, failedImages]);
  
  const currentIndex = useMemo(() => {
    return validImages.findIndex(img => img.url === selectedImage);
  }, [validImages, selectedImage]);
  
  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < validImages.length - 1) {
      onImageSelect(validImages[currentIndex + 1].url);
    }
  }, [currentIndex, validImages, onImageSelect]);
  
  const handleSwipeRight = useCallback(() => {
    if (currentIndex > 0) {
      onImageSelect(validImages[currentIndex - 1].url);
    }
  }, [currentIndex, validImages, onImageSelect]);
  
  const swipeHandlers = useSwipeNavigation(handleSwipeLeft, handleSwipeRight);
  
  const isMockupImage = mockupUrl && selectedImage === mockupUrl;
  
  return (
    <div className="space-y-3 md:sticky md:top-24 md:self-start">
      {/* Main Image */}
      <div 
        className="aspect-square overflow-hidden rounded-xl bg-muted border border-border relative select-none"
        {...swipeHandlers}
      >
        {selectedImage && !failedImages.has(selectedImage) ? (
          <>
            <img
              src={selectedImage}
              alt={productTitle}
              className="w-full h-full object-cover"
              draggable={false}
              onError={handleImageError}
            />
            
            {/* Changing device refetches the mockup, and the old picture used
                to sit there unchanged until the new one arrived — no way to
                tell whether anything was happening. */}
            {mockupLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 rounded-full border-2 border-ink/15 bg-background px-3.5 py-2 text-xs font-semibold shadow-sm">
                  <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  Fitting to {phoneModel}…
                </div>
              </div>
            )}
            
            {/* Swipe Indicator Dots */}
            {validImages.length > 1 && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {validImages.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      currentIndex === idx
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/40">
            <PackageIcon className="size-10 text-muted-foreground/50" />
            <p className="px-6 text-center text-xs text-muted-foreground">
              Photo coming soon — this design is printed to order
            </p>
          </div>
        )}
      </div>
      
      {/* Which phone is pictured — under the image, not over it.
          This was a filled pill sitting bottom-centre on mobile, directly on
          the part of the shot a skin buyer most wants to look at: the port
          cutouts along the bottom edge. Nothing about the label needs to be
          on top of the product, so it is a caption now, and it can be a full
          sentence without a max-width fighting the artwork. */}
      {phoneModel && isMockupImage && (
        <div className="flex items-start gap-2 rounded-xl border-2 border-ink/15 bg-card px-3 py-2">
          <SmartphoneIcon className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.2} />
          <p className="text-[12px] leading-snug">
            {mockupExact ? (
              <>
                <span className="font-bold text-foreground">Preview on {phoneModel}</span>
                <span className="text-muted-foreground"> · full body wrap</span>
              </>
            ) : (
              <>
                <span className="font-bold text-foreground">
                  Shown on {shownModel || "another model"}
                </span>
                <span className="text-muted-foreground">
                  {" "}— we don&rsquo;t have a photo on the {phoneModel} yet, but it&rsquo;s cut for yours
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Thumbnail Gallery */}
      {validImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {validImages.slice(0, 4).map((image, idx) => (
            <button
              key={idx}
              onClick={() => onImageSelect(image.url)}
              className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                selectedImage === image.url
                  ? "border-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <img
                src={image.url}
                alt={image.alt || productTitle}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
