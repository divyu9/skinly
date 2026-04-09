import { useState, useMemo } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import { PackageIcon, ChevronRightIcon, CalendarIcon, WalletIcon, CoinsIcon, RefreshCcwIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";

type DateFilter = "7" | "15" | "30" | "60" | "90" | "custom" | "all";

function OrdersPageInner() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const orders = useQuery(api.orders.getOrders, {});

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
      month: "short",
      day: "numeric",
    });
  };

  // Filter orders by date and status
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    let filtered = [...orders];
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Apply date filter
    if (dateFilter !== "all") {
      const now = Date.now();
      let startDate: number;
      
      if (dateFilter === "custom") {
        if (customStartDate) {
          startDate = customStartDate.getTime();
          filtered = filtered.filter(order => {
            const time = order._creationTime || order.createdAt || 0;
            return time >= startDate;
          });
        }
        if (customEndDate) {
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          filtered = filtered.filter(order => {
            const time = order._creationTime || order.createdAt || 0;
            return time <= endDate.getTime();
          });
        }
      } else {
        const days = parseInt(dateFilter);
        startDate = now - (days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
            const time = order._creationTime || order.createdAt || 0;
            return time >= startDate;
        });
      }
    }
    
    return filtered;
  }, [orders, dateFilter, statusFilter, customStartDate, customEndDate]);

  // Count orders by status
  const statusCounts = useMemo(() => {
    if (!orders) return {};
    return {
      all: orders.length,
      processing: orders.filter(o => o.status === "processing").length,
      shipped: orders.filter(o => o.status === "shipped").length,
      delivered: orders.filter(o => o.status === "delivered").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
    };
  }, [orders]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BrandLogo type="header" imgClassName="h-10" />
              <h1 className="text-2xl font-bold">My Orders</h1>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Status Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="all" className="flex flex-col gap-1 py-2">
              <span className="text-sm font-medium">All</span>
              <Badge variant="secondary" className="text-xs">{statusCounts.all || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex flex-col gap-1 py-2">
              <span className="text-sm font-medium">Processing</span>
              <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-500">{statusCounts.processing || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="shipped" className="flex flex-col gap-1 py-2">
              <span className="text-sm font-medium">Shipped</span>
              <Badge variant="secondary" className="text-xs bg-indigo-500/10 text-indigo-500">{statusCounts.shipped || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="delivered" className="flex flex-col gap-1 py-2">
              <span className="text-sm font-medium">Delivered</span>
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">{statusCounts.delivered || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex flex-col gap-1 py-2">
              <span className="text-sm font-medium">Cancelled</span>
              <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-500">{statusCounts.cancelled || 0}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Filter */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Date:</span>
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
          
          {(dateFilter !== "all" || statusFilter !== "all") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setDateFilter("all");
                setStatusFilter("all");
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {orders === undefined ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>{orders && orders.length > 0 ? "No orders match filters" : "No orders yet"}</EmptyTitle>
              <EmptyDescription>
                {orders && orders.length > 0 
                  ? "Try adjusting your filters to see more orders." 
                  : "You haven't placed any orders. Start shopping to see your orders here!"}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {orders && orders.length > 0 ? (
                <Button onClick={() => {
                  setDateFilter("all");
                  setStatusFilter("all");
                  setCustomStartDate(undefined);
                  setCustomEndDate(undefined);
                }}>
                  Clear Filters
                </Button>
              ) : (
                <Link to="/products">
                  <Button>Browse Products</Button>
                </Link>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Placed on {formatDate(order._creationTime || order.createdAt || Date.now())}
                      </p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.items.slice(0, 2).map((item, idx) => (
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
                            <p className="text-sm font-medium line-clamp-2">
                              {item.productTitle}
                            </p>
                            {item.phoneModel && (
                              <p className="text-xs text-muted-foreground">
                                {item.phoneModel}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-primary">
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </div>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-sm text-muted-foreground">
                          +{order.items.length - 2} more item(s)
                        </p>
                      )}
                    </div>

                    {/* Wallet & Cashback Information */}
                    {(order.walletAmountUsed || (order.cashbackCredited && order.cashbackAmount) || order.refundedToWallet) && (
                      <div className="flex flex-wrap gap-2 pb-4 border-b">
                        {order.walletAmountUsed && order.walletAmountUsed > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <WalletIcon className="size-4 text-blue-600" />
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Wallet Used</span>
                              <span className="text-sm font-semibold text-blue-600">
                                ₹{order.walletAmountUsed.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        )}
                        {order.cashbackCredited && order.cashbackAmount && order.cashbackAmount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                            <CoinsIcon className="size-4 text-green-600" />
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Cashback Earned</span>
                              <span className="text-sm font-semibold text-green-600">
                                ₹{order.cashbackAmount.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        )}
                        {order.refundedToWallet && order.refundAmount && order.refundAmount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <RefreshCcwIcon className="size-4 text-purple-600" />
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">Refunded to Wallet</span>
                              <span className="text-sm font-semibold text-purple-600">
                                ₹{order.refundAmount.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order Total and View Button */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Order Total</p>
                        <p className="text-xl font-bold text-primary">
                          ₹{order.total.toFixed(0)}
                        </p>
                        {order.paymentMethod === "cod" && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                              COD
                            </Badge>
                            {order.prepaidAmount && order.prepaidAmount > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Paid ₹{order.prepaidAmount.toFixed(0)}, COD ₹{(order.codAmount ?? 0).toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Pay on delivery
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Link to={`/orders/${order._id}`}>
                        <Button variant="outline">
                          View Details
                          <ChevronRightIcon className="size-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { BrandLogo } from "@/components/brand-logo.tsx";

export default function OrdersPage() {
  return (
    <>
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      <Unauthenticated>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to view orders</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to see your order history
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
        <OrdersPageInner />
      </Authenticated>
    </>
  );
}
