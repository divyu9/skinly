import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

export function HeroSlider() {
  const heroSlides = useQuery(api.homepage.getActiveHeroSlides);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    if (!heroSlides || heroSlides.length <= 1 || !isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroSlides, isAutoPlaying]);

  // Loading state
  if (heroSlides === undefined) {
    return (
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-muted animate-pulse rounded-2xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Empty state - don't render if no slides
  if (heroSlides.length === 0) {
    return null;
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrevious = () => {
    goToSlide(currentSlide === 0 ? heroSlides.length - 1 : currentSlide - 1);
  };

  const goToNext = () => {
    goToSlide((currentSlide + 1) % heroSlides.length);
  };

  return (
    <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden group">
      {/* Slides */}
      <div className="relative w-full h-full">
        {heroSlides.map((slide, index) => (
          <div
            key={slide._id}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            )}
          >
            {/* Background Image */}
            <img
              src={slide.imageUrl}
              alt={slide.heading || "Hero slide"}
              className="w-full h-full object-cover"
            />

            {/* Overlay gradient for text readability */}
            {(slide.heading || slide.subheading || slide.ctaText) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            )}

            {/* Text Content */}
            {(slide.heading || slide.subheading || slide.ctaText) && (
              <div className="absolute inset-0 flex flex-col items-center justify-end p-6 md:p-12 text-center">
                <div className="max-w-3xl space-y-4 mb-8 md:mb-16">
                  {slide.heading && (
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
                      {slide.heading}
                    </h1>
                  )}
                  
                  {slide.subheading && (
                    <p className="text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-md">
                      {slide.subheading}
                    </p>
                  )}
                  
                  {slide.ctaText && slide.ctaLink && (
                    <div className="pt-4">
                      <Button
                        asChild
                        size="lg"
                        className="text-base md:text-lg px-8 py-6 rounded-full shadow-2xl hover:scale-105 transition-transform"
                      >
                        <Link to={slide.ctaLink}>
                          {slide.ctaText}
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Arrows (show on hover, hide on mobile) */}
      {heroSlides.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 size-12 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous slide"
          >
            <ChevronLeftIcon className="size-6 text-foreground" />
          </button>

          <button
            onClick={goToNext}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 size-12 items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next slide"
          >
            <ChevronRightIcon className="size-6 text-foreground" />
          </button>
        </>
      )}

      {/* Indicator Dots */}
      {heroSlides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "transition-all rounded-full",
                index === currentSlide 
                  ? "w-8 h-2 bg-white" 
                  : "w-2 h-2 bg-white/50 hover:bg-white/80"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Swipe indicators for mobile */}
      {heroSlides.length > 1 && (
        <div className="md:hidden absolute left-4 right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-between pointer-events-none">
          <div className="size-8 rounded-full bg-white/30 flex items-center justify-center">
            <ChevronLeftIcon className="size-5 text-white" />
          </div>
          <div className="size-8 rounded-full bg-white/30 flex items-center justify-center">
            <ChevronRightIcon className="size-5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
