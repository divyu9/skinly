import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Id } from "@/lib/firebase-api";
import { ScrollNavButtons } from "@/components/ui/scroll-nav-buttons.tsx";

interface ExploreByGadgetProps {
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

export function ExploreByGadget({ sectionId, config }: ExploreByGadgetProps) {
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
    <section className="py-12 px-4">
      {/* Responsive styles for gadget cards */}
      <style>{`
        .gadget-card {
          width: var(--mobile-width);
          height: var(--mobile-height);
        }
        @media (min-width: 768px) {
          .gadget-card {
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
          <ScrollNavButtons containerId="explore-gadget-scroll" />
        </div>

        {/* Horizontal Scroll Container */}
        <div
          id="explore-gadget-scroll"
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {cards.map((card) => (
            <Link
              key={card._id}
              to={card.linkUrl}
              className="gadget-card flex-shrink-0 snap-start group relative rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all hover:shadow-xl"
              style={{
                '--mobile-width': mobileWidth,
                '--mobile-height': mobileHeight,
                '--desktop-width': desktopWidth,
                '--desktop-height': desktopHeight,
              } as React.CSSProperties}
            >
              {/* Background Image */}
              <img
                src={card.imageUrl}
                alt={card.title}
                loading="lazy"
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
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
