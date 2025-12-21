import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ExploreByGadgetProps {
  sectionId: Id<"homepageSections">;
  config: {
    title: string;
    subtitle?: string;
    autoGenerate: boolean;
    cardWidth: number;
    cardHeight: number;
  };
}

export function ExploreByGadget({ sectionId, config }: ExploreByGadgetProps) {
  const cards = useQuery(api.homepageSectionCards.getActiveSectionCards, {
    sectionId,
  });

  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4">
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
              className="flex-shrink-0 snap-start group relative"
              style={{ width: config.cardWidth }}
            >
              <div 
                className="relative rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all hover:shadow-xl"
                style={{
                  width: config.cardWidth,
                  height: config.cardHeight,
                }}
              >
                {/* Background Image */}
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  loading="lazy"
                  width={config.cardWidth}
                  height={config.cardHeight}
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-110"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <h3 className="font-bold text-2xl mb-1">{card.title}</h3>
                  {card.subtitle && (
                    <p className="text-sm text-white/80">{card.subtitle}</p>
                  )}
                  <div className="mt-3 text-sm font-medium flex items-center gap-2">
                    <span>Shop Now</span>
                    <svg 
                      className="size-4 transition-transform group-hover:translate-x-1" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5l7 7-7 7" 
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
