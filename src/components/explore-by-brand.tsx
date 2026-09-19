import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Id } from "@/lib/firebase-api";
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

/**
 * The brand's logo, filling its card.
 *
 * The logos are square tiles — most of them a wordmark that runs nearly the
 * full width — and they were drawn inside a `p-6` box at `max-h-[120px]`, so
 * on a 95px card the mark came out 43px wide with white all around it and
 * the 120px height spilling past the card's own edge. Sized to the card, a
 * square tile lands exactly on it and a wider or taller one still fits whole,
 * because object-contain never crops a logo to fill a corner.
 */
function BrandMark({ src, name }: { src?: string; name?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10">
        <span className="px-2 text-center text-base font-bold leading-tight tracking-tight text-foreground/70">
          {name || "Brand"}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name || "Brand"}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-full object-contain transition-transform group-hover:scale-105"
    />
  );
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
    <section className="px-4 py-12">
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
              {/* Brand Logo. The old Cloudinary account was deleted, so a
                  share of these logo URLs 404. A broken-image icon on every
                  other brand made the row look dead — fall back to the
                  brand's own name. A card that also carries a caption gives
                  the logo the room that is left, so the text is never
                  squeezed out; most carry none and the logo takes the card. */}
              <div className="flex size-full min-h-0 flex-col items-center justify-center">
                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                  <BrandMark src={card.imageUrl} name={card.title} />
                </div>
                {(card.title || card.subtitle) && (
                  <div className="w-full shrink-0 px-2 pb-2 text-center">
                    {card.title && (
                      <h3 className="truncate text-sm font-semibold">{card.title}</h3>
                    )}
                    {card.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
