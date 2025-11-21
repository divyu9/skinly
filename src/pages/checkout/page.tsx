import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { PackageIcon, TruckIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Link } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

function CheckoutPageInner() {
  const navigate = useNavigate();
  const cartItems = useQuery(api.cart.getCart);
  const createOrder = useMutation(api.orders.createOrder);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    paymentMethod: "cod",
  });

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

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shippingFee = subtotal > 500 ? 0 : 50;
  const total = subtotal + shippingFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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
      });

      toast.success("Order placed successfully!");
      navigate(`/orders/${result.orderId}`);
    } catch (error) {
      toast.error("Failed to place order. Please try again.");
    } finally {
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
                className="h-8"
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
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value })
                    }
                  >
                    <div className="flex items-center space-x-2 p-4 border rounded-lg">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="font-medium">Cash on Delivery</div>
                        <div className="text-sm text-muted-foreground">
                          Pay when you receive your order
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
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
                    ₹{total.toFixed(0)}
                  </span>
                </div>
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
