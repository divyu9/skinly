/**
 * Site-wide safety net for images that 404.
 *
 * The old Cloudinary account was deleted, so 2,531 image URLs across 791
 * products now return 401. Left alone the browser paints its broken-image glyph
 * next to the alt text, which is how carousels ended up looking abandoned.
 *
 * There are 40-odd <img> tags across the storefront and more will be added, so
 * rather than wrap each one this listens once, in the capture phase — image
 * `error` events do not bubble, so a normal listener would never see them.
 *
 * It only marks the element and strips the alt text; the actual placeholder is
 * painted by CSS in index.css. Nothing is added to or removed from the DOM,
 * which keeps React's reconciler out of it — components that render their own
 * richer placeholder (ProductThumb, ProductImages) still do.
 */

const BROKEN_ATTR = "data-img-broken";

export function installImageFallback() {
  if (typeof document === "undefined") return;

  document.addEventListener(
    "error",
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLImageElement)) return;
      if (el.hasAttribute(BROKEN_ATTR)) return;
      // A src that has not resolved yet is not a failure.
      if (!el.currentSrc && !el.getAttribute("src")) return;

      el.setAttribute(BROKEN_ATTR, "");
      // Keep the text for assistive tech, drop it from the visual box so the
      // placeholder is not overprinted with a filename.
      const alt = el.getAttribute("alt");
      if (alt) {
        el.setAttribute("aria-label", alt);
        el.setAttribute("alt", "");
      }
    },
    true
  );
}

/** True for hosts we know are gone, so the admin can list them without probing. */
export const DEAD_IMAGE_HOSTS = ["res.cloudinary.com"];

export function isDeadImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return DEAD_IMAGE_HOSTS.some((h) => url.includes(h));
}

/**
 * Whether a product has a picture anyone can actually see.
 *
 * "Has images" was never the same question as "shows an image": 791 products
 * carry Cloudinary URLs that answer 401, so a product with four images can
 * still render four grey boxes. Both the admin filter and the storefront
 * ordering ask this one function, so a product the admin lists as having no
 * image is exactly the one the storefront pushes down.
 *
 * Images are stored either as strings or as `{ url }`, depending on how old
 * the row is.
 */
export function usableImageUrls(images?: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((i) => (typeof i === "string" ? i : (i as { url?: string })?.url))
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u) && !isDeadImageUrl(u));
}

export const hasUsableImage = (images?: unknown): boolean => usableImageUrls(images).length > 0;
