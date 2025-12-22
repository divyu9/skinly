import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ExploreByBrandProps {
  sectionId: Id<"homepageSections">;
  config: {
    title: string;
    subtitle?: string;
    autoGenerate: boolean;
    cardWidth: number;
    cardHeight: number;
  };
}

export function ExploreByBrand({ sectionId, config }: ExploreByBrandProps) {
  const cards = useQuery(api.homepageSectionCards.getActiveSectionCards, {
    sectionId,
  });

  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4 bg-muted/30">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">{config.title}</h2>
          {config.subtitle && (
            <p className="text-muted-foreground">{config.subtitle}</p>
          )}
        </div>

        {/* Horizontal Scroll Container */}
        <div 
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {cards.map((card) => (
            <Link
              key={card._id}
              to={card.linkUrl}
              className="flex-shrink-0 snap-start group"
              style={{ width: config.cardWidth }}
            >
              <div 
                className="relative bg-white rounded-xl border-2 border-border hover:border-primary transition-all hover:shadow-xl overflow-hidden flex items-center justify-center"
                style={{
                  width: config.cardWidth,
                  height: config.cardHeight,
                }}
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
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
