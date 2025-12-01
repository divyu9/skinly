import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link, useParams } from "react-router-dom";
import { PackageIcon, TruckIcon, MapPinIcon, CreditCardIcon, ChevronLeftIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

function OrderDetailPageInner() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useQuery(
    api.orders.getOrder,
    orderId ? { orderId: orderId as Id<"orders"> } : "skip"
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "confirmed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "processing":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "shipped":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "delivered":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (order === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading order details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/orders">
              <Button variant="ghost" size="sm">
                <ChevronLeftIcon className="size-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <Link to="/">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-12"
              />
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Order Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Order Details</h1>
              <p className="text-lg text-muted-foreground">{order.orderNumber}</p>
              <p className="text-sm text-muted-foreground">
                Placed on {formatDate(order._creationTime)}
              </p>
            </div>
            <Badge className={`${getStatusColor(order.status)} text-base px-4 py-2`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="size-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx}>
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex gap-4">
                      {item.productImage && (
                        <div className="size-20 bg-muted rounded-lg overflow-hidden shrink-0">
                          <img
                            src={item.productImage}
                            alt={item.productTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                          {item.productTitle}
                        </h4>
                        {item.phoneModel && (
                          <p className="text-sm text-muted-foreground mb-1">
                            For: {item.phoneModel}
                          </p>
                        )}
                        {item.variant !== "Default Title" && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Variant: {item.variant}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Qty: {item.quantity}
                          </span>
                          <span className="font-semibold text-primary">
                            ₹{item.price.toFixed(0)} each
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          ₹{(item.price * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tracking Information */}
            {(order.awbNumber || order.trackingUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="size-5" />
                    Tracking Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {order.awbNumber && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                          Tracking Number
                        </p>
                        <p className="text-sm font-mono font-semibold">{order.awbNumber}</p>
                      </div>
                    )}
                    {order.shippingStatus && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                          Status
                        </p>
                        <p className="text-sm">{order.shippingStatus}</p>
                      </div>
                    )}
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button className="w-full" size="sm">
                          <TruckIcon className="size-4 mr-2" />
                          Track Your Shipment
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinIcon className="size-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{order.shippingAddress.fullName}</p>
                  <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.addressLine1}
                  </p>
                  {order.shippingAddress.addressLine2 && (
                    <p className="text-muted-foreground">
                      {order.shippingAddress.addressLine2}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                    {order.shippingAddress.pincode}
                  </p>
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
              <CardContent>
                <p className="text-sm">
                  {order.paymentMethod === "cod"
                    ? "Cash on Delivery (COD)"
                    : order.paymentMethod}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <TruckIcon className="size-3" />
                      Shipping
                    </span>
                    <span>
                      {order.shippingFee === 0 ? (
                        <span className="text-green-600 font-medium">FREE</span>
                      ) : (
                        `₹${order.shippingFee.toFixed(0)}`
                      )}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary">
                    ₹{order.total.toFixed(0)}
                  </span>
                </div>

                {/* GST Breakdown */}
                {order.totalGstAmount !== undefined && order.taxableAmount !== undefined && (
                  <>
                    <Separator />
                    <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">
                        GST Breakdown (Tax Included)
                      </p>
                      <div className="flex justify-between text-xs">
                        <span>Taxable Amount</span>
                        <span>₹{order.taxableAmount.toFixed(2)}</span>
                      </div>
                      {order.cgstAmount !== undefined && order.sgstAmount !== undefined ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span>CGST (9%)</span>
                            <span>₹{order.cgstAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>SGST (9%)</span>
                            <span>₹{order.sgstAmount.toFixed(2)}</span>
                          </div>
                        </>
                      ) : order.igstAmount !== undefined ? (
                        <div className="flex justify-between text-xs">
                          <span>IGST (18%)</span>
                          <span>₹{order.igstAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-xs font-medium pt-1 border-t">
                        <span>Total GST</span>
                        <span>₹{order.totalGstAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-2">
                  <Link to="/orders" className="block">
                    <Button variant="outline" className="w-full">
                      View All Orders
                    </Button>
                  </Link>
                  <Link to="/products" className="block">
                    <Button className="w-full">Continue Shopping</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to view order</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to see order details
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
          <Skeleton className="h-96 w-full max-w-5xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <OrderDetailPageInner />
      </Authenticated>
    </>
  );
}
