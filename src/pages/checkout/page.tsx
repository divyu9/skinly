import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { PackageIcon, TruckIcon, CreditCardIcon, BanknoteIcon, AlertCircleIcon, ShieldCheckIcon, WalletIcon, TagIcon, XIcon, SparklesIcon, CheckCircleIcon, ArrowLeftIcon } from "lucide-react";
import { CartButton } from "@/components/cart.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Link } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { calculateGST } from "@/lib/gst";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { useGuestCart } from "@/hooks/use-guest-cart.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { CheckoutUpsells } from "./_components/checkout-upsells.tsx";

// PhonePe TypeScript declarations
declare global {
  interface Window {
    PhonePeCheckout?: {
      transact: (config: {
        tokenUrl: string;
        callback: (response: 'USER_CANCEL' | 'CONCLUDED') => void;
        type: 'IFRAME';
      }) => void;
      closePage: () => void;
    };
  }
}

// Generate or retrieve guest session ID
function getGuestSessionId() {
  const storageKey = "skinly_guest_session_id";
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

// Active Coupons Section Component
function ActiveCouponsSection({ 
  onCouponSelect, 
  appliedCouponCode 
}: { 
  onCouponSelect: (code: string) => void; 
  appliedCouponCode?: string;
}) {
  const activeCoupons = useQuery(api.coupons.getActiveCoupons);

  if (!activeCoupons || activeCoupons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-amber-600" />
          Active Offers & Coupons
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCoupons.slice(0, 5).map((coupon) => {
          const isApplied = appliedCouponCode === coupon.code;
          const discountText = coupon.discountType === "percentage"
            ? `${coupon.discountValue}% OFF`
            : `₹${coupon.discountValue} OFF`;

          return (
            <div
              key={coupon._id}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                isApplied
                  ? "bg-green-500/10 border-green-500/50"
                  : "bg-muted/50 border-muted hover:border-primary/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {coupon.code}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {discountText}
                  </Badge>
                  {isApplied && (
                    <Badge className="bg-green-600 text-white text-xs">
                      Applied
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {coupon.description}
                </p>
                {coupon.minCartValue && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Min. cart value: ₹{coupon.minCartValue}
                  </p>
                )}
                {coupon.maxDiscount && coupon.discountType === "percentage" && (
                  <p className="text-xs text-muted-foreground">
                    Max discount: ₹{coupon.maxDiscount}
                  </p>
                )}
              </div>
              {!isApplied && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onCouponSelect(coupon.code)}
                  className="shrink-0"
                >
                  Apply
                </Button>
              )}
            </div>
          );
        })}
        {activeCoupons.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Showing top {Math.min(5, activeCoupons.length)} of {activeCoupons.length} active offers
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CheckoutPageInner() {
  const navigate = useNavigate();
  const convex = useConvex();
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  
  // For authenticated users, use database cart
  // For guests, use localStorage cart
  const dbCartItems = useQuery(api.cart.getCart, isAuthenticated ? {} : "skip");
  const { guestCart, clearGuestCart } = useGuestCart();
  const syncGuestCartToDb = useMutation(api.cart.syncGuestCartToDb);
  
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
  const maxRetries = 5; // 5 retries = ~10 seconds total
  const [guestSessionId] = useState(() => getGuestSessionId());
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon: {
      _id: Id<"coupons">;
      code: string;
      description: string;
    };
    discountAmount: number;
    eligibleItemsCount: number;
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "phonepe",
  });

  // Determine which cart to use
  const cartItems = isAuthenticated ? dbCartItems : guestCart;

  // Reset OTP state when payment method changes away from COD
  const handlePaymentMethodChange = (value: string) => {
    setFormData({ ...formData, paymentMethod: value });
    if (value !== "cod") {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpInput("");
      setOtpExpiresAt(null);
    }
  };

  // Reset OTP state when phone number changes
  const handlePhoneChange = (value: string) => {
    // Only allow digits, max 10
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setFormData({ ...formData, phone: digitsOnly });
    if (otpVerified || otpSent) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtpInput("");
      setOtpExpiresAt(null);
    }
  };

  // Get full phone number with country code for backend
  const getFullPhoneNumber = () => {
    return formData.phone ? `+91${formData.phone}` : "";
  };

  // Validate phone number
  const isPhoneValid = formData.phone.length === 10;

  // Calculate totals and GST (before early returns)
  const subtotal = (cartItems && cartItems.length > 0) ? cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ) : 0;
  
  // Get shipping settings from backend
  const shippingSettings = useQuery(api.shipping.getShippingSettings);
  const shippingFee = shippingSettings 
    ? (subtotal >= shippingSettings.freeShippingThreshold ? 0 : shippingSettings.flatShippingFee)
    : 0;
  const total = subtotal + shippingFee;

  // Get wallet balance and max usage (only for authenticated users)
  const walletData = useQuery(api.wallet.getWalletBalance, isAuthenticated ? {} : "skip");
  const walletMaxUsage = useQuery(
    api.wallet.calculateMaxWalletUsage,
    isAuthenticated ? { orderTotal: total } : "skip"
  );

  // Check COD availability
  const codAvailability = useQuery(
    api.cod.isCodAvailable,
    cartItems && cartItems.length > 0
      ? {
          cartItems: cartItems.map((item) => ({
            productId: item.productId,
            variant: item.variant,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: total,
        }
      : "skip"
  );

  // Calculate cashback for cart items
  // Skip if no cart items or if variants are not proper IDs
  // Variants must start with "j" to be valid Convex IDs
  const shouldFetchCashback = cartItems && cartItems.length > 0 && 
    cartItems.every(item => {
      return item.productId && 
             item.productId.startsWith("j") && 
             item.variant && 
             item.variant.startsWith("j");
    });
    
  const cashbackData = useQuery(
    api.cashbackHelpers.calculateCartCashback,
    shouldFetchCashback
      ? {
          items: cartItems.map((item) => ({
            productId: item.productId as Id<"products">,
            variantId: item.variant as Id<"variants">,
            finalPrice: item.price,
            quantity: item.quantity,
          })),
        }
      : "skip"
  );

  const totalCashback = cashbackData?.totalCashback || 0;

  // Calculate coupon discount
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  
  // Calculate wallet amount to use
  const walletBalance = walletData?.balance || 0;
  const maxWalletUsage = walletMaxUsage?.maxUsage || 0;
  const totalAfterCoupon = Math.max(0, total - couponDiscount);
  const walletAmount = useWallet ? Math.min(maxWalletUsage, totalAfterCoupon) : 0;

  // Calculate final total including COD fee if COD is selected
  const codFee = formData.paymentMethod === "cod" && codAvailability?.available
    ? codAvailability.codFee
    : 0;
  const subtotalAfterDiscounts = totalAfterCoupon - walletAmount;
  const finalTotal = subtotalAfterDiscounts + codFee;

  // Calculate GST breakdown based on customer's state
  const gstBreakdown = useMemo(() => {
    if (!formData.state || finalTotal === 0) {
      return null;
    }
    return calculateGST(finalTotal, formData.state);
  }, [finalTotal, formData.state]);

  // Handle coupon apply
  const handleApplyCoupon = async () => {
    // Clear previous message
    setCouponMessage(null);
    
    if (!couponCode.trim()) {
      setCouponMessage({ type: 'error', text: 'Please enter a coupon code' });
      return;
    }

    setIsApplyingCoupon(true);
    try {
      // Validate cart items have proper IDs before querying
      if (!cartItems || cartItems.length === 0) {
        setCouponMessage({ type: 'error', text: 'Your cart is empty' });
        setIsApplyingCoupon(false);
        return;
      }

      // Filter cart items to only include those with valid Convex product IDs
      const validCartItems = cartItems.filter(item => {
        const hasValidProductId = item.productId && typeof item.productId === 'string' && item.productId.startsWith('j');
        return hasValidProductId;
      });

      if (validCartItems.length === 0) {
        setCouponMessage({ type: 'error', text: 'This coupon does not apply to the items in your cart' });
        setIsApplyingCoupon(false);
        return;
      }

      // For each cart item, look up the actual variant ID
      // Cart items store variant title as string, but we need variant IDs for validation
      const cartItemsWithVariantIds = await Promise.all(
        validCartItems.map(async (item) => {
          // Fetch all variants for this product
          const variants = await convex.query(api.products.getProductVariants, {
            productId: item.productId as Id<"products">,
          });
          
          // Find the variant that matches the cart item's variant title
          const matchingVariant = variants.find(v => v.title === item.variant);
          
          return {
            variantId: matchingVariant?._id as Id<"variants"> | undefined,
            productId: item.productId as Id<"products">,
            productTitle: item.productTitle,
            price: item.price,
            quantity: item.quantity,
          };
        })
      );

      // Filter out items where we couldn't find a matching variant
      const itemsWithValidVariants = cartItemsWithVariantIds.filter(item => item.variantId);

      if (itemsWithValidVariants.length === 0) {
        setCouponMessage({ type: 'error', text: 'This coupon does not apply to the items in your cart' });
        setIsApplyingCoupon(false);
        return;
      }

      const result = await convex.query(api.coupons.validateCoupon, {
        code: couponCode.trim(),
        cartTotal: total,
        userEmail: formData.email || undefined,
        cartItems: itemsWithValidVariants.map((item) => ({
          variantId: item.variantId!,
          productId: item.productId,
          productTitle: item.productTitle,
          price: item.price,
          quantity: item.quantity,
        })),
      });
      
      setAppliedCoupon(result);
      setCouponMessage({ type: 'success', text: `Coupon applied! You saved ₹${result.discountAmount.toFixed(0)}` });
      // Clear success message after showing briefly
      setTimeout(() => setCouponMessage(null), 2000);
    } catch (error) {
      // Extract user-friendly error message from ConvexError
      let errorMessage = "Coupon could not be applied";
      
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error as { data?: { message?: string } };
        if (convexError.data?.message) {
          errorMessage = convexError.data.message;
        }
      } else if (error instanceof Error && error.message && !error.message.includes('CONVEX')) {
        // Use error message only if it doesn't contain technical Convex details
        errorMessage = error.message;
      }
      
      // Log full error for debugging but show clean message to user
      console.error("Coupon validation error:", error);
      setCouponMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Handle coupon removal
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage(null);
  };

  // Handle coupon code change
  const handleCouponCodeChange = (value: string) => {
    setCouponCode(value.toUpperCase());
    // Clear message when user starts typing
    if (couponMessage) {
      setCouponMessage(null);
    }
  };

  // Loading state
  if (authLoading || (isAuthenticated && dbCartItems === undefined)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show payment verification failed UI
  if (showPaymentVerificationFailed && currentOrderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircleIcon className="size-6 text-amber-600" />
              Payment Verification Issue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We're unable to confirm your payment status with PhonePe at the moment. 
              This might be due to a temporary connectivity issue.
            </p>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircleIcon className="size-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  What you can do:
                </p>
                <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                  <li>Check your order page for the latest payment status</li>
                  <li>Try verifying again in a moment</li>
                  <li>Check your bank/UPI app for payment confirmation</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={() => navigate(`/orders/${currentOrderId}`)}
              >
                View Order Details
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setShowPaymentVerificationFailed(false);
                  setRetryCount(0);
                  setIsRedirectingToPayment(true);
                  setIsSubmitting(true);
                  handlePhonePeCallback('CONCLUDED');
                }}
              >
                Retry Verification
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={() => {
                  sessionStorage.removeItem('skinly_merchant_txn_id');
                  sessionStorage.removeItem('skinly_order_id');
                  setShowPaymentVerificationFailed(false);
                  setRetryCount(0);
                  navigate('/checkout');
                }}
              >
                Start New Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((!cartItems || cartItems.length === 0) && !isRedirectingToPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyDescription>
              Add some items to your cart before checking out
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

  const handleSendOtp = async () => {
    if (!formData.phone.trim()) {
      toast.error("Please enter your phone number first");
      return;
    }
    if (!isPhoneValid) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setIsSendingOtp(true);
    try {
      const result = await generateCodOtp({
        phoneNumber: getFullPhoneNumber(),
      });
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
    if (!otpInput.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await verifyCodOtp({
        phoneNumber: getFullPhoneNumber(),
        otp: otpInput,
      });
      setOtpVerified(true);
      toast.success("Phone number verified successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // PhonePe iframe callback handler
  const handlePhonePeCallback = async (response: 'USER_CANCEL' | 'CONCLUDED') => {
    console.log("PhonePe callback received:", response);
    
    if (response === 'USER_CANCEL') {
      // User cancelled payment - update order status to failed
      let merchantTxnId = currentMerchantTxnId;
      
      if (!merchantTxnId) {
        merchantTxnId = sessionStorage.getItem('skinly_merchant_txn_id');
      }
      
      // Get orderId for redirect
      let orderId = currentOrderId;
      if (!orderId) {
        orderId = sessionStorage.getItem('skinly_order_id') as Id<"orders"> | null;
      }
      
      // Update order status to failed if we have transaction ID
      if (merchantTxnId) {
        try {
          await updatePaymentStatus({
            merchantTransactionId: merchantTxnId,
            paymentStatus: "failed",
          });
          console.log("Order marked as cancelled due to user cancellation");
        } catch (error) {
          console.error("Failed to update order status on cancellation:", error);
        }
      }
      
      setIsRedirectingToPayment(false);
      setIsSubmitting(false);
      setRetryCount(0);
      // Clear sessionStorage
      sessionStorage.removeItem('skinly_merchant_txn_id');
      sessionStorage.removeItem('skinly_order_id');
      
      // Redirect to failed order page if we have orderId
      if (orderId) {
        toast.error("Payment cancelled");
        setTimeout(() => {
          navigate(`/orders/${orderId}`);
        }, 300);
      } else {
        toast.error("Payment cancelled");
      }
      return;
    }
    
    if (response === 'CONCLUDED') {
      // Payment completed (could be success or failure)
      // Try to get transaction details from state first, then fallback to sessionStorage
      let merchantTxnId = currentMerchantTxnId;
      let orderId = currentOrderId;
      
      if (!merchantTxnId || !orderId) {
        console.log("State variables missing, trying sessionStorage...");
        merchantTxnId = sessionStorage.getItem('skinly_merchant_txn_id');
        orderId = sessionStorage.getItem('skinly_order_id') as Id<"orders"> | null;
        console.log("SessionStorage values:", { merchantTxnId, orderId });
      }
      
      if (!merchantTxnId || !orderId) {
        console.error("Missing transaction ID or order ID");
        toast.error("Unable to verify payment");
        setIsRedirectingToPayment(false);
        setIsSubmitting(false);
        setRetryCount(0);
        return;
      }
      
      try {
        // Check payment status with PhonePe API
        console.log("Verifying payment status with PhonePe...");
        
        const currentRetry = retryCount + 1;
        setRetryCount(currentRetry);
        
        try {
          const phonepeStatus = await checkPaymentStatus({
            merchantTransactionId: merchantTxnId,
          });
          console.log("PhonePe API status:", phonepeStatus);
          
          // If payment was successful or failed, the mutation already updated the DB
          if (phonepeStatus.paymentStatus === "success") {
            // Clear sessionStorage and state
            sessionStorage.removeItem('skinly_merchant_txn_id');
            sessionStorage.removeItem('skinly_order_id');
            setRetryCount(0);
            setIsRedirectingToPayment(false);
            setIsSubmitting(false);
            
            // Clear guest cart on successful payment
            if (!isAuthenticated) {
              clearGuestCart();
            }
            
            toast.success("Payment successful!");
            setTimeout(() => {
              // For guests with tracking token, use tracking page
              const urlParams = new URLSearchParams(window.location.search);
              const trackingToken = urlParams.get('trackingToken');
              if (!isAuthenticated && trackingToken) {
                navigate(`/orders/track?token=${trackingToken}`);
              } else {
                navigate(`/orders/${orderId}`);
              }
            }, 300);
            return;
          } else if (phonepeStatus.paymentStatus === "failed") {
            // Clear sessionStorage and state
            sessionStorage.removeItem('skinly_merchant_txn_id');
            sessionStorage.removeItem('skinly_order_id');
            setRetryCount(0);
            setIsRedirectingToPayment(false);
            setIsSubmitting(false);
            
            // Redirect to failed order page
            toast.error("Payment failed");
            setTimeout(() => {
              navigate(`/orders/${orderId}`);
            }, 300);
            return;
          }
          
          // Still pending - check retry count
          if (currentRetry >= maxRetries) {
            // Max retries reached - show fallback UI
            console.log("Max retries reached. Showing fallback UI.");
            setShowPaymentVerificationFailed(true);
            setIsRedirectingToPayment(false);
            setIsSubmitting(false);
          } else {
            // Retry after delay
            console.log(`Payment still pending, retrying (${currentRetry}/${maxRetries})...`);
            setTimeout(() => handlePhonePeCallback('CONCLUDED'), 2000);
          }
        } catch (phonepeError) {
          console.error("PhonePe API check failed:", phonepeError);
          
          // On error, check if we should retry or give up
          if (currentRetry >= maxRetries) {
            console.log("Max retries reached after error.");
            setShowPaymentVerificationFailed(true);
            setIsRedirectingToPayment(false);
            setIsSubmitting(false);
          } else {
            // Retry after delay
            console.log(`API error, retrying (${currentRetry}/${maxRetries})...`);
            setTimeout(() => handlePhonePeCallback('CONCLUDED'), 2000);
          }
        }
      } catch (error) {
        console.error("Error in payment verification:", error);
        setShowPaymentVerificationFailed(true);
        setIsRedirectingToPayment(false);
        setIsSubmitting(false);
        setRetryCount(0);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Place Order clicked - starting checkout", { 
      isAuthenticated, 
      guestCartLength: guestCart.length,
      cartItemsLength: cartItems?.length || 0,
      paymentMethod: formData.paymentMethod 
    });
    
    // Validate all required fields
    if (!formData.fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    
    // Validate email for all users
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    
    // Validate phone number
    if (!isPhoneValid) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    
    // Validate address fields
    if (!formData.addressLine1.trim()) {
      toast.error("Please enter address line 1");
      return;
    }
    
    if (!formData.addressLine2.trim()) {
      toast.error("Please enter address line 2");
      return;
    }
    
    if (!formData.city.trim()) {
      toast.error("Please enter your city");
      return;
    }
    
    if (!formData.state.trim()) {
      toast.error("Please enter your state");
      return;
    }
    
    if (!formData.pincode.trim()) {
      toast.error("Please enter your pincode");
      return;
    }
    
    // Check COD OTP verification
    if (formData.paymentMethod === "cod" && !otpVerified) {
      toast.error("Please verify your phone number with OTP before placing a COD order");
      return;
    }
    
    setIsSubmitting(true);
    setRetryCount(0); // Reset retry count for new payment
    setShowPaymentVerificationFailed(false); // Reset failed state

    try {
      // For guest users, sync cart to database first
      if (!isAuthenticated && guestCart.length > 0) {
        console.log("Syncing guest cart to database", { 
          sessionId: guestSessionId, 
          itemCount: guestCart.length 
        });
        await syncGuestCartToDb({
          sessionId: guestSessionId,
          guestCartItems: guestCart,
        });
        console.log("Guest cart synced successfully");
      }
      // Prepare COD fields
      let codFeeAmount = 0;
      let prepaidAmount = 0;
      let codAmount = 0;

      if (formData.paymentMethod === "cod" && codAvailability?.available) {
        codFeeAmount = codAvailability.codFee;
        prepaidAmount = codAvailability.prepaidAmount;
        codAmount = codAvailability.codAmount;
      }

      // Create order first
      console.log("Creating order with params:", {
        isGuest: !isAuthenticated,
        sessionId: !isAuthenticated ? guestSessionId : undefined,
        guestEmail: !isAuthenticated ? formData.email : undefined,
        paymentMethod: formData.paymentMethod
      });
      
      const result = await createOrder({
        shippingAddress: {
          fullName: formData.fullName,
          phone: getFullPhoneNumber(),
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        customerEmail: formData.email || undefined,
        paymentMethod: formData.paymentMethod,
        codFee: codFeeAmount,
        prepaidAmount,
        codAmount,
        walletAmount: isAuthenticated && useWallet ? walletAmount : undefined,
        couponId: appliedCoupon?.coupon._id,
        couponDiscount: appliedCoupon?.discountAmount,
        sessionId: !isAuthenticated ? guestSessionId : undefined,
        guestEmail: !isAuthenticated ? formData.email : undefined,
      });
      
      console.log("Order created successfully:", result);

      // Handle payment based on method
      // Check if order was fully paid by wallet
      const remainingAmount = result.remainingAmount || 0;
      
      if (remainingAmount === 0) {
        // Order fully paid by wallet - clear guest cart on success
        if (!isAuthenticated) {
          clearGuestCart();
        }
        
        toast.success("Order placed successfully!");
        
        // For guests, navigate with tracking token
        if (!isAuthenticated && result.trackingToken) {
          navigate(`/orders/track?token=${result.trackingToken}`);
        } else {
          navigate(`/orders/${result.orderId}`);
        }
      } else if (formData.paymentMethod === "phonepe") {
        // Show loading state immediately
        setIsRedirectingToPayment(true);
        
        const paymentResult = await initiatePayment({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: remainingAmount,
          customerPhone: getFullPhoneNumber(),
        });

        if (paymentResult.success && paymentResult.paymentUrl) {
          // Store transaction details for callback in state and sessionStorage
          setCurrentMerchantTxnId(paymentResult.merchantTransactionId);
          setCurrentOrderId(result.orderId);
          sessionStorage.setItem('skinly_merchant_txn_id', paymentResult.merchantTransactionId);
          sessionStorage.setItem('skinly_order_id', result.orderId);
          console.log("Stored transaction details:", { 
            merchantTxnId: paymentResult.merchantTransactionId, 
            orderId: result.orderId 
          });
          
          // Check if PhonePe SDK is loaded
          if (!window.PhonePeCheckout) {
            console.error("PhonePe SDK not loaded");
            toast.error("Payment service not available. Please refresh and try again.");
            setIsRedirectingToPayment(false);
            return;
          }
          
          // Open PhonePe payment in iframe
          window.PhonePeCheckout.transact({
            tokenUrl: paymentResult.paymentUrl,
            callback: handlePhonePeCallback,
            type: "IFRAME"
          });
        } else {
          setIsRedirectingToPayment(false);
          throw new Error("Failed to initiate payment");
        }
      } else if (formData.paymentMethod === "cod") {
        // Check if partial COD is enabled
        if (prepaidAmount > 0) {
          // Partial COD: Initiate PhonePe payment for prepaid amount
          // Show loading state immediately
          setIsRedirectingToPayment(true);
          
          const paymentResult = await initiatePayment({
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            amount: prepaidAmount,
            customerPhone: getFullPhoneNumber(),
          });

          if (paymentResult.success && paymentResult.paymentUrl) {
            // Store transaction details for callback in state and sessionStorage
            setCurrentMerchantTxnId(paymentResult.merchantTransactionId);
            setCurrentOrderId(result.orderId);
            sessionStorage.setItem('skinly_merchant_txn_id', paymentResult.merchantTransactionId);
            sessionStorage.setItem('skinly_order_id', result.orderId);
            console.log("Stored transaction details (partial COD):", { 
              merchantTxnId: paymentResult.merchantTransactionId, 
              orderId: result.orderId 
            });
            
            // Check if PhonePe SDK is loaded
            if (!window.PhonePeCheckout) {
              console.error("PhonePe SDK not loaded");
              toast.error("Payment service not available. Please refresh and try again.");
              setIsRedirectingToPayment(false);
              return;
            }
            
            // Open PhonePe payment in iframe
            window.PhonePeCheckout.transact({
              tokenUrl: paymentResult.paymentUrl,
              callback: handlePhonePeCallback,
              type: "IFRAME"
            });
          } else {
            setIsRedirectingToPayment(false);
            throw new Error("Failed to initiate prepaid payment");
          }
        } else {
          // Full COD: Go directly to order page - clear guest cart on success
          if (!isAuthenticated) {
            clearGuestCart();
          }
          
          toast.success("Order placed successfully!");
          
          // For guests, navigate with tracking token
          if (!isAuthenticated && result.trackingToken) {
            navigate(`/orders/track?token=${result.trackingToken}`);
          } else {
            navigate(`/orders/${result.orderId}`);
          }
        }
      } else {
        // For other methods, go directly to order page
        toast.success("Order placed successfully!");
        navigate(`/orders/${result.orderId}`);
      }
    } catch (error) {
      console.error("Order creation error:", error);
      
      // Extract detailed error message
      let errorMessage = "Failed to place order. Please try again.";
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error as { data?: { message?: string; code?: string } };
        if (convexError.data?.message) {
          errorMessage = convexError.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setIsSubmitting(false);
      setIsRedirectingToPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeftIcon className="size-4 mr-2" />
                Back
              </Button>
              <Link to="/">
                <img
                  src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                  alt="Skinly"
                  className="h-10"
                />
              </Link>
              <h1 className="text-xl font-bold hidden sm:block">Checkout</h1>
            </div>
            <CartButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Order Summary - Mobile Only */}
              <Card className="lg:hidden">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cartItems && cartItems.map((item, index) => (
                      <div key={('_id' in item ? String(item._id) : `${item.productId}-${item.variant}-${index}`)} className="flex gap-3">
                        {item.productImage && (
                          <div className="size-16 bg-muted rounded-lg overflow-hidden shrink-0">
                            <img
                              src={item.productImage}
                              alt={item.productTitle}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {item.productTitle}
                          </p>
                          {item.phoneModel && (
                            <p className="text-xs text-muted-foreground">
                              {item.phoneModel}
                            </p>
                          )}
                          {item.coverage && (
                            <p className="text-xs text-muted-foreground">
                              Coverage: {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-primary">
                            ₹{item.price.toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Coupon Code Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <TagIcon className="size-4" />
                      <span>Have a Coupon?</span>
                    </div>
                    
                    {!appliedCoupon ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => handleCouponCodeChange(e.target.value)}
                            disabled={isApplyingCoupon}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleApplyCoupon}
                            disabled={!couponCode.trim() || isApplyingCoupon}
                          >
                            {isApplyingCoupon ? "Applying..." : "Apply"}
                          </Button>
                        </div>
                        
                        {/* Inline feedback message */}
                        {couponMessage && (
                          <div className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                            couponMessage.type === 'success' 
                              ? 'bg-green-500/10 border border-green-500/20' 
                              : 'bg-red-500/10 border border-red-500/20'
                          }`}>
                            {couponMessage.type === 'success' ? (
                              <CheckCircleIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <AlertCircleIcon className="size-4 text-red-600 mt-0.5 shrink-0" />
                            )}
                            <p className={`text-xs ${
                              couponMessage.type === 'success' 
                                ? 'text-green-700 dark:text-green-300' 
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                              {couponMessage.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <TagIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                              {appliedCoupon.coupon.code}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveCoupon}
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                            {appliedCoupon.coupon.description}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            You're saving ₹{appliedCoupon.discountAmount.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Pricing */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Shipping</span>
                      <span>
                        {shippingFee === 0 ? (
                          <span className="text-green-600 font-medium">FREE</span>
                        ) : (
                          `₹${shippingFee.toFixed(0)}`
                        )}
                      </span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <TagIcon className="size-3" />
                          Coupon Discount
                        </span>
                        <span className="text-green-600 font-medium">-₹{couponDiscount.toFixed(0)}</span>
                      </div>
                    )}
                    {walletAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <WalletIcon className="size-3" />
                          Wallet Deduction
                        </span>
                        <span className="text-green-600 font-medium">-₹{walletAmount.toFixed(0)}</span>
                      </div>
                    )}
                    {codFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>COD Fee</span>
                        <span>₹{codFee.toFixed(0)}</span>
                      </div>
                    )}
                    {shippingSettings && subtotal < shippingSettings.freeShippingThreshold && (
                      <p className="text-xs text-muted-foreground">
                        Add ₹{(shippingSettings.freeShippingThreshold - subtotal + 1).toFixed(0)} more for free shipping
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {walletAmount > 0 ? "Amount to Pay" : "Total"}
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      ₹{finalTotal.toFixed(0)}
                    </span>
                  </div>

                  {/* Cashback Display */}
                  {totalCashback > 0 && (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <SparklesIcon className="size-4 text-purple-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                            You'll earn ₹{totalCashback.toFixed(0)} cashback
                          </p>
                          <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                            Credited to your wallet after delivery
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t-2 border-purple-500/20">
                        <span className="text-sm font-medium text-muted-foreground">Effective Cost</span>
                        <span className="text-xl font-bold text-purple-600">
                          ₹{(finalTotal - totalCashback).toFixed(0)}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {walletAmount > 0 && walletAmount >= total && (
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <WalletIcon className="size-4 text-green-600" />
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Fully paid with wallet!
                      </p>
                    </div>
                  )}

                  {/* Partial COD Breakdown */}
                  {formData.paymentMethod === "cod" && codAvailability?.available && codAvailability.prepaidAmount > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pay Now (PhonePe)</span>
                        <span className="font-medium text-blue-600">₹{codAvailability.prepaidAmount.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pay on Delivery</span>
                        <span className="font-medium text-amber-600">₹{codAvailability.codAmount.toFixed(0)}</span>
                      </div>
                    </div>
                  )}

                  {/* GST Breakdown */}
                  {gstBreakdown && (
                    <>
                      <Separator />
                      <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground">
                          GST Breakdown (Tax Included)
                        </p>
                        <div className="flex justify-between text-xs">
                          <span>Taxable Amount</span>
                          <span>₹{gstBreakdown.taxableAmount.toFixed(2)}</span>
                        </div>
                        {gstBreakdown.isUttarPradesh ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span>CGST (9%)</span>
                              <span>₹{gstBreakdown.cgstAmount?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>SGST (9%)</span>
                              <span>₹{gstBreakdown.sgstAmount?.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-xs">
                            <span>IGST (18%)</span>
                            <span>₹{gstBreakdown.igstAmount?.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs font-medium pt-1 border-t">
                          <span>Total GST</span>
                          <span>₹{gstBreakdown.totalGstAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Active Coupons & Offers */}
              <ActiveCouponsSection 
                onCouponSelect={(code) => {
                  setCouponCode(code);
                  setTimeout(() => handleApplyCoupon(), 0);
                }}
                appliedCouponCode={appliedCoupon?.coupon.code}
              />

              {/* Checkout Upsells - show recommended products */}
              <CheckoutUpsells />

              {/* Shipping Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="size-5" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      required
                      placeholder="John Smith"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll send your order confirmation and tracking link to this email
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex items-stretch gap-0">
                      <div className="flex items-center justify-center px-3 bg-muted border border-r-0 rounded-l-md text-sm font-medium">
                        +91
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        disabled={otpVerified}
                        className="rounded-l-none"
                        maxLength={10}
                        pattern="[0-9]{10}"
                      />
                    </div>
                    {formData.phone && !isPhoneValid && (
                      <p className="text-xs text-red-600 mt-1">
                        Please enter a valid 10-digit mobile number
                      </p>
                    )}
                    {otpVerified && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Verified for COD orders
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      required
                      placeholder="House/Flat No., Building Name"
                      value={formData.addressLine1}
                      maxLength={99}
                      onChange={(e) =>
                        setFormData({ ...formData, addressLine1: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.addressLine1.length}/99 characters
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      required
                      placeholder="Street, Area, Locality"
                      value={formData.addressLine2}
                      maxLength={99}
                      onChange={(e) =>
                        setFormData({ ...formData, addressLine2: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.addressLine2.length}/99 characters
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        required
                        placeholder="Mumbai"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        required
                        placeholder="Maharashtra"
                        value={formData.state}
                        onChange={(e) =>
                          setFormData({ ...formData, state: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        required
                        placeholder="400001"
                        value={formData.pincode}
                        onChange={(e) =>
                          setFormData({ ...formData, pincode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guest Checkout Notice */}
              {!isAuthenticated && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <AlertCircleIcon className="size-5 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          Guest Checkout
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          You're checking out as a guest. We'll send your order confirmation to your email.
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          Want to track your orders easily? <Link to="/" className="underline font-medium">Sign in</Link> or create an account.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wallet Payment - Always show for authenticated users */}
              {isAuthenticated && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <WalletIcon className="size-5" />
                      Wallet Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-2xl font-bold text-primary">₹{walletBalance.toFixed(2)}</p>
                      </div>
                      {maxWalletUsage > 0 && maxWalletUsage < walletBalance && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Max Usage</p>
                          <p className="text-lg font-semibold">₹{maxWalletUsage.toFixed(2)}</p>
                        </div>
                      )}
                    </div>

                    {walletBalance > 0 && walletMaxUsage?.canUseWallet ? (
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="useWallet" 
                            checked={useWallet}
                            onCheckedChange={(checked) => setUseWallet(checked === true)}
                          />
                          <Label
                            htmlFor="useWallet"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Use wallet balance for this order
                          </Label>
                        </div>

                        {useWallet && walletAmount > 0 && (
                          <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <WalletIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-green-900 dark:text-green-100">
                                ₹{walletAmount.toFixed(2)} will be deducted from your wallet
                              </p>
                              {walletAmount >= totalAfterCoupon && (
                                <p className="text-green-700 dark:text-green-300 mt-1">
                                  Your order will be fully paid with wallet balance!
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {walletBalance === 0 
                          ? "Your wallet is empty. You can add funds after completing orders or redeeming coupons."
                          : "Wallet cannot be used for this order."
                        }
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCardIcon className="size-5" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={handlePaymentMethodChange}
                  >
                    <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="phonepe" id="phonepe" />
                      <Label htmlFor="phonepe" className="flex-1 cursor-pointer">
                        <div className="font-medium">PhonePe Payment Gateway</div>
                        <div className="text-sm text-muted-foreground">
                          Pay securely with UPI, Cards, Net Banking & more
                        </div>
                      </Label>
                    </div>
                    
                    {codAvailability?.available && codAvailability?.showOption ? (
                      <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Cash on Delivery</span>
                            {codAvailability.codFee > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                +₹{codAvailability.codFee.toFixed(0)} fee
                              </Badge>
                            )}
                            {codAvailability.isMixedCart && (
                              <Badge variant="outline" className="text-xs">
                                Mixed Cart
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {codAvailability.prepaidAmount > 0
                              ? `Pay ₹${codAvailability.prepaidAmount.toFixed(0)} now, ₹${codAvailability.codAmount.toFixed(0)} on delivery`
                              : "Pay cash when your order is delivered"}
                          </div>
                        </Label>
                      </div>
                    ) : null}
                  </RadioGroup>

                  {/* COD Fee Notice */}
                  {formData.paymentMethod === "cod" && codAvailability?.available && codAvailability.codFee > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircleIcon className="size-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          COD fee of ₹{codAvailability.codFee.toFixed(0)} will be added to your order
                        </p>
                        {codAvailability.prepaidAmount > 0 && (
                          <p className="text-amber-700 dark:text-amber-300 mt-1">
                            You'll pay ₹{codAvailability.prepaidAmount.toFixed(0)} now via PhonePe, and ₹{codAvailability.codAmount.toFixed(0)} on delivery
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* COD Phone Verification */}
              {formData.paymentMethod === "cod" && codAvailability?.available && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheckIcon className="size-5" />
                      Verify Your Phone Number
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!otpVerified ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          For COD orders, we need to verify your phone number. An OTP will be sent to your WhatsApp.
                        </p>
                        
                        {!otpSent ? (
                          <Button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={!formData.phone || !isPhoneValid || isSendingOtp}
                            className="w-full"
                          >
                            {isSendingOtp ? "Sending OTP..." : "Send OTP to WhatsApp"}
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                              <ShieldCheckIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                              <p className="text-sm text-green-900 dark:text-green-100">
                                OTP sent to {getFullPhoneNumber()}. Check your WhatsApp.
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="otp">Enter OTP</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="otp"
                                  type="text"
                                  maxLength={6}
                                  placeholder="Enter 6-digit OTP"
                                  value={otpInput}
                                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                                />
                                <Button
                                  type="button"
                                  onClick={handleVerifyOtp}
                                  disabled={otpInput.length !== 6 || isVerifyingOtp}
                                >
                                  {isVerifyingOtp ? "Verifying..." : "Verify"}
                                </Button>
                              </div>
                            </div>
                            
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleSendOtp}
                              disabled={isSendingOtp}
                              className="w-full"
                            >
                              {isSendingOtp ? "Resending..." : "Resend OTP"}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <ShieldCheckIcon className="size-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100">
                            Phone Number Verified
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {getFullPhoneNumber()}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting || isRedirectingToPayment}
              >
                {isRedirectingToPayment ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    {retryCount > 0 
                      ? `Verifying payment... (${retryCount}/${maxRetries})`
                      : "Processing payment..."
                    }
                  </span>
                ) : isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    Creating order...
                  </span>
                ) : (
                  "Place Order"
                )}
              </Button>
            </form>
          </div>

          {/* Order Summary - Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cartItems && cartItems.map((item, index) => (
                    <div key={('_id' in item ? String(item._id) : `${item.productId}-${item.variant}-${index}`)} className="flex gap-3">
                      {item.productImage && (
                        <div className="size-16 bg-muted rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.productImage}
                            alt={item.productTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">
                          {item.productTitle}
                        </p>
                        {item.phoneModel && (
                          <p className="text-xs text-muted-foreground">
                            {item.phoneModel}
                          </p>
                        )}
                        {item.coverage && (
                          <p className="text-xs text-muted-foreground">
                            Coverage: {item.coverage === "only_back" ? "Only Back" : "Full Body Wrap"}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-primary">
                          ₹{item.price.toFixed(0)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Coupon Code Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <TagIcon className="size-4" />
                    <span>Have a Coupon?</span>
                  </div>
                  
                  {!appliedCoupon ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={(e) => handleCouponCodeChange(e.target.value)}
                          disabled={isApplyingCoupon}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleApplyCoupon}
                          disabled={!couponCode.trim() || isApplyingCoupon}
                        >
                          {isApplyingCoupon ? "Applying..." : "Apply"}
                        </Button>
                      </div>
                      
                      {/* Inline feedback message */}
                      {couponMessage && (
                        <div className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                          couponMessage.type === 'success' 
                            ? 'bg-green-500/10 border border-green-500/20' 
                            : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                          {couponMessage.type === 'success' ? (
                            <CheckCircleIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <AlertCircleIcon className="size-4 text-red-600 mt-0.5 shrink-0" />
                          )}
                          <p className={`text-xs ${
                            couponMessage.type === 'success' 
                              ? 'text-green-700 dark:text-green-300' 
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {couponMessage.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <TagIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">
                            {appliedCoupon.coupon.code}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveCoupon}
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                          {appliedCoupon.coupon.description}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          You're saving ₹{appliedCoupon.discountAmount.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span>
                      {shippingFee === 0 ? (
                        <span className="text-green-600 font-medium">FREE</span>
                      ) : (
                        `₹${shippingFee.toFixed(0)}`
                      )}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <TagIcon className="size-3" />
                        Coupon Discount
                      </span>
                      <span className="text-green-600 font-medium">-₹{couponDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  {walletAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <WalletIcon className="size-3" />
                        Wallet Deduction
                      </span>
                      <span className="text-green-600 font-medium">-₹{walletAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {codFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>COD Fee</span>
                      <span>₹{codFee.toFixed(0)}</span>
                    </div>
                  )}
                  {shippingSettings && subtotal < shippingSettings.freeShippingThreshold && (
                    <p className="text-xs text-muted-foreground">
                      Add ₹{(shippingSettings.freeShippingThreshold - subtotal + 1).toFixed(0)} more for free shipping
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {walletAmount > 0 ? "Amount to Pay" : "Total"}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{finalTotal.toFixed(0)}
                  </span>
                </div>

                {/* Cashback Display */}
                {totalCashback > 0 && (
                  <>
                    <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <SparklesIcon className="size-4 text-purple-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                          You'll earn ₹{totalCashback.toFixed(0)} cashback
                        </p>
                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                          Credited to your wallet after delivery
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t-2 border-purple-500/20">
                      <span className="text-sm font-medium text-muted-foreground">Effective Cost</span>
                      <span className="text-xl font-bold text-purple-600">
                        ₹{(finalTotal - totalCashback).toFixed(0)}
                      </span>
                    </div>
                  </>
                )}
                
                {walletAmount > 0 && walletAmount >= total && (
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <WalletIcon className="size-4 text-green-600" />
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Fully paid with wallet!
                    </p>
                  </div>
                )}

                {/* Partial COD Breakdown */}
                {formData.paymentMethod === "cod" && codAvailability?.available && codAvailability.prepaidAmount > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay Now (PhonePe)</span>
                      <span className="font-medium text-blue-600">₹{codAvailability.prepaidAmount.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay on Delivery</span>
                      <span className="font-medium text-amber-600">₹{codAvailability.codAmount.toFixed(0)}</span>
                    </div>
                  </div>
                )}

                {/* GST Breakdown */}
                {gstBreakdown && (
                  <>
                    <Separator />
                    <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">
                        GST Breakdown (Tax Included)
                      </p>
                      <div className="flex justify-between text-xs">
                        <span>Taxable Amount</span>
                        <span>₹{gstBreakdown.taxableAmount.toFixed(2)}</span>
                      </div>
                      {gstBreakdown.isUttarPradesh ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span>CGST (9%)</span>
                            <span>₹{gstBreakdown.cgstAmount?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>SGST (9%)</span>
                            <span>₹{gstBreakdown.sgstAmount?.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span>IGST (18%)</span>
                          <span>₹{gstBreakdown.igstAmount?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-medium pt-1 border-t">
                        <span>Total GST</span>
                        <span>₹{gstBreakdown.totalGstAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutPageInner />;
}
