import { useMemo, useCallback, useState } from "react";
import { PackageIcon } from "lucide-react";
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
            
            {/* Says which phone is pictured. It used to claim the chosen
                model whatever was on screen, so picking a model we have no
                shot of showed a different phone under a label promising
                yours. When it is a stand-in it says so, and still makes the
                point that matters: the skin is cut for what you picked. */}
            {phoneModel && isMockupImage && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:bottom-auto md:top-3 md:left-auto md:right-3 md:translate-x-0 max-w-[85%] rounded-lg bg-primary px-3 py-1.5 text-center text-xs font-semibold leading-tight text-primary-foreground shadow-lg pointer-events-none">
                {mockupExact ? (
                  <>
                    <div>Preview on {phoneModel}</div>
                    <div className="mt-0.5 text-[10px] opacity-90">Full Body Wrap</div>
                  </>
                ) : (
                  <>
                    <div>Shown on {shownModel || "another model"}</div>
                    <div className="mt-0.5 text-[10px] opacity-90">
                      Cut to fit your {phoneModel}
                    </div>
                  </>
                )}
              </div>
            )}

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
              <div className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none ${
                phoneModel && isMockupImage ? "bottom-14 md:bottom-3" : "bottom-3"
              }`}>
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
