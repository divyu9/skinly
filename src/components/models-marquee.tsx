import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { cn } from "@/lib/utils.ts";
import { useEffect, useRef, useState } from "react";

/** The strip's reserved height. Measured at 72px on both breakpoints — the
 *  mobile layout stacks a brand bar over the row, the wide one sets them side
 *  by side, and they land on the same height. */
const MARQUEE_H = "h-[72px]";

/*
 * The ticker starts moving on the visitor's first touch, scroll or key.
 * Moving from the first frame, it never let the page look finished: speed
 * measurements compare screenshots until nothing changes, and a strip that
 * scrolls forever at the top of the screen held PageSpeed's Speed Index at
 * 17.8 seconds on a page that was fully drawn in two. Someone reading the
 * page sees the first few models at once and the strip in motion as soon as
 * they do anything.
 */
function useStartOnInteraction() {
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (moving) return;
    const events = ["pointerdown", "touchstart", "scroll", "keydown", "wheel", "mousemove"] as const;
    const go = () => setMoving(true);
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, go));
  }, [moving]);
  return moving;
}

/*
 * How long one lap takes, worked out from how long a lap is. A fixed duration
 * made the speed depend on the list: 7.5s over a phone-width strip of thirty
 * models was ~450px a second, too fast to read a single name. A lap is one
 * copy of the list (a third of the track), so seconds = that width / speed.
 */
function useLapSeconds(pxPerSecond: number, deps: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const lap = el.scrollWidth / 3;
      if (lap > 0) setSeconds(Math.max(10, lap / pxPerSecond));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pxPerSecond, deps]);
  return { ref, seconds };
}

export function ModelsMarquee() {
  const moving = useStartOnInteraction();
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const marqueeModels = useQuery(
    api.homepage.getMarqueeModels,
    homepageSettings?.marqueeEnabled 
      ? { maxModels: homepageSettings.marqueeMaxModels }
      : "skip"
  );
  const mobileLap = useLapSeconds(40, marqueeModels);
  const desktopLap = useLapSeconds(55, marqueeModels);

  /*
   * This strip sits above `main`, so anything it does to its own height moves
   * the entire page.
   *
   * It used to return null while the settings query was out, then render a
   * 44px loading row, then the finished 72px strip — pushing everything below
   * it down twice. Measured, `main` started at y=64 and settled at y=164, and
   * because a full viewport of content moves with it that single 100px push
   * was 0.65 of the homepage's layout shift, far more than everything else
   * combined.
   *
   * So the height is reserved from the first paint and every state fills it:
   * unknown, loading, and loaded are all MARQUEE_H tall. Only an explicit
   * "off" collapses it, which is a shift no one sees unless the marquee is
   * actually disabled.
   */
  const settingsKnown = homepageSettings !== undefined;

  if (settingsKnown && !homepageSettings?.marqueeEnabled) {
    return null;
  }

  if (!settingsKnown || marqueeModels === undefined) {
    return (
      <div className={`halftone w-full overflow-hidden border-y-2 border-ink/15 ${MARQUEE_H}`}>
        <div className="flex h-full items-center justify-center gap-2">
          <div className="size-3 animate-pulse rounded-full bg-brand/50" />
          <span className="text-xs text-muted-foreground">Loading latest models…</span>
        </div>
      </div>
    );
  }

  // Genuinely nothing to scroll: hold the space rather than collapse the page.
  if (marqueeModels.length === 0) {
    return <div className={`w-full border-y-2 border-ink/15 ${MARQUEE_H}`} aria-hidden="true" />;
  }

  // Triple the array for seamless infinite scroll
  const modelsToShow = [...marqueeModels, ...marqueeModels, ...marqueeModels];

  return (
    // The loaded strip keeps MARQUEE_H as well. On phones the brand bar over
    // the row made it 86px, so the page moved down 14px the moment the models
    // arrived — the largest layout shift left on the homepage.
    <div className={`w-full overflow-hidden border-y-2 border-ink/20 bg-blush/30 ${MARQUEE_H}`}>
      {/* Mobile: Simple centered marquee */}
      <div className="flex h-full flex-col md:hidden">
        <div className="border-b-2 border-ink/20 bg-brand py-1.5 text-center text-xs font-extrabold tracking-wide text-brand-foreground">
          ✨ NOW SUPPORTING
        </div>
        <div className="relative flex min-h-0 flex-1 items-center overflow-hidden">
          <div
            ref={mobileLap.ref}
            className="animate-marquee-mobile flex whitespace-nowrap"
            style={{
              animationPlayState: moving ? "running" : "paused",
              ...(mobileLap.seconds ? { animationDuration: `${mobileLap.seconds}s` } : {}),
            }}
          >
            {modelsToShow.map((model, idx) => {
              const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
              const emoji = emojis[idx % emojis.length];
              return (
                <span 
                  key={idx} 
                  className="text-sm text-foreground font-semibold inline-flex items-center gap-2 pr-4"
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
      <div className="hidden h-full md:flex items-center gap-4">
        <div className="flex flex-shrink-0 items-center gap-2 rounded-r-full border-y-2 border-r-2 border-ink bg-brand px-6 py-2 text-sm font-extrabold text-brand-foreground">
          <span className="text-base">✨</span>
          <span className="whitespace-nowrap tracking-wide">NOW SUPPORTING:</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={desktopLap.ref}
            className="animate-marquee-models flex whitespace-nowrap"
            style={{
              animationPlayState: moving ? "running" : "paused",
              ...(desktopLap.seconds ? { animationDuration: `${desktopLap.seconds}s` } : {}),
            }}
          >
            {modelsToShow.map((model, idx) => {
              const emojis = ['🔥', '🚀', '✨', '⭐', '💫', '🌟', '⚡', '🎯'];
              const emoji = emojis[idx % emojis.length];
              return (
                <span 
                  key={idx} 
                  className="text-sm text-foreground/90 font-medium inline-flex items-center gap-2 pr-3"
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
