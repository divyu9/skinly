import { loadFs } from "./fs";

/**
 * The listing's own first picture, for a cart line whose saved picture does
 * not load. Lines added before 16 Oct 2026 could carry a guessed mockup
 * filename (a 404), and showed an empty box in the cart and at checkout.
 * One read per product, shared by every line and every page.
 */
const cache = new Map<string, Promise<string | null>>();

export function productThumb(productId: string): Promise<string | null> {
  if (!productId) return Promise.resolve(null);
  let p = cache.get(productId);
  if (!p) {
    p = loadFs()
      .then(({ db, doc, getDoc }) => getDoc(doc(db, "products", productId)))
      .then((snap) => {
        const imgs = (snap.data() as any)?.images || [];
        return String(imgs.find((i: any) => i?.url)?.url || "") || null;
      })
      .catch(() => null);
    cache.set(productId, p);
  }
  return p;
}

/** onError for a cart line's <img>: try the listing's picture once, then the logo. */
export function cartImageFallback(productId: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) { img.src = "/logo.webp"; return; }
    img.dataset.fallback = "1";
    void productThumb(productId).then((url) => { img.src = url || "/logo.webp"; });
  };
}
