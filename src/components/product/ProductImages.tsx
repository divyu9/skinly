import { useMemo, useCallback } from "react";
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
}

export function ProductImages({
  images,
  selectedImage,
  onImageSelect,
  productTitle,
  phoneModel,
  mockupUrl,
}: ProductImagesProps) {
  const currentIndex = useMemo(() => {
    return images.findIndex(img => img.url === selectedImage);
  }, [images, selectedImage]);
  
  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < images.length - 1) {
      onImageSelect(images[currentIndex + 1].url);
    }
  }, [currentIndex, images, onImageSelect]);
  
  const handleSwipeRight = useCallback(() => {
    if (currentIndex > 0) {
      onImageSelect(images[currentIndex - 1].url);
    }
  }, [currentIndex, images, onImageSelect]);
  
  const swipeHandlers = useSwipeNavigation(handleSwipeLeft, handleSwipeRight);
  
  const handleImageError = useCallback(() => {
    const nextImage = images.find(img => img.url !== selectedImage);
    if (nextImage) {
      onImageSelect(nextImage.url);
    }
  }, [images, selectedImage, onImageSelect]);
  
  const isMockupImage = mockupUrl && selectedImage === mockupUrl;
  
  return (
    <div className="space-y-3 md:sticky md:top-24 md:self-start">
      {/* Main Image */}
      <div 
        className="aspect-square overflow-hidden rounded-xl bg-muted border border-border relative select-none"
        {...swipeHandlers}
      >
        {selectedImage ? (
          <>
            <img
              src={selectedImage}
              alt={productTitle}
              className="w-full h-full object-cover"
              draggable={false}
              onError={handleImageError}
            />
            
            {/* Mockup Badge */}
            {phoneModel && isMockupImage && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:bottom-auto md:top-3 md:left-auto md:right-3 md:translate-x-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg text-center leading-tight pointer-events-none">
                <div>Preview on {phoneModel}</div>
                <div className="text-[10px] mt-0.5 opacity-90">Full Body Wrap</div>
              </div>
            )}
            
            {/* Swipe Indicator Dots */}
            {images.length > 1 && (
              <div className={`absolute left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none ${
                phoneModel && isMockupImage ? "bottom-14 md:bottom-3" : "bottom-3"
              }`}>
                {images.map((_, idx) => (
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
          <div className="w-full h-full flex items-center justify-center">
            <PackageIcon className="size-12 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(0, 4).map((image, idx) => (
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
