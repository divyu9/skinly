import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";

interface ExploreByBrandProps {
  sectionId: Id<"homepageSections">;
  config: {
    title: string;
    subtitle?: string;
    autoGenerate: boolean;
    cardWidth: number;
    cardHeight: number;
    // Responsive dimensions
    mobileCardWidth?: string;
    mobileCardHeight?: string;
    desktopCardWidth?: string;
    desktopCardHeight?: string;
  };
}

export function ExploreByBrand({ sectionId, config }: ExploreByBrandProps) {
  const cards = useQuery(api.homepageSectionCards.getActiveSectionCards, {
    sectionId,
  });

  // Get responsive dimensions with fallbacks to legacy values
  const mobileWidth = config.mobileCardWidth || `${config.cardWidth}px`;
  const mobileHeight = config.mobileCardHeight || `${config.cardHeight}px`;
  const desktopWidth = config.desktopCardWidth || `${config.cardWidth}px`;
  const desktopHeight = config.desktopCardHeight || `${config.cardHeight}px`;

  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4 bg-muted/30">
      {/* Responsive styles for brand cards */}
      <style>{`
        .brand-card {
          width: var(--mobile-width);
          height: var(--mobile-height);
        }
        @media (min-width: 768px) {
          .brand-card {
            width: var(--desktop-width) !important;
            height: var(--desktop-height) !important;
          }
        }
      `}</style>
      <div className="container mx-auto">
        {/* Header with Nav Buttons */}
        <div className="flex items-center justify-center gap-6 mb-8">
          <div className="text-center flex-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">{config.title}</h2>
            {config.subtitle && (
              <p className="text-muted-foreground">{config.subtitle}</p>
            )}
          </div>
          <ScrollNavButtons containerId="explore-brand-scroll" />
        </div>

        {/* Horizontal Scroll Container */}
        <div
          id="explore-brand-scroll"
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {cards.map((card) => (
            <Link
              key={card._id}
              to={card.linkUrl}
              className="brand-card flex-shrink-0 snap-start group relative bg-white rounded-xl border-2 border-border hover:border-primary transition-all hover:shadow-xl overflow-hidden flex items-center justify-center"
              style={{
                '--mobile-width': mobileWidth,
                '--mobile-height': mobileHeight,
                '--desktop-width': desktopWidth,
                '--desktop-height': desktopHeight,
              } as React.CSSProperties}
            >
              {/* Brand Logo */}
              <div className="p-6 flex flex-col items-center justify-center gap-3">
                <img
                  src={card.imageUrl}
                  alt={card.title || "Brand"}
                  loading="lazy"
                  className="max-w-full max-h-[120px] object-contain transition-transform group-hover:scale-110"
                />
                {card.title && (
                  <h3 className="font-semibold text-lg text-center">{card.title}</h3>
                )}
                {card.subtitle && (
                  <p className="text-sm text-muted-foreground text-center">
                    {card.subtitle}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
