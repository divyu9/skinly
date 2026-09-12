import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { PlayIcon, XIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

/**
 * Customers wearing the thing, playing next to the buy button.
 *
 * UGC only existed as a row on the homepage — a page nobody is on when they
 * are deciding. Proof is worth most at the moment of doubt, so the clips for
 * *this* product play in the corner of the product page instead, small enough
 * to ignore and one tap from full screen.
 *
 * Two kinds of clip are stored: files we host, which autoplay muted inline,
 * and Instagram reel links, which cannot be embedded and so show their
 * thumbnail and open on Instagram. Anything with neither a playable file nor a
 * thumbnail is skipped rather than rendered as a grey box.
 */

interface UgcVideo {
  _id: string;
  productId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  ctaText?: string;
  isActive?: boolean;
}

const isEmbeddableFile = (url?: string) =>
  !!url && !/instagram\.com|youtube\.com|youtu\.be|tiktok\.com|facebook\.com/i.test(url);

export function ProductUgcFloat({
  productId,
  /** True while the page's own Buy Now bar is on screen, so we clear that too. */
  stickyBarVisible = false,
}: {
  productId?: string;
  stickyBarVisible?: boolean;
}) {
  const videos = useQuery(api.homepage.getActiveUgcVideos) as UgcVideo[] | undefined;
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const previewRef = useRef<HTMLVideoElement>(null);

  const clips = useMemo(() => {
    if (!Array.isArray(videos) || !productId) return [];
    return videos.filter(
      (v) => v.productId === productId && (isEmbeddableFile(v.videoUrl) || v.thumbnailUrl),
    );
  }, [videos, productId]);

  // A different product means a different set; start from its first clip.
  useEffect(() => {
    setIndex(0);
    setDismissed(false);
    setExpanded(false);
  }, [productId]);

  // The page behind a full-screen player should not scroll under it.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  if (!clips.length || dismissed) return null;

  const clip = clips[Math.min(index, clips.length - 1)];
  const playable = isEmbeddableFile(clip.videoUrl);

  const openClip = () => {
    if (playable) {
      setExpanded(true);
    } else if (clip.videoUrl) {
      window.open(clip.videoUrl, "_blank", "noopener,noreferrer");
    }
  };

  const step = (delta: number) =>
    setIndex((i) => (i + delta + clips.length) % clips.length);

  const floater = (
    <div
      className="fixed right-3 z-40 transition-[bottom] duration-200 md:right-6"
      // Sits on top of the app tab bar, and lifts again when the page's own
      // Buy Now bar slides in — a clip covering either one would be worse than
      // no clip at all.
      style={{
        bottom: `calc(${stickyBarVisible ? "9rem" : "4.75rem"} + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide customer video"
          className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full border-2 border-ink bg-background text-ink shadow-sm"
        >
          <XIcon className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={openClip}
          aria-label="Watch customer video"
          className="sticker block h-[176px] w-[104px] overflow-hidden rounded-2xl bg-ink/5"
        >
          {playable ? (
            <video
              ref={previewRef}
              src={clip.videoUrl}
              poster={clip.thumbnailUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
          ) : (
            <img
              src={clip.thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-[10px] font-bold text-white">
            <PlayIcon className="size-3 fill-white" />
            {clip.ctaText || "Real customer"}
          </span>
        </button>

        {clips.length > 1 && (
          <div className="mt-1 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous video"
              className="flex size-5 items-center justify-center rounded-full bg-ink/10 text-ink"
            >
              <ChevronLeftIcon className="size-3" />
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {index + 1}/{clips.length}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next video"
              className="flex size-5 items-center justify-center rounded-full bg-ink/10 text-ink"
            >
              <ChevronRightIcon className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const player =
    expanded && playable ? (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"
        onClick={() => setExpanded(false)}
      >
        <button
          type="button"
          aria-label="Close video"
          onClick={() => setExpanded(false)}
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <XIcon className="size-5" />
        </button>
        <video
          src={clip.videoUrl}
          poster={clip.thumbnailUrl}
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] w-auto max-w-full rounded-2xl"
        />
      </div>
    ) : null;

  return createPortal(
    <>
      {floater}
      {player}
    </>,
    document.body,
  );
}
