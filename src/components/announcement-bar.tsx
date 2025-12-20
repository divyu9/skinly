import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { XIcon } from "lucide-react";
import { useState } from "react";

export function AnnouncementBar() {
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't render if announcement is disabled or dismissed
  if (!homepageSettings?.announcementEnabled || isDismissed) {
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
      <span className="text-sm font-medium truncate">{text}</span>
      {link && (
        <span className="text-sm font-bold">→</span>
      )}
    </div>
  );

  return (
    <div className="w-full bg-primary text-primary-foreground border-b border-primary-foreground/20">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-2">
        {/* Empty space for balance */}
        <div className="w-6" />

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
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-primary-foreground/10 rounded transition-colors"
          aria-label="Dismiss announcement"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
