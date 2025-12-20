import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { MinusIcon, PlusIcon, TrashIcon, ShoppingCartIcon, ArrowLeftIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CartButton } from "@/components/cart.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";

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
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Header */}
      <header className="sticky top-[36px] z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeftIcon className="size-4" />
              Back
            </Button>
            <h1 className="text-xl font-bold">Shopping Cart</h1>
          </div>
          <Link to="/" className="text-xl font-bold text-primary">
            SKINLY
          </Link>
        </div>
      </header>

      {/* Cart Content */}
      <div className="container mx-auto px-4 py-8">
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
      </div>
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
          {cartItems.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  {item.productImage && (
                    <div className="size-20 sm:size-24 bg-muted rounded-lg overflow-hidden shrink-0">
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base line-clamp-2 mb-2">
                      {item.productTitle}
                    </h3>
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
                    <p className="text-lg font-bold text-primary mb-4">
                      ₹{item.price.toFixed(0)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border rounded-lg">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 p-0"
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
          ))}

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
                  <span className="text-muted-foreground">Items ({cartItems.length})</span>
                  <span>₹{subtotal.toFixed(0)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold">Subtotal</span>
                <span className="text-2xl font-bold text-primary">₹{subtotal.toFixed(0)}</span>
              </div>

              <Button 
                className="w-full" 
                size="lg"
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
            
            return (
              <Card key={key}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    {item.productImage && (
                      <div className="size-20 sm:size-24 bg-muted rounded-lg overflow-hidden shrink-0">
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base line-clamp-2 mb-2">
                        {item.productTitle}
                      </h3>
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
                      <p className="text-lg font-bold text-primary mb-4">
                        ₹{item.price.toFixed(0)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border rounded-lg">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
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

              <Button 
                className="w-full" 
                size="lg"
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
