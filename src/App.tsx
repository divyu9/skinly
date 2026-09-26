import { Suspense, useEffect } from "react";
import { usePageLoaded } from "./hooks/use-page-loaded";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AdminPageWrapper } from "./components/admin-page-wrapper.tsx";
import { Skeleton } from "./components/ui/skeleton.tsx";
import { FacebookPixelInitializer } from "./components/facebook-pixel-initializer.tsx";
import { ReferralTracker } from "./components/referral-tracker.tsx";
import { lazyWithReload } from "./lib/lazy-with-reload.ts";
import { StorefrontErrorBoundary } from "./components/storefront-error-boundary.tsx";
import { MobileBottomNav } from "./components/mobile-bottom-nav.tsx";

// Critical pages - loaded immediately
import Index from "./pages/Index.tsx";
import ProductsPage from "./pages/products/page.tsx";
import ProductDetailPage from "./pages/products/detail/product-detail.tsx";
import NotFound from "./pages/NotFound.tsx";

/*
 * Account, cart, checkout and order pages - lazy loaded. They were in the
 * first download of every visit (with a date picker and date-fns), which a
 * shopper opening the homepage on a phone paid for before seeing anything.
 * Cart and checkout are fetched once the page is idle (below), so the tap
 * that opens them does not wait.
 */
const CheckoutPage = lazyWithReload(() => import("./pages/checkout/page.tsx"), "./pages/checkout/page.tsx");
const CartPage = lazyWithReload(() => import("./pages/cart/page.tsx"), "./pages/cart/page.tsx");
const OrdersPage = lazyWithReload(() => import("./pages/orders/page.tsx"), "./pages/orders/page.tsx");
const TrackOrderPage = lazyWithReload(() => import("./pages/track/page.tsx"), "./pages/track/page.tsx");
const OrderDetailPage = lazyWithReload(() => import("./pages/orders/detail/page.tsx"), "./pages/orders/detail/page.tsx");
const DevicesPage = lazyWithReload(() => import("./pages/devices/page.tsx"), "./pages/devices/page.tsx");
const PaymentCallback = lazyWithReload(() => import("./pages/payment/callback.tsx"), "./pages/payment/callback.tsx");
const PayPage = lazyWithReload(() => import("./pages/pay/page.tsx"), "./pages/pay/page.tsx");
const ReviewPage = lazyWithReload(() => import("./pages/review/page.tsx"), "./pages/review/page.tsx");
const AccountPage = lazyWithReload(() => import("./pages/account/page.tsx"), "./pages/account/page.tsx");
const ReferralsPage = lazyWithReload(() => import("./pages/account/referrals/page.tsx"), "./pages/account/referrals/page.tsx");
const WalletPage = lazyWithReload(() => import("./pages/account/wallet/page.tsx"), "./pages/account/wallet/page.tsx");

// Policy pages - lazy loaded
const ReturnsPolicy = lazyWithReload(() => import("./pages/policies/returns.tsx"), "./pages/policies/returns.tsx");
const ShippingPolicy = lazyWithReload(() => import("./pages/policies/shipping.tsx"), "./pages/policies/shipping.tsx");
const TermsOfService = lazyWithReload(() => import("./pages/policies/terms.tsx"), "./pages/policies/terms.tsx");
const PrivacyPolicy = lazyWithReload(() => import("./pages/policies/privacy.tsx"), "./pages/policies/privacy.tsx");
const SEOPage = lazyWithReload(() => import("./pages/seo/page.tsx"), "./pages/seo/page.tsx");
const MagnetoXPage = lazyWithReload(() => import("./pages/magneto-x/page.tsx"), "./pages/magneto-x/page.tsx");

