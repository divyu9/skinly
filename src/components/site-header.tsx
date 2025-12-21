import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { MobileNav } from "./mobile-nav.tsx";
import { HeaderSearch } from "./header-search.tsx";

interface SiteHeaderProps {
  onGadgetSelectorClick?: () => void;
  onPhoneSelectorClick?: () => void;
  onRequestModelClick?: () => void;
}

export function SiteHeader({ onGadgetSelectorClick, onPhoneSelectorClick, onRequestModelClick }: SiteHeaderProps) {
  const latestModels = useQuery(api.supportedModels.getLatest, { count: 20 });

  return (
    <>
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              width="348"
              height="140"
              className="h-12 md:h-16"
            />
          </Link>
          
          {/* Header Search - Hidden on mobile, shown on tablet+ */}
          <div className="hidden md:flex flex-1 max-w-lg">
            <HeaderSearch onRequestModelClick={onRequestModelClick || (() => {})} />
          </div>
          
          <MobileNav 
            onGadgetSelectorClick={onGadgetSelectorClick}
            onPhoneSelectorClick={onPhoneSelectorClick}
          />
        </div>
      </nav>

      {/* Latest Models Marquee */}
      <div className="w-full bg-primary/5 border-y border-primary/10 mt-24 overflow-hidden">
        {latestModels === undefined ? (
          // Loading state
          <div className="py-4 flex items-center justify-center gap-2">
            <div className="size-4 rounded-full bg-primary/40 animate-pulse" />
            <span className="text-sm text-muted-foreground">Loading latest models...</span>
          </div>
        ) : latestModels.length === 0 ? (
          // Empty state
          <div className="py-4 text-center text-sm text-muted-foreground">
            No models available
          </div>
        ) : (
          <>
            {/* Mobile: Stacked Horizontal Marquee */}
            <div className="md:hidden">
              <div className="text-center py-2 bg-primary text-primary-foreground text-xs font-bold">
                ✨ Now supporting:
              </div>
              <div className="py-3 overflow-hidden">
                <div className="animate-marquee-mobile flex gap-4 whitespace-nowrap">
                  {(() => {
                    const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
                    return [...latestModels.slice(0, 20), ...latestModels.slice(0, 20), ...latestModels.slice(0, 20)].map((model, idx) => {
                      const emoji = emojis[idx % emojis.length];
                      return (
                        <span key={idx} className="text-base text-foreground font-semibold">
                          {emoji} {model.brandName} {model.modelName} <span className="text-primary/40 mx-2">•</span>
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Desktop: Horizontal Marquee */}
            <div className="hidden md:flex items-center gap-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold px-4 py-1.5 flex-shrink-0 bg-primary text-primary-foreground rounded-r-full">
                <span>✨</span>
                <span className="whitespace-nowrap">Now supporting:</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="animate-marquee flex gap-3 whitespace-nowrap">
                  {(() => {
                    const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
                    return [...latestModels.slice(0, 20), ...latestModels.slice(0, 20), ...latestModels.slice(0, 20)].map((model, idx) => {
                      const emoji = emojis[idx % emojis.length];
                      return (
                        <span key={idx} className="text-sm text-foreground/80 font-medium">
                          {emoji} {model.brandName} {model.modelName} <span className="text-primary/40 mx-2">•</span>
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
