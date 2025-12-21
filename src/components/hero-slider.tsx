import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useRef, useState, useEffect } from "react";

export function HeroSlider() {
  const heroSlides = useQuery(api.homepage.getActiveHeroSlides);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Track scroll position to update active dot
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !heroSlides || heroSlides.length === 0) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.clientWidth * 0.9 + 12; // 90vw + gap
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.max(0, Math.min(index, heroSlides.length - 1)));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [heroSlides]);

  // Loading state
  if (heroSlides === undefined) {
    return (
      <div className="py-6">
        <div className="flex gap-3 overflow-x-hidden px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 w-[90vw] h-[110vw] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state - don't render if no slides
  if (heroSlides.length === 0) {
    return null;
  }

  return (
    <div className="py-6 space-y-4">
      {/* Horizontal Scrolling Cards */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        {heroSlides.map((slide) => (
          <div
            key={slide._id}
            className="flex-shrink-0 w-[90vw] h-[110vw] snap-start"
            style={{
              contain: 'layout style paint',
            }}
          >
            <Link
              to={slide.ctaLink || "/"}
              className="group block relative w-full h-full rounded-2xl overflow-hidden shadow-lg bg-muted"
              style={{
                isolation: 'isolate',
                willChange: 'transform',
              }}
            >
              {/* Background Image */}
              <img
                src={slide.imageUrl}
                alt={slide.heading || "Hero slide"}
                loading={slide._id === heroSlides[0]._id ? "eager" : "lazy"}
                className="w-full h-full object-cover object-center transition-transform duration-300 group-active:scale-95"
              />

              {/* Overlay gradient for text readability - only if text exists */}
              {(slide.heading || slide.subheading || slide.ctaText) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              )}

              {/* Text Content - only if text exists */}
              {(slide.heading || slide.subheading || slide.ctaText) && (
                <div className="absolute inset-0 flex flex-col justify-end p-6 text-left">
                  {slide.heading && (
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {slide.heading}
                    </h2>
                  )}
                  
                  {slide.subheading && (
                    <p className="text-base text-white/90 mb-3">
                      {slide.subheading}
                    </p>
                  )}
                  
                  {slide.ctaText && (
                    <div className="inline-flex">
                      <span className="bg-white/95 backdrop-blur-sm text-foreground text-sm font-semibold px-5 py-2 rounded-full">
                        {slide.ctaText}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Link>
          </div>
        ))}
      </div>

      {/* Pagination Dots - only show if multiple slides */}
      {heroSlides.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                const container = scrollContainerRef.current;
                if (!container) return;
                const cardWidth = container.clientWidth * 0.9 + 12; // 90vw + gap
                container.scrollTo({
                  left: cardWidth * index,
                  behavior: 'smooth',
                });
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-8 bg-foreground'
                  : 'w-2 bg-foreground/30'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
