import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import AdminWalletPage from "./pages/admin/wallet/page.tsx";
import DevicesPage from "./pages/devices/page.tsx";
import GstMigrationPage from "./pages/admin/gst-migration.tsx";
import TaxExportPage from "./pages/admin/tax-export.tsx";
import FixCollectionsPage from "./pages/admin/fix-collections.tsx";
import PaymentCallback from "./pages/payment/callback.tsx";
import AccountPage from "./pages/account/page.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/confirm" element={<ProductConfirmPage />} />
          <Route path="/products/detail" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/admin/products" element={<AdminPageWrapper><AdminProductsPage /></AdminPageWrapper>} />
          <Route path="/admin/products/new" element={<AdminPageWrapper><NewProductPage /></AdminPageWrapper>} />
          <Route path="/admin/products/:productId" element={<AdminPageWrapper><EditProductPage /></AdminPageWrapper>} />
          <Route path="/admin/collections" element={<AdminPageWrapper><AdminCollectionsPage /></AdminPageWrapper>} />
          <Route path="/admin/orders" element={<AdminPageWrapper><AdminOrdersPage /></AdminPageWrapper>} />
          <Route path="/admin/orders/:orderId" element={<AdminPageWrapper><AdminOrderDetailPage /></AdminPageWrapper>} />
          <Route path="/admin/coupons" element={<AdminPageWrapper><AdminCouponsPage /></AdminPageWrapper>} />
          <Route path="/admin/reviews" element={<AdminPageWrapper><AdminReviewsPage /></AdminPageWrapper>} />
          <Route path="/admin/abandoned-carts" element={<AdminPageWrapper><AdminAbandonedCartsPage /></AdminPageWrapper>} />
          <Route path="/admin/stock-notifications" element={<AdminPageWrapper><AdminStockNotificationsPage /></AdminPageWrapper>} />
          <Route path="/admin/oos" element={<AdminPageWrapper><AdminOOSPage /></AdminPageWrapper>} />
          <Route path="/admin/cod" element={<AdminPageWrapper><AdminCODPage /></AdminPageWrapper>} />
          <Route path="/admin/whatsapp" element={<AdminPageWrapper><AdminWhatsAppPage /></AdminPageWrapper>} />
          <Route path="/admin/whatsapp/messages" element={<AdminPageWrapper><AdminWhatsAppMessagesPage /></AdminPageWrapper>} />
          <Route path="/admin/wallet" element={<AdminPageWrapper><AdminWalletPage /></AdminPageWrapper>} />
          <Route path="/admin/mockups" element={<AdminPageWrapper><AdminMockupsPage /></AdminPageWrapper>} />
          <Route path="/admin/mockups/missing" element={<AdminPageWrapper><AdminMockupsMissingPage /></AdminPageWrapper>} />
          <Route path="/admin/google-drive-import" element={<AdminPageWrapper><AdminGoogleDriveImportPage /></AdminPageWrapper>} />
          <Route path="/admin/models" element={<AdminPageWrapper><AdminModelsPage /></AdminPageWrapper>} />
          <Route path="/admin/seed-models" element={<AdminPageWrapper><AdminSeedModelsPage /></AdminPageWrapper>} />
          <Route path="/admin/phone-collections" element={<AdminPageWrapper><AdminPhoneCollectionsPage /></AdminPageWrapper>} />
          <Route path="/admin/product-fields-migration" element={<AdminPageWrapper><AdminProductFieldsMigrationPage /></AdminPageWrapper>} />
          <Route path="/admin/gst-migration" element={<AdminPageWrapper><GstMigrationPage /></AdminPageWrapper>} />
          <Route path="/admin/tax-export" element={<AdminPageWrapper><TaxExportPage /></AdminPageWrapper>} />
          <Route path="/admin/fix-collections" element={<AdminPageWrapper><FixCollectionsPage /></AdminPageWrapper>} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
