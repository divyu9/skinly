import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Link, useNavigate } from "react-router-dom";
import { PackageIcon, SearchIcon, TrendingUpIcon, CreditCardIcon, TruckIcon, IndianRupeeIcon, FileTextIcon, ListChecksIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function AdminOrdersPageInner() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<Id<"orders">>>(new Set());

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

      {/* Pack List Button */}
      {displayOrders && displayOrders.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedOrders.size > 0
              ? `${selectedOrders.size} order${selectedOrders.size > 1 ? "s" : ""} selected`
              : "Select orders to create pack list"}
          </div>
          <Button
            onClick={generatePackList}
            disabled={selectedOrders.size === 0}
            variant="default"
          >
            <ListChecksIcon className="size-4 mr-2" />
            Generate Pack List ({selectedOrders.size})
          </Button>
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
                        <Badge
                          variant="outline"
                          className={getPaymentStatusColor(order.paymentStatus)}
                        >
                          {order.paymentStatus || "pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
            <Skeleton className="h-96 w-full" />
          </div>
        </AuthLoading>
        <Authenticated>
          <AdminOrdersPageInner />
        </Authenticated>
      </div>
    </div>
  );
}
