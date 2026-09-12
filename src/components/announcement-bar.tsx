import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Link } from "react-router-dom";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { ANNOUNCEMENT_DISMISSED_EVENT, isAnnouncementDismissed, dismissAnnouncement } from "@/lib/announcement-dismissed.ts";

export function AnnouncementBar() {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const [isDismissed, setIsDismissed] = useState(isAnnouncementDismissed);

  // Don't render loading state or if announcement is disabled or dismissed
  if (homepageSettings === undefined || !homepageSettings?.announcementEnabled || isDismissed) {
    return null;
  }

  const text = homepageSettings.announcementText;
  const link = homepageSettings.announcementLink;

  // Don't render if no text
  if (!text) {
    return null;
  }

  const content = (
    <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
      <span className="text-xs font-normal truncate">{text}</span>
      {link && (
        <span className="text-xs font-semibold">→</span>
      )}
    </div>
  );

  return (
    <div className="w-full bg-primary text-primary-foreground fixed top-0 left-0 right-0 z-50">
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
          className="p-0.5 hover:bg-primary-foreground/10 rounded transition-colors"
          aria-label="Dismiss announcement"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
