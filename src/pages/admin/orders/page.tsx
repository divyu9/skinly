import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Link, useNavigate } from "react-router-dom";
import { PackageIcon, SearchIcon, TrendingUpIcon, CreditCardIcon, TruckIcon, IndianRupeeIcon, FileTextIcon, ListChecksIcon, PackageCheckIcon, FileDownIcon, LoaderIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { PDFDocument } from "pdf-lib";

function AdminOrdersPageInner() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<Id<"orders">>>(new Set());
  
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
  
  // Actions
  const bulkCreateShipments = useAction(api.rapidshyp.bulkCreateShipments);
  const bulkFetchLabels = useAction(api.rapidshyp.bulkFetchLabels);

  const stats = useQuery(api.admin.orders.getOrderStats);
  const allOrders = useQuery(api.admin.orders.getAllOrders, {
    status: statusFilter,
    paymentStatus: paymentFilter,
  });
  const searchResults = useQuery(
    api.admin.orders.searchOrders,
    searchTerm.length >= 3 ? { searchTerm } : "skip"
  );

  const displayOrders = searchTerm.length >= 3 ? searchResults : allOrders;

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

      console.log(`Fetching ${results.labels.length} labels for ST4 format`);

      // Fetch all label PDFs
      const labelPdfs: Array<{ orderNumber: string; pdf: PDFDocument }> = [];
      const fetchErrors: Array<{ orderNumber: string; error: string }> = [];

      for (const label of results.labels) {
        try {
          console.log(`Fetching label for ${label.orderNumber} from ${label.labelUrl}`);
          
          const response = await fetch(label.labelUrl, {
            method: 'GET',
            redirect: 'follow',
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          console.log(`Content-Type for ${label.orderNumber}:`, contentType);

          const pdfBytes = await response.arrayBuffer();
          console.log(`Fetched ${pdfBytes.byteLength} bytes for ${label.orderNumber}`);

          if (pdfBytes.byteLength === 0) {
            throw new Error('Empty PDF file');
          }

          const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          console.log(`Loaded PDF for ${label.orderNumber}, pages: ${pdf.getPageCount()}`);
          
          labelPdfs.push({ orderNumber: label.orderNumber, pdf });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to fetch/load label for ${label.orderNumber}:`, errorMsg);
          fetchErrors.push({
            orderNumber: label.orderNumber,
            error: errorMsg,
          });
        }
      }

      if (labelPdfs.length === 0) {
        toast.error("Failed to fetch any labels");
        if (fetchErrors.length > 0) {
          setBulkResults({
            type: "labels",
            successful: 0,
            failed: fetchErrors.length,
            details: fetchErrors.map((e) => ({
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
            fetchErrors.push({
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

      if (fetchErrors.length > 0 || results.errors.length > 0) {
        setBulkResults({
          type: "labels",
          successful: labelPdfs.length,
          failed: fetchErrors.length + results.errors.length,
          details: [
            ...fetchErrors.map((e) => ({
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
        if (skuMap[sku]) {
          skuMap[sku].quantity += item.quantity;
          skuMap[sku].orders.push(order.orderNumber);
        } else {
          skuMap[sku] = {
            sku,
            quantity: item.quantity,
            orders: [order.orderNumber],
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            Manage all customer orders and track payments
          </p>
        </div>
        <Link to="/admin/tax-export">
          <Button variant="outline">
            <FileTextIcon className="size-4 mr-2" />
            Export for Tax Filing
          </Button>
        </Link>
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
              {stats.processing} processing
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

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All Orders
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {stats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="processing" className="flex items-center gap-2">
            Processing
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-purple-500/10 text-purple-600 border-purple-500/20">
              {stats.processing}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="shipped" className="flex items-center gap-2">
            Shipped
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
              {stats.shipped}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="delivered" className="flex items-center gap-2">
            Delivered
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-green-500/10 text-green-600 border-green-500/20">
              {stats.delivered}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex items-center gap-2">
            Cancelled
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-red-500/10 text-red-600 border-red-500/20">
              {stats.cancelled}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rto" className="flex items-center gap-2">
            RTO
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-orange-500/10 text-orange-600 border-orange-500/20">
              {stats.rto}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">
                      <Checkbox
                        checked={
                          displayOrders.length > 0 &&
                          selectedOrders.size === displayOrders.length
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium">Order Number</th>
                    <th className="p-3 text-left text-sm font-medium">Date & Time</th>
                    <th className="p-3 text-left text-sm font-medium">Customer</th>
                    <th className="p-3 text-left text-sm font-medium">Phone</th>
                    <th className="p-3 text-left text-sm font-medium">City</th>
                    <th className="p-3 text-left text-sm font-medium">Order Value</th>
                    <th className="p-3 text-left text-sm font-medium">Items</th>
                    <th className="p-3 text-left text-sm font-medium">Order Status</th>
                    <th className="p-3 text-left text-sm font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.map((order) => (
                    <tr
                      key={order._id}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Don't navigate if clicking checkbox
                        if ((e.target as HTMLElement).closest('button[role="checkbox"]')) {
                          return;
                        }
                        navigate(`/admin/orders/${order._id}`);
                      }}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedOrders.has(order._id)}
                          onCheckedChange={(checked) =>
                            handleSelectOrder(order._id, checked as boolean)
                          }
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-sm font-medium">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{formatDate(order._creationTime)}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-medium">
                          {order.shippingAddress.fullName}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{order.shippingAddress.phone}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{order.shippingAddress.city}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-medium">
                          ₹{order.total.toFixed(0)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm">{order.items.length}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={getPaymentStatusColor(order.paymentStatus)}
                          >
                            {order.paymentStatus || "pending"}
                          </Badge>
                          {order.paymentMethod === "cod" && (
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                                COD
                              </Badge>
                              {order.codAmount && order.codAmount > 0 && (
                                <span className="text-xs text-muted-foreground">₹{order.codAmount.toFixed(0)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
