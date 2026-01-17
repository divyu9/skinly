import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useRef, useState, useEffect, useCallback } from "react";

export function FeatureBanner() {
  const banners = useQuery(api.homepage.getActiveFeatureBanners);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Detect screen size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get dimensions for a banner
  const getBannerDimensions = useCallback((banner: NonNullable<typeof banners>[0]) => {
    if (isMobile) {
      return {
        width: banner.mobileWidth || "100vw",
        height: banner.mobileHeight || "200px",
      };
    } else {
      return {
        width: banner.desktopWidth || "100%",
        height: banner.desktopHeight || "400px",
      };
    }
  }, [isMobile]);

  // Auto-scroll effect (every 5 seconds)
  useEffect(() => {
    if (!banners || banners.length <= 1) return;

    const interval = setInterval(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const nextIndex = (activeIndex + 1) % banners.length;
      const bannerWidth = container.clientWidth;
      
      container.scrollTo({
        left: bannerWidth * nextIndex,
        behavior: 'smooth',
      });
      
      setActiveIndex(nextIndex);
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [activeIndex, banners]);

  // Track scroll position to update active dot (for manual scrolling)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !banners || banners.length === 0) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const bannerWidth = container.clientWidth;
      const index = Math.round(scrollLeft / bannerWidth);
      setActiveIndex(Math.max(0, Math.min(index, banners.length - 1)));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [banners]);

  // Loading state
  if (banners === undefined) {
    return (
      <section className="container mx-auto px-4 py-12">
        <Skeleton className="w-full aspect-[16/7] md:aspect-[21/7] rounded-3xl" />
      </section>
    );
  }

  // Empty state - don't render if no banners
  if (banners.length === 0) {
    return null;
  }

  // Single banner - no auto-scroll
  if (banners.length === 1) {
    const banner = banners[0];
    const dimensions = getBannerDimensions(banner);
    return (
      <section className="container mx-auto px-4 py-12">
        <div
          className="relative w-full rounded-3xl overflow-hidden group"
          style={{ height: dimensions.height }}
        >
          {/* Background Image */}
          <img
            src={banner.backgroundImage}
            alt={banner.heading}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

          {/* Content - only show if any text exists */}
          {(banner.heading || banner.subheading || banner.ctaText) && (
            <div className="absolute inset-0 flex flex-col items-start justify-center p-8 md:p-16 max-w-2xl">
              {banner.heading && (
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
                  {banner.heading}
                </h2>
              )}

              {banner.subheading && (
                <p className="text-lg md:text-xl text-white/90 mb-6">
                  {banner.subheading}
                </p>
              )}

              {banner.ctaText && banner.ctaLink && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-full px-8 text-base shadow-2xl hover:scale-105 transition-transform"
                >
                  <Link to={banner.ctaLink}>
                    {banner.ctaText}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Multiple banners - auto-scrolling carousel
  return (
    <section className="container mx-auto px-4 py-12">
      <div className="space-y-4">
        {/* Scrolling Banners */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {banners.map((banner) => {
            const dimensions = getBannerDimensions(banner);
            return (
              <div
                key={banner._id}
                className="flex-shrink-0 w-full snap-start"
              >
                <div
                  className="relative w-full rounded-3xl overflow-hidden group"
                  style={{ height: dimensions.height }}
                >
                  {/* Background Image */}
                  <img
                    src={banner.backgroundImage}
                    alt={banner.heading}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

                  {/* Content - only show if any text exists */}
                  {(banner.heading || banner.subheading || banner.ctaText) && (
                    <div className="absolute inset-0 flex flex-col items-start justify-center p-8 md:p-16 max-w-2xl">
                      {banner.heading && (
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
                          {banner.heading}
                        </h2>
                      )}

                      {banner.subheading && (
                        <p className="text-lg md:text-xl text-white/90 mb-6">
                          {banner.subheading}
                        </p>
                      )}

                      {banner.ctaText && banner.ctaLink && (
                        <Button
                          asChild
                          size="lg"
                          className="rounded-full px-8 text-base shadow-2xl hover:scale-105 transition-transform"
                        >
                          <Link to={banner.ctaLink}>
                            {banner.ctaText}
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                const container = scrollContainerRef.current;
                if (!container) return;
                const bannerWidth = container.clientWidth;
                container.scrollTo({
                  left: bannerWidth * index,
                  behavior: 'smooth',
                });
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-8 bg-foreground'
                  : 'w-2 bg-foreground/30'
              }`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
