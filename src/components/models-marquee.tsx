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
      <div className="halftone w-full overflow-hidden border-y-2 border-ink/15">
        <div className="py-3 flex items-center justify-center gap-2">
          <div className="size-3 animate-pulse rounded-full bg-brand/50" />
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
    <div className="w-full overflow-hidden border-y-2 border-ink/20 bg-blush/30">
      {/* Mobile: Simple centered marquee */}
      <div className="md:hidden">
        <div className="border-b-2 border-ink/20 bg-brand py-2 text-center text-xs font-extrabold tracking-wide text-brand-foreground">
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
                  <span className="mx-1 text-brand">•</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: Horizontal marquee with label */}
      <div className="hidden md:flex items-center gap-4 py-3">
        <div className="flex flex-shrink-0 items-center gap-2 rounded-r-full border-y-2 border-r-2 border-ink bg-brand px-6 py-2 text-sm font-extrabold text-brand-foreground">
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
                  <span className="mx-1 text-brand">•</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
