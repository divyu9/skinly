import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet.tsx";
import { ShoppingCartIcon, MinusIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { useEffect, useState } from "react";

export function CartButton() {
  const { user, isLoading: authLoading } = useAuth();
  const cartCount = useQuery(api.cart.getCartCount, user ? {} : "skip");
  const { getGuestCartCount, guestCart } = useGuestCart();
  const [displayCount, setDisplayCount] = useState(0);
  const [isOpen, setIsOpen] = useState(true);

  // Update display count whenever cart data changes
  useEffect(() => {
    if (user && cartCount !== undefined) {
      setDisplayCount(cartCount);
    } else if (!user && !authLoading) {
      setDisplayCount(getGuestCartCount());
    }
  }, [user, cartCount, guestCart, authLoading, getGuestCartCount]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="relative overflow-visible">
          <ShoppingCartIcon className="size-4 mr-2" />
          Cart
          {displayCount > 0 && (
            <Badge className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0 text-xs font-bold z-50 pointer-events-none">
              {displayCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {displayCount > 0
              ? `${displayCount} ${displayCount === 1 ? "item" : "items"} in your cart`
              : "Your cart is empty"}
          </SheetDescription>
        </SheetHeader>
        <CartContent onCheckoutClick={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function CartContent({ onCheckoutClick }: { onCheckoutClick: () => void }) {
  const { user, isLoading: authLoading } = useAuth();
  const cartItems = useQuery(api.cart.getCart, user ? {} : "skip");
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const clearCart = useMutation(api.cart.clearCart);
  const syncGuestCart = useMutation(api.cart.syncGuestCart);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const {
    guestCart,
    updateGuestCartQuantity,
    removeFromGuestCart,
    clearGuestCart,
  } = useGuestCart();

  // Sync guest cart when user signs in
  useEffect(() => {
    if (user && guestCart.length > 0 && !isSyncing) {
      setIsSyncing(true);
      syncGuestCart({ guestCartItems: guestCart })
        .then(() => {
          clearGuestCart();
          toast.success("Cart synced!");
        })
        .catch((error) => {
          console.error("Cart sync error:", error);
          toast.error("Failed to sync cart");
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [user, guestCart.length, syncGuestCart, clearGuestCart, isSyncing]);

  // Determine loading state
  const isLoading = authLoading || (user && cartItems === undefined) || isSyncing;
  
  // Use guest cart if not authenticated, otherwise use database cart
  const displayItems = user ? (cartItems || []) : guestCart;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading cart...</p>
        </div>
      </div>
    );
  }

  if (!displayItems || displayItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
        </Empty>
      </div>
    );
  }

  const subtotal = displayItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = async (productId: string, variant: string, cartId: Id<"cart"> | undefined, newQuantity: number) => {
    try {
      if (user && cartId) {
        await updateQuantity({ cartId, quantity: newQuantity });
      } else {
        updateGuestCartQuantity(productId, variant, newQuantity);
      }
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const handleRemove = async (productId: string, variant: string, cartId: Id<"cart"> | undefined) => {
    try {
      if (user && cartId) {
        await removeFromCart({ cartId });
      } else {
        removeFromGuestCart(productId, variant);
      }
      toast.success("Item removed from cart");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleClearCart = async () => {
    try {
      if (user) {
        await clearCart({});
      } else {
        clearGuestCart();
      }
      toast.success("Cart cleared");
    } catch (error) {
      toast.error("Failed to clear cart");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {displayItems.map((item, idx) => {
          const itemId = "_id" in item ? (item._id as Id<"cart">) : undefined;
          const key = itemId || `${item.productId}-${item.variant}-${idx}`;
          
          return (
            <div key={key}>
              <div className="flex gap-3 py-3 px-1">
                {/* Product Image */}
                {item.productImage && (
                  <div className="size-16 bg-muted rounded overflow-hidden shrink-0">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="font-medium text-sm line-clamp-1 mb-0.5">
                      {item.productTitle}
                    </h4>
                    {item.phoneModel && (
                      <p className="text-xs text-muted-foreground">
                        {item.phoneModel}
                      </p>
                    )}
                    {item.coverage && (
                      <p className="text-xs text-muted-foreground">
                        {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                      </p>
                    )}
                    {item.variant !== "Default Title" && (
                      <p className="text-xs text-muted-foreground">
                        {item.variant}
                      </p>
                    )}
                  </div>
                  
                  {/* Price and Controls */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">
                      â¹{item.price.toFixed(0)}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center border rounded">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleUpdateQuantity(
                            item.productId,
                            item.variant,
                            itemId,
                            Math.max(1, item.quantity - 1)
                          )}
                        >
                          <MinusIcon className="size-3" />
                        </Button>
                        <span className="px-2 text-xs font-medium min-w-[2ch] text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => handleUpdateQuantity(
                            item.productId,
                            item.variant,
                            itemId,
                            item.quantity + 1
                          )}
                        >
                          <PlusIcon className="size-3" />
                        </Button>
                      </div>
                      
                      {/* Remove Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(
                          item.productId,
                          item.variant,
                          itemId
                        )}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Separator between items */}
              {idx < displayItems.length - 1 && <Separator />}
            </div>
          );
        })}
      </div>

      <Separator className="my-2" />

      {/* Cart Summary */}
      <div className="space-y-2 pb-1">
        <div className="flex justify-between items-center px-1">
          <span className="font-medium text-sm">Subtotal</span>
          <span className="text-lg font-bold text-primary">â¹{subtotal.toFixed(0)}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link to="/checkout" className="w-full max-w-[85%]" onClick={onCheckoutClick}>
            <Button className="w-full" size="default">
              Proceed to Checkout
            </Button>
          </Link>

          <Button
            variant="outline"
            className="w-full max-w-[85%]"
            size="sm"
            onClick={handleClearCart}
          >
            Clear Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
