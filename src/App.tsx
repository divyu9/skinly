import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AdminPageWrapper } from "./components/admin-page-wrapper.tsx";
import { Skeleton } from "./components/ui/skeleton.tsx";
import { FacebookPixelInitializer } from "./components/facebook-pixel-initializer.tsx";

// Critical pages - loaded immediately
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import ProductsPage from "./pages/products/page.tsx";
import ProductDetailPage from "./pages/products/detail/page.tsx";
import CheckoutPage from "./pages/checkout/page.tsx";
import CartPage from "./pages/cart/page.tsx";
import OrdersPage from "./pages/orders/page.tsx";
import OrderDetailPage from "./pages/orders/detail/page.tsx";
import DevicesPage from "./pages/devices/page.tsx";
import PaymentCallback from "./pages/payment/callback.tsx";
import AccountPage from "./pages/account/page.tsx";
import WalletPage from "./pages/account/wallet/page.tsx";
import NotFound from "./pages/NotFound.tsx";

// Policy pages - lazy loaded
const ReturnsPolicy = lazy(() => import("./pages/policies/returns.tsx"));
const ShippingPolicy = lazy(() => import("./pages/policies/shipping.tsx"));
const TermsOfService = lazy(() => import("./pages/policies/terms.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/policies/privacy.tsx"));
const SEOPage = lazy(() => import("./pages/seo/page.tsx"));

// Admin pages - lazy loaded to reduce initial bundle
const AdminProductsPage = lazy(() => import("./pages/admin/products/page.tsx"));
const AdminCollectionsPage = lazy(() => import("./pages/admin/collections/page.tsx"));
const NewProductPage = lazy(() => import("./pages/admin/products/new/page.tsx"));
const EditProductPage = lazy(() => import("./pages/admin/products/edit/page.tsx"));
const AdminOrdersPage = lazy(() => import("./pages/admin/orders/page.tsx"));
const AdminOrderDetailPage = lazy(() => import("./pages/admin/orders/detail.tsx"));
const AdminCouponsPage = lazy(() => import("./pages/admin/coupons/page.tsx"));
const AdminReviewsPage = lazy(() => import("./pages/admin/reviews.tsx"));
const AdminAbandonedCartsPage = lazy(() => import("./pages/admin/abandoned-carts/page.tsx"));
const AdminStockNotificationsPage = lazy(() => import("./pages/admin/stock-notifications/page.tsx"));
const AdminOOSPage = lazy(() => import("./pages/admin/oos/page.tsx"));
const AdminMockupsPage = lazy(() => import("./pages/admin/mockups.tsx"));
const AdminMockupsMissingPage = lazy(() => import("./pages/admin/mockups-missing.tsx"));
const AdminMockupsAdvancedPage = lazy(() => import("./pages/admin/mockups-advanced.tsx"));
const AdminGoogleDriveImportPage = lazy(() => import("./pages/admin/google-drive-import.tsx"));
const AdminModelsPage = lazy(() => import("./pages/admin/models/page.tsx"));
const AdminSeedModelsPage = lazy(() => import("./pages/admin/seed-models/page.tsx"));
const AdminPhoneCollectionsPage = lazy(() => import("./pages/admin/phone-collections.tsx"));
const AdminProductFieldsMigrationPage = lazy(() => import("./pages/admin/product-fields-migration.tsx"));
const AdminVariantModeMigrationPage = lazy(() => import("./pages/admin/variant-mode-migration.tsx"));
const AdminCODPage = lazy(() => import("./pages/admin/cod.tsx"));
const AdminWhatsAppPage = lazy(() => import("./pages/admin/whatsapp/page.tsx"));
const AdminWhatsAppMessagesPage = lazy(() => import("./pages/admin/whatsapp/messages.tsx"));
const AdminWhatsAppHealthPage = lazy(() => import("./pages/admin/whatsapp-health.tsx"));
const AdminWhatsAppDebugLogsPage = lazy(() => import("./pages/admin/whatsapp-debug-logs.tsx"));
const AdminWalletPage = lazy(() => import("./pages/admin/wallet/page.tsx"));
const AdminCashbackPage = lazy(() => import("./pages/admin/cashback/page.tsx"));
const AdminEmailsPage = lazy(() => import("./pages/admin/emails/page.tsx"));
const AdminBugsPage = lazy(() => import("./pages/admin/bugs/page.tsx"));
const AdminUpsellsPage = lazy(() => import("./pages/admin/upsells/page.tsx"));
const AdminSEOTemplatesPage = lazy(() => import("./pages/admin/seo-templates/page.tsx"));
const AdminSEOPagesPage = lazy(() => import("./pages/admin/seo-pages/page.tsx"));
const AdminSEOPagesNewPage = lazy(() => import("./pages/admin/seo-pages/new.tsx"));
const AdminSEOPagesEditPage = lazy(() => import("./pages/admin/seo-pages/edit.tsx"));
const AdminSEOPagesAutoGeneratePage = lazy(() => import("./pages/admin/seo-pages/auto-generate.tsx"));
const AdminSettingsPage = lazy(() => import("./pages/admin/settings/page.tsx"));
const AdminMigrationPage = lazy(() => import("./pages/admin/migration.tsx"));
const AdminSitemapGeneratorPage = lazy(() => import("./pages/admin/sitemap-generator.tsx"));
const AdminSEOGeneratorPage = lazy(() => import("./pages/admin/seo-generator/page.tsx"));
const AdminShippingPage = lazy(() => import("./pages/admin/shipping.tsx"));
const AdminProductClassificationPage = lazy(() => import("./pages/admin/product-classification/page.tsx"));
const AdminHomepagePage = lazy(() => import("./pages/admin/homepage/page.tsx"));
const AdminUnauthorizedPage = lazy(() => import("./pages/admin/unauthorized.tsx"));
const GstMigrationPage = lazy(() => import("./pages/admin/gst-migration.tsx"));
const TaxExportPage = lazy(() => import("./pages/admin/tax-export.tsx"));
const FixCollectionsPage = lazy(() => import("./pages/admin/fix-collections.tsx"));

