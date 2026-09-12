/**
 * Whether the visitor has closed the announcement bar, shared.
 *
 * The bar held this in its own `useState`, but the header is a sibling that
 * positions itself `top: 28px` to sit under the bar. Closing the bar removed
 * it and left the header floating over a 28px strip of empty page, because
 * nothing told the header. Kept for the tab only — a dismissal is a "not now",
 * not a permanent preference, and the next visit should show the offer again.
 */

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
