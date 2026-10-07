/**
 * Tells the server what is in a guest's cart (functions/src/cartSync.ts), so
 * the dashboard can count carts and a checkout left half-way can get the
 * abandoned-cart reminder. Debounced: one call a few seconds after the cart
 * or the checkout form settles, never one per keystroke. Never throws, and
 * the Firebase Functions SDK is loaded only when the first call goes out.
 */

type Line = {
  productId: string; productTitle?: string; productImage?: string; variant?: string;
  price?: number; quantity?: number; phoneBrand?: string; phoneModel?: string; coverage?: string;
};
type Payload = {
  items: Line[];
  stage: "cart" | "checkout" | "ordered";
  phone?: string; email?: string; name?: string; optIn?: boolean; orderId?: string;
};

const ID_KEY = "skinly_cart_id";
let timer: ReturnType<typeof setTimeout> | undefined;
let lastSent = "";
let pending: Payload | null = null;

/** One id per browser, kept across visits, so a returning guest's cart is the same row. */
function cartId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      id = `c${rnd.slice(0, 24)}`;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

async function send(p: Payload) {
  const id = cartId();
  if (!id) return;
  const body = {
    cartId: id,
    stage: p.stage,
    items: p.items.slice(0, 30).map((i) => ({
      productId: i.productId, productTitle: i.productTitle, productImage: i.productImage, variant: i.variant,
      price: i.price, quantity: i.quantity, phoneBrand: i.phoneBrand, phoneModel: i.phoneModel, coverage: i.coverage,
    })),
    ...(p.phone ? { phone: p.phone } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.name ? { name: p.name } : {}),
    ...(p.optIn ? { optIn: true } : {}),
    ...(p.orderId ? { orderId: p.orderId } : {}),
  };
  const key = JSON.stringify(body);
  if (key === lastSent) return;
  try {
    const [{ functions }, { httpsCallable }] = await Promise.all([import("./firebase"), import("firebase/functions")]);
    await httpsCallable(functions, "syncCart")(body);
    lastSent = key;
  } catch {
    /* offline or rate-limited: the next change tries again */
  }
}

/** Queue the latest cart state; sent once things are quiet for `delayMs`. */
export function syncCartSoon(p: Payload, delayMs = 4000) {
  pending = p;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const now = pending;
    pending = null;
    if (now) void send(now);
  }, delayMs);
}

/** Send now (an order was just placed). */
export function syncCartNow(p: Payload) {
  if (timer) clearTimeout(timer);
  pending = null;
  void send(p);
}
