import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export function HeroSlider() {
  const heroSlides = useQuery(api.homepage.getActiveHeroSlides);

  // Loading state
  if (heroSlides === undefined) {
    return (
      <div className="px-4 py-6">
        <div className="flex gap-3 overflow-x-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 w-[90vw] h-[55vw] rounded-2xl" />
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
    <div className="px-4 py-6">
      {/* Horizontal Scrolling Cards */}
      <div 
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {heroSlides.map((slide) => (
          <Link
            key={slide._id}
            to={slide.ctaLink || "/"}
            className="group relative flex-shrink-0 w-[90vw] h-[55vw] rounded-2xl overflow-hidden shadow-lg snap-start"
          >
            {/* Background Image */}
            <img
              src={slide.imageUrl}
              alt={slide.heading || "Hero slide"}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-active:scale-95"
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
        ))}
      </div>
    </div>
  );
}
