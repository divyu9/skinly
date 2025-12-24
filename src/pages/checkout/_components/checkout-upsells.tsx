import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlusIcon, SparklesIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export function CheckoutUpsells() {
  const { user, isLoading: authLoading } = useAuth();
  const { addToGuestCart, guestCart } = useGuestCart();
  const [addingProduct, setAddingProduct] = useState<string | null>(null);

  // Query cart data directly for reactivity
  const dbCartItems = useQuery(api.cart.getCart, user ? {} : "skip");
  
  // Determine which cart to use
  const cartItems = user ? dbCartItems : guestCart;

  // Map cart items to the format expected by the backend
  const mappedCartItems = cartItems ? cartItems.map(item => ({
    productId: item.productId,
    variant: item.variant,
    price: item.price,
    quantity: item.quantity,
    phoneModel: item.phoneModel,
    phoneBrand: item.phoneBrand,
    coverage: item.coverage,
  })) : [];

  const upsells = useQuery(
    api.checkoutUpsells.getUpsellsForCart,
    mappedCartItems.length > 0 ? { cartItems: mappedCartItems } : "skip"
  );

  const addToCart = useMutation(api.cart.addToCart);

  const handleAddUpsell = async (upsell: NonNullable<typeof upsells>[0]) => {
    if (!upsell) return;
    
    setAddingProduct(upsell.variantId);
    
    try {
      const cartItem = {
        productId: upsell.productId,
        productTitle: upsell.productTitle,
        productImage: upsell.productImage,
        variant: upsell.variantTitle,
        price: upsell.discountedPrice || upsell.originalPrice,
        quantity: 1,
      };

      if (user) {
        await addToCart(cartItem);
      } else {
        addToGuestCart(cartItem);
      }

      toast.success("Added to cart!");
    } catch (error) {
      // Try guest cart if auth fails
      if (user === null || user === undefined) {
        addToGuestCart({
          productId: upsell.productId,
          productTitle: upsell.productTitle,
          productImage: upsell.productImage,
          variant: upsell.variantTitle,
          price: upsell.discountedPrice || upsell.originalPrice,
          quantity: 1,
        });
        toast.success("Added to cart!");
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setAddingProduct(null);
    }
  };

  // Show loading state while auth or cart is loading
  if (authLoading || (user && dbCartItems === undefined)) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading while upsells are being fetched
  if (upsells === undefined && cartItems && cartItems.length > 0) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!upsells || upsells.length === 0) {
    return null;
  }

  // Calculate total savings across all upsells
  const totalSavings = upsells.reduce((sum, upsell) => {
    if (upsell.discountedPrice) {
      return sum + (upsell.originalPrice - upsell.discountedPrice);
    }
    return sum;
  }, 0);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-primary" />
          <CardTitle>Complete Your Order</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Surprise Deal : Only for this Order - Save ₹{totalSavings.toFixed(0)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {upsells.map((upsell) => {
            const savings = upsell.discountedPrice
              ? upsell.originalPrice - upsell.discountedPrice
              : 0;
            const savingsPercent = upsell.discountedPrice
              ? Math.round((savings / upsell.originalPrice) * 100)
              : 0;

            return (
              <div
                key={upsell.variantId}
                className="relative flex flex-col border rounded-lg overflow-hidden hover:border-primary/40 transition-all bg-card"
              >
                {/* Savings Badge */}
                {savings > 0 && (
                  <Badge className="absolute top-2 right-2 z-10 bg-green-600 text-white">
                    Save {savingsPercent}%
                  </Badge>
                )}

                {/* Product Image */}
                {upsell.productImage && (
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img
                      src={upsell.productImage}
                      alt={upsell.productTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Details */}
                <div className="p-3 flex-1 flex flex-col">
                  <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                    {upsell.productTitle}
                  </h4>
                  {upsell.variantTitle !== "Default Title" && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {upsell.variantTitle}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="mb-3 mt-auto">
                    {upsell.discountedPrice ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-600">
                          ₹{upsell.discountedPrice.toFixed(0)}
                        </span>
                        <span className="text-sm text-muted-foreground line-through">
                          ₹{upsell.originalPrice.toFixed(0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        ₹{upsell.originalPrice.toFixed(0)}
                      </span>
                    )}
                    {savings > 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        Save ₹{savings.toFixed(0)}
                      </p>
                    )}
                  </div>

                  {/* Add Button */}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddUpsell(upsell)}
                    disabled={addingProduct === upsell.variantId}
                  >
                    <PlusIcon className="size-4 mr-2" />
                    {addingProduct === upsell.variantId ? "Adding..." : "Add to Cart"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