// Admin pages - lazy loaded to reduce initial bundle
const AdminBrokenImagesPage = lazyWithReload(() => import("./pages/admin/broken-images/page.tsx"), "./pages/admin/broken-images/page.tsx");
const AdminAiMockupsPage = lazyWithReload(() => import("./pages/admin/ai-mockups/page.tsx"), "./pages/admin/ai-mockups/page.tsx");
const AdminQuickLaunchPage = lazyWithReload(() => import("./pages/admin/launch/page.tsx"), "./pages/admin/launch/page.tsx");
const AdminProductsPage = lazyWithReload(() => import("./pages/admin/products/page.tsx"), "./pages/admin/products/page.tsx");
const AdminCollectionsPage = lazyWithReload(() => import("./pages/admin/collections/page.tsx"), "./pages/admin/collections/page.tsx");
const NewProductPage = lazyWithReload(() => import("./pages/admin/products/new/page.tsx"), "./pages/admin/products/new/page.tsx");
const EditProductPage = lazyWithReload(() => import("./pages/admin/products/edit/page.tsx"), "./pages/admin/products/edit/page.tsx");
const BulkProductCreatorPage = lazyWithReload(() => import("./pages/admin/products/bulk/page.tsx"), "./pages/admin/products/bulk/page.tsx");
const AdminOrdersPage = lazyWithReload(() => import("./pages/admin/orders/page.tsx"), "./pages/admin/orders/page.tsx");
const AdminCustomersPage = lazyWithReload(() => import("./pages/admin/customers/page.tsx"), "./pages/admin/customers/page.tsx");
const AdminOrderDetailPage = lazyWithReload(() => import("./pages/admin/orders/detail.tsx"), "./pages/admin/orders/detail.tsx");
const AdminCouponsPage = lazyWithReload(() => import("./pages/admin/coupons/page.tsx"), "./pages/admin/coupons/page.tsx");
const AdminReviewsPage = lazyWithReload(() => import("./pages/admin/reviews.tsx"), "./pages/admin/reviews.tsx");
const AdminAbandonedCartsPage = lazyWithReload(() => import("./pages/admin/abandoned-carts/page.tsx"), "./pages/admin/abandoned-carts/page.tsx");
const AdminStockNotificationsPage = lazyWithReload(() => import("./pages/admin/stock-notifications/page.tsx"), "./pages/admin/stock-notifications/page.tsx");
const AdminOOSPage = lazyWithReload(() => import("./pages/admin/oos/page.tsx"), "./pages/admin/oos/page.tsx");
const AdminMockupsAdvancedPage = lazyWithReload(() => import("./pages/admin/mockups-advanced.tsx"), "./pages/admin/mockups-advanced.tsx");
const AdminGoogleDriveImportPage = lazyWithReload(() => import("./pages/admin/google-drive-import.tsx"), "./pages/admin/google-drive-import.tsx");
const AdminModelsPage = lazyWithReload(() => import("./pages/admin/models/page.tsx"), "./pages/admin/models/page.tsx");
const AdminVariantPresetsPage = lazyWithReload(() => import("./pages/admin/variant-presets.tsx"), "./pages/admin/variant-presets.tsx");
const AdminCODPage = lazyWithReload(() => import("./pages/admin/cod.tsx"), "./pages/admin/cod.tsx");
const AdminWhatsAppPage = lazyWithReload(() => import("./pages/admin/whatsapp/page.tsx"), "./pages/admin/whatsapp/page.tsx");
const AdminWhatsAppMessagesPage = lazyWithReload(() => import("./pages/admin/whatsapp/messages.tsx"), "./pages/admin/whatsapp/messages.tsx");
const AdminWhatsAppHealthPage = lazyWithReload(() => import("./pages/admin/whatsapp-health.tsx"), "./pages/admin/whatsapp-health.tsx");
const AdminWhatsAppDebugLogsPage = lazyWithReload(() => import("./pages/admin/whatsapp-debug-logs.tsx"), "./pages/admin/whatsapp-debug-logs.tsx");
const AdminWalletPage = lazyWithReload(() => import("./pages/admin/wallet/page.tsx"), "./pages/admin/wallet/page.tsx");
const AdminReferralsPage = lazyWithReload(() => import("./pages/admin/referrals/page.tsx"), "./pages/admin/referrals/page.tsx");
const AdminCashbackPage = lazyWithReload(() => import("./pages/admin/cashback/page.tsx"), "./pages/admin/cashback/page.tsx");
const AdminEmailsPage = lazyWithReload(() => import("./pages/admin/emails/page.tsx"), "./pages/admin/emails/page.tsx");
const AdminBugsPage = lazyWithReload(() => import("./pages/admin/bugs/page.tsx"), "./pages/admin/bugs/page.tsx");
const AdminUpsellsPage = lazyWithReload(() => import("./pages/admin/upsells/page.tsx"), "./pages/admin/upsells/page.tsx");
const AdminSEOTemplatesPage = lazyWithReload(() => import("./pages/admin/seo-templates/page.tsx"), "./pages/admin/seo-templates/page.tsx");
const AdminSEOPagesPage = lazyWithReload(() => import("./pages/admin/seo-pages/page.tsx"), "./pages/admin/seo-pages/page.tsx");
const AdminSEOPagesNewPage = lazyWithReload(() => import("./pages/admin/seo-pages/new.tsx"), "./pages/admin/seo-pages/new.tsx");
const AdminSEOPagesEditPage = lazyWithReload(() => import("./pages/admin/seo-pages/edit.tsx"), "./pages/admin/seo-pages/edit.tsx");
const AdminSEOPagesAutoGeneratePage = lazyWithReload(() => import("./pages/admin/seo-pages/auto-generate.tsx"), "./pages/admin/seo-pages/auto-generate.tsx");
const AdminSettingsPage = lazyWithReload(() => import("./pages/admin/settings/page.tsx"), "./pages/admin/settings/page.tsx");
const AdminSeoAutomationPage = lazyWithReload(() => import("./pages/admin/seo-automation/page.tsx"), "./pages/admin/seo-automation/page.tsx");
const AdminSEOGeneratorPage = lazyWithReload(() => import("./pages/admin/seo-generator/page.tsx"), "./pages/admin/seo-generator/page.tsx");
const AdminShippingPage = lazyWithReload(() => import("./pages/admin/shipping.tsx"), "./pages/admin/shipping.tsx");
const AdminProductClassificationPage = lazyWithReload(() => import("./pages/admin/product-classification/page.tsx"), "./pages/admin/product-classification/page.tsx");
const AdminProductCategoriesPage = lazyWithReload(() => import("./pages/admin/product-categories/page.tsx"), "./pages/admin/product-categories/page.tsx");
const AdminHomepagePage = lazyWithReload(() => import("./pages/admin/homepage/page.tsx"), "./pages/admin/homepage/page.tsx");
const AdminProductSectionsPage = lazyWithReload(() => import("./pages/admin/product-sections/page.tsx"), "./pages/admin/product-sections/page.tsx");
const AdminMediaLibraryPage = lazyWithReload(() => import("./pages/admin/media/page.tsx"), "./pages/admin/media/page.tsx");
const AdminUnauthorizedPage = lazyWithReload(() => import("./pages/admin/unauthorized.tsx"), "./pages/admin/unauthorized.tsx");
const TaxExportPage = lazyWithReload(() => import("./pages/admin/tax-export.tsx"), "./pages/admin/tax-export.tsx");
const MockPaymentPage = lazyWithReload(() => import("./pages/mock-payment/page.tsx"), "./pages/mock-payment/page.tsx");

