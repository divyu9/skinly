import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link, useParams } from "react-router-dom";
import { PackageIcon, ArrowLeftIcon, TruckIcon, FileTextIcon, SendIcon, BanknoteIcon, PackageXIcon, RotateCcwIcon, CheckIcon, XCircleIcon, AlertCircleIcon, PackageOpenIcon, RefreshCwIcon } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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
  const inventoryData = useQuery(
    api.admin.orders.getOrderVariantInventory,
    orderId && order && (order.status === "cancelled" || order.status === "rto")
      ? { orderId: orderId as Id<"orders"> }
      : "skip"
  );
  const updateOrderStatus = useMutation(api.admin.orders.updateOrderStatus);
  const updatePaymentStatus = useMutation(api.admin.orders.updateOrderPaymentStatus);
  const updateShippingInfo = useMutation(api.admin.orders.updateShippingInfo);
  const createShipment = useAction(api.rapidshyp.createShipment);
  const cancelShipment = useAction(api.rapidshyp.cancelShipment);
  const restockInventory = useMutation(api.admin.orders.restockInventory);
  const refundToWallet = useMutation(api.admin.orders.refundToWallet);
  const saveManualTracking = useMutation(api.admin.manualTracking.saveManualTracking);
  const recordRtoAction = useMutation(api.admin.orders.recordRtoAction);

  const [creatingShipment, setCreatingShipment] = useState(false);
  const [cancellingShipment, setCancellingShipment] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isRestocking, setIsRestocking] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundForm, setRefundForm] = useState({
    amount: "",
    reason: "",
  });
  const [showManualTrackingDialog, setShowManualTrackingDialog] = useState(false);
  const [manualTrackingForm, setManualTrackingForm] = useState({
    trackingNumber: "",
    courierCompany: "",
  });
  const [isSavingManualTracking, setIsSavingManualTracking] = useState(false);
  const [showRtoActionDialog, setShowRtoActionDialog] = useState(false);
  const [rtoActionForm, setRtoActionForm] = useState<{
    actionType: "restocked" | "resent" | "resolved";
    notes: string;
    newOrderNumber: string;
  }>({
    actionType: "resolved",
    notes: "",
    newOrderNumber: "",
  });
  const [isRecordingRtoAction, setIsRecordingRtoAction] = useState(false);

  const handleStatusChange = async (
    status: "processing" | "shipped" | "delivered" | "cancelled" | "rto"
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

  const handleCancelShipment = async () => {
    if (!orderId) return;
    setCancellingShipment(true);
    try {
      const result = await cancelShipment({ orderId: orderId as Id<"orders"> });
      if (result.success) {
        toast.success("Shipment cancelled successfully");
        setShowCancelDialog(false);
      } else {
        toast.error("Failed to cancel shipment");
      }
    } catch (error) {
      console.error("Cancel Shipment Error:", error);
      
      // Extract detailed error message from ConvexError
      let errorMessage = "Failed to cancel shipment";
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
      setCancellingShipment(false);
    }
  };

  const handleSelectAllItems = (checked: boolean) => {
    if (checked && order) {
      setSelectedItems(new Set(order.items.map((item) => item.variant)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (sku: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(sku);
    } else {
      newSelected.delete(sku);
    }
    setSelectedItems(newSelected);
  };

  const handleRestock = async () => {
    if (!orderId || !order) return;
    setIsRestocking(true);
    try {
      const itemsToRestock = order.items
        .filter((item) => selectedItems.has(item.variant))
        .map((item) => ({
          variant: item.variant,
          quantity: item.quantity,
        }));

      const result = await restockInventory({
        orderId: orderId as Id<"orders">,
        itemsToRestock,
      });

      if (result.success) {
        toast.success(`Successfully restocked ${itemsToRestock.length} item(s)`);
        setShowRestockDialog(false);
        setSelectedItems(new Set());
      } else {
        const failedItems = result.results.filter((r) => !r.success);
        toast.error(`Failed to restock ${failedItems.length} item(s)`, {
          description: failedItems.map((r) => `${r.sku}: ${r.error}`).join(", "),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restock inventory");
    } finally {
      setIsRestocking(false);
    }
  };

  const formatRestockDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefund = async () => {
    if (!orderId || !order) return;
    
    const amount = parseFloat(refundForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    if (amount > order.total) {
      toast.error(`Refund amount cannot exceed order total (₹${order.total})`);
      return;
    }

    setIsRefunding(true);
    try {
      const result = await refundToWallet({
        orderId: orderId as Id<"orders">,
        refundAmount: amount,
        refundReason: refundForm.reason || undefined,
      });

      if (result.success) {
        toast.success(`Successfully refunded ₹${amount} to customer's wallet`);
        setShowRefundDialog(false);
        setRefundForm({ amount: "", reason: "" });
      }
    } catch (error) {
      console.error("Refund Error:", error);
      
      let errorMessage = "Failed to process refund";
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error.data as { message?: string };
        errorMessage = convexError.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleSaveManualTracking = async () => {
    if (!orderId) return;
    
    if (!manualTrackingForm.trackingNumber.trim()) {
      toast.error("Tracking number is required");
      return;
    }

    if (!manualTrackingForm.courierCompany.trim()) {
      toast.error("Courier company is required");
      return;
    }

    setIsSavingManualTracking(true);
    try {
      const result = await saveManualTracking({
        orderId: orderId as Id<"orders">,
        trackingNumber: manualTrackingForm.trackingNumber,
        courierCompany: manualTrackingForm.courierCompany,
      });

      if (result.success) {
        const statusMsg = result.statusUpdated 
          ? " Order status updated to shipped."
          : "";
        toast.success(`Manual tracking saved successfully!${statusMsg}`);
        setShowManualTrackingDialog(false);
        setManualTrackingForm({ trackingNumber: "", courierCompany: "" });
      }
    } catch (error) {
      console.error("Manual Tracking Error:", error);
      
      let errorMessage = "Failed to save manual tracking";
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error.data as { message?: string };
        errorMessage = convexError.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSavingManualTracking(false);
    }
  };

  const handleRecordRtoAction = async () => {
    if (!orderId) return;

    // Validate required fields
    if (rtoActionForm.actionType === "resent" && !rtoActionForm.newOrderNumber.trim()) {
      toast.error("New order number is required for 'Resent' action");
      return;
    }

    setIsRecordingRtoAction(true);
    try {
      const result = await recordRtoAction({
        orderId: orderId as Id<"orders">,
        actionType: rtoActionForm.actionType,
        notes: rtoActionForm.notes || undefined,
        newOrderNumber: rtoActionForm.newOrderNumber || undefined,
      });

      if (result.success) {
        const actionLabels = {
          restocked: "Inventory Restocked",
          resent: "Package Resent",
          resolved: "Marked as Resolved",
        };
        toast.success(`RTO action recorded: ${actionLabels[result.actionType]}`);
        setShowRtoActionDialog(false);
        setRtoActionForm({
          actionType: "resolved",
          notes: "",
          newOrderNumber: "",
        });
      }
    } catch (error) {
      console.error("Record RTO Action Error:", error);

      let errorMessage = "Failed to record RTO action";
      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error.data as { message?: string };
        errorMessage = convexError.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsRecordingRtoAction(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "shipped":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "delivered":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "rto":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
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
          <Link to="/backend-skinly/orders">
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
        <Link to="/backend-skinly/orders">
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
            onValueChange={(value) => handleStatusChange(value as "processing" | "shipped" | "delivered" | "cancelled" | "rto")}
          >
            <SelectTrigger className={`w-40 ${getStatusColor(order.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled/Refunded</SelectItem>
              <SelectItem value="rto">RTO</SelectItem>
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

              {/* Manual Tracking Details */}
              {(order.manualTrackingNumber || order.manualCourierCompany) && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="font-medium text-xs text-blue-700 dark:text-blue-300 uppercase mb-1 flex items-center gap-2">
                    <TruckIcon className="size-3" />
                    Manual Tracking (Non-RapidShyp)
                  </p>
                  {order.manualTrackingNumber && (
                    <p className="text-sm">
                      <span className="font-medium">Tracking Number:</span> {order.manualTrackingNumber}
                    </p>
                  )}
                  {order.manualCourierCompany && (
                    <p className="text-sm">
                      <span className="font-medium">Courier:</span> {order.manualCourierCompany}
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
                    <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={cancellingShipment}
                        >
                          <XCircleIcon className="size-4 mr-2" />
                          Cancel Shipment
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Cancel Shipment</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to cancel this shipment?
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-900">
                              <strong>Warning:</strong> This will cancel the shipment with RapidShyp and reset the order status to Processing. All shipping information (AWB, tracking URL, label) will be removed.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowCancelDialog(false)}
                            disabled={cancellingShipment}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleCancelShipment}
                            disabled={cancellingShipment}
                          >
                            {cancellingShipment ? (
                              <>
                                <Spinner className="size-4 mr-2" />
                                Cancelling...
                              </>
                            ) : (
                              "Confirm Cancel"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}

                {/* Manual Tracking Button */}
                <Dialog open={showManualTrackingDialog} onOpenChange={setShowManualTrackingDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant={order.manualTrackingNumber ? "outline" : "default"}
                      className="flex-1"
                      onClick={() => {
                        setManualTrackingForm({
                          trackingNumber: order.manualTrackingNumber || "",
                          courierCompany: order.manualCourierCompany || "",
                        });
                      }}
                    >
                      <TruckIcon className="size-4 mr-2" />
                      {order.manualTrackingNumber ? "Edit Manual Tracking" : "Add Manual Tracking"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {order.manualTrackingNumber ? "Edit" : "Add"} Manual Tracking
                      </DialogTitle>
                      <DialogDescription>
                        Add tracking details for orders shipped through non-RapidShyp couriers. 
                        {order.status === "processing" && " Order status will be updated to shipped."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="manual-tracking">Tracking Number *</Label>
                        <Input
                          id="manual-tracking"
                          placeholder="Enter tracking number"
                          value={manualTrackingForm.trackingNumber}
                          onChange={(e) =>
                            setManualTrackingForm({
                              ...manualTrackingForm,
                              trackingNumber: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="manual-courier">Courier Company *</Label>
                        <Input
                          id="manual-courier"
                          placeholder="e.g., Blue Dart, DTDC, India Post"
                          value={manualTrackingForm.courierCompany}
                          onChange={(e) =>
                            setManualTrackingForm({
                              ...manualTrackingForm,
                              courierCompany: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowManualTrackingDialog(false)}
                        disabled={isSavingManualTracking}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveManualTracking}
                        disabled={isSavingManualTracking}
                      >
                        {isSavingManualTracking ? (
                          <>
                            <Spinner className="size-4 mr-2" />
                            Saving...
                          </>
                        ) : (
                          "Save Manual Tracking"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Restocking - Only show for cancelled/RTO orders */}
          {(order.status === "cancelled" || order.status === "rto") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageXIcon className="size-5" />
                  Inventory Restocking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.restockingHistory && order.restockingHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckIcon className="size-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        Inventory has been restocked
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Restocking History
                      </p>
                      {order.restockingHistory.map((entry, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <p className="font-medium">
                            {formatRestockDate(entry.restockedAt)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            By: {entry.restockedBy}
                          </p>
                          <div className="mt-2 space-y-1">
                            {entry.items.map((item, itemIdx) => (
                              <p key={itemIdx} className="text-xs">
                                • {item.sku} × {item.quantity}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedItems(new Set(order.items.map((i) => i.variant)));
                        setShowRestockDialog(true);
                      }}
                    >
                      <RotateCcwIcon className="size-4 mr-2" />
                      Restock Again
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <PackageXIcon className="size-4 text-amber-600" />
                      <span className="text-sm text-amber-900">
                        Inventory has not been restocked yet
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSelectedItems(new Set(order.items.map((i) => i.variant)));
                        setShowRestockDialog(true);
                      }}
                    >
                      <RotateCcwIcon className="size-4 mr-2" />
                      Restock Inventory
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Refund to Wallet - Only show for cancelled/RTO orders */}
          {(order.status === "cancelled" || order.status === "rto") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BanknoteIcon className="size-5" />
                  Refund to Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.refundedToWallet ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckIcon className="size-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        Refunded to customer's wallet
                      </span>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Refund Amount:</span>
                        <span className="font-semibold">₹{order.refundAmount?.toFixed(0)}</span>
                      </div>
                      {order.refundedAt && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Date: </span>
                          <span>{formatRestockDate(order.refundedAt)}</span>
                        </div>
                      )}
                      {order.refundedBy && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">By: </span>
                          <span>{order.refundedBy}</span>
                        </div>
                      )}
                      {order.refundReason && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span>{order.refundReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <BanknoteIcon className="size-4 text-blue-600" />
                      <span className="text-sm text-blue-900">
                        No refund processed yet
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setRefundForm({ amount: order.total.toString(), reason: "" });
                        setShowRefundDialog(true);
                      }}
                    >
                      <BanknoteIcon className="size-4 mr-2" />
                      Process Refund
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* RTO Management - Only show for RTO orders */}
          {order.status === "rto" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircleIcon className="size-5" />
                  RTO Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* RTO Action History */}
                {order.rtoActions && order.rtoActions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <PackageOpenIcon className="size-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {order.rtoActions.length} RTO {order.rtoActions.length === 1 ? "action" : "actions"} recorded
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">
                        Action History
                      </p>
                      {order.rtoActions.map((action, idx) => {
                        const actionLabels = {
                          restocked: { label: "Inventory Restocked", color: "text-green-600", icon: RotateCcwIcon },
                          resent: { label: "Package Resent", color: "text-indigo-600", icon: RefreshCwIcon },
                          resolved: { label: "Marked as Resolved", color: "text-purple-600", icon: CheckIcon },
                        };
                        const actionInfo = actionLabels[action.actionType];
                        const ActionIcon = actionInfo.icon;

                        return (
                          <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                            <div className="flex items-center gap-2">
                              <ActionIcon className={`size-4 ${actionInfo.color}`} />
                              <span className="font-medium">{actionInfo.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatRestockDate(action.actionAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              By: {action.actionBy}
                            </p>
                            {action.notes && (
                              <p className="text-xs">
                                <span className="text-muted-foreground">Notes: </span>
                                <span>{action.notes}</span>
                              </p>
                            )}
                            {action.newOrderNumber && (
                              <p className="text-xs">
                                <span className="text-muted-foreground">New Order: </span>
                                <span className="font-mono font-medium">{action.newOrderNumber}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowRtoActionDialog(true)}
                    >
                      <AlertCircleIcon className="size-4 mr-2" />
                      Record Another Action
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <AlertCircleIcon className="size-4 text-orange-600" />
                      <span className="text-sm text-orange-900">
                        No RTO actions recorded yet
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setShowRtoActionDialog(true)}
                    >
                      <AlertCircleIcon className="size-4 mr-2" />
                      Record RTO Action
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
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

      {/* Refund to Wallet Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund to Wallet</DialogTitle>
            <DialogDescription>
              Process a refund and credit the amount to customer's wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="refund-amount">Refund Amount (₹)</Label>
              <Input
                id="refund-amount"
                type="number"
                min="0"
                max={order.total}
                step="0.01"
                placeholder="Enter refund amount"
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: ₹{order.total.toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="refund-reason">Reason (Optional)</Label>
              <Input
                id="refund-reason"
                placeholder="Enter reason for refund"
                value={refundForm.reason}
                onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
              />
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> The refund amount will be credited to the customer's Skinly Wallet and can be used on their next purchase.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRefundDialog(false);
                setRefundForm({ amount: "", reason: "" });
              }}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRefund}
              disabled={isRefunding || !refundForm.amount || parseFloat(refundForm.amount) <= 0}
            >
              {isRefunding ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <BanknoteIcon className="size-4 mr-2" />
                  Confirm Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Inventory Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restock Inventory</DialogTitle>
            <DialogDescription>
              Select which items to restock from this {order.status} order
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {inventoryData === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : inventoryData && inventoryData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b">
                  <Checkbox
                    checked={selectedItems.size === order.items.length && selectedItems.size > 0}
                    onCheckedChange={handleSelectAllItems}
                  />
                  <span className="text-sm font-medium">Select All Items</span>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {inventoryData.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedItems.has(item.sku)}
                        onCheckedChange={(checked) =>
                          handleSelectItem(item.sku, checked as boolean)
                        }
                      />
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm">{item.productTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.sku} • Variant: {item.variantTitle}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Order Qty: <span className="font-medium text-foreground">{item.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Current Inventory: <span className="font-medium text-foreground">{item.currentInventory}</span>
                          </span>
                          <span className="text-green-600">
                            → After Restock: <span className="font-semibold">{item.currentInventory + item.quantity}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No inventory data available
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRestockDialog(false);
                setSelectedItems(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestock}
              disabled={selectedItems.size === 0 || isRestocking}
            >
              {isRestocking ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Restocking...
                </>
              ) : (
                <>
                  <RotateCcwIcon className="size-4 mr-2" />
                  Restock {selectedItems.size} Item{selectedItems.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RTO Action Dialog */}
      <Dialog open={showRtoActionDialog} onOpenChange={setShowRtoActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record RTO Action</DialogTitle>
            <DialogDescription>
              Record what action was taken for this RTO (Return to Origin) order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rto-action-type">Action Type *</Label>
              <Select
                value={rtoActionForm.actionType}
                onValueChange={(value: "restocked" | "resent" | "resolved") =>
                  setRtoActionForm({ ...rtoActionForm, actionType: value })
                }
              >
                <SelectTrigger id="rto-action-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restocked">Inventory Restocked</SelectItem>
                  <SelectItem value="resent">Package Resent</SelectItem>
                  <SelectItem value="resolved">Marked as Resolved</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {rtoActionForm.actionType === "restocked" && "Record that inventory was restocked"}
                {rtoActionForm.actionType === "resent" && "Record that the package was resent to the customer"}
                {rtoActionForm.actionType === "resolved" && "Mark this RTO as resolved without further action"}
              </p>
            </div>

            {rtoActionForm.actionType === "resent" && (
              <div>
                <Label htmlFor="new-order-number">New Order Number *</Label>
                <Input
                  id="new-order-number"
                  placeholder="e.g., ORD-1234567890-C"
                  value={rtoActionForm.newOrderNumber}
                  onChange={(e) =>
                    setRtoActionForm({ ...rtoActionForm, newOrderNumber: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the new order number (typically with -C suffix)
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="rto-notes">Notes (Optional)</Label>
              <Textarea
                id="rto-notes"
                placeholder="Add any additional notes about this action..."
                value={rtoActionForm.notes}
                onChange={(e) =>
                  setRtoActionForm({ ...rtoActionForm, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRtoActionDialog(false);
                setRtoActionForm({
                  actionType: "resolved",
                  notes: "",
                  newOrderNumber: "",
                });
              }}
              disabled={isRecordingRtoAction}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordRtoAction}
              disabled={
                isRecordingRtoAction ||
                (rtoActionForm.actionType === "resent" && !rtoActionForm.newOrderNumber.trim())
              }
            >
              {isRecordingRtoAction ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Recording...
                </>
              ) : (
                <>
                  <AlertCircleIcon className="size-4 mr-2" />
                  Record Action
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
