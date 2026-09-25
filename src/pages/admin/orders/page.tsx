import { useQuery, useAction, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PackageIcon, SearchIcon, TruckIcon, IndianRupeeIcon, FileTextIcon, ListChecksIcon, PackageCheckIcon, FileDownIcon, LoaderIcon, CalendarIcon, PlusIcon, AlertTriangleIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import type { Id } from "@/lib/firebase-api";
import { PDFDocument } from "pdf-lib";
import { ManualOrderDialog } from "./manual-order-dialog.tsx";
import { ORDER_STATUSES } from "@/lib/normalize-order.ts";
import { ADMIN_STATUS_LABELS, STATUS_BADGE, STATUS_DOT } from "@/lib/order-label.ts";

type DateFilter = "7" | "15" | "30" | "60" | "90" | "custom" | "all";

function AdminOrdersPageInner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /*
   * ?q= seeds the search, so "See orders" on a customer lands here already
   * filtered to them. The tab widens to All at the same time, or a customer
   * whose orders are all delivered would open on an empty Processing list.
   */
  const [statusFilter, setStatusFilter] = useState<string>(params.get("q") ? "all" : "processing");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState(params.get("q") || "");
  const [selectedOrders, setSelectedOrders] = useState<Set<Id<"orders">>>(new Set());

  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Bulk operations state
  const [showBulkShipDialog, setShowBulkShipDialog] = useState(false);
  const [showBulkLabelsDialog, setShowBulkLabelsDialog] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    type: "ship" | "labels";
    successful: number;
    failed: number;
    details: Array<{ orderNumber: string; error?: string; awb?: string }>;
  } | null>(null);

  // Manual order dialog state
  const [showManualOrderDialog, setShowManualOrderDialog] = useState(false);
  
  // Bulk status change state
  const [showBulkOrderStatusDialog, setShowBulkOrderStatusDialog] = useState(false);
  const [showBulkPaymentStatusDialog, setShowBulkPaymentStatusDialog] = useState(false);
  const [bulkNewOrderStatus, setBulkNewOrderStatus] = useState("processing");
  const [bulkNewPaymentStatus, setBulkNewPaymentStatus] = useState("success");

  // Actions
  const bulkCreateShipments = useAction(api.rapidshyp.bulkCreateShipments);
  const bulkFetchLabels = useAction(api.rapidshyp.bulkFetchLabels);
  const softDeleteOrders = useMutation(api.admin.orders.softDeleteOrders);
  const restoreOrders = useMutation(api.admin.orders.restoreOrders);
  const bulkUpdateOrderStatus = useMutation(api.admin.orders.bulkUpdateOrderStatus);
  const bulkUpdatePaymentStatus = useMutation(api.admin.orders.bulkUpdatePaymentStatus);

  const stats = useQuery(api.admin.orders.getOrderStats);
  const allOrders = useQuery(api.admin.orders.getAllOrders, {
    status: statusFilter === "failed" || statusFilter === "deleted" || statusFilter === "all" ? undefined : statusFilter,
    paymentStatus: statusFilter === "failed" ? "failed" : (paymentFilter !== "all" ? paymentFilter : undefined),
    showDeleted: statusFilter === "deleted",
  });
  const searchResults = useQuery(
    api.admin.orders.searchOrders,
    searchTerm.length >= 3 ? { searchTerm } : "skip"
  );

  const baseOrders = searchTerm.length >= 3 ? searchResults : allOrders;
  
  // Apply date filter to orders
  const displayOrders = useMemo(() => {
    if (!baseOrders) return undefined;
    if (dateFilter === "all") return baseOrders;
    
    let filtered = [...baseOrders];
    const now = Date.now();
    
    if (dateFilter === "custom") {
      if (customStartDate) {
        const startTime = customStartDate.getTime();
        filtered = filtered.filter(order => order._creationTime >= startTime);
      }
      if (customEndDate) {
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => order._creationTime <= endDate.getTime());
      }
    } else {
      const days = parseInt(dateFilter);
      const startTime = now - (days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(order => order._creationTime >= startTime);
    }
    
    return filtered;
  }, [baseOrders, dateFilter, customStartDate, customEndDate]);

  const computedStats = useMemo<Record<string, number>>(() => {
    // Zeroes rather than null: the render below dereferences every field, and
    // it is only safe today because of an early return three hundred lines
    // away. Moving that guard would turn this into a blank admin page.
    //
    // One counter per status, taken off the list itself, so a status added to
    // the vocabulary gets its tab and its number without being named here too.
    const blank = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    if (!displayOrders) return {
      ...blank, total: 0, failed: 0, deleted: 0, totalRevenue: 0, pendingPayments: 0,
    };
    return {
      ...blank,
      ...Object.fromEntries(
        ORDER_STATUSES.map((s) => [s, displayOrders.filter((o: any) => o.status === s).length])
      ),
      total: displayOrders.length,
      failed: displayOrders.filter((o) => normalizePaymentStatus(o.paymentStatus) === "failed").length,
      deleted: displayOrders.filter((o) => o.isDeleted).length,
      totalRevenue: displayOrders
        .filter((o) => normalizePaymentStatus(o.paymentStatus) === "success")
        .reduce((sum, o) => sum + (o.total || 0), 0),
      pendingPayments: displayOrders.filter(
        (o) => normalizePaymentStatus(o.paymentStatus) === "pending" || !o.paymentStatus
      ).length,
      successfulPayments: displayOrders.filter((o) => normalizePaymentStatus(o.paymentStatus) === "success")
        .length,
      failedPayments: displayOrders.filter((o) => normalizePaymentStatus(o.paymentStatus) === "failed")
        .length,
    };
  }, [displayOrders]);

  const getStatusColor = (status: string) => STATUS_BADGE[status] || "";

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

  function normalizePaymentStatus(value: any) {
    const v = String(value || "").toLowerCase();
    if (v === "paid") return "success";
    if (v === "pending") return "pending";
    if (v === "success") return "success";
    if (v === "failed") return "failed";
    return value;
  }

  function toMillis(value: any): number {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return 0;
  }

  function formatDate(timestamp: any) {
    const ts = toMillis(timestamp);
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * "14 min ago" — how fresh a courier update is, which is the only thing
   * anyone wants to know about one at a glance.
   */
  function timeAgo(ts: number): string {
    const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (secs < 60) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
  }

  const handleSelectOrder = (orderId: Id<"orders">, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && displayOrders) {
      setSelectedOrders(new Set(displayOrders.map((o) => o._id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  // Get valid orders for bulk ship (processing status, no AWB)
  const getValidShipOrders = () => {
    if (!displayOrders) return [];
    return displayOrders.filter((o) => 
      selectedOrders.has(o._id) && 
      o.status === "processing" && 
      !o.awbNumber
    );
  };

  // Get valid orders for bulk labels (shipped status, has labelUrl)
  const getValidLabelOrders = () => {
    if (!displayOrders) return [];
    return displayOrders.filter((o) => 
      selectedOrders.has(o._id) && 
      o.status === "shipped" && 
      o.labelUrl
    );
  };

  const handleBulkShip = async () => {
    const validOrders = getValidShipOrders();
    if (validOrders.length === 0) return;

    setIsProcessingBulk(true);
    setShowBulkShipDialog(false);

    try {
      const results = await bulkCreateShipments({
        orderIds: validOrders.map((o) => o._id),
      });

      setBulkResults({
        type: "ship",
        successful: results.successful.length,
        failed: results.failed.length,
        details: [
          ...results.successful.map((r) => ({
            orderNumber: r.orderNumber,
            awb: r.awbNumber,
          })),
          ...results.failed.map((r) => ({
            orderNumber: r.orderNumber,
            error: r.error,
          })),
        ],
      });

      if (results.successful.length > 0) {
        toast.success(`${results.successful.length} shipments created successfully`);
      }
      if (results.failed.length > 0) {
        toast.error(`${results.failed.length} shipments failed`);
      }

      // Clear selection
      setSelectedOrders(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create shipments");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkFetchLabels = async () => {
    const validOrders = getValidLabelOrders();
    if (validOrders.length === 0) return;

    setIsProcessingBulk(true);
    setShowBulkLabelsDialog(false);

    try {
      const results = await bulkFetchLabels({
        orderIds: validOrders.map((o) => o._id),
      });

      if (results.labels.length === 0) {
        toast.error("No labels found");
        setIsProcessingBulk(false);
        return;
      }

      console.log(`Loading ${results.labels.length} labels for ST4 format`);

      // Load all label PDFs from base64 data (fetched by backend)
      const labelPdfs: Array<{ orderNumber: string; pdf: PDFDocument }> = [];
      const loadErrors: Array<{ orderNumber: string; error: string }> = [];

      for (const label of results.labels) {
        try {
          console.log(`Loading label for ${label.orderNumber}`);
          
          // Convert base64 to bytes
          const base64Data = label.pdfBase64;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          console.log(`Decoded ${bytes.byteLength} bytes for ${label.orderNumber}`);

          if (bytes.byteLength === 0) {
            throw new Error('Empty PDF data');
          }

          const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
          console.log(`Loaded PDF for ${label.orderNumber}, pages: ${pdf.getPageCount()}`);
          
          labelPdfs.push({ orderNumber: label.orderNumber, pdf });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to load label for ${label.orderNumber}:`, errorMsg);
          loadErrors.push({
            orderNumber: label.orderNumber,
            error: errorMsg,
          });
        }
      }

      if (labelPdfs.length === 0) {
        toast.error("Failed to load any labels");
        if (loadErrors.length > 0) {
          setBulkResults({
            type: "labels",
            successful: 0,
            failed: loadErrors.length,
            details: loadErrors.map((e) => ({
              orderNumber: e.orderNumber,
              error: e.error,
            })),
          });
        }
        setIsProcessingBulk(false);
        return;
      }

      console.log(`Successfully loaded ${labelPdfs.length} labels, creating ST4 layout`);

      // Create merged PDF with ST4 layout (2×2 grid on A4 pages)
      const mergedPdf = await PDFDocument.create();
      
      // A4 dimensions in points (72 points = 1 inch)
      const A4_WIDTH = 595.28;  // 210mm
      const A4_HEIGHT = 841.89; // 297mm
      
      // Each label occupies 1/4 of A4 page
      const LABEL_WIDTH = A4_WIDTH / 2;
      const LABEL_HEIGHT = A4_HEIGHT / 2;

      // Process labels in batches of 4 (one A4 page per batch)
      for (let i = 0; i < labelPdfs.length; i += 4) {
        const batch = labelPdfs.slice(i, i + 4);
        
        // Create new A4 page
        const a4Page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        
        // Position labels in 2×2 grid
        const positions = [
          { x: 0, y: LABEL_HEIGHT },           // Top-left
          { x: LABEL_WIDTH, y: LABEL_HEIGHT }, // Top-right
          { x: 0, y: 0 },                      // Bottom-left
          { x: LABEL_WIDTH, y: 0 },            // Bottom-right
        ];

        for (let j = 0; j < batch.length; j++) {
          const { orderNumber, pdf } = batch[j];
          const position = positions[j];
          
          try {
            // Get first page from the label PDF
            const [labelPage] = await mergedPdf.embedPages([pdf.getPages()[0]]);
            
            // Get original dimensions
            const { width: origWidth, height: origHeight } = labelPage;
            
            // Calculate scale to fit in cell while maintaining aspect ratio
            const scaleX = LABEL_WIDTH / origWidth;
            const scaleY = LABEL_HEIGHT / origHeight;
            const scale = Math.min(scaleX, scaleY);
            
            const scaledWidth = origWidth * scale;
            const scaledHeight = origHeight * scale;
            
            // Center label in its cell
            const xOffset = (LABEL_WIDTH - scaledWidth) / 2;
            const yOffset = (LABEL_HEIGHT - scaledHeight) / 2;
            
            // Draw the label on the A4 page
            a4Page.drawPage(labelPage, {
              x: position.x + xOffset,
              y: position.y + yOffset,
              width: scaledWidth,
              height: scaledHeight,
            });
            
            console.log(`Placed label ${orderNumber} at position ${j + 1}/4 on page ${Math.floor(i / 4) + 1}`);
          } catch (error) {
            console.error(`Failed to embed label ${orderNumber}:`, error);
            loadErrors.push({
              orderNumber,
              error: error instanceof Error ? error.message : 'Failed to embed in ST4 layout',
            });
          }
        }
      }

      // Download merged PDF
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `shipping-labels-st4-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalPages = Math.ceil(labelPdfs.length / 4);
      toast.success(`Downloaded ${labelPdfs.length} labels in ST4 format (${totalPages} A4 pages)`);

      if (loadErrors.length > 0 || results.errors.length > 0) {
        setBulkResults({
          type: "labels",
          successful: labelPdfs.length,
          failed: loadErrors.length + results.errors.length,
          details: [
            ...loadErrors.map((e) => ({
              orderNumber: e.orderNumber,
              error: e.error,
            })),
            ...results.errors.map((e) => ({
              orderNumber: e.orderNumber,
              error: e.error,
            })),
          ],
        });
      }

      // Clear selection
      setSelectedOrders(new Set());
    } catch (error) {
      console.error('Bulk fetch labels error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch labels");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleSoftDelete = async () => {
    if (selectedOrders.size === 0) return;
    
    try {
      const result = await softDeleteOrders({
        orderIds: Array.from(selectedOrders),
      });
      toast.success(`${result.deletedCount} order(s) deleted successfully`);
      setSelectedOrders(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete orders");
    }
  };

  const handleRestore = async () => {
    if (selectedOrders.size === 0) return;

    try {
      const result = await restoreOrders({
        orderIds: Array.from(selectedOrders),
      });
      toast.success(`${result.restoredCount} order(s) restored successfully`);
      setSelectedOrders(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore orders");
    }
  };

  const handleBulkOrderStatus = async () => {
    if (selectedOrders.size === 0 || !bulkNewOrderStatus) return;
    try {
      const result = await bulkUpdateOrderStatus({
        orderIds: Array.from(selectedOrders),
        status: bulkNewOrderStatus,
      });
      // The server refuses a move the graph does not allow, so some of a
      // selection can go through and some not. Say which, rather than
      // reporting the whole batch as done.
      if (result.blockedCount) toast.warning(result.message);
      else toast.success(result.message || `${result.updatedCount} order(s) updated`);
      setSelectedOrders(new Set());
      setShowBulkOrderStatusDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order status");
    }
  };

  const handleBulkPaymentStatus = async () => {
    if (selectedOrders.size === 0 || !bulkNewPaymentStatus) return;
    try {
      const result = await bulkUpdatePaymentStatus({
        orderIds: Array.from(selectedOrders),
        paymentStatus: bulkNewPaymentStatus,
      });
      toast.success(`${result.updatedCount} order(s) payment status updated to "${bulkNewPaymentStatus}"`);
      setSelectedOrders(new Set());
      setShowBulkPaymentStatusDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payment status");
    }
  };

  const generatePackList = () => {
    if (!displayOrders || selectedOrders.size === 0) {
      toast.error("Please select orders to generate pack list");
      return;
    }

    const selectedOrdersList = displayOrders.filter((o) =>
      selectedOrders.has(o._id)
    );

    // Create a consolidated SKU list with quantities
    const skuMap: Record<string, { sku: string; quantity: number; orders: string[] }> = {};

    selectedOrdersList.forEach((order) => {
      order.items.forEach((item) => {
        const sku = item.variant; // Using variant as SKU
        const orderRef = order.orderNumber || order.failedOrderNumber || order._id;
        if (skuMap[sku]) {
          skuMap[sku].quantity += item.quantity;
          skuMap[sku].orders.push(orderRef);
        } else {
          skuMap[sku] = {
            sku,
            quantity: item.quantity,
            orders: [orderRef],
          };
        }
      });
    });

    // Generate text content
    let packListText = `PACK LIST - Generated ${new Date().toLocaleString("en-IN")}\n`;
    packListText += `Total Orders: ${selectedOrders.size}\n`;
    packListText += `Total Unique SKUs: ${Object.keys(skuMap).length}\n`;
    packListText += `\n${"=".repeat(80)}\n\n`;

    packListText += `SKU\t\tQuantity\tOrder Numbers\n`;
    packListText += `${"-".repeat(80)}\n`;

    Object.values(skuMap).forEach((item) => {
      packListText += `${item.sku}\t\t${item.quantity}\t\t${item.orders.join(", ")}\n`;
    });

    packListText += `\n${"=".repeat(80)}\n\n`;
    packListText += `DETAILED ORDER ITEMS:\n\n`;

    selectedOrdersList.forEach((order) => {
      packListText += `Order: ${order.orderNumber}\n`;
      packListText += `Customer: ${order.shippingAddress.fullName}\n`;
      packListText += `Phone: ${order.shippingAddress.phone}\n`;
      packListText += `City: ${order.shippingAddress.city}, ${order.shippingAddress.state}\n`;
      packListText += `Items:\n`;
      order.items.forEach((item) => {
        packListText += `  - SKU: ${item.variant} | ${item.productTitle} | Qty: ${item.quantity}`;
        if (item.phoneModel) packListText += ` | Model: ${item.phoneModel}`;
        if (item.coverage) packListText += ` | Coverage: ${item.coverage}`;
        packListText += `\n`;
      });
      packListText += `\n`;
    });

    // Download as text file
    const blob = new Blob([packListText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pack-list-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Pack list generated for ${selectedOrders.size} orders`);
  };

  if (!stats || displayOrders === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  /** A stat tile that also opens the tab it counts. */
  const Tile = ({ label, value, sub, icon: Icon, tone, to }: {
    label: string; value: string; sub: string; icon: any; tone: string; to?: string;
  }) => (
    <button
      type="button"
      onClick={to ? () => setStatusFilter(to) : undefined}
      className={`tile ${to ? "tile-press cursor-pointer" : "cursor-default"} rounded-xl p-4 text-left`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid size-7 place-items-center rounded-md ${tone}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums leading-none">{value}</div>
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </button>
  );

  const inTransit = stats.ready_to_ship + stats.shipped + stats.out_for_delivery;
  const attention = stats.undelivered + stats.rto;

  return (
    <div className="admin-brandy space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          {/* The teal rule is the wordmark's own colour — it says whose shop this is. */}
          <div className="mt-1.5 h-1 w-14 rounded-full bg-brand" />
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.total} orders · {inTransit} on the way · {stats.processing} waiting to be packed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/backend-skinly/tax-export"
            state={selectedOrders.size > 0 ? { selectedOrderIds: Array.from(selectedOrders) } : undefined}
          >
            <Button variant="outline" className="sticker-sm sticker-press rounded-lg">
              <FileTextIcon className="size-4 mr-2" />
              Export for Tax
            </Button>
          </Link>
          <Button className="sticker-sm sticker-press rounded-lg" onClick={() => setShowManualOrderDialog(true)}>
            <PlusIcon className="size-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/*
        Four numbers about the shop, not about whichever tab is open — and each
        one opens the list behind it, because every one of them is a question
        whose next step is "show me which".
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Tile
          label="Revenue" value={`₹${Number(stats.revenue || 0).toLocaleString("en-IN")}`}
          sub={`${stats.paidOrders || 0} paid orders`}
          icon={IndianRupeeIcon} tone="bg-brand/15 text-brand"
        />
        <Tile
          label="To pack" value={String(stats.processing)}
          sub={stats.processing ? "Ready for a label" : "Nothing waiting"}
          icon={PackageIcon} tone="bg-purple-500/15 text-purple-600" to="processing"
        />
        <Tile
          label="On the way" value={String(inTransit)}
          sub={`${stats.delivered} delivered so far`}
          icon={TruckIcon} tone="bg-indigo-500/15 text-indigo-600" to="shipped"
        />
        <Tile
          label="Needs a look" value={String(attention)}
          sub={attention ? "Failed delivery or returned" : "Nothing stuck"}
          icon={attention ? AlertTriangleIcon : PackageCheckIcon}
          tone={attention ? "bg-amber-500/15 text-amber-600" : "bg-green-500/15 text-green-600"}
          to={stats.undelivered ? "undelivered" : "rto"}
        />
      </div>

      {/*
        The pipeline, left to right, in the order a parcel passes through it,
        with the three views that are not stages set apart after a divider.
        A count of zero is dimmed rather than hidden, so the row does not
        reshuffle itself as the day goes on.
      */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max items-center gap-1.5">
          {ORDER_STATUSES.map((st) => {
            const on = statusFilter === st;
            const n = stats[st] || 0;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  on ? `${STATUS_BADGE[st]} border-current` : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`size-2 rounded-full ${STATUS_DOT[st]} ${n ? "" : "opacity-30"}`} />
                {ADMIN_STATUS_LABELS[st]}
                <span className={`tabular-nums text-xs font-semibold ${n ? "" : "opacity-40"}`}>{n}</span>
              </button>
            );
          })}

          <span className="mx-1 h-6 w-px shrink-0 bg-border" />

          {([
            ["failed", "Payment failed", stats.failed],
            ["deleted", "Deleted", stats.deleted],
            ["all", "All", stats.total],
          ] as const).map(([value, label, n]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === value
                  ? "border-current bg-muted text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
              <span className={`tabular-nums text-xs font-semibold ${n ? "" : "opacity-40"}`}>{n || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Order Date:</span>
            </div>
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="15">Last 15 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {customStartDate ? formatDate(customStartDate.getTime()) : "Start Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {customEndDate ? formatDate(customEndDate.getTime()) : "End Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            
            {(dateFilter !== "all" || statusFilter !== "all" || paymentFilter !== "all" || searchTerm.length >= 3) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setDateFilter("all");
                  setStatusFilter("all");
                  setPaymentFilter("all");
                  setSearchTerm("");
                  setCustomStartDate(undefined);
                  setCustomEndDate(undefined);
                }}
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operation Buttons */}
      {displayOrders && displayOrders.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedOrders.size > 0
              ? `${selectedOrders.size} order${selectedOrders.size > 1 ? "s" : ""} selected`
              : "Select orders for bulk operations"}
          </div>
          <div className="flex gap-2">
            {/* Bulk Ship - Processing tab only */}
            {statusFilter === "processing" && (
              <Button
                onClick={() => setShowBulkShipDialog(true)}
                disabled={isProcessingBulk || getValidShipOrders().length === 0}
                variant="default"
              >
                {isProcessingBulk ? (
                  <LoaderIcon className="size-4 mr-2 animate-spin" />
                ) : (
                  <PackageCheckIcon className="size-4 mr-2" />
                )}
                Bulk Ship via RapidShyp ({getValidShipOrders().length})
              </Button>
            )}
            
            {/* Bulk Fetch Labels - Shipped tab only */}
            {statusFilter === "shipped" && (
              <Button
                onClick={() => setShowBulkLabelsDialog(true)}
                disabled={isProcessingBulk || getValidLabelOrders().length === 0}
                variant="default"
              >
                {isProcessingBulk ? (
                  <LoaderIcon className="size-4 mr-2 animate-spin" />
                ) : (
                  <FileDownIcon className="size-4 mr-2" />
                )}
                Bulk Fetch Labels ({getValidLabelOrders().length})
              </Button>
            )}
            
            {/* Bulk Order Status Change */}
            <Button
              onClick={() => setShowBulkOrderStatusDialog(true)}
              disabled={selectedOrders.size === 0}
              variant="outline"
            >
              Change Order Status ({selectedOrders.size})
            </Button>

            {/* Bulk Payment Status Change */}
            <Button
              onClick={() => setShowBulkPaymentStatusDialog(true)}
              disabled={selectedOrders.size === 0}
              variant="outline"
            >
              Change Payment Status ({selectedOrders.size})
            </Button>

            {/* Soft Delete - All tabs except deleted */}
            {statusFilter !== "deleted" && (
              <Button
                onClick={() => handleSoftDelete()}
                disabled={selectedOrders.size === 0}
                variant="destructive"
              >
                Delete Selected ({selectedOrders.size})
              </Button>
            )}

            {/* Restore - Deleted tab only */}
            {statusFilter === "deleted" && (
              <Button
                onClick={() => handleRestore()}
                disabled={selectedOrders.size === 0}
                variant="default"
              >
                Restore Selected ({selectedOrders.size})
              </Button>
            )}

            {/* Pack List - All tabs */}
            <Button
              onClick={generatePackList}
              disabled={selectedOrders.size === 0}
              variant="outline"
            >
              <ListChecksIcon className="size-4 mr-2" />
              Generate Pack List ({selectedOrders.size})
            </Button>
          </div>
        </div>
      )}

      {/* Orders Table */}
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
        <div className="tile overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-ink/10 bg-muted/60">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-muted-foreground">
                  <th className="w-10">
                    <Checkbox
                      className="w-4 h-4 bg-background border-2 border-black/60 dark:border-white/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                      checked={displayOrders.length > 0 && selectedOrders.size === displayOrders.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Ships to</th>
                  <th className="!text-right">Value</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayOrders.map((order) => {
                  const pay = normalizePaymentStatus(order.paymentStatus) || "pending";
                  const awb = order.awbNumber || order.manualTrackingNumber || "";
                  const courier = order.courierName || order.manualCourierCompany || "";
                  return (
                    <tr
                      key={order._id}
                      className="cursor-pointer transition-colors hover:bg-brand/[0.04]"
                      onClick={(e) => {
                        // Don't navigate if clicking the checkbox or a link
                        const el = e.target as HTMLElement;
                        if (el.closest('button[role="checkbox"]') || el.closest("a")) return;
                        navigate(`/backend-skinly/orders/${order._id}`);
                      }}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          className="w-4 h-4 bg-background border-2 border-black/60 dark:border-white/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                          checked={selectedOrders.has(order._id)}
                          onCheckedChange={(checked) => handleSelectOrder(order._id, checked as boolean)}
                        />
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-sm font-semibold">
                          {order.orderNumber || order.checkoutRef || order.failedOrderNumber || "Pending"}
                        </div>
                        {order.invoiceNumber && (
                          <div className="font-mono text-[11px] text-muted-foreground">{order.invoiceNumber}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatDate(order._creationTime ?? order.createdAt)}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium">
                          {order.shippingAddress?.fullName || order.customerName || "—"}
                        </div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {order.shippingAddress?.phone || order.phone || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="text-sm">{order.shippingAddress?.city || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? "" : "s"}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="text-sm font-semibold tabular-nums">
                          ₹{(order.total || 0).toFixed(0)}
                        </div>
                        {order.paymentMethod === "cod" && (
                          <div className="text-xs text-amber-600">
                            COD{order.codAmount > 0 ? ` ₹${order.codAmount.toFixed(0)}` : ""}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                          <span className={`size-1.5 rounded-full ${STATUS_DOT[order.status] || "bg-muted-foreground"}`} />
                          {ADMIN_STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>

                      {/*
                        What the courier last said, on the row itself. It used
                        to live two clicks away on the order page, so the only
                        way to see that a parcel had stalled was to open every
                        one of them.
                      */}
                      <td className="px-3 py-2.5">
                        {awb ? (
                          <>
                            <div className="text-xs font-medium">
                              {courier || "Courier"}
                              {order.trackingUrl ? (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 font-mono text-brand hover:underline"
                                >
                                  {awb}
                                </a>
                              ) : (
                                <span className="ml-1 font-mono text-muted-foreground">{awb}</span>
                              )}
                            </div>
                            <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
                              {order.shippingStatus || "No update yet"}
                              {order.lastTrackingEventAt ? ` · ${timeAgo(order.lastTrackingEventAt)}` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not shipped</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getPaymentStatusColor(pay)}`}>
                          {pay}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Ship Confirmation Dialog */}
      <Dialog open={showBulkShipDialog} onOpenChange={setShowBulkShipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Create Shipments</DialogTitle>
            <DialogDescription>
              Create RapidShyp shipments for {getValidShipOrders().length} selected orders?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">Orders to ship:</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {getValidShipOrders().map((order) => (
                <div key={order._id} className="text-sm font-mono">
                  {order.orderNumber} - {order.shippingAddress.fullName}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkShipDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkShip}>
              Create Shipments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Fetch Labels Confirmation Dialog */}
      <Dialog open={showBulkLabelsDialog} onOpenChange={setShowBulkLabelsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Fetch Labels</DialogTitle>
            <DialogDescription>
              Download combined PDF with labels for {getValidLabelOrders().length} selected orders?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">Orders to fetch labels for:</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {getValidLabelOrders().map((order) => (
                <div key={order._id} className="text-sm font-mono">
                  {order.orderNumber} - AWB: {order.awbNumber}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkLabelsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkFetchLabels}>
              Fetch Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Results Dialog */}
      {bulkResults && (
        <Dialog open={!!bulkResults} onOpenChange={() => setBulkResults(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {bulkResults.type === "ship" ? "Shipment Results" : "Label Fetch Results"}
              </DialogTitle>
              <DialogDescription>
                {bulkResults.successful} successful, {bulkResults.failed} failed
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-96 overflow-y-auto">
              {bulkResults.details.map((detail, idx) => (
                <div
                  key={idx}
                  className={`p-3 mb-2 rounded border ${
                    detail.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-sm font-medium">{detail.orderNumber}</span>
                      {detail.awb && (
                        <span className="ml-2 text-xs text-muted-foreground">AWB: {detail.awb}</span>
                      )}
                    </div>
                    {detail.error ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">Success</Badge>
                    )}
                  </div>
                  {detail.error && (
                    <p className="text-xs text-red-600 mt-1">{detail.error}</p>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setBulkResults(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Order Dialog */}
      <ManualOrderDialog
        open={showManualOrderDialog}
        onOpenChange={setShowManualOrderDialog}
      />

      {/* Bulk Order Status Change Dialog */}
      <Dialog open={showBulkOrderStatusDialog} onOpenChange={setShowBulkOrderStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Order Status</DialogTitle>
            <DialogDescription>
              Update order status for {selectedOrders.size} selected order{selectedOrders.size !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-order-status">New Order Status</Label>
            <Select value={bulkNewOrderStatus} onValueChange={setBulkNewOrderStatus}>
              <SelectTrigger id="bulk-order-status" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>{ADMIN_STATUS_LABELS[st]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkOrderStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkOrderStatus}>
              Update {selectedOrders.size} Order{selectedOrders.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Payment Status Change Dialog */}
      <Dialog open={showBulkPaymentStatusDialog} onOpenChange={setShowBulkPaymentStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Payment Status</DialogTitle>
            <DialogDescription>
              Update payment status for {selectedOrders.size} selected order{selectedOrders.size !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-payment-status">New Payment Status</Label>
            <Select value={bulkNewPaymentStatus} onValueChange={setBulkNewPaymentStatus}>
              <SelectTrigger id="bulk-payment-status" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkPaymentStatusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkPaymentStatus}>
              Update {selectedOrders.size} Order{selectedOrders.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminOrdersPage() {
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
            <Skeleton className="h-96 w-full" />
          </div>
        </AuthLoading>
      <Authenticated>
        <AdminOrdersPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
