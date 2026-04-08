import { useState, useEffect, useCallback } from "react";

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
const GUEST_CART_UPDATE_EVENT = "guest_cart_updated";

export function useGuestCart() {
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>(() => {
    // Initialize from localStorage on first render
    const stored = localStorage.getItem(GUEST_CART_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        console.error("Failed to parse guest cart:", err);
        localStorage.removeItem(GUEST_CART_KEY);
        return [];
      }
    }
    return [];
  });

  // Sync state across components via custom event and localStorage
  useEffect(() => {
    const syncCart = () => {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (stored) {
        try {
          setGuestCart(JSON.parse(stored));
        } catch (err) {
          console.error(err);
        }
      } else {
        setGuestCart([]);
      }
    };

    window.addEventListener(GUEST_CART_UPDATE_EVENT, syncCart);
    window.addEventListener("storage", (e) => {
      if (e.key === GUEST_CART_KEY) syncCart();
    });

    return () => {
      window.removeEventListener(GUEST_CART_UPDATE_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  const persistCart = useCallback((newCart: GuestCartItem[]) => {
    setGuestCart(newCart);
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(newCart));
    window.dispatchEvent(new Event(GUEST_CART_UPDATE_EVENT));
  }, []);

  const addToGuestCart = (item: Omit<GuestCartItem, "quantity"> & { quantity?: number }) => {
    const prev = guestCart;
    const existingIndex = prev.findIndex(
      (i) => i.productId === item.productId && i.variant === item.variant
    );

    let newCart;
    if (existingIndex > -1) {
      newCart = [...prev];
      newCart[existingIndex].quantity += item.quantity || 1;
    } else {
      newCart = [...prev, { ...item, quantity: item.quantity || 1 }];
    }
    persistCart(newCart);
  };

  const updateGuestCartQuantity = (productId: string, variant: string, quantity: number) => {
    const newCart = guestCart.map((item) =>
      item.productId === productId && item.variant === variant
        ? { ...item, quantity: Math.max(1, quantity) }
        : item
    );
    persistCart(newCart);
  };

  const removeFromGuestCart = (productId: string, variant: string) => {
    const newCart = guestCart.filter(
      (item) => !(item.productId === productId && item.variant === variant)
    );
    persistCart(newCart);
  };

  const clearGuestCart = () => {
    persistCart([]);
  };

  const getGuestCartCount = () => {
    return guestCart.reduce((total, item) => total + item.quantity, 0);
  };

  const getGuestCartTotal = () => {
    return guestCart.reduce((total, item) => total + item.price * item.quantity, 0);
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
