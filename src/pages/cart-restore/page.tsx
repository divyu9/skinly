import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner.tsx";

export const PENDING_COUPON_KEY = "skinly_pending_coupon";

/**
 * /c/:code — the abandoned-cart WhatsApp's "Complete My Order" button.
 *
 * WhatsApp opens links in its own browser, which has neither the customer's
 * sign-in nor their saved cart, so a plain /cart link showed an empty cart.
 * The code names their abandoned cart (functions/src/abandonedCarts.ts,
 * restoreAbandonedCart): an unpaid checkout goes straight to its pay link;
 * otherwise the lines go back into this browser's cart, the reminder's coupon
 * is queued for checkout to apply, and the customer lands on checkout. Any
 * code that doesn't resolve still ends on the cart, never on an error.
 */
export default function CartRestorePage() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (isLoading || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const r: any = (await httpsCallable(getFunctions(), "restoreAbandonedCart")({ code })).data;
        if (r?.payLink) { window.location.replace(r.payLink); return; }
        if (r?.couponCode) { try { localStorage.setItem(PENDING_COUPON_KEY, String(r.couponCode)); } catch { /* checkout just won't prefill */ } }
        const items: any[] = Array.isArray(r?.items) ? r.items : [];
        // A signed-in customer's cart lives on their account and is still there.
        if (items.length && !isAuthenticated) {
          const key = "skinly_guest_cart";
          let cart: any[] = [];
          try { cart = JSON.parse(localStorage.getItem(key) || "[]"); } catch { cart = []; }
          const same = (a: any, b: any) => a.productId === b.productId && a.variant === b.variant &&
            (a.phoneModel || "") === (b.phoneModel || "") && (a.coverage || "") === (b.coverage || "");
          for (const it of items) if (!cart.some((c) => same(c, it))) cart.push(it);
          localStorage.setItem(key, JSON.stringify(cart));
          window.dispatchEvent(new Event("guest_cart_updated"));
        }
        navigate(items.length || isAuthenticated ? "/checkout" : "/cart", { replace: true });
      } catch {
        navigate("/cart", { replace: true });
      }
    })();
  }, [code, isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Helmet><title>Your cart · GoSkinly</title><meta name="robots" content="noindex" /></Helmet>
      <Spinner />
      <p className="font-semibold">Bringing back your cart…</p>
    </div>
  );
}
