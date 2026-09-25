/**
 * Whether the visitor has closed the announcement bar, shared.
 *
 * The bar held this in its own `useState`, but the header is a sibling that
 * positions itself `top: 28px` to sit under the bar. Closing the bar removed
 * it and left the header floating over a 28px strip of empty page, because
 * nothing told the header. Kept for the tab only — a dismissal is a "not now",
 * not a permanent preference, and the next visit should show the offer again.
 */

/**
 * Whether the bar shows at all: switched on, with something to say, and not
 * past its end time. The bar, the header and the homepage all ask this, so a
 * sale that ends leaves no 28px gap where the bar was.
 */
export function announcementLive(settings: any): boolean {
  if (!settings?.announcementEnabled || !String(settings.announcementText || "").trim()) return false;
  const ends = Number(settings.announcementEndsAt) || 0;
  return !ends || Date.now() <= ends;
}

export const ANNOUNCEMENT_DISMISSED_EVENT = "skinly:announcement-dismissed";

const KEY = "skinly_announcement_dismissed";

export function isAnnouncementDismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissAnnouncement() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* private mode — the event below still syncs this page */
  }
  window.dispatchEvent(new Event(ANNOUNCEMENT_DISMISSED_EVENT));
}


/*
 * Whether the bar was showing last time, so the layout can reserve its height
 * before the settings query answers.
 *
 * The bar is `fixed`, but the header offsets itself beneath it and the page
 * pads for the header — so when `announcementEnabled` resolved from undefined
 * to true, everything below moved down 28px. That was a measured 0.076 of
 * layout shift on every cold load. Remembering the last answer means a
 * returning visitor reserves the right space from the first frame; a first
 * visit assumes it is on, which is the common case and the cheaper miss.
 */

const SHOWN_KEY = "skinly_announcement_was_shown";

export function announcementLikelyShown(): boolean {
  try {
    const v = localStorage.getItem(SHOWN_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function rememberAnnouncementShown(shown: boolean) {
  try {
    localStorage.setItem(SHOWN_KEY, shown ? "1" : "0");
  } catch {
    /* storage unavailable — the guess above still holds for this page */
  }
}
