import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PackageIcon, TruckIcon, CreditCardIcon, BanknoteIcon, AlertCircleIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Link } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { calculateGST } from "@/lib/gst";
import { Badge } from "@/components/ui/badge.tsx";

function CheckoutPageInner() {
  const navigate = useNavigate();
  const cartItems = useQuery(api.cart.getCart);
  const createOrder = useMutation(api.orders.createOrder);
  const initiatePayment = useAction(api.phonepe.initiatePayment);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "phonepe",
  });

  // Calculate totals and GST (before early returns)
  const subtotal = cartItems ? cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ) : 0;
  const shippingFee = subtotal > 500 ? 0 : 50;
  const total = subtotal + shippingFee;

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

  // Calculate final total including COD fee if COD is selected
  const codFee = formData.paymentMethod === "cod" && codAvailability?.available
    ? codAvailability.codFee
    : 0;
  const finalTotal = total + codFee;

  // Calculate GST breakdown based on customer's state
  const gstBreakdown = useMemo(() => {
    if (!formData.state || finalTotal === 0) {
      return null;
    }
    return calculateGST(finalTotal, formData.state);
  }, [finalTotal, formData.state]);

  if (cartItems === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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
      const result = await createOrder({
        shippingAddress: {
          fullName: formData.fullName,
          phone: formData.phone,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        paymentMethod: formData.paymentMethod,
        codFee: codFeeAmount,
        prepaidAmount,
        codAmount,
      });

      // Handle payment based on method
      if (formData.paymentMethod === "phonepe") {
        toast.loading("Redirecting to payment gateway...");
        
        const paymentResult = await initiatePayment({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: finalTotal,
          customerPhone: formData.phone,
        });

        if (paymentResult.success && paymentResult.paymentUrl) {
          // Redirect to PhonePe payment page
          window.location.href = paymentResult.paymentUrl;
        } else {
          throw new Error("Failed to initiate payment");
        }
      } else if (formData.paymentMethod === "cod") {
        // Check if partial COD is enabled
        if (prepaidAmount > 0) {
          // Partial COD: Initiate PhonePe payment for prepaid amount
          toast.loading("Redirecting to payment gateway for prepaid amount...");
          
          const paymentResult = await initiatePayment({
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            amount: prepaidAmount,
            customerPhone: formData.phone,
          });

          if (paymentResult.success && paymentResult.paymentUrl) {
            // Redirect to PhonePe payment page
            window.location.href = paymentResult.paymentUrl;
          } else {
            throw new Error("Failed to initiate prepaid payment");
          }
        } else {
          // Full COD: Go directly to order page
          toast.success("Order placed successfully!");
          navigate(`/orders/${result.orderId}`);
        }
      } else {
        // For other methods, go directly to order page
        toast.success("Order placed successfully!");
        navigate(`/orders/${result.orderId}`);
      }
    } catch (error) {
      toast.error("Failed to place order. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-12"
              />
            </Link>
            <h1 className="text-2xl font-bold">Checkout</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      required
                      placeholder="House/Flat No., Building Name"
                      value={formData.addressLine1}
                      onChange={(e) =>
                        setFormData({ ...formData, addressLine1: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      placeholder="Street, Area, Locality"
                      value={formData.addressLine2}
                      onChange={(e) =>
                        setFormData({ ...formData, addressLine2: e.target.value })
                      }
                    />
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
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value })
                    }
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
                    
                    {codAvailability?.available ? (
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
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {codAvailability.prepaidAmount > 0
                              ? `Pay ₹${codAvailability.prepaidAmount.toFixed(0)} now, ₹${codAvailability.codAmount.toFixed(0)} on delivery`
                              : "Pay cash when your order is delivered"}
                          </div>
                        </Label>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 p-4 border rounded-lg opacity-50">
                        <RadioGroupItem value="cod" id="cod" disabled />
                        <Label htmlFor="cod" className="flex-1 cursor-not-allowed">
                          <div className="font-medium">Cash on Delivery</div>
                          <div className="text-sm text-muted-foreground">
                            Not available for this order
                          </div>
                        </Label>
                      </div>
                    )}
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Placing Order..." : "Place Order"}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cartItems.map((item) => (
                    <div key={item._id} className="flex gap-3">
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
                        <p className="text-sm font-semibold text-primary">
                          ₹{item.price.toFixed(0)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
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
                  {codFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>COD Fee</span>
                      <span>₹{codFee.toFixed(0)}</span>
                    </div>
                  )}
                  {subtotal <= 500 && (
                    <p className="text-xs text-muted-foreground">
                      Add ₹{(501 - subtotal).toFixed(0)} more for free shipping
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{finalTotal.toFixed(0)}
                  </span>
                </div>

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
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to checkout</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to proceed with checkout
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <CheckoutPageInner />
      </Authenticated>
    </>
  );
}
