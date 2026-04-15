import { useQuery, useMutation, useAction, useConvex } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PackageIcon, AlertCircleIcon } from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Link } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner.tsx";
import { calculateGST } from "@/lib/gst";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import type { Id } from "@/lib/firebase-api";
import { CheckoutUpsells } from "./_components/checkout-upsells.tsx";
import { AddressForm, type FormData } from "./_components/AddressForm.tsx";
import { PaymentMethodSelector } from "./_components/PaymentMethodSelector.tsx";
import { CodOtpSection } from "./_components/CodOtpSection.tsx";
import { WalletSection } from "./_components/WalletSection.tsx";
import { OrderSummaryPanel } from "./_components/OrderSummaryPanel.tsx";
import { ActiveCouponsSection } from "./_components/ActiveCouponsSection.tsx";

import { BrandLogo } from "@/components/brand-logo.tsx";

// PhonePe TypeScript declarations
declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (config: {
        tokenUrl: string;
        callback: (response: "USER_CANCEL" | "CONCLUDED") => void;
        type: "IFRAME";
      }) => void;
      closePage: () => void;
    };
  }
}

function getGuestSessionId() {
  const storageKey = "skinly_guest_session_id";
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

function CheckoutPageInner() {
  const navigate = useNavigate();
  const convex = useConvex();
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;

  const dbCartItems = useQuery(api.cart.getCart, isAuthenticated ? {} : "skip");
  const { guestCart, clearGuestCart } = useGuestCart();
  const syncGuestCartToDb = useMutation(api.cart.syncGuestCartToDb);
  const clearUserCart = useMutation(api.cart.clearCart);
  const createOrder = useMutation(api.orders.createOrder);
  const updatePaymentStatus = useMutation(api.orders.updatePaymentStatus);
  const initiatePayment = useAction(api.phonepe.initiatePayment);
  const checkPaymentStatus = useAction(api.phonepe.checkPaymentStatus);
  const generateCodOtp = useMutation(api.codOtp.generateCodOtp);
  const verifyCodOtp = useMutation(api.codOtp.verifyCodOtp);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false);
  const [currentMerchantTxnId, setCurrentMerchantTxnId] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<Id<"orders"> | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showPaymentVerificationFailed, setShowPaymentVerificationFailed] = useState(false);
  const maxRetries = 5;
  const [guestSessionId] = useState(() => getGuestSessionId());

  const handlePhonePeCallback = useCallback(async (response: "USER_CANCEL" | "CONCLUDED") => {
    if (response === "USER_CANCEL") {
      const merchantTxnId = currentMerchantTxnId || sessionStorage.getItem("skinly_merchant_txn_id");
      const orderId = (currentOrderId || sessionStorage.getItem("skinly_order_id")) as Id<"orders"> | null;
      if (orderId) {
        try { await updatePaymentStatus({ orderId: orderId, paymentStatus: "failed" }); } catch {}
      }
      setIsRedirectingToPayment(false); setIsSubmitting(false); setRetryCount(0);
      sessionStorage.removeItem("skinly_merchant_txn_id"); sessionStorage.removeItem("skinly_order_id");
      toast.error("Payment cancelled");
      if (orderId) setTimeout(() => navigate(`/orders/${orderId}`), 300);
      return;
    }

    const merchantTxnId = currentMerchantTxnId || sessionStorage.getItem("skinly_merchant_txn_id");
    const orderId = (currentOrderId || sessionStorage.getItem("skinly_order_id")) as Id<"orders"> | null;
    if (!merchantTxnId || !orderId) { toast.error("Unable to verify payment"); setIsRedirectingToPayment(false); setIsSubmitting(false); setRetryCount(0); return; }

    let currentRetry = 0;

    const verify = async () => {
      while (currentRetry < maxRetries) {
        currentRetry++;
        setRetryCount(currentRetry);
        try {
          const phonepeStatus = await checkPaymentStatus({ merchantTransactionId: merchantTxnId, orderId: orderId, sessionId: !isAuthenticated ? guestSessionId : undefined });
          if (phonepeStatus.paymentStatus === "success") {
            // Manually update payment status for local development mock
            try { await updatePaymentStatus({ orderId: orderId, paymentStatus: "success" }); } catch {}
            
            sessionStorage.removeItem("skinly_merchant_txn_id"); sessionStorage.removeItem("skinly_order_id");
            setRetryCount(0); setIsRedirectingToPayment(false); setIsSubmitting(false);
            if (!isAuthenticated) clearGuestCart();
            else clearUserCart();
            toast.success("Payment successful!");
            setTimeout(() => {
              sessionStorage.removeItem("skinly_tracking_token");
              navigate(`/orders/${orderId}`);
            }, 300);
            return;
          } else if (phonepeStatus.paymentStatus === "failed") {
            sessionStorage.removeItem("skinly_merchant_txn_id"); sessionStorage.removeItem("skinly_order_id");
            setRetryCount(0); setIsRedirectingToPayment(false); setIsSubmitting(false);
            toast.error("Payment failed");
            setTimeout(() => navigate(`/orders/${orderId}`), 300);
            return;
          }
        } catch {
          // Ignore errors and let it retry
        }

        if (currentRetry >= maxRetries) {
          setShowPaymentVerificationFailed(true); setIsRedirectingToPayment(false); setIsSubmitting(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };

    verify();
  }, [
    currentMerchantTxnId, currentOrderId, isAuthenticated, guestSessionId,
    checkPaymentStatus, updatePaymentStatus, clearGuestCart, clearUserCart, navigate, maxRetries
  ]);

  const openPhonePe = (paymentUrl: string, merchantTxnId: string, orderId: Id<"orders">) => {
    setCurrentMerchantTxnId(merchantTxnId);
    setCurrentOrderId(orderId);
    sessionStorage.setItem("skinly_merchant_txn_id", merchantTxnId);
    sessionStorage.setItem("skinly_order_id", orderId);
    
    // Redirect directly to PhonePe instead of IFRAME, which fixes the "page not opening" issue.
    window.location.href = paymentUrl;
  };

  // Automatically check for returning from payment
  useEffect(() => {
    const merchantTxnId = sessionStorage.getItem("skinly_merchant_txn_id");
    const orderId = sessionStorage.getItem("skinly_order_id");
    
    if (merchantTxnId && orderId && !isRedirectingToPayment && retryCount === 0) {
      // User has returned from PhonePe
      setIsRedirectingToPayment(true);
      setIsSubmitting(true);
      setCurrentMerchantTxnId(merchantTxnId);
      setCurrentOrderId(orderId as Id<"orders">);
      
      // Clean up URL if there are query params from payment gateway
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // Verify payment
      handlePhonePeCallback("CONCLUDED");
    }
  }, [handlePhonePeCallback, isRedirectingToPayment, retryCount]);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon: { _id: Id<"coupons">; code: string; description: string; effectType?: "discount" | "wallet_credit" };
    discountAmount: number;
    eligibleItemsCount: number;
    isWalletCredit?: boolean;
    walletCreditAmount?: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    fullName: "", email: "", phone: "", addressLine1: "", addressLine2: "",
    city: "", state: "", pincode: "", paymentMethod: "phonepe",
  });

  const cartItems = isAuthenticated ? dbCartItems : guestCart;

  const cartItemsForStockCheck = cartItems?.map((item) => ({
    productId: item.productId, variant: item.variant, quantity: item.quantity,
  })) || [];

  const stockStatus = useQuery(
    api.cart.checkCartItemsStock,
    cartItemsForStockCheck.length > 0 ? { cartItems: cartItemsForStockCheck } : "skip"
  );

  const hasOutOfStockItems = stockStatus?.some((s) => s.isOutOfStock) || false;
  const outOfStockItems = stockStatus?.filter((s) => s.isOutOfStock) || [];

  const subtotal = cartItems?.length
    ? cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : 0;

  const shippingSettings = useQuery(api.shipping.getShippingSettings);
  const shippingFee = shippingSettings
    ? subtotal >= shippingSettings.freeShippingThreshold ? 0 : shippingSettings.flatShippingFee
    : 0;
  const total = subtotal + shippingFee;

  const walletData = useQuery(api.wallet.getWalletBalance, isAuthenticated ? {} : "skip");
  const walletMaxUsage = useQuery(
    api.wallet.calculateMaxWalletUsage,
    isAuthenticated ? { orderTotal: total } : "skip"
  );

  const codAvailability = useQuery(
    api.cod.isCodAvailable,
    cartItems?.length
      ? { cartItems: cartItems.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity, price: i.price })), totalAmount: total }
      : "skip"
  );

  const shouldFetchCashback =
    cartItems?.length &&
    cartItems.every((i) => i.productId?.startsWith("j") && i.variant?.startsWith("j"));

  const cashbackData = useQuery(
    api.cashbackHelpers.calculateCartCashback,
    shouldFetchCashback
      ? { items: cartItems!.map((i) => ({ productId: i.productId as Id<"products">, variantId: i.variant as Id<"variants">, finalPrice: i.price, quantity: i.quantity })) }
      : "skip"
  );

  const totalCashback = cashbackData?.totalCashback || 0;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const walletBalance = walletData?.balance || 0;
  const maxWalletUsage = walletMaxUsage?.maxUsage || 0;
  const totalAfterCoupon = Math.max(0, total - couponDiscount);
  const walletAmount = useWallet ? Math.min(maxWalletUsage, totalAfterCoupon) : 0;
  const codFee = formData.paymentMethod === "cod" && codAvailability?.available ? codAvailability.codFee : 0;
  const subtotalAfterDiscounts = totalAfterCoupon - walletAmount;
  const finalTotal = subtotalAfterDiscounts + codFee;

  const gstBreakdown = useMemo(() => {
    if (!formData.state || finalTotal === 0) return null;
    return calculateGST(finalTotal, formData.state);
  }, [finalTotal, formData.state]);

  const getFullPhoneNumber = () => (formData.phone ? `+91${formData.phone}` : "");
  const isPhoneValid = formData.phone.length === 10;

  const handleFieldChange = (field: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handlePaymentMethodChange = (value: string) => {
    setFormData((prev) => ({ ...prev, paymentMethod: value }));
    if (value !== "cod") { setOtpSent(false); setOtpVerified(false); setOtpInput(""); setOtpExpiresAt(null); }
  };

  const handlePhoneChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digitsOnly }));
    if (otpVerified || otpSent) { setOtpSent(false); setOtpVerified(false); setOtpInput(""); setOtpExpiresAt(null); }
  };

  const handleCouponCodeChange = (value: string) => {
    setCouponCode(value.toUpperCase());
    if (couponMessage) setCouponMessage(null);
  };

  const handleApplyCoupon = async (codeToApply?: string | React.MouseEvent | React.FormEvent) => {
    // Determine the actual code string to apply.
    // When called from the button onClick, codeToApply might be an Event object, which doesn't have a trim method.
    let code = "";
    if (typeof codeToApply === "string") {
      code = codeToApply;
    } else {
      code = couponCode;
    }
    
    setCouponMessage(null);
    if (!code || typeof code !== "string" || !code.trim()) { 
      setCouponMessage({ type: "error", text: "Please enter a coupon code" }); 
      return; 
    }
    if (!cartItems?.length) { setCouponMessage({ type: "error", text: "Your cart is empty" }); return; }

    setIsApplyingCoupon(true);
    try {
      const result = await convex.query(api.coupons.validateCoupon, {
        code: code.trim(),
        cartTotal: subtotal,
        userEmail: formData.email || undefined,
        cartItems: cartItems.map((i) => ({ productId: i.productId, productTitle: i.productTitle, price: i.price, quantity: i.quantity })),
      });
      setAppliedCoupon(result);
      setCouponCode(code.toUpperCase());
      if (result.isWalletCredit && result.walletCreditAmount) {
        setCouponMessage({ type: "success", text: `Coupon applied! You'll receive ₹${result.walletCreditAmount} wallet credit when your order is delivered` });
      } else {
        setCouponMessage({ type: "success", text: `Coupon applied! You saved ₹${result.discountAmount.toFixed(0)}` });
      }
      setTimeout(() => setCouponMessage(null), 3000);
    } catch (error) {
      let msg = "Coupon could not be applied";
      if (error && typeof error === "object" && "data" in error) {
        const e = error as { data?: { message?: string } };
        if (e.data?.message) msg = e.data.message;
      } else if (error instanceof Error && !error.message.includes("CONVEX")) {
        msg = error.message;
      }
      setCouponMessage({ type: "error", text: msg });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => { setAppliedCoupon(null); setCouponCode(""); setCouponMessage(null); };

  const handleSendOtp = async () => {
    if (!isPhoneValid) { toast.error("Please enter a valid 10-digit mobile number"); return; }
    setIsSendingOtp(true);
    try {
      const result = await generateCodOtp({ phoneNumber: getFullPhoneNumber() });
      setOtpSent(true);
      setOtpExpiresAt(result.expiresAt);
      toast.success("OTP sent to your WhatsApp");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) { toast.error("Please enter the OTP"); return; }
    setIsVerifyingOtp(true);
    try {
      await verifyCodOtp({ phoneNumber: getFullPhoneNumber(), otp: otpInput });
      setOtpVerified(true);
      toast.success("Phone number verified successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasOutOfStockItems) {
      const names = outOfStockItems.map((item) => cartItems?.find((ci) => ci.productId === item.productId && ci.variant === item.variant)?.productTitle || "Item").join(", ");
      toast.error(`Cannot proceed: Some items are out of stock (${names}). Please remove them from your cart and try again.`, { duration: 5000 });
      return;
    }
    if (!formData.fullName.trim()) { toast.error("Please enter your full name"); return; }
    if (!formData.email.trim()) { toast.error("Email is required"); return; }
    if (!isPhoneValid) { toast.error("Please enter a valid 10-digit mobile number"); return; }
    if (!formData.addressLine1.trim()) { toast.error("Please enter address line 1"); return; }
    if (!formData.addressLine2.trim()) { toast.error("Please enter address line 2"); return; }
    if (!formData.city.trim()) { toast.error("Please enter your city"); return; }
    if (!formData.state.trim()) { toast.error("Please enter your state"); return; }
    if (!formData.pincode.trim()) { toast.error("Please enter your pincode"); return; }
    if (formData.paymentMethod === "cod" && !otpVerified) { toast.error("Please verify your phone number with OTP before placing a COD order"); return; }

    setIsSubmitting(true); setRetryCount(0); setShowPaymentVerificationFailed(false);
    try {
      if (!isAuthenticated && guestCart.length > 0) await syncGuestCartToDb({ sessionId: guestSessionId, guestCartItems: guestCart });

      let codFeeAmount = 0, prepaidAmount = 0, codAmount = 0;
      if (formData.paymentMethod === "cod" && codAvailability?.available) {
        codFeeAmount = codAvailability.codFee; prepaidAmount = codAvailability.prepaidAmount; codAmount = codAvailability.codAmount;
      }

      const result = await createOrder({
        shippingAddress: { fullName: formData.fullName, phone: getFullPhoneNumber(), addressLine1: formData.addressLine1, addressLine2: formData.addressLine2, city: formData.city, state: formData.state, pincode: formData.pincode },
        customerEmail: formData.email || undefined,
        paymentMethod: formData.paymentMethod,
        codFee: codFeeAmount, prepaidAmount, codAmount,
        walletAmount: isAuthenticated && useWallet ? walletAmount : undefined,
        couponId: appliedCoupon?.coupon._id,
        couponDiscount: appliedCoupon?.discountAmount,
        walletCreditAmount: appliedCoupon?.walletCreditAmount,
        sessionId: !isAuthenticated ? guestSessionId : undefined,
        guestEmail: !isAuthenticated ? formData.email : undefined,
        remainingAmount: finalTotal, // Pass final total for Firebase hook mock
        guestItems: !isAuthenticated ? guestCart : undefined, // Pass guest items directly
      });

      const remainingAmount = result.remainingAmount || 0;
      const guestNav = () => navigate(`/orders/${result.orderId}`);

      if (remainingAmount === 0) {
        if (!isAuthenticated) clearGuestCart();
        else clearUserCart();
        toast.success("Order placed successfully!");
        guestNav();
      } else if (formData.paymentMethod === "phonepe" || (formData.paymentMethod === "cod" && prepaidAmount > 0)) {
        setIsRedirectingToPayment(true);
        const amount = formData.paymentMethod === "cod" ? prepaidAmount : remainingAmount;
        
        // Save tracking token for when user returns from payment gateway
        if (result.trackingToken) {
          sessionStorage.setItem("skinly_tracking_token", result.trackingToken);
        }
        
        try {
          // PhonePe merchantTransactionId only allows alphanumeric, hyphens, and underscores.
          const safeOrderNumber = result.orderNumber?.replace(/[^a-zA-Z0-9_-]/g, "");
          const paymentResult = await initiatePayment({ 
            orderId: result.orderId, 
            orderNumber: safeOrderNumber, 
            amount, 
            customerPhone: getFullPhoneNumber(), 
            sessionId: !isAuthenticated ? guestSessionId : undefined 
          });
          
          if (paymentResult.success && paymentResult.paymentUrl) {
            openPhonePe(paymentResult.paymentUrl, paymentResult.merchantTransactionId, result.orderId);
          } else {
            throw new Error("Failed to initiate payment");
          }
        } catch (paymentError) {
          const e = paymentError as any;
          console.error("Payment initiation failed — full error:", JSON.stringify({ message: e?.message, code: e?.code, details: e?.details, data: e?.data }, null, 2));
          // Order was created successfully but payment initiation failed.
          // We must redirect to the order page so the user can retry payment there.
          setIsRedirectingToPayment(false);

          const rawMsg: string = e?.message || e?.details?.message || e?.data?.message || "";
          const errMsg = rawMsg || "Payment failed to initiate.";
          toast.error(errMsg + " You can retry payment from the order page.");
          
          guestNav();
        }
      } else {
        if (!isAuthenticated) clearGuestCart();
        else clearUserCart();
        toast.success("Order placed successfully!");
        guestNav();
      }
    } catch (error) {
      let msg = "Failed to place order. Please try again.";
      if (error && typeof error === "object" && "data" in error) {
        const e = error as { data?: { message?: string } };
        if (e.data?.message) msg = e.data.message;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg); setIsSubmitting(false); setIsRedirectingToPayment(false);
    }
  };

  // ── Early returns ──────────────────────────────────────────────────────────

  if (authLoading || (isAuthenticated && dbCartItems === undefined)) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (showPaymentVerificationFailed && currentOrderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircleIcon className="size-6 text-amber-600" />Payment Verification Issue</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">We're unable to confirm your payment status with PhonePe at the moment.</p>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircleIcon className="size-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">What you can do:</p>
                <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                  <li>Check your order page for the latest payment status</li>
                  <li>Try verifying again in a moment</li>
                  <li>Check your bank/UPI app for payment confirmation</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={() => navigate(`/orders/${currentOrderId}`)}>View Order Details</Button>
              <Button className="w-full" variant="outline" onClick={() => { setShowPaymentVerificationFailed(false); setRetryCount(0); setIsRedirectingToPayment(true); setIsSubmitting(true); handlePhonePeCallback("CONCLUDED"); }}>Retry Verification</Button>
              <Button className="w-full" variant="ghost" onClick={() => { sessionStorage.removeItem("skinly_merchant_txn_id"); sessionStorage.removeItem("skinly_order_id"); setShowPaymentVerificationFailed(false); setRetryCount(0); navigate("/checkout"); }}>Start New Payment</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cartItems?.length && !isRedirectingToPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><PackageIcon /></EmptyMedia>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>Add some items to your cart before checking out</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Link to="/products"><Button>Browse Products</Button></Link></EmptyContent>
        </Empty>
      </div>
    );
  }

  // ── Shared summary props ───────────────────────────────────────────────────

  const summaryProps = {
    cartItems: cartItems as any,
    stockStatus,
    subtotal,
    shippingFee,
    shippingSettings,
    couponDiscount,
    walletAmount,
    walletTotal: total,
    codFee,
    finalTotal,
    totalCashback,
    gstBreakdown,
    couponCode,
    appliedCoupon,
    isApplyingCoupon,
    couponMessage,
    paymentMethod: formData.paymentMethod,
    codAvailability,
    onCouponCodeChange: handleCouponCodeChange,
    onApplyCoupon: handleApplyCoupon,
    onRemoveCoupon: handleRemoveCoupon,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="shrink-0">
                ← Back
              </Button>
              <BrandLogo type="header" imgClassName="h-10" />
              <h1 className="text-xl font-bold hidden sm:block">Checkout</h1>
            </div>
            <CartButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {hasOutOfStockItems && (
              <Card className="mb-6 border-destructive/50 bg-destructive/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-destructive mb-1">Out of Stock Items in Cart</h3>
                      <p className="text-sm text-destructive/90 mb-2">Please remove the following out-of-stock items from your cart to proceed:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-destructive/90">
                        {outOfStockItems.map((item, idx) => {
                          const ci = cartItems?.find((c) => c.productId === item.productId && c.variant === item.variant);
                          return <li key={idx}>{ci?.productTitle}{ci && ci.variant !== "Default Title" ? ` - ${ci.variant}` : ""}</li>;
                        })}
                      </ul>
                      <Link to="/cart"><Button variant="outline" size="sm" className="mt-3 border-destructive text-destructive hover:bg-destructive hover:text-white">Go to Cart</Button></Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Order Summary — mobile only */}
              <div className="lg:hidden">
                <OrderSummaryPanel {...summaryProps} />
              </div>

              <ActiveCouponsSection onCouponSelect={handleApplyCoupon} appliedCouponCode={appliedCoupon?.coupon.code} />
              <CheckoutUpsells />

              <AddressForm
                formData={formData}
                isPhoneValid={isPhoneValid}
                otpVerified={otpVerified}
                isAuthenticated={isAuthenticated}
                onFieldChange={handleFieldChange}
                onPhoneChange={handlePhoneChange}
              />

              {isAuthenticated && (
                <WalletSection
                  walletBalance={walletBalance}
                  maxWalletUsage={maxWalletUsage}
                  walletAmount={walletAmount}
                  totalAfterCoupon={totalAfterCoupon}
                  useWallet={useWallet}
                  canUseWallet={walletMaxUsage?.canUseWallet ?? false}
                  onUseWalletChange={setUseWallet}
                />
              )}

              <PaymentMethodSelector
                paymentMethod={formData.paymentMethod}
                codAvailability={codAvailability}
                onPaymentMethodChange={handlePaymentMethodChange}
              />

              {formData.paymentMethod === "cod" && codAvailability?.available && (
                <CodOtpSection
                  fullPhoneNumber={getFullPhoneNumber()}
                  isPhoneValid={isPhoneValid}
                  otpSent={otpSent}
                  otpVerified={otpVerified}
                  otpInput={otpInput}
                  isSendingOtp={isSendingOtp}
                  isVerifyingOtp={isVerifyingOtp}
                  onOtpInputChange={setOtpInput}
                  onSendOtp={handleSendOtp}
                  onVerifyOtp={handleVerifyOtp}
                />
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isRedirectingToPayment || hasOutOfStockItems}>
                {isRedirectingToPayment ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    {retryCount > 0 ? `Verifying payment... (${retryCount}/${maxRetries})` : "Processing payment..."}
                  </span>
                ) : isSubmitting ? (
                  <span className="flex items-center gap-2"><Spinner className="size-4" />Creating order...</span>
                ) : (
                  "Place Order"
                )}
              </Button>

              {/* Upsells Section under Place Order */}
              <div className="mt-8">
                <CheckoutUpsells />
              </div>
            </form>
          </div>

          {/* Order Summary — desktop sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <OrderSummaryPanel {...summaryProps} cardClassName="sticky top-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutPageInner />;
}
