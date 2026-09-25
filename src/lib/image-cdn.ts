/**
 * Pictures at the size they are shown, from Cloudflare's image resizing.
 *
 * Every storefront picture lives in R2 and was served at whatever size it was
 * uploaded: 900px category cards shown at 280px, 1200px hero slides shown at
 * 600px. PageSpeed counted 1.4 MB of the homepage as bytes nobody saw.
 *
 * R2 is now reachable at cdn.goskinly.com, a hostname inside the goskinly.com
 * zone, so Cloudflare can resize on the way out:
 *   https://cdn.goskinly.com/cdn-cgi/image/width=480,.../media-library/x.webp
 * Each size is made once and cached at the edge. The free plan allows 5,000
 * distinct resizes a month; past that `onerror=redirect` sends the browser to
 * the original file, so the worst case is today's behaviour, never a broken
 * picture.
 *
 * Anything that is not an R2 picture (local /assets copies, other hosts) is
 * returned untouched.
 */

const R2_PUBLIC = "https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/";
const CDN = "https://cdn.goskinly.com/";

/** cdn.goskinly.com and zone transformations went live on 24 Sep 2026. */
export const IMAGE_CDN_ON = true;

/** The object key if this is one of our R2 pictures, else null. */
function r2Key(url: string): string | null {
  if (url.startsWith(R2_PUBLIC)) return url.slice(R2_PUBLIC.length);
  if (url.startsWith(CDN) && !url.startsWith(`${CDN}cdn-cgi/`)) return url.slice(CDN.length);
  return null;
}

/** One resized copy, or the URL unchanged when resizing does not apply. */
export function sizedImage(url: string | undefined | null, width: number, quality = 75): string | undefined {
  if (!url) return url ?? undefined;
  const key = IMAGE_CDN_ON ? r2Key(url) : null;
  if (!key) return url;
  return `${CDN}cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down,onerror=redirect/${key}`;
}

/** A srcset of resized copies; undefined when resizing does not apply. */
export function sizedSrcSet(url: string | undefined | null, widths: number[], quality = 75): string | undefined {
  if (!url || !IMAGE_CDN_ON || !r2Key(url)) return undefined;
  return widths.map((w) => `${sizedImage(url, w, quality)} ${w}w`).join(", ");
}

/**
 * Props for an <img>: src at the middle width (what a browser without
 * srcset support gets), srcset across the widths, and the layout's sizes.
 */
export function responsiveImg(
  url: string | undefined | null,
  widths: number[],
  sizes: string,
  quality = 75,
): { src?: string; srcSet?: string; sizes?: string } {
  if (!url) return {};
  const srcSet = sizedSrcSet(url, widths, quality);
  if (!srcSet) return { src: url };
  const mid = widths[Math.floor(widths.length / 2)];
  return { src: sizedImage(url, mid, quality), srcSet, sizes };
}

/*
 * Product photos, resized, from goskinly.com itself.
 *
 * A product page's largest paint is its main photo, and it came from r2.dev
 * at upload size: 70–90 KB of 1200px webp for a 362px box, over a second
 * connection the phone had to open first. Lighthouse put the product page at
 * 55 with the photo arriving 7.7 s in. Resized on the site's own host it rides
 * the connection the HTML already opened, and it is ~26 KB as AVIF.
 *
 * Two widths only, 640 and 960, shared by the main photo, the thumbnails and
 * every product card, so one product costs at most two of the month's 5,000
 * free resizes and a card's photo is already cached when its page opens.
 *
 * scripts/prerender.mjs writes the same URLs and the same `sizes` into each
 * product page's HTML so the photo paints before the app loads; the three
 * must stay identical or the browser downloads the photo twice.
 */
const SITE_RESIZE = "https://goskinly.com/cdn-cgi/image/";

export function productImageUrl(url: string | undefined | null, width: 640 | 960 = 640): string | undefined {
  if (!url) return url ?? undefined;
  const key = IMAGE_CDN_ON ? r2Key(url) : null;
  if (!key) return url;
  return `${SITE_RESIZE}width=${width},quality=75,format=auto,fit=scale-down,onerror=redirect/${CDN}${key}`;
}

/** The main photo's box: 100vw less padding and borders on a phone, 42% of the row from md, 432px from lg. */
export const PRODUCT_MAIN_SIZES = "(min-width: 1024px) 432px, (min-width: 768px) 42vw, calc(100vw - 50px)";

export function productMainImg(url: string | undefined | null): { src?: string; srcSet?: string; sizes?: string } {
  if (!url) return {};
  const small = productImageUrl(url, 640);
  if (small === url) return { src: url };
  return { src: small, srcSet: `${small} 640w, ${productImageUrl(url, 960)} 960w`, sizes: PRODUCT_MAIN_SIZES };
}
