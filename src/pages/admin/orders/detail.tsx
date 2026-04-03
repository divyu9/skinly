import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Link, useParams } from "react-router-dom";
import { PackageIcon, ArrowLeftIcon } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

import { OrderHeader, type OrderStatus, type PaymentStatus } from "./_components/OrderHeader.tsx";
import { CustomerInfoCard, type CustomerFormData, type AddressFormData } from "./_components/CustomerInfoCard.tsx";
import { OrderItemsTable, type ItemFormEntry } from "./_components/OrderItemsTable.tsx";
import { PaymentRefundPanel, type RefundFormData } from "./_components/PaymentRefundPanel.tsx";
import { ShippingTrackingPanel, type ShippingFormData, type ManualTrackingFormData } from "./_components/ShippingTrackingPanel.tsx";
import { RtoActionsPanel, type RtoActionFormData } from "./_components/RtoActionsPanel.tsx";
import { WhatsAppPanel, type EmailType } from "./_components/WhatsAppPanel.tsx";

function OrderDetailPageInner() {
  const { orderId } = useParams<{ orderId: string }>();

  // ── Queries ────────────────────────────────────────────────────────────────
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

  // ── Mutations & Actions ────────────────────────────────────────────────────
  const updateOrderStatus = useMutation(api.admin.orders.updateOrderStatus);
  const updatePaymentStatus = useMutation(api.admin.orders.updateOrderPaymentStatus);
  const updateShippingInfo = useMutation(api.admin.orders.updateShippingInfo);
  const sendOrderEmail = useMutation(api.admin.orders.sendOrderStatusEmail);
  const sendOrderWhatsApp = useMutation(api.admin.orders.sendOrderStatusWhatsApp);
  const updateCustomerInfo = useMutation(api.admin.orders.updateCustomerInfo);
  const updateShippingAddress = useMutation(api.admin.orders.updateOrderShippingAddress);
  const updateOrderItems = useMutation(api.admin.orders.updateOrderItems);
  const createShipment = useAction(api.rapidshyp.createShipment);
  const cancelShipment = useAction(api.rapidshyp.cancelShipment);
  const restockInventory = useMutation(api.admin.orders.restockInventory);
  const refundToWallet = useMutation(api.admin.orders.refundToWallet);
  const saveManualTracking = useMutation(api.admin.manualTracking.saveManualTracking);
  const recordRtoAction = useMutation(api.admin.orders.recordRtoAction);

  // ── State ──────────────────────────────────────────────────────────────────
  const [editingShipping, setEditingShipping] = useState(false);
  const [shippingForm, setShippingForm] = useState<ShippingFormData>({
    awbNumber: "", trackingUrl: "", shippingStatus: "",
  });

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailDialogData, setEmailDialogData] = useState<{
    newStatus?: string; oldStatus?: string; isPaymentStatus?: boolean;
  }>({});
  const [selectedEmailType, setSelectedEmailType] = useState<EmailType>("order_confirmed");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false);
  const [showEditItemsDialog, setShowEditItemsDialog] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerFormData>({ fullName: "", phone: "", email: "" });
  const [addressForm, setAddressForm] = useState<AddressFormData>({
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
  });
  const [itemsForm, setItemsForm] = useState<ItemFormEntry[]>([]);

  const [creatingShipment, setCreatingShipment] = useState(false);
  const [cancellingShipment, setCancellingShipment] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isRestocking, setIsRestocking] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundForm, setRefundForm] = useState<RefundFormData>({ amount: "", reason: "" });

  const [showManualTrackingDialog, setShowManualTrackingDialog] = useState(false);
  const [manualTrackingForm, setManualTrackingForm] = useState<ManualTrackingFormData>({
    trackingNumber: "", courierCompany: "",
  });
  const [isSavingManualTracking, setIsSavingManualTracking] = useState(false);

  const [showRtoActionDialog, setShowRtoActionDialog] = useState(false);
  const [rtoActionForm, setRtoActionForm] = useState<RtoActionFormData>({
    actionType: "resolved", notes: "", newOrderNumber: "",
  });
  const [isRecordingRtoAction, setIsRecordingRtoAction] = useState(false);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStatusChange = async (status: OrderStatus) => {
    if (!orderId || !order) return;
    try {
      const oldStatus = order.status;
      const result = await updateOrderStatus({ orderId: orderId as Id<"orders">, status });
      if (result.whatsappErrors && result.whatsappErrors.length > 0) {
        toast.warning("Status updated but WhatsApp notification failed", {
          description: result.whatsappErrors[0], duration: 8000,
        });
      } else {
        toast.success("Order status and WhatsApp notification sent");
      }
      let defaultEmailType: EmailType = "order_confirmed";
      if (status === "processing") defaultEmailType = "order_confirmed";
      else if (status === "shipped") defaultEmailType = "order_dispatched";
      else if (status === "delivered") defaultEmailType = "order_delivered";
      else if (status === "cancelled") defaultEmailType = "order_cancelled";
      setSelectedEmailType(defaultEmailType);
      setEmailDialogData({ newStatus: status, oldStatus, isPaymentStatus: false });
      setSendWhatsApp(true);
      setShowEmailDialog(true);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handlePaymentStatusChange = async (paymentStatus: PaymentStatus) => {
    if (!orderId || !order) return;
    try {
      const oldPaymentStatus = order.paymentStatus;
      await updatePaymentStatus({ orderId: orderId as Id<"orders">, paymentStatus });
      toast.success("Payment status updated");
      if (paymentStatus === "failed") {
        setSelectedEmailType("payment_failed");
        setEmailDialogData({ newStatus: paymentStatus, oldStatus: oldPaymentStatus, isPaymentStatus: true });
        setSendWhatsApp(true);
        setShowEmailDialog(true);
      }
    } catch {
      toast.error("Failed to update payment status");
    }
  };

  const handleSendEmail = async () => {
    if (!orderId) return;
    setSendingEmail(true);
    try {
      let emailSent = false;
      let whatsappSent = false;
      await sendOrderEmail({ orderId: orderId as Id<"orders">, emailType: selectedEmailType });
      emailSent = true;
      if (sendWhatsApp) {
        try {
          await sendOrderWhatsApp({ orderId: orderId as Id<"orders">, whatsappType: selectedEmailType });
          whatsappSent = true;
        } catch (whatsappError) {
          console.error("WhatsApp send failed:", whatsappError);
          toast.warning("Email sent, but WhatsApp notification failed");
        }
      }
      if (emailSent && whatsappSent) toast.success("Email and WhatsApp sent successfully!");
      else if (emailSent) toast.success("Email sent successfully!");
      setShowEmailDialog(false);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleUpdateCustomerInfo = async () => {
    if (!orderId || !order) return;
    try {
      await updateCustomerInfo({
        orderId: orderId as Id<"orders">,
        fullName: customerForm.fullName,
        phone: customerForm.phone,
        customerEmail: order.userId ? customerForm.email : undefined,
        guestEmail: !order.userId ? customerForm.email : undefined,
      });
      toast.success("Customer information updated");
      setShowEditCustomerDialog(false);
    } catch {
      toast.error("Failed to update customer information");
    }
  };

  const handleUpdateShippingAddress = async () => {
    if (!orderId) return;
    try {
      await updateShippingAddress({ orderId: orderId as Id<"orders">, ...addressForm });
      toast.success("Shipping address updated");
      setShowEditAddressDialog(false);
    } catch {
      toast.error("Failed to update shipping address");
    }
  };

  const handleUpdateOrderItems = async () => {
    if (!orderId) return;
    try {
      await updateOrderItems({ orderId: orderId as Id<"orders">, items: itemsForm });
      toast.success("Order items updated");
      setShowEditItemsDialog(false);
    } catch {
      toast.error("Failed to update order items");
    }
  };

  const handleShippingUpdate = async () => {
    if (!orderId) return;
    try {
      await updateShippingInfo({ orderId: orderId as Id<"orders">, ...shippingForm });
      toast.success("Shipping information updated");
      setEditingShipping(false);
      setShippingForm({ awbNumber: "", trackingUrl: "", shippingStatus: "" });
    } catch {
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
      let errorMessage = "Failed to create shipment";
      let errorDetails = "";
      if (error && typeof error === "object" && "data" in error) {
        const e = error.data as { message?: string; code?: string };
        errorMessage = e.message || errorMessage;
        errorDetails = e.code || "";
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
      let errorMessage = "Failed to cancel shipment";
      let errorDetails = "";
      if (error && typeof error === "object" && "data" in error) {
        const e = error.data as { message?: string; code?: string };
        errorMessage = e.message || errorMessage;
        errorDetails = e.code || "";
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
    if (checked && order) setSelectedItems(new Set(order.items.map((i) => i.variant)));
    else setSelectedItems(new Set());
  };

  const handleSelectItem = (sku: string, checked: boolean) => {
    const next = new Set(selectedItems);
    if (checked) next.add(sku); else next.delete(sku);
    setSelectedItems(next);
  };

  const handleRestock = async () => {
    if (!orderId || !order) return;
    setIsRestocking(true);
    try {
      const itemsToRestock = order.items
        .filter((item) => selectedItems.has(item.variant))
        .map((item) => ({ variant: item.variant, quantity: item.quantity }));
      const result = await restockInventory({ orderId: orderId as Id<"orders">, itemsToRestock });
      if (result.success) {
        toast.success(`Successfully restocked ${itemsToRestock.length} item(s)`);
        setShowRestockDialog(false);
        setSelectedItems(new Set());
      } else {
        const failed = result.results.filter((r) => !r.success);
        toast.error(`Failed to restock ${failed.length} item(s)`, {
          description: failed.map((r) => `${r.sku}: ${r.error}`).join(", "),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restock inventory");
    } finally {
      setIsRestocking(false);
    }
  };

  const handleRefund = async () => {
    if (!orderId || !order) return;
    const amount = parseFloat(refundForm.amount);
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid refund amount"); return; }
    if (amount > order.total) { toast.error(`Refund amount cannot exceed order total (₹${order.total})`); return; }
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
      let msg = "Failed to process refund";
      if (error && typeof error === "object" && "data" in error) {
        const e = error.data as { message?: string };
        msg = e.message || msg;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg);
    } finally {
      setIsRefunding(false);
    }
  };

  const handleSaveManualTracking = async () => {
    if (!orderId) return;
    if (!manualTrackingForm.trackingNumber.trim()) { toast.error("Tracking number is required"); return; }
    if (!manualTrackingForm.courierCompany.trim()) { toast.error("Courier company is required"); return; }
    setIsSavingManualTracking(true);
    try {
      const result = await saveManualTracking({
        orderId: orderId as Id<"orders">,
        trackingNumber: manualTrackingForm.trackingNumber,
        courierCompany: manualTrackingForm.courierCompany,
      });
      if (result.success) {
        const statusMsg = result.statusUpdated ? " Order status updated to shipped." : "";
        toast.success(`Manual tracking saved successfully!${statusMsg}`);
        setShowManualTrackingDialog(false);
        setManualTrackingForm({ trackingNumber: "", courierCompany: "" });
      }
    } catch (error) {
      let msg = "Failed to save manual tracking";
      if (error && typeof error === "object" && "data" in error) {
        const e = error.data as { message?: string };
        msg = e.message || msg;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg);
    } finally {
      setIsSavingManualTracking(false);
    }
  };

  const handleRecordRtoAction = async () => {
    if (!orderId) return;
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
        const labels = { restocked: "Inventory Restocked", resent: "Package Resent", resolved: "Marked as Resolved" };
        toast.success(`RTO action recorded: ${labels[result.actionType]}`);
        setShowRtoActionDialog(false);
        setRtoActionForm({ actionType: "resolved", notes: "", newOrderNumber: "" });
      }
    } catch (error) {
      let msg = "Failed to record RTO action";
      if (error && typeof error === "object" && "data" in error) {
        const e = error.data as { message?: string };
        msg = e.message || msg;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg);
    } finally {
      setIsRecordingRtoAction(false);
    }
  };

  // ── Loading / empty states ─────────────────────────────────────────────────

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
          <EmptyMedia variant="icon"><PackageIcon /></EmptyMedia>
          <EmptyTitle>Order not found</EmptyTitle>
          <EmptyDescription>
            This order does not exist or you don't have permission to view it
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/backend-skinly/orders"><Button>Back to Orders</Button></Link>
        </EmptyContent>
      </Empty>
    );
  }

  const orderEmail = order.user?.email || order.customerEmail || order.guestEmail;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Link to="/backend-skinly/orders">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="size-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
      </div>

      {/* Header: order number + status dropdowns */}
      <OrderHeader
        orderNumber={order.orderNumber}
        creationTime={order._creationTime}
        status={order.status}
        paymentStatus={order.paymentStatus}
        onStatusChange={handleStatusChange}
        onPaymentStatusChange={handlePaymentStatusChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <OrderItemsTable
            items={order.items as any}
            showEditItemsDialog={showEditItemsDialog}
            itemsForm={itemsForm}
            onOpenEditItems={() => { setItemsForm([...order.items]); setShowEditItemsDialog(true); }}
            onCloseEditItems={() => setShowEditItemsDialog(false)}
            onItemsFormChange={setItemsForm}
            onSaveItems={handleUpdateOrderItems}
          />

          <ShippingTrackingPanel
            awbNumber={order.awbNumber}
            trackingUrl={order.trackingUrl}
            shippingStatus={order.shippingStatus}
            courierName={order.courierName}
            labelUrl={order.labelUrl}
            manualTrackingNumber={order.manualTrackingNumber}
            manualCourierCompany={order.manualCourierCompany}
            orderStatus={order.status}
            creatingShipment={creatingShipment}
            cancellingShipment={cancellingShipment}
            onCreateShipment={handleCreateShipment}
            editingShipping={editingShipping}
            shippingForm={shippingForm}
            onOpenEditShipping={() => {
              setShippingForm({
                awbNumber: order.awbNumber || "",
                trackingUrl: order.trackingUrl || "",
                shippingStatus: order.shippingStatus || "",
              });
              setEditingShipping(true);
            }}
            onCloseEditShipping={setEditingShipping}
            onShippingFormChange={setShippingForm}
            onSaveShipping={handleShippingUpdate}
            showCancelDialog={showCancelDialog}
            onOpenCancelDialog={setShowCancelDialog}
            onConfirmCancelShipment={handleCancelShipment}
            showManualTrackingDialog={showManualTrackingDialog}
            manualTrackingForm={manualTrackingForm}
            isSavingManualTracking={isSavingManualTracking}
            onOpenManualTracking={() => {
              setManualTrackingForm({
                trackingNumber: order.manualTrackingNumber || "",
                courierCompany: order.manualCourierCompany || "",
              });
              setShowManualTrackingDialog(true);
            }}
            onCloseManualTracking={(open) => setShowManualTrackingDialog(open)}
            onManualTrackingFormChange={setManualTrackingForm}
            onSaveManualTracking={handleSaveManualTracking}
          />

          <RtoActionsPanel
            orderStatus={order.status}
            inventoryData={inventoryData}
            restockingHistory={order.restockingHistory}
            showRestockDialog={showRestockDialog}
            selectedItems={selectedItems}
            isRestocking={isRestocking}
            onOpenRestock={() => { setSelectedItems(new Set(order.items.map((i) => i.variant))); setShowRestockDialog(true); }}
            onCloseRestock={() => { setShowRestockDialog(false); setSelectedItems(new Set()); }}
            onSelectAll={handleSelectAllItems}
            onSelectItem={handleSelectItem}
            onConfirmRestock={handleRestock}
            rtoActions={order.rtoActions}
            showRtoActionDialog={showRtoActionDialog}
            rtoActionForm={rtoActionForm}
            isRecordingRtoAction={isRecordingRtoAction}
            onOpenRtoAction={() => setShowRtoActionDialog(true)}
            onCloseRtoAction={() => {
              setShowRtoActionDialog(false);
              setRtoActionForm({ actionType: "resolved", notes: "", newOrderNumber: "" });
            }}
            onRtoActionFormChange={setRtoActionForm}
            onConfirmRtoAction={handleRecordRtoAction}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <CustomerInfoCard
            shippingAddress={order.shippingAddress}
            email={orderEmail}
            showEditCustomerDialog={showEditCustomerDialog}
            customerForm={customerForm}
            onOpenEditCustomer={() => {
              setCustomerForm({
                fullName: order.shippingAddress.fullName,
                phone: order.shippingAddress.phone,
                email: orderEmail || "",
              });
              setShowEditCustomerDialog(true);
            }}
            onCloseEditCustomer={() => setShowEditCustomerDialog(false)}
            onCustomerFormChange={setCustomerForm}
            onSaveCustomer={handleUpdateCustomerInfo}
            showEditAddressDialog={showEditAddressDialog}
            addressForm={addressForm}
            onOpenEditAddress={() => {
              setAddressForm({
                addressLine1: order.shippingAddress.addressLine1,
                addressLine2: order.shippingAddress.addressLine2 || "",
                city: order.shippingAddress.city,
                state: order.shippingAddress.state,
                pincode: order.shippingAddress.pincode,
              });
              setShowEditAddressDialog(true);
            }}
            onCloseEditAddress={() => setShowEditAddressDialog(false)}
            onAddressFormChange={setAddressForm}
            onSaveAddress={handleUpdateShippingAddress}
          />

          <PaymentRefundPanel
            paymentMethod={order.paymentMethod}
            total={order.total}
            subtotal={order.subtotal}
            shippingFee={order.shippingFee}
            codFee={order.codFee}
            prepaidAmount={order.prepaidAmount}
            codAmount={order.codAmount}
            totalGstAmount={order.totalGstAmount}
            cgstAmount={order.cgstAmount}
            sgstAmount={order.sgstAmount}
            cgstRate={order.cgstRate}
            sgstRate={order.sgstRate}
            igstAmount={order.igstAmount}
            igstRate={order.igstRate}
            refundedToWallet={order.refundedToWallet}
            refundAmount={order.refundAmount}
            refundedAt={order.refundedAt}
            refundedBy={order.refundedBy}
            refundReason={order.refundReason}
            orderStatus={order.status}
            showRefundDialog={showRefundDialog}
            refundForm={refundForm}
            isRefunding={isRefunding}
            onOpenRefund={() => { setRefundForm({ amount: order.total.toString(), reason: "" }); setShowRefundDialog(true); }}
            onCloseRefund={() => setShowRefundDialog(false)}
            onRefundFormChange={setRefundForm}
            onConfirmRefund={handleRefund}
          />
        </div>
      </div>

      {/* Email / WhatsApp notification dialog */}
      <WhatsAppPanel
        showEmailDialog={showEmailDialog}
        emailDialogData={emailDialogData}
        selectedEmailType={selectedEmailType}
        sendingEmail={sendingEmail}
        sendWhatsApp={sendWhatsApp}
        onCloseEmailDialog={() => setShowEmailDialog(false)}
        onEmailTypeChange={setSelectedEmailType}
        onSendWhatsAppChange={setSendWhatsApp}
        onSendEmail={handleSendEmail}
      />
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><PackageIcon /></EmptyMedia>
            <EmptyTitle>Please sign in to access admin</EmptyTitle>
            <EmptyDescription>You need to be logged in to view order details</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><SignInButton /></EmptyContent>
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
