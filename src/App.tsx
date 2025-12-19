import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DefaultProviders } from "./components/providers/default.tsx";
import { AdminPageWrapper } from "./components/admin-page-wrapper.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import ProductsPage from "./pages/products/page.tsx";
import ProductConfirmPage from "./pages/products/confirm.tsx";
import ProductDetailPage from "./pages/products/detail/page.tsx";
import CheckoutPage from "./pages/checkout/page.tsx";
import CartPage from "./pages/cart/page.tsx";
import OrdersPage from "./pages/orders/page.tsx";
import OrderDetailPage from "./pages/orders/detail/page.tsx";
import AdminProductsPage from "./pages/admin/products/page.tsx";
import AdminCollectionsPage from "./pages/admin/collections/page.tsx";
import NewProductPage from "./pages/admin/products/new/page.tsx";
import EditProductPage from "./pages/admin/products/edit/page.tsx";
import AdminOrdersPage from "./pages/admin/orders/page.tsx";
import AdminOrderDetailPage from "./pages/admin/orders/detail.tsx";
import AdminCouponsPage from "./pages/admin/coupons/page.tsx";
import AdminReviewsPage from "./pages/admin/reviews.tsx";
import AdminAbandonedCartsPage from "./pages/admin/abandoned-carts/page.tsx";
import AdminStockNotificationsPage from "./pages/admin/stock-notifications/page.tsx";
import AdminOOSPage from "./pages/admin/oos/page.tsx";
import AdminMockupsPage from "./pages/admin/mockups.tsx";
import AdminMockupsMissingPage from "./pages/admin/mockups-missing.tsx";
import AdminGoogleDriveImportPage from "./pages/admin/google-drive-import.tsx";
import AdminModelsPage from "./pages/admin/models/page.tsx";
import AdminSeedModelsPage from "./pages/admin/seed-models/page.tsx";
import AdminPhoneCollectionsPage from "./pages/admin/phone-collections.tsx";
import AdminProductFieldsMigrationPage from "./pages/admin/product-fields-migration.tsx";
import AdminCODPage from "./pages/admin/cod.tsx";
import AdminWhatsAppPage from "./pages/admin/whatsapp/page.tsx";
import AdminWhatsAppMessagesPage from "./pages/admin/whatsapp/messages.tsx";
import AdminWhatsAppHealthPage from "./pages/admin/whatsapp-health.tsx";
import AdminWhatsAppDebugLogsPage from "./pages/admin/whatsapp-debug-logs.tsx";
import AdminWalletPage from "./pages/admin/wallet/page.tsx";
import AdminCashbackPage from "./pages/admin/cashback/page.tsx";
import AdminEmailsPage from "./pages/admin/emails/page.tsx";
import AdminBugsPage from "./pages/admin/bugs/page.tsx";
import AdminUpsellsPage from "./pages/admin/upsells/page.tsx";
import AdminSEOTemplatesPage from "./pages/admin/seo-templates/page.tsx";
import AdminSEOPagesPage from "./pages/admin/seo-pages/page.tsx";
import AdminSEOPagesNewPage from "./pages/admin/seo-pages/new.tsx";
import AdminSEOPagesEditPage from "./pages/admin/seo-pages/edit.tsx";
import AdminSEOPagesAutoGeneratePage from "./pages/admin/seo-pages/auto-generate.tsx";
import AdminSettingsPage from "./pages/admin/settings/page.tsx";
import AdminMigrationPage from "./pages/admin/migration.tsx";
import AdminSitemapGeneratorPage from "./pages/admin/sitemap-generator.tsx";
import AdminSEOGeneratorPage from "./pages/admin/seo-generator/page.tsx";
import AdminShippingPage from "./pages/admin/shipping.tsx";
import AdminProductClassificationPage from "./pages/admin/product-classification/page.tsx";
import DevicesPage from "./pages/devices/page.tsx";
import GstMigrationPage from "./pages/admin/gst-migration.tsx";
import TaxExportPage from "./pages/admin/tax-export.tsx";
import FixCollectionsPage from "./pages/admin/fix-collections.tsx";
import PaymentCallback from "./pages/payment/callback.tsx";
import AccountPage from "./pages/account/page.tsx";
import WalletPage from "./pages/account/wallet/page.tsx";
import ReturnsPolicy from "./pages/policies/returns.tsx";
import ShippingPolicy from "./pages/policies/shipping.tsx";
import TermsOfService from "./pages/policies/terms.tsx";
import PrivacyPolicy from "./pages/policies/privacy.tsx";
import SEOPage from "./pages/seo/page.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <HelmetProvider>
      <DefaultProviders>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/wallet" element={<WalletPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/confirm" element={<ProductConfirmPage />} />
          <Route path="/products/detail" element={<ProductDetailPage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/backend-skinly/products" element={<AdminPageWrapper><AdminProductsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/products/new" element={<AdminPageWrapper><NewProductPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/products/:productId" element={<AdminPageWrapper><EditProductPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/collections" element={<AdminPageWrapper><AdminCollectionsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/orders" element={<AdminPageWrapper><AdminOrdersPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/orders/:orderId" element={<AdminPageWrapper><AdminOrderDetailPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/coupons" element={<AdminPageWrapper><AdminCouponsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/reviews" element={<AdminPageWrapper><AdminReviewsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/abandoned-carts" element={<AdminPageWrapper><AdminAbandonedCartsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/stock-notifications" element={<AdminPageWrapper><AdminStockNotificationsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/oos" element={<AdminPageWrapper><AdminOOSPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/cod" element={<AdminPageWrapper><AdminCODPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/shipping" element={<AdminPageWrapper><AdminShippingPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/whatsapp" element={<AdminPageWrapper><AdminWhatsAppPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/whatsapp/messages" element={<AdminPageWrapper><AdminWhatsAppMessagesPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/whatsapp/health" element={<AdminPageWrapper><AdminWhatsAppHealthPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/whatsapp/debug-logs" element={<AdminPageWrapper><AdminWhatsAppDebugLogsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/wallet" element={<AdminPageWrapper><AdminWalletPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/cashback" element={<AdminPageWrapper><AdminCashbackPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/emails" element={<AdminPageWrapper><AdminEmailsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/bugs" element={<AdminPageWrapper><AdminBugsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/upsells" element={<AdminPageWrapper><AdminUpsellsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-templates" element={<AdminPageWrapper><AdminSEOTemplatesPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-pages" element={<AdminPageWrapper><AdminSEOPagesPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-pages/new" element={<AdminPageWrapper><AdminSEOPagesNewPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-pages/:pageId" element={<AdminPageWrapper><AdminSEOPagesEditPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-pages/auto-generate" element={<AdminPageWrapper><AdminSEOPagesAutoGeneratePage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/settings" element={<AdminPageWrapper><AdminSettingsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/mockups" element={<AdminPageWrapper><AdminMockupsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/mockups/missing" element={<AdminPageWrapper><AdminMockupsMissingPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/google-drive-import" element={<AdminPageWrapper><AdminGoogleDriveImportPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/models" element={<AdminPageWrapper><AdminModelsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seed-models" element={<AdminPageWrapper><AdminSeedModelsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/phone-collections" element={<AdminPageWrapper><AdminPhoneCollectionsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/product-fields-migration" element={<AdminPageWrapper><AdminProductFieldsMigrationPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/gst-migration" element={<AdminPageWrapper><GstMigrationPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/tax-export" element={<AdminPageWrapper><TaxExportPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/fix-collections" element={<AdminPageWrapper><FixCollectionsPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/migration" element={<AdminPageWrapper><AdminMigrationPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/sitemap" element={<AdminPageWrapper><AdminSitemapGeneratorPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/seo-generator" element={<AdminPageWrapper><AdminSEOGeneratorPage /></AdminPageWrapper>} />
          <Route path="/backend-skinly/product-classification" element={<AdminPageWrapper><AdminProductClassificationPage /></AdminPageWrapper>} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/policies/returns" element={<ReturnsPolicy />} />
          <Route path="/policies/shipping" element={<ShippingPolicy />} />
          <Route path="/policies/terms" element={<TermsOfService />} />
          <Route path="/policies/privacy" element={<PrivacyPolicy />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          {/* SEO landing pages (catch-all for root-level slugs) - must be second to last */}
          <Route path="/:slug" element={<SEOPage />} />
          {/* 404 - must be absolute last */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DefaultProviders>
    </HelmetProvider>
  );
}
