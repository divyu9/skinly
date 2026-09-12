import { Link, useLocation } from "react-router-dom";
import { HomeIcon, LayoutGridIcon, ShoppingBagIcon, UserIcon } from "lucide-react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";

/**
 * The app-style tab bar, phones only.
 *
 * The storefront's only navigation was a header that scrolls with a frosted
 * overlay, so getting from a product back to the cart meant scrolling to the
 * top first. Four destinations that are always one thumb-reach away is what
 * every shopping app does, and it is the cheapest thing that makes a mobile
 * web store feel like one.
 */
const TABS = [
  { to: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { to: "/products", label: "Shop", icon: LayoutGridIcon, match: (p: string) => p.startsWith("/products") || p.startsWith("/devices") },
  { to: "/cart", label: "Cart", icon: ShoppingBagIcon, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") },
  { to: "/account", label: "Account", icon: UserIcon, match: (p: string) => p.startsWith("/account") || p.startsWith("/orders") },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { getGuestCartCount } = useGuestCart();
  const signedInCount = useQuery(api.cart.getCartCount, user ? {} : "skip") as number | undefined;
  const count = user ? (signedInCount ?? 0) : getGuestCartCount();

  // The bar would sit on top of the payment sheet and the cart's own sticky
  // total, and a checkout is the one place a stray tap is expensive.
  if (/^\/(checkout|payment)/.test(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg sm:hidden"
      // Clears the iPhone home indicator rather than sitting under it.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch">
        {TABS.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                // 56px tall: comfortably over the 44px minimum for a thumb.
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className={active ? "size-5" : "size-5"} strokeWidth={active ? 2.4 : 1.8} />
                  {to === "/cart" && count > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