// Loading fallback for lazy-loaded routes
function PageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <DefaultProviders>
        <FacebookPixelInitializer />
        <BrowserRouter>
          <Routes>
          {/* Critical paths - eagerly loaded */}
          <Route path="/" element={<Index />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/wallet" element={<WalletPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/detail" element={<ProductDetailPage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Admin routes - lazy loaded */}
          <Route path="/backend-skinly/products" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/products/new" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><NewProductPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/products/:productId" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><EditProductPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/collections" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCollectionsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/orders" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminOrdersPage /></AdminPageWrapper></Suspense>} />
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
          <Route path="/backend-skinly/cashback" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminCashbackPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/emails" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminEmailsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/bugs" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminBugsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/upsells" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminUpsellsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-templates" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOTemplatesPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-pages" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-pages/new" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesNewPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-pages/:pageId" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesEditPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-pages/auto-generate" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOPagesAutoGeneratePage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/settings" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSettingsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/mockups" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMockupsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/mockups/missing" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMockupsMissingPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/mockups-advanced" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMockupsAdvancedPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/google-drive-import" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminGoogleDriveImportPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/models" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminModelsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seed-models" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSeedModelsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/phone-collections" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminPhoneCollectionsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/product-fields-migration" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductFieldsMigrationPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/variant-mode-migration" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminVariantModeMigrationPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/gst-migration" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><GstMigrationPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/tax-export" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><TaxExportPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/fix-collections" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><FixCollectionsPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/migration" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminMigrationPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/sitemap" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSitemapGeneratorPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/seo-generator" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminSEOGeneratorPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/product-classification" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminProductClassificationPage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/homepage" element={<Suspense fallback={<PageSkeleton />}><AdminPageWrapper><AdminHomepagePage /></AdminPageWrapper></Suspense>} />
          <Route path="/backend-skinly/unauthorized" element={<Suspense fallback={<PageSkeleton />}><AdminUnauthorizedPage /></Suspense>} />

          {/* Policy pages - lazy loaded */}
          <Route path="/policies/returns" element={<Suspense fallback={<PageSkeleton />}><ReturnsPolicy /></Suspense>} />
          <Route path="/policies/shipping" element={<Suspense fallback={<PageSkeleton />}><ShippingPolicy /></Suspense>} />
          <Route path="/policies/terms" element={<Suspense fallback={<PageSkeleton />}><TermsOfService /></Suspense>} />
          <Route path="/policies/privacy" element={<Suspense fallback={<PageSkeleton />}><PrivacyPolicy /></Suspense>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          {/* SEO landing pages (catch-all for root-level slugs) - must be second to last */}
          <Route path="/:slug" element={<Suspense fallback={<PageSkeleton />}><SEOPage /></Suspense>} />
          {/* 404 - must be absolute last */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DefaultProviders>
    </HelmetProvider>
  );
}
