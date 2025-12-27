import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button.tsx";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface ScrollNavButtonsProps {
  containerId: string;
  className?: string;
}

export function ScrollNavButtons({ containerId, className }: ScrollNavButtonsProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    containerRef.current = container;
    
    const updateScrollButtons = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    // Initial check
    updateScrollButtons();

    // Update on scroll
    container.addEventListener("scroll", updateScrollButtons);
    
    // Update on resize
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      container.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [containerId]);

  const scroll = (direction: "left" | "right") => {
    const container = containerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const targetScroll = container.scrollLeft + (direction === "left" ? -scrollAmount : scrollAmount);

    container.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("hidden lg:flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => scroll("left")}
        disabled={!canScrollLeft}
        className={cn(
          "size-10 rounded-full shadow-lg transition-all",
          !canScrollLeft && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Scroll left"
      >
        <ChevronLeftIcon className="size-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => scroll("right")}
        disabled={!canScrollRight}
        className={cn(
          "size-10 rounded-full shadow-lg transition-all",
          !canScrollRight && "opacity-30 cursor-not-allowed"
        )}
        aria-label="Scroll right"
      >
        <ChevronRightIcon className="size-5" />
      </Button>
    </div>
  );
}
