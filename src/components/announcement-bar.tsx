import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ANNOUNCEMENT_DISMISSED_EVENT, isAnnouncementDismissed, dismissAnnouncement, announcementLive } from "@/lib/announcement-dismissed.ts";

/** The bar's colours, chosen per offer in the admin. */
export const ANNOUNCEMENT_STYLES: Record<string, string> = {
  brand: "bg-primary text-primary-foreground",
  sale: "bg-heart text-white",
  dark: "bg-ink text-background",
};

/** "1d 05:23:11" or "05:23:11" — to the second, short enough for a phone's bar. */
function remaining(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${p(h)}:${p(m)}:${p(s)}`;
}

/**
 * The time left on a sale, ticking every second, in a chip that stands out
 * from the bar. Calls onEnd once when it reaches zero.
 */
export function Countdown({ endsAt, onEnd, className = "" }: { endsAt: number; onEnd?: () => void; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = endsAt - now;
  useEffect(() => { if (left <= 0) onEnd?.(); }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (left <= 0) return null;
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded bg-background/95 px-1.5 py-px font-mono text-[11px] font-bold leading-4 tabular-nums text-foreground shadow-sm ${className}`}
      aria-label={`Ends in ${remaining(left)}`}
    >
      <span className="hidden font-sans font-semibold sm:inline">Ends in </span>{remaining(left)}
    </span>
  );
}

export function AnnouncementBar() {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const [isDismissed, setIsDismissed] = useState(isAnnouncementDismissed);
  const [ended, setEnded] = useState(false);

  // Don't render loading state or if announcement is disabled or dismissed
  if (homepageSettings === undefined || !homepageSettings?.announcementEnabled || isDismissed) {
    return null;
  }
  // A sale with an end time takes itself down (Admin › Homepage › Notice bar).
  if (ended || !announcementLive(homepageSettings)) return null;
  const endsAt = Number(homepageSettings.announcementEndsAt) || 0;
  const showCountdown = !!endsAt && homepageSettings.announcementCountdown === true;

  const text = homepageSettings.announcementText;
  const link = homepageSettings.announcementLink;

  // Don't render if no text
  if (!text) {
    return null;
  }

  const content = (
    <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
      <span className="text-xs font-normal truncate">{text}</span>
      {showCountdown && (
        <Countdown
          endsAt={endsAt}
          onEnd={() => {
            // The sale is over: take the bar down now, and let the header move up.
            setEnded(true);
            window.dispatchEvent(new Event(ANNOUNCEMENT_DISMISSED_EVENT));
          }}
        />
      )}
      {link && (
        <span className="text-xs font-semibold">→</span>
      )}
    </div>
  );

  return (
    <div className={`w-full fixed top-0 left-0 right-0 z-50 ${ANNOUNCEMENT_STYLES[homepageSettings.announcementStyle as string] || ANNOUNCEMENT_STYLES.brand}`}>
      <div className="container mx-auto px-4 py-1.5 flex items-center justify-between gap-2">
        {/* Empty space for balance */}
        <div className="w-5" />

        {/* Content - clickable if link provided */}
        {link ? (
          <Link 
            to={link}
            className="flex items-center justify-center gap-2 flex-1 min-w-0 hover:opacity-90 transition-opacity"
          >
            {content}
          </Link>
        ) : (
          content
        )}

        {/* Dismiss button */}
        <button
          onClick={() => {
            // The header positions itself under this bar, so it has to hear
            // about this or it leaves a 28px strip of empty page above itself.
            dismissAnnouncement();
            setIsDismissed(true);
          }}
          /* Was 18x18. This is the control someone reaches for precisely
             because they want the bar gone; missing it twice is worse than the
             bar. The icon stays 14px, the target is 44. */
          className="-my-2 grid size-11 place-items-center rounded transition-colors hover:bg-primary-foreground/10"
          aria-label="Dismiss announcement"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
