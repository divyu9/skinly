import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { cn } from "@/lib/utils.ts";

export function ModelsMarquee() {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const marqueeModels = useQuery(
    api.homepage.getMarqueeModels,
    homepageSettings?.marqueeEnabled 
      ? { maxModels: homepageSettings.marqueeMaxModels }
      : "skip"
  );

  // Don't render if marquee is disabled
  if (!homepageSettings?.marqueeEnabled) {
    return null;
  }

  // Loading state
  if (marqueeModels === undefined) {
    return (
      <div className="w-full bg-primary/5 border-y border-primary/10 overflow-hidden">
        <div className="py-3 flex items-center justify-center gap-2">
          <div className="size-3 rounded-full bg-primary/40 animate-pulse" />
          <span className="text-xs text-muted-foreground">Loading latest models...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (marqueeModels.length === 0) {
    return null;
  }

  // Triple the array for seamless infinite scroll
  const modelsToShow = [...marqueeModels, ...marqueeModels, ...marqueeModels];

  return (
    <div className="w-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-y border-primary/20 overflow-hidden">
      {/* Mobile: Simple centered marquee */}
      <div className="md:hidden">
        <div className="text-center py-2 bg-gradient-to-r from-primary via-primary to-primary text-primary-foreground text-xs font-bold tracking-wide">
          ✨ NOW SUPPORTING
        </div>
        <div className="py-3 overflow-hidden relative">
          <div className="animate-marquee-mobile flex gap-4 whitespace-nowrap">
            {modelsToShow.map((model, idx) => {
              const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
              const emoji = emojis[idx % emojis.length];
              return (
                <span 
                  key={idx} 
                  className="text-sm text-foreground font-semibold inline-flex items-center gap-2"
                >
                  <span className="text-base">{emoji}</span>
                  <span>{model}</span>
                  <span className="text-primary/40 mx-1">•</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: Horizontal marquee with label */}
      <div className="hidden md:flex items-center gap-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold px-6 py-2 flex-shrink-0 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-r-full shadow-lg">
          <span className="text-base">✨</span>
          <span className="whitespace-nowrap tracking-wide">NOW SUPPORTING:</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee flex gap-3 whitespace-nowrap">
            {modelsToShow.map((model, idx) => {
              const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
              const emoji = emojis[idx % emojis.length];
              return (
                <span 
                  key={idx} 
                  className="text-sm text-foreground/90 font-medium inline-flex items-center gap-2"
                >
                  <span>{emoji}</span>
                  <span>{model}</span>
                  <span className="text-primary/40 mx-1">•</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
