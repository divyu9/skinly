import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { DownloadIcon, FileSpreadsheetIcon, CalendarIcon, TrendingUpIcon } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { useLocation } from "react-router-dom";

function TaxExportPageInner() {
  const location = useLocation();
  const selectedOrderIds = useMemo(() => {
    const ids = (location.state as any)?.selectedOrderIds;
    return Array.isArray(ids) ? ids : [];
  }, [location.state]);

  const [dateRangeType, setDateRangeType] = useState<string>(
    selectedOrderIds.length > 0 ? "all-time" : "this-month"
  );
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [orderStatus, setOrderStatus] = useState<string>("all");

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (dateRangeType) {
      case "all-time": {
        startDate = new Date(0);
        break;
      }
      case "this-month": {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      }
      case "last-month": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case "this-quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
        break;
      }
      case "last-quarter": {
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const year = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const q = lastQuarter < 0 ? 3 : lastQuarter;
        startDate = new Date(year, q * 3, 1, 0, 0, 0, 0);
        endDate = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "this-year": {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      }
      case "last-year": {
        startDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        break;
      }
      case "custom": {
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        }
        break;
      }
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    return {
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
    };
  }, [dateRangeType, customStartDate, customEndDate]);

  const queryArgs = useMemo(() => {
    return {
      ...dateRange,
      orderIds: selectedOrderIds.length > 0 ? selectedOrderIds : undefined,
      status: orderStatus,
    };
  }, [dateRange, selectedOrderIds, orderStatus]);

  const orders = useQuery(api.exports.getOrdersForExport, queryArgs);
  const stats = useQuery(api.exports.getExportStats, queryArgs);

  const handleExport = () => {
    if (!orders || orders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    try {
      // Create CSV content with GST details
      const headers = [
        "Order Number",
        "Order Date",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Shipping Address",
        "City",
        "State",
        "Pincode",
        "Order Status",
        "Payment Status",
        "Payment Method",
        "Items Count",
        "Item Details",
        "Subtotal (₹)",
        "Shipping Fee (₹)",
        "Total Amount (₹)",
        "Taxable Amount (₹)",
        "GST Rate (%)",
        "CGST Rate (%)",
        "CGST Amount (₹)",
        "SGST Rate (%)",
        "SGST Amount (₹)",
        "IGST Rate (%)",
        "IGST Amount (₹)",
        "Total GST (₹)",
        "AWB Number",
        "Tracking URL",
      ];

      const rows = orders.map((order) => {
        // Format items
        const itemDetails = order.items
          .map(
            (item) =>
              `${item.productTitle}${item.phoneModel ? ` (${item.phoneModel})` : ""} - Qty: ${item.quantity} × ₹${item.price.toFixed(2)}`
          )
          .join("; ");

        // Format address
        const address = [
          order.shippingAddress.addressLine1,
          order.shippingAddress.addressLine2,
        ]
          .filter(Boolean)
          .join(", ");

        return [
          order.orderNumber || order.failedOrderNumber || "Pending",
          new Date(order._creationTime).toLocaleString("en-IN"),
          order.shippingAddress.fullName,
          order.shippingAddress.phone,
          "", // Email not stored in current schema
          address,
          order.shippingAddress.city,
          order.shippingAddress.state,
          order.shippingAddress.pincode,
          order.status,
          order.paymentStatus || "N/A",
          order.paymentMethod,
          order.items.length.toString(),
          itemDetails,
          order.subtotal.toFixed(2),
          order.shippingFee.toFixed(2),
          order.total.toFixed(2),
          (order.taxableAmount || 0).toFixed(2),
          order.gstRate ? (order.gstRate * 100).toFixed(0) : "0",
          order.cgstRate ? (order.cgstRate * 100).toFixed(0) : "",
          order.cgstAmount ? order.cgstAmount.toFixed(2) : "",
          order.sgstRate ? (order.sgstRate * 100).toFixed(0) : "",
          order.sgstAmount ? order.sgstAmount.toFixed(2) : "",
          order.igstRate ? (order.igstRate * 100).toFixed(0) : "",
          order.igstAmount ? order.igstAmount.toFixed(2) : "",
          (order.totalGstAmount || 0).toFixed(2),
          order.awbNumber || "",
          order.trackingUrl || "",
        ];
      });

      // Escape CSV values
      const escapeCSV = (value: string | number) => {
        const stringValue = String(value);
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Build CSV
      const csv = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      // Add BOM for proper Excel UTF-8 support
      const BOM = "\uFEFF";
      const csvWithBOM = BOM + csv;

      // Download file
      const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const startDateStr = new Date(dateRange.startDate).toISOString().split("T")[0];
      const endDateStr = new Date(dateRange.endDate).toISOString().split("T")[0];
      link.download = `skinly-orders-${startDateStr}-to-${endDateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${orders.length} orders successfully`);
    } catch (error) {
      toast.error("Failed to export orders");
      console.error(error);
    }
  };

  if (!orders || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Tax Export & Compliance</h1>
        <p className="text-muted-foreground">
          Export order data with GST details for CA and tax compliance
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
              <FileSpreadsheetIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <TrendingUpIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxable Amount
              </CardTitle>
              <TrendingUpIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{stats.totalTaxableAmount.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total GST
              </CardTitle>
              <TrendingUpIcon className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₹{stats.totalGst.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* GST Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle>GST Breakdown</CardTitle>
          <CardDescription>
            Detailed GST summary for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">CGST (Uttar Pradesh)</p>
              <p className="text-xl font-bold">₹{stats.totalCgst.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">SGST (Uttar Pradesh)</p>
              <p className="text-xl font-bold">₹{stats.totalSgst.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">IGST (Other States)</p>
              <p className="text-xl font-bold">₹{stats.totalIgst.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5" />
            Select Date Range
          </CardTitle>
          <CardDescription>
            Choose a time period to export order data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRangeType} onValueChange={setDateRangeType}>
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-time">All Time</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="last-quarter">Last Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRangeType === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm">
                <strong>Selected Period:</strong>{" "}
                {new Date(dateRange.startDate).toLocaleDateString("en-IN")} to{" "}
                {new Date(dateRange.endDate).toLocaleDateString("en-IN")}
              </p>
              {selectedOrderIds.length > 0 ? (
                <p className="text-sm mt-1">
                  <strong>Selected Orders:</strong> {selectedOrderIds.length}
                </p>
              ) : null}
              <p className="text-sm mt-1">
                <strong>Orders to export:</strong> {orders.length}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Export Includes:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Order details (number, date, status)</li>
                <li>Customer information (name, phone, address)</li>
                <li>Item details and quantities</li>
                <li>Amount breakdown (subtotal, shipping, total)</li>
                <li>Complete GST details (CGST, SGST, IGST)</li>
                <li>Taxable amount calculations</li>
                <li>Shipping information (AWB, tracking)</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="orderStatus">Order Status</Label>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger id="orderStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rto">RTO</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExport}
              disabled={orders.length === 0}
              size="lg"
              className="w-full"
            >
              <DownloadIcon className="size-5 mr-2" />
              Export {orders.length} Order{orders.length !== 1 ? "s" : ""} to Excel
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Exports as CSV file compatible with Excel, Google Sheets, and accounting software
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>For CA & Tax Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            This export contains all information required for GST filing and tax compliance:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
            <li>Complete order records with dates and amounts</li>
            <li>Customer shipping addresses and states for GST jurisdiction</li>
            <li>Detailed GST breakdown (CGST, SGST, IGST) per order</li>
            <li>Taxable amounts calculated from tax-inclusive pricing</li>
            <li>Payment status and methods for reconciliation</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            All amounts are shown in INR (₹). The exported file can be directly shared with
            your Chartered Accountant for GST return filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TaxExportPage() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSpreadsheetIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access tax export</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to export order data
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
        <AdminLayout>
          <TaxExportPageInner />
        </AdminLayout>
      </Authenticated>
    </>
  );
}
