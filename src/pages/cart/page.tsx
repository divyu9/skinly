import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { MinusIcon, PlusIcon, TrashIcon, ShoppingCartIcon, ArrowLeftIcon, AlertCircleIcon } from "lucide-react";
import type { Id } from "@/lib/firebase-api";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutUpsells } from "../checkout/_components/checkout-upsells.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CartButton } from "@/components/cart.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";

import { SiteHeader } from "@/components/site-header.tsx";

export default function CartPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [showContent, setShowContent] = useState(false);

  // Delay showing content slightly to ensure auth is determined
  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container max-w-4xl mx-auto px-4 py-8">
        {(authLoading || !showContent) ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : user ? (
          <AuthenticatedCartContent />
        ) : (
          <GuestCartContent />
        )}
      </main>
    </div>
  );
}

function AuthenticatedCartContent() {
  const navigate = useNavigate();
  const cartItems = useQuery(api.cart.getCart);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const clearCart = useMutation(api.cart.clearCart);
  const syncGuestCart = useMutation(api.cart.syncGuestCart);
  const { guestCart, clearGuestCart } = useGuestCart();
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Check stock status for cart items (Must be called unconditionally at the very top)
  const cartItemsForStockCheck = (cartItems || []).map(item => ({
    productId: item.productId,
    variant: item.variant,
    quantity: item.quantity,
  }));

  const stockStatus = useQuery(
    api.cart.checkCartItemsStock,
    cartItemsForStockCheck.length > 0 ? { cartItems: cartItemsForStockCheck } : "skip"
  );

  // Create a map for quick stock lookup
  const stockStatusMap = new Map(
    stockStatus?.map(status => [`${status.productId}-${status.variant}`, status]) || []
  );

  // Check if there are any out-of-stock items
  const hasOutOfStockItems = stockStatus?.some(status => status.isOutOfStock) || false;

  // Sync guest cart when user signs in
  useEffect(() => {
    if (guestCart.length > 0 && !isSyncing) {
      setIsSyncing(true);
      syncGuestCart({ guestCartItems: guestCart })
        .then(() => {
          clearGuestCart();
          toast.success("Cart synced!");
        })
        .catch((error) => {
          console.error("Cart sync error:", error);
          toast.error("Failed to sync cart");
          setHasError(true);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [guestCart.length, syncGuestCart, clearGuestCart, isSyncing]);

  // Show loading state
  if (cartItems === undefined || isSyncing) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  // Handle errors gracefully
  if (hasError) {
    return (
      <div className="max-w-2xl mx-auto">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingCartIcon />
            </EmptyMedia>
            <EmptyTitle>Unable to load cart</EmptyTitle>
            <EmptyDescription>
              There was an error loading your cart. Please try refreshing the page.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  // Show empty state
  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingCartIcon />
            </EmptyMedia>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>
              Add some items to your cart to get started
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/products">
              <Button>Browse Products</Button>
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = async (cartId: Id<"cart">, newQuantity: number) => {
    try {
      await updateQuantity({ cartId, quantity: newQuantity });
    } catch (error) {
      console.error("Update quantity error:", error);
      toast.error("Failed to update quantity");
    }
  };

  const handleRemove = async (cartId: Id<"cart">) => {
    try {
      await removeFromCart({ cartId });
      toast.success("Item removed from cart");
    } catch (error) {
      console.error("Remove item error:", error);
      toast.error("Failed to remove item");
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart({});
      toast.success("Cart cleared");
    } catch (error) {
      console.error("Clear cart error:", error);
      toast.error("Failed to clear cart");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => {
            const stockInfo = stockStatusMap.get(`${item.productId}-${item.variant}`);
            const isOutOfStock = stockInfo?.isOutOfStock || false;
            
            return (
              <Card key={item._id} className={isOutOfStock ? 'opacity-50' : ''}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                  {item.productImage && (
                    <Link 
                      to={`/products/detail?id=${item.productId}`}
                      className="shrink-0"
                    >
                      <div className="size-20 sm:size-24 bg-muted rounded-lg overflow-hidden">
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className={`w-full h-full object-cover hover:scale-105 transition-transform ${isOutOfStock ? 'grayscale' : ''}`}
                          onError={(e) => {
                            e.currentTarget.src = "/logo.webp";
                          }}
                        />
                      </div>
                    </Link>
                  )}

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link 
                        to={`/products/detail?id=${item.productId}`}
                        className="hover:text-primary transition-colors flex-1"
                      >
                        <h3 className="font-semibold text-base line-clamp-2">
                          {item.productTitle}
                        </h3>
                      </Link>
                      {isOutOfStock && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          Out of Stock
                        </Badge>
                      )}
                    </div>
                    {item.phoneModel && (
                      <p className="text-sm text-muted-foreground mb-1">
                        For: {item.phoneModel}
                      </p>
                    )}
                    {item.coverage && (
                      <p className="text-sm text-muted-foreground mb-1">
                        Coverage: {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                      </p>
                    )}
                    {item.variant !== "Default Title" && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Variant: {item.variant}
                      </p>
                    )}
                    {isOutOfStock && (
                      <div className="flex items-center gap-1 mb-2 text-sm text-destructive">
                        <AlertCircleIcon className="size-4" />
                        <span>Remove this item to proceed with checkout</span>
                      </div>
                    )}
                    <p className="text-lg font-bold text-primary mb-4">
                      ₹{item.price.toFixed(0)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center border rounded-lg ${isOutOfStock ? 'opacity-50' : ''}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0"
                          disabled={isOutOfStock}
                          onClick={() => handleUpdateQuantity(item._id, Math.max(1, item.quantity - 1))}
                        >
                          <MinusIcon className="size-4" />
                        </Button>
                        <span className="px-4 text-sm font-medium min-w-[3ch] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0"
                          disabled={isOutOfStock}
                          onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 gap-2 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(item._id)}
                      >
                        <TrashIcon className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
             );
          })}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearCart}
          >
            Clear Cart
          </Button>

          {/* Upsells Section */}
          <div className="mt-8">
            <CheckoutUpsells />
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items ({cartItems.length})</span>
                  <span>₹{subtotal.toFixed(0)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold">Subtotal</span>
                <span className="text-2xl font-bold text-primary">₹{subtotal.toFixed(0)}</span>
              </div>

              {hasOutOfStockItems && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2 mb-2">
                  <AlertCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    Please remove out-of-stock items from your cart to proceed with checkout.
                  </p>
                </div>
              )}
              <Button 
                className="w-full" 
                size="lg"
                disabled={hasOutOfStockItems}
                onClick={() => navigate("/checkout")}
              >
                Proceed to Checkout
              </Button>

              <Link to="/products" className="block">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GuestCartContent() {
  const navigate = useNavigate();
  const {
    guestCart,
    updateGuestCartQuantity,
    removeFromGuestCart,
    clearGuestCart,
  } = useGuestCart();

  // Check stock status for guest cart items (Must be called unconditionally)
  const cartItemsForStockCheck = (guestCart || []).map(item => ({
    productId: item.productId,
    variant: item.variant,
    quantity: item.quantity,
  }));

  const stockStatus = useQuery(
    api.cart.checkCartItemsStock,
    cartItemsForStockCheck.length > 0 ? { cartItems: cartItemsForStockCheck } : "skip"
  );

  // Create a map for quick stock lookup
  const stockStatusMap = new Map(
    stockStatus?.map(status => [`${status.productId}-${status.variant}`, status]) || []
  );

  // Check if there are any out-of-stock items
  const hasOutOfStockItems = stockStatus?.some(status => status.isOutOfStock) || false;

  if (!guestCart || guestCart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingCartIcon />
            </EmptyMedia>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>
              Add some items to your cart to get started
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/products">
              <Button>Browse Products</Button>
            </Link>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const subtotal = guestCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = (productId: string, variant: string, newQuantity: number) => {
    try {
      updateGuestCartQuantity(productId, variant, newQuantity);
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const handleRemove = (productId: string, variant: string) => {
    try {
      removeFromGuestCart(productId, variant);
      toast.success("Item removed from cart");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleClearCart = () => {
    try {
      clearGuestCart();
      toast.success("Cart cleared");
    } catch (error) {
      toast.error("Failed to clear cart");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {guestCart.map((item, idx) => {
            const key = `${item.productId}-${item.variant}-${idx}`;
            const stockInfo = stockStatusMap.get(`${item.productId}-${item.variant}`);
            const isOutOfStock = stockInfo?.isOutOfStock || false;
            
            return (
              <Card key={key} className={isOutOfStock ? 'opacity-50' : ''}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    {item.productImage && (
                      <Link 
                        to={`/products/detail?id=${item.productId}`}
                        className="shrink-0"
                      >
                        <div className="size-20 sm:size-24 bg-muted rounded-lg overflow-hidden">
                          <img
                            src={item.productImage}
                            alt={item.productTitle}
                            className={`w-full h-full object-cover hover:scale-105 transition-transform ${isOutOfStock ? 'grayscale' : ''}`}
                            onError={(e) => {
                              e.currentTarget.src = "/logo.webp";
                            }}
                          />
                        </div>
                      </Link>
                    )}

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link 
                          to={`/products/detail?id=${item.productId}`}
                          className="hover:text-primary transition-colors flex-1"
                        >
                          <h3 className="font-semibold text-base line-clamp-2">
                            {item.productTitle}
                          </h3>
                        </Link>
                        {isOutOfStock && (
                          <Badge variant="destructive" className="text-xs shrink-0">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                      {item.phoneModel && (
                        <p className="text-sm text-muted-foreground mb-1">
                          For: {item.phoneModel}
                        </p>
                      )}
                      {item.coverage && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Coverage: {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                        </p>
                      )}
                      {item.variant !== "Default Title" && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Variant: {item.variant}
                        </p>
                      )}
                      {isOutOfStock && (
                        <div className="flex items-center gap-1 mb-2 text-sm text-destructive">
                          <AlertCircleIcon className="size-4" />
                          <span>Remove this item to proceed with checkout</span>
                        </div>
                      )}
                      <p className="text-lg font-bold text-primary mb-4">
                        ₹{item.price.toFixed(0)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center border rounded-lg ${isOutOfStock ? 'opacity-50' : ''}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            disabled={isOutOfStock}
                            onClick={() => handleUpdateQuantity(
                              item.productId,
                              item.variant,
                              Math.max(1, item.quantity - 1)
                            )}
                          >
                            <MinusIcon className="size-4" />
                          </Button>
                          <span className="px-4 text-sm font-medium min-w-[3ch] text-center">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            disabled={isOutOfStock}
                            onClick={() => handleUpdateQuantity(
                              item.productId,
                              item.variant,
                              item.quantity + 1
                            )}
                          >
                            <PlusIcon className="size-4" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 gap-2 text-destructive hover:text-destructive"
                          onClick={() => handleRemove(item.productId, item.variant)}
                        >
                          <TrashIcon className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearCart}
          >
            Clear Cart
          </Button>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items ({guestCart.length})</span>
                  <span>₹{subtotal.toFixed(0)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold">Subtotal</span>
                <span className="text-2xl font-bold text-primary">₹{subtotal.toFixed(0)}</span>
              </div>

              {hasOutOfStockItems && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                  <AlertCircleIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    Please remove out-of-stock items from your cart to proceed with checkout.
                  </p>
                </div>
              )}
              <Button 
                className="w-full" 
                size="lg"
                disabled={hasOutOfStockItems}
                onClick={() => navigate("/checkout")}
              >
                Proceed to Checkout
              </Button>

              <Link to="/products" className="block">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
