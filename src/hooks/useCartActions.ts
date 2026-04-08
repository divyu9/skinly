import { useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { ConvexError } from "convex/values";
import { trackAddToCart } from "@/lib/analytics.ts";
import type { Id } from "@/lib/firebase-api";

interface CartItemParams {
  productId: Id<"products">;
  productTitle: string;
  productImage: string;
  variant: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
  coverage?: "only_back" | "full_body_wrap";
}

interface UseCartActionsParams {
  product: {
    _id: Id<"products">;
    title: string;
    variants: Array<{
      _id: Id<"variants">;
      title: string;
      price: number;
      inventoryQuantity?: number;
      inventory_quantity?: number;
    }>;
  } | null | undefined;
  selectedVariant: number;
  displayImage: string;
  phoneModel?: string | null;
  phoneBrand?: string | null;
  coverage?: "only_back" | "full_body_wrap";
  requiresDeviceSelection: boolean;
}

export function useCartActions({
  product,
  selectedVariant,
  displayImage,
  phoneModel,
  phoneBrand,
  coverage,
  requiresDeviceSelection,
}: UseCartActionsParams) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToGuestCart } = useGuestCart();
  const addToCartMutation = useMutation(api.cart.addToCart);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  
  const createCartItem = useCallback((): CartItemParams | null => {
    if (!product || !product.variants || product.variants.length === 0) return null;
    
    const variant = product.variants[selectedVariant];
    if (!variant) return null;
    
    // Clean up undefined values for Firestore
    const item: any = {
      productId: product._id,
      productTitle: product.title,
      productImage: displayImage,
      variant: variant.title,
      price: variant.price,
      quantity: 1,
      coverage: coverage || null,
    };
    
    if (phoneModel) item.phoneModel = phoneModel;
    if (phoneBrand) item.phoneBrand = phoneBrand;
    
    return item as CartItemParams;
  }, [product, selectedVariant, displayImage, phoneModel, phoneBrand, coverage]);
  
  const addToCart = useCallback(async (cartItem: CartItemParams) => {
    if (user) {
      await addToCartMutation(cartItem);
    } else {
      addToGuestCart(cartItem);
    }
    
    trackAddToCart(
      cartItem.productId,
      `${cartItem.productTitle} - ${cartItem.variant}`,
      cartItem.price,
      1
    );
  }, [user, addToCartMutation, addToGuestCart]);
  
  const handleAddToCart = useCallback(async () => {
    if (!product || !product.variants || product.variants.length === 0) return;
    
    if (requiresDeviceSelection && !phoneModel) {
      toast.error("Please select your device model first");
      return;
    }
    
    // Check stock availability
    const variant = product.variants[selectedVariant];
    if (variant) {
      const inventoryQuantity = variant.inventoryQuantity ?? variant.inventory_quantity ?? 0;
      if (inventoryQuantity <= 0) {
        toast.error("This item is out of stock");
        return;
      }
    }
    
    const cartItem = createCartItem();
    if (!cartItem) return;
    
    setIsAdding(true);
    
    try {
      await addToCart(cartItem);
      toast.success("Added to cart!");
    } catch (error: any) {
      console.error("Add to cart error:", error);
      if (error?.message === "UNAUTHENTICATED" || (error instanceof ConvexError && (error.data as { code?: string })?.code === "UNAUTHENTICATED")) {
        addToGuestCart(cartItem);
        trackAddToCart(
          cartItem.productId,
          `${cartItem.productTitle} - ${cartItem.variant}`,
          cartItem.price,
          1
        );
        toast.success("Added to cart!");
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setIsAdding(false);
    }
  }, [product, requiresDeviceSelection, phoneModel, selectedVariant, createCartItem, addToCart, addToGuestCart]);
  
  const handleBuyNow = useCallback(async () => {
    if (!product || !product.variants || product.variants.length === 0) return;
    
    if (requiresDeviceSelection && !phoneModel) {
      toast.error("Please select your device model first");
      return;
    }
    
    // Check stock availability
    const variant = product.variants[selectedVariant];
    if (variant) {
      const inventoryQuantity = variant.inventoryQuantity ?? variant.inventory_quantity ?? 0;
      if (inventoryQuantity <= 0) {
        toast.error("This item is out of stock");
        return;
      }
    }
    
    const cartItem = createCartItem();
    if (!cartItem) return;
    
    setIsBuyingNow(true);
    
    try {
      await addToCart(cartItem);
      navigate("/checkout");
    } catch (error: any) {
      console.error("Buy now error:", error);
      if (error?.message === "UNAUTHENTICATED" || (error instanceof ConvexError && (error.data as { code?: string })?.code === "UNAUTHENTICATED")) {
        addToGuestCart(cartItem);
        trackAddToCart(
          cartItem.productId,
          `${cartItem.productTitle} - ${cartItem.variant}`,
          cartItem.price,
          1
        );
        navigate("/checkout");
      } else {
        toast.error("Failed to add to cart");
      }
    } finally {
      setIsBuyingNow(false);
    }
  }, [product, requiresDeviceSelection, phoneModel, selectedVariant, createCartItem, addToCart, addToGuestCart, navigate]);
  
  return {
    isAdding,
    isBuyingNow,
    handleAddToCart,
    handleBuyNow,
  };
}
