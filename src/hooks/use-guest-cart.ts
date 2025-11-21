import { useState, useEffect } from "react";

export interface GuestCartItem {
  productId: string;
  productTitle: string;
  productImage?: string;
  variant: string;
  price: number;
  quantity: number;
  phoneModel?: string;
  phoneBrand?: string;
  coverage?: "only_back" | "full_body_wrap";
}

const GUEST_CART_KEY = "skinly_guest_cart";

export function useGuestCart() {
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);

  // Load guest cart from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(GUEST_CART_KEY);
    if (stored) {
      try {
        setGuestCart(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse guest cart:", err);
        localStorage.removeItem(GUEST_CART_KEY);
      }
    }
  }, []);

  // Save to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(guestCart));
  }, [guestCart]);

  const addToGuestCart = (item: Omit<GuestCartItem, "quantity"> & { quantity?: number }) => {
    setGuestCart((prev) => {
      // Check if item already exists
      const existingIndex = prev.findIndex(
        (i) => i.productId === item.productId && i.variant === item.variant
      );

      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...prev];
        updated[existingIndex].quantity += item.quantity || 1;
        return updated;
      } else {
        // Add new item
        return [...prev, { ...item, quantity: item.quantity || 1 }];
      }
    });
  };

  const updateGuestCartQuantity = (productId: string, variant: string, quantity: number) => {
    setGuestCart((prev) =>
      prev.map((item) =>
        item.productId === productId && item.variant === variant
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  const removeFromGuestCart = (productId: string, variant: string) => {
    setGuestCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.variant === variant))
    );
  };

  const clearGuestCart = () => {
    setGuestCart([]);
    localStorage.removeItem(GUEST_CART_KEY);
  };

  const getGuestCartCount = () => {
    return guestCart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getGuestCartTotal = () => {
    return guestCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  return {
    guestCart,
    addToGuestCart,
    updateGuestCartQuantity,
    removeFromGuestCart,
    clearGuestCart,
    getGuestCartCount,
    getGuestCartTotal,
  };
}
