import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link, useParams } from "react-router-dom";
import { PackageIcon, ArrowLeftIcon, TruckIcon, FileTextIcon, SendIcon, BanknoteIcon } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function OrderDetailPageInner() {
  const { orderId } = useParams<{ orderId: string }>();
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    awbNumber: "",
    trackingUrl: "",
    shippingStatus: "",
  });

  const order = useQuery(
    api.admin.orders.getOrderDetails,
    orderId ? { orderId: orderId as Id<"orders"> } : "skip"
  );
  const updateOrderStatus = useMutation(api.admin.orders.updateOrderStatus);
  const updatePaymentStatus = useMutation(api.admin.orders.updateOrderPaymentStatus);
  const updateShippingInfo = useMutation(api.admin.orders.updateShippingInfo);
  const createShipment = useAction(api.rapidshyp.createShipment);

  const [creatingShipment, setCreatingShipment] = useState(false);

  const handleStatusChange = async (
    status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  ) => {
    if (!orderId) return;
    try {
      await updateOrderStatus({ orderId: orderId as Id<"orders">, status });
      toast.success("Order status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handlePaymentStatusChange = async (
    paymentStatus: "pending" | "success" | "failed"
  ) => {
    if (!orderId) return;
    try {
      await updatePaymentStatus({ orderId: orderId as Id<"orders">, paymentStatus });
      toast.success("Payment status updated");
    } catch (error) {
      toast.error("Failed to update payment status");
    }
  };

  const handleShippingUpdate = async () => {
    if (!orderId) return;
    try {
      await updateShippingInfo({
        orderId: orderId as Id<"orders">,
        ...shippingForm,
      });
      toast.success("Shipping information updated");
      setEditingShipping(false);
      setShippingForm({ awbNumber: "", trackingUrl: "", shippingStatus: "" });
    } catch (error) {
      toast.error("Failed to update shipping info");
    }
  };

  const handleCreateShipment = async () => {
    if (!orderId) return;
    setCreatingShipment(true);
    try {
      const result = await createShipment({ orderId: orderId as Id<"orders"> });
      if (result.success) {
        toast.success(`Shipment created! AWB: ${result.awbNumber}`);
      } else {
        toast.error("Failed to create shipment");
      }
    } catch (error) {
      console.error("RapidShyp Error:", error);
      
      // Extract detailed error message from ConvexError
      let errorMessage = "Failed to create shipment";
      let errorDetails = "";
      
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error.data as { message?: string; code?: string };
        errorMessage = convexError.message || errorMessage;
        errorDetails = convexError.code || "";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, {
        description: errorDetails ? `Error code: ${errorDetails}` : undefined,
        duration: 10000,
      });
    } finally {
      setCreatingShipment(false);
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "confirmed":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "processing":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "shipped":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "delivered":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "";
    }
  };

  const getPaymentStatusColor = (status?: string) => {
    switch (status) {
      case "success":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (order === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>Order not found</EmptyTitle>
          <EmptyDescription>
            This order does not exist or you don't have permission to view it
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/admin/orders">
            <Button>Back to Orders</Button>
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link to="/admin/orders">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="size-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
      </div>

      {/* Order Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
          <p className="text-muted-foreground">{formatDate(order._creationTime)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={order.status}
            onValueChange={(value: typeof order.status) => handleStatusChange(value)}
          >
            <SelectTrigger className={`w-40 ${getStatusColor(order.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={order.paymentStatus || "pending"}
            onValueChange={(value: "pending" | "success" | "failed") =>
              handlePaymentStatusChange(value)
            }
          >
            <SelectTrigger className={`w-40 ${getPaymentStatusColor(order.paymentStatus)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Payment Pending</SelectItem>
              <SelectItem value="success">Paid</SelectItem>
              <SelectItem value="failed">Payment Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Items ({order.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0">
                    {item.productImage && (
                      <div className="size-20 bg-muted rounded-lg overflow-hidden shrink-0">
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{item.productTitle}</p>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>Variant: {item.variant}</p>
                        {item.phoneModel && <p>Model: {item.phoneModel}</p>}
                        {item.phoneBrand && <p>Brand: {item.phoneBrand}</p>}
                        {item.coverage && (
                          <p>
                            Coverage:{" "}
                            {item.coverage === "full_body_wrap"
                              ? "Full Body Wrap"
                              : "Only Back"}
                          </p>
                        )}
                        <p className="font-medium text-foreground">SKU: {item.variant}</p>
                      </div>
                      <p className="font-medium">
                        ₹{item.price.toFixed(0)} × {item.quantity} = ₹
                        {(item.quantity * item.price).toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Management</CardTitle>
            </CardHeader>
            <CardContent>
              {(order.awbNumber || order.trackingUrl) && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                    Current Shipping Details
                  </p>
                  {order.awbNumber && (
                    <p className="text-sm">
                      <span className="font-medium">AWB:</span> {order.awbNumber}
                    </p>
                  )}
                  {order.courierName && (
                    <p className="text-sm">
                      <span className="font-medium">Courier:</span> {order.courierName}
                    </p>
                  )}
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Track Shipment →
                    </a>
                  )}
                  {order.shippingStatus && (
                    <p className="text-sm text-muted-foreground">
                      Status: {order.shippingStatus}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!order.awbNumber ? (
                  <Button
                    onClick={handleCreateShipment}
                    disabled={creatingShipment}
                    className="flex-1"
                  >
                    {creatingShipment ? (
                      <>
                        <Spinner className="size-4 mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <SendIcon className="size-4 mr-2" />
                        Create Shipment
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    {order.labelUrl && (
                      <a
                        href={order.labelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full">
                          <FileTextIcon className="size-4 mr-2" />
                          Download Label
                        </Button>
                      </a>
                    )}
                    <Dialog open={editingShipping} onOpenChange={setEditingShipping}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShippingForm({
                              awbNumber: order.awbNumber || "",
                              trackingUrl: order.trackingUrl || "",
                              shippingStatus: order.shippingStatus || "",
                            });
                          }}
                        >
                          <TruckIcon className="size-4 mr-2" />
                          Edit Shipping
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Update Shipping Information</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="awb">AWB / Tracking Number</Label>
                            <Input
                              id="awb"
                              placeholder="Enter AWB number"
                              value={shippingForm.awbNumber}
                              onChange={(e) =>
                                setShippingForm({
                                  ...shippingForm,
                                  awbNumber: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="tracking">Tracking URL</Label>
                            <Input
                              id="tracking"
                              placeholder="https://..."
                              value={shippingForm.trackingUrl}
                              onChange={(e) =>
                                setShippingForm({
                                  ...shippingForm,
                                  trackingUrl: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="status">Shipping Status</Label>
                            <Input
                              id="status"
                              placeholder="e.g., In Transit, Out for Delivery"
                              value={shippingForm.shippingStatus}
                              onChange={(e) =>
                                setShippingForm({
                                  ...shippingForm,
                                  shippingStatus: e.target.value,
                                })
                              }
                            />
                          </div>
                          <Button onClick={handleShippingUpdate} className="w-full">
                            Save Shipping Info
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Customer & Order Details */}
        <div className="space-y-6">
          {/* Customer Info & Shipping Address Combined */}
          <Card>
            <CardHeader>
              <CardTitle>Customer & Shipping Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Customer</p>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Name</p>
                    <p className="font-medium">{order.shippingAddress.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Phone</p>
                    <p className="font-medium">{order.shippingAddress.phone}</p>
                  </div>
                  {order.user?.email && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Email</p>
                      <p className="font-medium break-all">{order.user.email}</p>
                    </div>
                  )}
                </div>

                {/* Shipping Address */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Shipping Address</p>
                  <div>
                    <p className="text-sm leading-relaxed">
                      {order.shippingAddress.addressLine1}
                      {order.shippingAddress.addressLine2 &&
                        `, ${order.shippingAddress.addressLine2}`}
                    </p>
                    <p className="text-sm leading-relaxed">
                      {order.shippingAddress.city}, {order.shippingAddress.state}
                    </p>
                    <p className="text-sm font-medium">{order.shippingAddress.pincode}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{order.subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>₹{order.shippingFee.toFixed(0)}</span>
              </div>
              {order.codFee && order.codFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">COD Fee</span>
                  <span>₹{order.codFee.toFixed(0)}</span>
                </div>
              )}
              {order.totalGstAmount !== undefined && (
                <>
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      GST Breakdown (Included)
                    </p>
                    <div className="space-y-1">
                      {order.cgstAmount !== undefined &&
                      order.sgstAmount !== undefined ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              CGST ({order.cgstRate! * 100}%)
                            </span>
                            <span>₹{order.cgstAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              SGST ({order.sgstRate! * 100}%)
                            </span>
                            <span>₹{order.sgstAmount.toFixed(2)}</span>
                          </div>
                        </>
                      ) : order.igstAmount !== undefined ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            IGST ({order.igstRate! * 100}%)
                          </span>
                          <span>₹{order.igstAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm font-medium">
                        <span>Total GST</span>
                        <span>₹{order.totalGstAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">₹{order.total.toFixed(0)}</span>
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                Payment Method: {order.paymentMethod}
              </div>
            </CardContent>
          </Card>

          {/* COD Payment Breakdown */}
          {order.paymentMethod === "cod" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                    COD
                  </Badge>
                  Payment Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.prepaidAmount && order.prepaidAmount > 0 ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prepaid Amount (PhonePe)</span>
                        <span className="font-medium text-blue-600">₹{order.prepaidAmount.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount on Delivery</span>
                        <span className="font-medium text-amber-600">₹{(order.codAmount ?? 0).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Partial COD: Customer paid ₹{order.prepaidAmount.toFixed(0)} upfront. 
                        Collect ₹{(order.codAmount ?? 0).toFixed(0)} on delivery.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount on Delivery</span>
                      <span className="font-medium text-amber-600">₹{order.total.toFixed(0)}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Full COD: Collect full payment on delivery.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to view order details
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="space-y-6">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </AuthLoading>
      <Authenticated>
        <OrderDetailPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
