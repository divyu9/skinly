import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlusIcon, SparklesIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

export function CheckoutUpsells() {
  const { user, isLoading: authLoading } = useAuth();
  const { addToGuestCart, guestCart } = useGuestCart();
  const [addingProduct, setAddingProduct] = useState<string | null>(null);
  // Track selected variant for each multi-variant product (productId -> variantId)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

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
    
    // For multi-variant products, use the selected variant
    let variantToAdd = upsell;
    if (upsell.hasMultipleVariants && upsell.allVariants) {
      const selectedVariantId = selectedVariants[upsell.productId];
      if (selectedVariantId) {
        const selectedVariant = upsell.allVariants.find(v => v.variantId === selectedVariantId);
        if (selectedVariant) {
          variantToAdd = {
            ...upsell,
            variantId: selectedVariant.variantId,
            variantTitle: selectedVariant.variantTitle,
            originalPrice: selectedVariant.price,
            discountedPrice: selectedVariant.discountedPrice,
          };
        }
      }
    }
    
    setAddingProduct(variantToAdd.variantId);
    
    try {
      const cartItem = {
        productId: variantToAdd.productId,
        productTitle: variantToAdd.productTitle,
        productImage: variantToAdd.productImage,
        variant: variantToAdd.variantTitle,
        price: variantToAdd.discountedPrice || variantToAdd.originalPrice,
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
          productId: variantToAdd.productId,
          productTitle: variantToAdd.productTitle,
          productImage: variantToAdd.productImage,
          variant: variantToAdd.variantTitle,
          price: variantToAdd.discountedPrice || variantToAdd.originalPrice,
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {upsells.map((upsell) => {
            // Get selected variant or default to the first variant
            const currentSelectedVariantId = selectedVariants[upsell.productId] || upsell.variantId;
            const currentVariant = upsell.hasMultipleVariants && upsell.allVariants
              ? upsell.allVariants.find(v => v.variantId === currentSelectedVariantId) || upsell.allVariants[0]
              : {
                  variantId: upsell.variantId,
                  variantTitle: upsell.variantTitle,
                  price: upsell.originalPrice,
                  discountedPrice: upsell.discountedPrice,
                  inventoryQuantity: 1,
                };

            const displayPrice = currentVariant.price;
            const displayDiscountedPrice = currentVariant.discountedPrice;
            const savings = displayDiscountedPrice
              ? displayPrice - displayDiscountedPrice
              : 0;
            const savingsPercent = displayDiscountedPrice
              ? Math.round((savings / displayPrice) * 100)
              : 0;

            return (
              <div
                key={upsell.variantId}
                className="relative flex flex-col border rounded-lg overflow-hidden hover:border-primary/40 transition-all bg-card"
              >
                {/* Savings Badge */}
                {savings > 0 && (
                  <Badge className="absolute top-1 right-1 md:top-2 md:right-2 z-10 bg-green-600 text-white text-[10px] md:text-xs px-1 md:px-2 py-0 md:py-1">
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
                <div className="p-2 md:p-3 flex-1 flex flex-col">
                  <h4 className="font-semibold text-xs md:text-sm line-clamp-2 mb-1">
                    {upsell.productTitle}
                  </h4>

                  {/* Variant Selector for Multi-Variant Products */}
                  {upsell.hasMultipleVariants && upsell.allVariants && upsell.allVariants.length > 1 ? (
                    <div className="mb-2 md:mb-3">
                      <Select
                        value={currentSelectedVariantId}
                        onValueChange={(value) => {
                          setSelectedVariants(prev => ({
                            ...prev,
                            [upsell.productId]: value,
                          }));
                        }}
                      >
                        <SelectTrigger className="h-7 md:h-8 text-[10px] md:text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {upsell.allVariants.map((variant) => (
                            <SelectItem key={variant.variantId} value={variant.variantId}>
                              <div className="flex items-center justify-between gap-2 md:gap-3 w-full">
                                <span className="text-[10px] md:text-xs">{variant.variantTitle}</span>
                                <span className="text-[10px] md:text-xs font-semibold">
                                  ₹{(variant.discountedPrice || variant.price).toFixed(0)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    currentVariant.variantTitle !== "Default Title" && (
                      <p className="text-[10px] md:text-xs text-muted-foreground mb-2">
                        {currentVariant.variantTitle}
                      </p>
                    )
                  )}

                  {/* Pricing */}
                  <div className="mb-2 md:mb-3 mt-auto">
                    {displayDiscountedPrice ? (
                      <div className="flex items-baseline gap-1 md:gap-2">
                        <span className="text-base md:text-lg font-bold text-green-600">
                          ₹{displayDiscountedPrice.toFixed(0)}
                        </span>
                        <span className="text-xs md:text-sm text-muted-foreground line-through">
                          ₹{displayPrice.toFixed(0)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-base md:text-lg font-bold text-primary">
                        ₹{displayPrice.toFixed(0)}
                      </span>
                    )}
                    {savings > 0 && (
                      <p className="text-[10px] md:text-xs text-green-600 font-medium">
                        Save ₹{savings.toFixed(0)}
                      </p>
                    )}
                  </div>

                  {/* Add Button */}
                  <Button
                    size="sm"
                    className="w-full h-7 md:h-9 text-xs md:text-sm"
                    onClick={() => handleAddUpsell(upsell)}
                    disabled={addingProduct === currentSelectedVariantId}
                  >
                    <PlusIcon className="size-3 md:size-4 mr-1 md:mr-2" />
                    {addingProduct === currentSelectedVariantId ? "Adding..." : "Add to Cart"}
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
