import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import ProductsPage from "./pages/products/page.tsx";
import ProductDetailPage from "./pages/products/detail/page.tsx";
import CheckoutPage from "./pages/checkout/page.tsx";
import OrdersPage from "./pages/orders/page.tsx";
import OrderDetailPage from "./pages/orders/detail/page.tsx";
import AdminProductsPage from "./pages/admin/products/page.tsx";
import AdminCollectionsPage from "./pages/admin/collections/page.tsx";
import NewProductPage from "./pages/admin/products/new/page.tsx";
import EditProductPage from "./pages/admin/products/edit/page.tsx";
import AdminOrdersPage from "./pages/admin/orders/page.tsx";
import AdminMockupsPage from "./pages/admin/mockups.tsx";
import GstMigrationPage from "./pages/admin/gst-migration.tsx";
import PaymentCallback from "./pages/payment/callback.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/detail" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/products/new" element={<NewProductPage />} />
          <Route path="/admin/products/:productId" element={<EditProductPage />} />
          <Route path="/admin/collections" element={<AdminCollectionsPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/mockups" element={<AdminMockupsPage />} />
          <Route path="/admin/gst-migration" element={<GstMigrationPage />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