// Loading fallback for lazy-loaded routes
function PageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Fetches the cart and checkout chunks once the page has loaded and gone
 * quiet, so the shopper's tap on the cart opens it without a download — and
 * without those chunks competing with the page's own pictures on arrival.
 */
function PrefetchCheckoutChunks() {
  const loaded = usePageLoaded();
  useEffect(() => {
    if (!loaded) return;
    const idle = (window as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 1));
    const t = setTimeout(() => idle(() => {
      void import("./pages/cart/page.tsx").catch(() => {});
      void import("./pages/checkout/page.tsx").catch(() => {});
    }), 4000);
    return () => clearTimeout(t);
  }, [loaded]);
  return null;
}

export default function App() {
  return (
    <HelmetProvider>
      <DefaultProviders>
        <FacebookPixelInitializer />
        <BrowserRouter>
          <ReferralTracker />
          <PrefetchCheckoutChunks />
          <StorefrontErrorBoundary>
          <Routes>
            {/* Critical paths - eagerly loaded */}
            <Route path="/" element={<Index />} />
            <Route path="/account" element={<Suspense fallback={<PageSkeleton />}><AccountPage /></Suspense>} />
            <Route path="/account/referrals" element={<Suspense fallback={<PageSkeleton />}><ReferralsPage /></Suspense>} />
            <Route path="/account/wallet" element={<Suspense fallback={<PageSkeleton />}><WalletPage /></Suspense>} />
            <Route path="/magneto-x" element={<Suspense fallback={<PageSkeleton />}><MagnetoXPage /></Suspense>} />
            <Route path="/products" element={<ProductsPage />} />
            {/* Category listings with a path of their own (src/lib/category-paths.mjs). */}
            <Route path="/skins" element={<ProductsPage />} />
            <Route path="/cases-covers" element={<ProductsPage />} />
            <Route path="/camera-rings" element={<ProductsPage />} />
            <Route path="/screen-protectors" element={<ProductsPage />} />
            <Route path="/accessories" element={<ProductsPage />} />
            <Route path="/products/detail" element={<ProductDetailPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/cart" element={<Suspense fallback={<PageSkeleton />}><CartPage /></Suspense>} />
            <Route path="/checkout" element={<Suspense fallback={<PageSkeleton />}><CheckoutPage /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<PageSkeleton />}><OrdersPage /></Suspense>} />
            {/* Guest-friendly: no login, the order number plus the contact it was placed with. */}
            <Route path="/track" element={<Suspense fallback={<PageSkeleton />}><TrackOrderPage /></Suspense>} />
            <Route path="/track-order" element={<Navigate to="/track" replace />} />
            <Route path="/orders/:orderId" element={<Suspense fallback={<PageSkeleton />}><OrderDetailPage /></Suspense>} />
            <Route path="/devices" element={<Suspense fallback={<PageSkeleton />}><DevicesPage /></Suspense>} />
            <Route path="/payment/callback" element={<Suspense fallback={<PageSkeleton />}><PaymentCallback /></Suspense>} />
            <Route path="/pay/:orderId" element={<Suspense fallback={<PageSkeleton />}><PayPage /></Suspense>} />
            <Route path="/review/:orderId" element={<Suspense fallback={<PageSkeleton />}><ReviewPage /></Suspense>} />
            

            {/* Admin routes - lazy loaded */}
            {/* Without this the bare path falls through to the /:slug SEO page and 404s */}
            <Route path="/backend-skinly" element={<Navigate to="/backend-skinly/products" replace />} />
            <Route path="/backend-skinly/products" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/products/new" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><NewProductPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/products/bulk" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><BulkProductCreatorPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/products/:productId" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><EditProductPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/broken-images" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminBrokenImagesPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/ai-mockups" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminAiMockupsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/launch" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminQuickLaunchPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/collections" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCollectionsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/orders" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminOrdersPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/customers" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCustomersPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/orders/:orderId" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminOrderDetailPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/coupons" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCouponsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/reviews" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminReviewsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/abandoned-carts" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminAbandonedCartsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/stock-notifications" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminStockNotificationsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/oos" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminOOSPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/cod" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCODPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/shipping" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminShippingPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/whatsapp" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminWhatsAppPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/whatsapp/messages" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminWhatsAppMessagesPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/whatsapp/health" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminWhatsAppHealthPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/whatsapp/debug-logs" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminWhatsAppDebugLogsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/wallet" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminWalletPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/referrals" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminReferralsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/cashback" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCashbackPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/emails" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminEmailsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/bugs" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminBugsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/upsells" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminUpsellsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-templates" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOTemplatesPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-pages" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-automation" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSeoAutomationPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-pages/new" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesNewPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-pages/:pageId" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesEditPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/seo-pages/auto-generate" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesAutoGeneratePage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/settings" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSettingsPage /></AdminPageWrapper></Suspense>} />
            {/* The old Mockups and Missing pages: Advanced Mockups does both, on all the mockups. */}
            <Route path="/backend-skinly/mockups" element={<Navigate to="/backend-skinly/mockups-advanced" replace />} />
            <Route path="/backend-skinly/mockups/missing" element={<Navigate to="/backend-skinly/mockups-advanced" replace />} />
            <Route path="/backend-skinly/mockups-advanced" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMockupsAdvancedPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/google-drive-import" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminGoogleDriveImportPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/models" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminModelsPage /></AdminPageWrapper></Suspense>} />
            {/* Phone Collections was a leftover migration page: collections are managed, and filled, from Collections. */}
            <Route path="/backend-skinly/phone-collections" element={<Navigate to="/backend-skinly/collections" replace />} />
            <Route path="/backend-skinly/variant-presets" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminVariantPresetsPage /></AdminPageWrapper></Suspense>} />
            {/* Auto-Assign was a stub since the Firebase move; its linking lives on Variant Presets. */}
            <Route path="/backend-skinly/variant-presets-auto-assign" element={<Navigate to="/backend-skinly/variant-presets" replace />} />
            <Route path="/backend-skinly/tax-export" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><TaxExportPage /></AdminPageWrapper></Suspense>} />
            {/* The sitemap is written by the build (scripts/prerender.mjs); this page only made a copy to paste nowhere. */}
            <Route path="/backend-skinly/sitemap" element={<Navigate to="/backend-skinly/seo-automation" replace />} />
            <Route path="/backend-skinly/seo-generator" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOGeneratorPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/product-classification" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductClassificationPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/product-categories" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductCategoriesPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/homepage" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminHomepagePage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/product-sections" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductSectionsPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/media" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMediaLibraryPage /></AdminPageWrapper></Suspense>} />
            <Route path="/backend-skinly/unauthorized" element={<Suspense fallback={<PageSkeleton />}><AdminUnauthorizedPage /></Suspense>} />

            {/* Policy pages - lazy loaded */}
            <Route path="/policies/returns" element={<Suspense fallback={<PageSkeleton />}><ReturnsPolicy /></Suspense>} />
            <Route path="/policies/shipping" element={<Suspense fallback={<PageSkeleton />}><ShippingPolicy /></Suspense>} />
            <Route path="/policies/terms" element={<Suspense fallback={<PageSkeleton />}><TermsOfService /></Suspense>} />
            <Route path="/policies/privacy" element={<Suspense fallback={<PageSkeleton />}><PrivacyPolicy /></Suspense>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/mock-payment" element={<Suspense fallback={<PageSkeleton />}><MockPaymentPage /></Suspense>} />
            {/* SEO landing pages (catch-all for root-level slugs) - must be second to last */}
            <Route path="/:slug" element={<Suspense fallback={<PageSkeleton />}><SEOPage /></Suspense>} />
            {/* 404 - must be absolute last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </StorefrontErrorBoundary>
          {/* Outside the boundary: if a page throws, the way out of it should
              still be there. */}
          <MobileBottomNav />
        </BrowserRouter>
      </DefaultProviders>
    </HelmetProvider>
  );
}
