import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { SidebarProvider } from "./components/admin-sidebar-context.tsx";
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
          <Route path="/admin/*" element={
            <SidebarProvider>
              <Routes>
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="products/new" element={<NewProductPage />} />
                <Route path="products/:productId" element={<EditProductPage />} />
                <Route path="collections" element={<AdminCollectionsPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
                <Route path="coupons" element={<AdminCouponsPage />} />
                <Route path="reviews" element={<AdminReviewsPage />} />
                <Route path="abandoned-carts" element={<AdminAbandonedCartsPage />} />
                <Route path="stock-notifications" element={<AdminStockNotificationsPage />} />
                <Route path="oos" element={<AdminOOSPage />} />
                <Route path="cod" element={<AdminCODPage />} />
                <Route path="whatsapp" element={<AdminWhatsAppPage />} />
                <Route path="whatsapp/messages" element={<AdminWhatsAppMessagesPage />} />
                <Route path="wallet" element={<AdminWalletPage />} />
                <Route path="mockups" element={<AdminMockupsPage />} />
                <Route path="mockups/missing" element={<AdminMockupsMissingPage />} />
                <Route path="google-drive-import" element={<AdminGoogleDriveImportPage />} />
                <Route path="models" element={<AdminModelsPage />} />
                <Route path="seed-models" element={<AdminSeedModelsPage />} />
                <Route path="phone-collections" element={<AdminPhoneCollectionsPage />} />
                <Route path="product-fields-migration" element={<AdminProductFieldsMigrationPage />} />
                <Route path="gst-migration" element={<GstMigrationPage />} />
                <Route path="tax-export" element={<TaxExportPage />} />
                <Route path="fix-collections" element={<FixCollectionsPage />} />
              </Routes>
            </SidebarProvider>
          } />
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
