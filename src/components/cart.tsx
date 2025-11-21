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
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export function CartButton() {
  const cartCount = useQuery(api.cart.getCartCount);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="relative">
          <ShoppingCartIcon className="size-4 mr-2" />
          Cart
          {cartCount !== undefined && cartCount > 0 && (
            <Badge className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0">
              {cartCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {cartCount !== undefined && cartCount > 0
              ? `${cartCount} ${cartCount === 1 ? "item" : "items"} in your cart`
              : "Your cart is empty"}
          </SheetDescription>
        </SheetHeader>
        <CartContent />
      </SheetContent>
    </Sheet>
  );
}

function CartContent() {
  const cartItems = useQuery(api.cart.getCart);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const clearCart = useMutation(api.cart.clearCart);

  if (cartItems === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading cart...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
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

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleUpdateQuantity = async (cartId: Id<"cart">, newQuantity: number) => {
    try {
      await updateQuantity({ cartId, quantity: newQuantity });
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const handleRemove = async (cartId: Id<"cart">) => {
    try {
      await removeFromCart({ cartId });
      toast.success("Item removed from cart");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart({});
      toast.success("Cart cleared");
    } catch (error) {
      toast.error("Failed to clear cart");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4">
        {cartItems.map((item) => (
          <Card key={item._id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                {/* Product Image */}
                {item.productImage && (
                  <div className="size-20 bg-muted rounded-lg overflow-hidden shrink-0">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                    {item.productTitle}
                  </h4>
                  {item.phoneModel && (
                    <p className="text-xs text-muted-foreground mb-1">
                      For: {item.phoneModel}
                    </p>
                  )}
                  {item.variant !== "Default Title" && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Variant: {item.variant}
                    </p>
                  )}
                  <p className="text-sm font-bold text-primary">
                    ₹{item.price.toFixed(0)}
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center border rounded-lg">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0"
                        onClick={() => handleUpdateQuantity(item._id, Math.max(1, item.quantity - 1))}
                      >
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="px-3 text-sm font-medium">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0"
                        onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(item._id)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Cart Summary */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Subtotal</span>
          <span className="text-2xl font-bold text-primary">₹{subtotal.toFixed(0)}</span>
        </div>

        <Link to="/checkout" className="block">
          <Button className="w-full" size="lg">
            Proceed to Checkout
          </Button>
        </Link>

        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={handleClearCart}
        >
          Clear Cart
        </Button>
      </div>
    </div>
  );
}
