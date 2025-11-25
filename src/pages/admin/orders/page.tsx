import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, SearchIcon, TrendingUpIcon, CreditCardIcon, TruckIcon, IndianRupeeIcon, SendIcon, FileTextIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function AdminOrdersPageInner() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingShipping, setEditingShipping] = useState<Id<"orders"> | null>(null);
  const [shippingForm, setShippingForm] = useState({
    awbNumber: "",
    trackingUrl: "",
    shippingStatus: "",
  });

  const stats = useQuery(api.admin.orders.getOrderStats);
  const allOrders = useQuery(api.admin.orders.getAllOrders, {
    status: statusFilter,
    paymentStatus: paymentFilter,
  });
  const searchResults = useQuery(
    api.admin.orders.searchOrders,
    searchTerm.length >= 3 ? { searchTerm } : "skip"
  );
  const updateOrderStatus = useMutation(api.admin.orders.updateOrderStatus);
  const updatePaymentStatus = useMutation(api.admin.orders.updateOrderPaymentStatus);
  const updateShippingInfo = useMutation(api.admin.orders.updateShippingInfo);
  const createShipment = useAction(api.rapidshyp.createShipment);
  const generateLabel = useAction(api.rapidshyp.generateShippingLabel);
  
  const [creatingShipment, setCreatingShipment] = useState<Id<"orders"> | null>(null);

  const displayOrders = searchTerm.length >= 3 ? searchResults : allOrders;

  const handleStatusChange = async (
    orderId: Id<"orders">,
    status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  ) => {
    try {
      await updateOrderStatus({ orderId, status });
      toast.success("Order status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handlePaymentStatusChange = async (
    orderId: Id<"orders">,
    paymentStatus: "pending" | "success" | "failed"
  ) => {
    try {
      await updatePaymentStatus({ orderId, paymentStatus });
      toast.success("Payment status updated");
    } catch (error) {
      toast.error("Failed to update payment status");
    }
  };

  const handleShippingUpdate = async (orderId: Id<"orders">) => {
    try {
      await updateShippingInfo({
        orderId,
        ...shippingForm,
      });
      toast.success("Shipping information updated");
      setEditingShipping(null);
      setShippingForm({ awbNumber: "", trackingUrl: "", shippingStatus: "" });
    } catch (error) {
      toast.error("Failed to update shipping info");
    }
  };

  const handleCreateShipment = async (orderId: Id<"orders">) => {
    setCreatingShipment(orderId);
    try {
      const result = await createShipment({ orderId });
      if (result.success) {
        toast.success(`Shipment created! AWB: ${result.awbNumber}`);
      } else {
        toast.error("Failed to create shipment");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create shipment";
      toast.error(errorMessage);
    } finally {
      setCreatingShipment(null);
    }
  };

  const handleGenerateLabel = async (awbNumber: string) => {
    try {
      toast.loading("Generating shipping label...");
      const result = await generateLabel({ awbNumber });
      if (result.success && result.labelUrl) {
        window.open(result.labelUrl, "_blank");
        toast.success("Label generated successfully");
      } else {
        toast.error("Failed to generate label");
      }
    } catch (error) {
      toast.error("Failed to generate label");
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

  if (!stats || displayOrders === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-muted-foreground">
          Manage all customer orders and track payments
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Orders
              </CardTitle>
              <PackageIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <IndianRupeeIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.successfulPayments} paid orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payments
              </CardTitle>
              <CreditCardIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.successfulPayments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingPayments} pending, {stats.failedPayments} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Shipped
              </CardTitle>
              <TruckIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {stats.shipped}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.delivered} delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by order #, name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>Order Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Status</Label>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {displayOrders.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>
              {searchTerm ? "No orders found" : "No orders yet"}
            </EmptyTitle>
            <EmptyDescription>
              {searchTerm
                ? "Try adjusting your search or filters"
                : "Orders will appear here when customers make purchases"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((order) => (
            <Card key={order._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(order._creationTime)}
                    </p>
                    {order.user && (
                      <p className="text-xs text-muted-foreground">
                        {order.user.email}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Select
                      value={order.status}
                      onValueChange={(value: typeof order.status) =>
                        handleStatusChange(order._id, value)
                      }
                    >
                      <SelectTrigger
                        className={`w-32 ${getStatusColor(order.status)}`}
                      >
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
                        handlePaymentStatusChange(order._id, value)
                      }
                    >
                      <SelectTrigger
                        className={`w-32 ${getPaymentStatusColor(order.paymentStatus)}`}
                      >
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
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Customer & Shipping Info */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                        Customer
                      </p>
                      <p className="font-medium">{order.shippingAddress.fullName}</p>
                      <p className="text-muted-foreground">
                        {order.shippingAddress.phone}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                        Shipping Address
                      </p>
                      <p className="text-muted-foreground">
                        {order.shippingAddress.addressLine1}
                        {order.shippingAddress.addressLine2 &&
                          `, ${order.shippingAddress.addressLine2}`}
                      </p>
                      <p className="text-muted-foreground">
                        {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                        {order.shippingAddress.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <p className="font-medium text-xs text-muted-foreground uppercase mb-2">
                      Order Items ({order.items.length})
                    </p>
                    <div className="space-y-2">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex gap-3">
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
                            <p className="text-sm font-medium line-clamp-1">
                              {item.productTitle}
                            </p>
                            {item.phoneModel && (
                              <p className="text-xs text-muted-foreground">
                                Model: {item.phoneModel}
                              </p>
                            )}
                            {item.coverage && (
                              <p className="text-xs text-muted-foreground">
                                Coverage: {item.coverage === "full_body_wrap" ? "Full Body Wrap" : "Only Back"}
                              </p>
                            )}
                            <p className="text-sm font-medium">
                              Qty: {item.quantity} × ₹{item.price.toFixed(0)} = ₹
                              {(item.quantity * item.price).toFixed(0)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-sm text-muted-foreground">
                          +{order.items.length - 3} more item(s)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shipping Information */}
                  {(order.awbNumber || order.trackingUrl) && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-xs text-muted-foreground uppercase mb-1">
                        Shipping Details
                      </p>
                      {order.awbNumber && (
                        <p className="text-sm">
                          <span className="font-medium">AWB:</span> {order.awbNumber}
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

                  {/* Order Total & Actions */}
                  <div className="flex flex-col gap-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Order Total</p>
                        <p className="text-2xl font-bold text-primary">
                          ₹{order.total.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Subtotal: ₹{order.subtotal.toFixed(0)} + Shipping: ₹
                          {order.shippingFee.toFixed(0)}
                        </p>
                      </div>
                      <Link to={`/orders/${order._id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>

                    {/* RapidShyp Actions */}
                    <div className="flex flex-wrap gap-2">
                      {!order.awbNumber ? (
                        <Button
                          onClick={() => handleCreateShipment(order._id)}
                          disabled={creatingShipment === order._id}
                          size="sm"
                          className="flex-1"
                        >
                          {creatingShipment === order._id ? (
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
                          <Button
                            onClick={() => handleGenerateLabel(order.awbNumber!)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <FileTextIcon className="size-4 mr-2" />
                            Get Label
                          </Button>
                          <Dialog
                            open={editingShipping === order._id}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditingShipping(order._id);
                                setShippingForm({
                                  awbNumber: order.awbNumber || "",
                                  trackingUrl: order.trackingUrl || "",
                                  shippingStatus: order.shippingStatus || "",
                                });
                              } else {
                                setEditingShipping(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1">
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
                                <Button
                                  onClick={() => handleShippingUpdate(order._id)}
                                  className="w-full"
                                >
                                  Save Shipping Info
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv"
                alt="Skinly"
                className="h-8"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/admin/products"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Products
              </Link>
              <Link
                to="/admin/collections"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Collections
              </Link>
              <Link
                to="/admin/orders"
                className="text-sm font-medium text-primary"
              >
                Orders
              </Link>
              <Link
                to="/admin/mockups"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Mockups
              </Link>
              <Link to="/">
                <Button variant="outline" size="sm">
                  View Store
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage orders
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <SignInButton />
            </EmptyContent>
          </Empty>
        </Unauthenticated>
        <AuthLoading>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminOrdersPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
