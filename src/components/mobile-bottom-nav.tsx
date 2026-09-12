import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HomeIcon, LayoutGridIcon, ShoppingBagIcon, UserIcon, ChevronRightIcon } from "lucide-react";
// Sheet, not Drawer: drawer.tsx imports `vaul`, which is not installed — it
// has never been buildable. Radix dialog is already a dependency.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { useShopCategories } from "@/lib/shop-categories.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
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
  // Shop is spliced in at index 1 — it opens a sheet rather than navigating.
  { to: "/cart", label: "Cart", icon: ShoppingBagIcon, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") },
  { to: "/account", label: "Account", icon: UserIcon, match: (p: string) => p.startsWith("/account") || p.startsWith("/orders") },
];

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [shopOpen, setShopOpen] = useState(false);
  const { user } = useAuth();
  const { getGuestCartCount } = useGuestCart();
  const signedInCount = useQuery(api.cart.getCartCount, user ? {} : "skip") as number | undefined;
  const count = user ? (signedInCount ?? 0) : getGuestCartCount();

  // The homepage's own curated list, so the sheet and "Explore by Category"
  // can never disagree about what the shop sells or in what order.
  const categories = useShopCategories();

  const goTo = (href: string) => {
    setShopOpen(false);
    navigate(href);
  };

  // The bar would sit on top of the payment sheet, and a checkout is the one
  // place a stray tap is expensive.
  const hidden = /^\/(checkout|payment)/.test(pathname);

  // The page needs clearance only where the bar is actually drawn. As a blanket
  // rule on body it left 56px of dead space at the bottom of checkout, which is
  // the page that can least afford it.
  useEffect(() => {
    document.body.classList.toggle("has-mobile-tabbar", !hidden);
    return () => document.body.classList.remove("has-mobile-tabbar");
  }, [hidden]);

  const shopSectionActive = pathname.startsWith("/products") || pathname.startsWith("/devices");

  if (hidden) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg sm:hidden"
      // Clears the iPhone home indicator rather than sitting under it.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch">
        <TabLink {...TABS[0]} pathname={pathname} count={count} />

        {/* Shop opens the categories rather than dropping you into the full
            catalogue. It is a sheet, not a page: it rises from the edge the
            thumb is already on, costs no navigation, and a swipe dismisses it. */}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setShopOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={shopOpen}
            className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              shopSectionActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <LayoutGridIcon className="size-5" strokeWidth={shopSectionActive ? 2.4 : 1.8} />
            Shop
          </button>
        </li>

        <TabLink {...TABS[1]} pathname={pathname} count={count} />
        <TabLink {...TABS[2]} pathname={pathname} count={count} />
      </ul>

      <Sheet open={shopOpen} onOpenChange={setShopOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl p-0">
          <SheetHeader className="px-4 pb-2 pt-4 text-left">
            <SheetTitle>Shop by category</SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-4 pb-6">
            {categories === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => goTo(c.href)}
                      className="flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors active:bg-muted"
                    >
                      <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {c.imageUrl && (
                          <img
                            src={c.imageUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.label}</span>
                        {c.count != null && (
                          <span className="block text-xs text-muted-foreground">
                            {c.count} design{c.count === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}

                <li className="pt-1">
                  <button
                    type="button"
                    onClick={() => goTo("/products")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
                  >
                    Shop all products
                    <ChevronRightIcon className="size-4" />
                  </button>
                </li>
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

/** One destination in the bar. */
function TabLink({
  to, label, icon: Icon, match, pathname, count,
}: (typeof TABS)[number] & { pathname: string; count: number }) {
  const active = match(pathname);
  return (
    <li className="flex-1">
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        // 56px tall: comfortably over the 44px minimum for a thumb.
        className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <span className="relative">
          <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
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
}
