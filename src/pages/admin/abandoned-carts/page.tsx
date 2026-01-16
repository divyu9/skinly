import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  ShoppingCartIcon,
  MailIcon,
  MessageSquareIcon,
  TrendingUpIcon,
  SettingsIcon,
  ClockIcon,
  ZapIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  SendIcon,
  PackageIcon,
  IndianRupeeIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AbandonedCartSettings } from "./settings.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

// Format time ago
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Format currency
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function AbandonedCartsPageInner() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const processAllCarts = useAction(api.abandonedCartsActions.processAbandonedCarts);
  const scanCarts = useAction(api.abandonedCartsActions.scanAndTrackAbandonedCarts);
  const sendReminder = useAction(api.abandonedCartsActions.sendAbandonedCartReminder);
  const [processing, setProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedCart, setSelectedCart] = useState<any>(null);

  const stats = useQuery(api.abandonedCarts.getAbandonedCartStats);
  const settings = useQuery(api.abandonedCartSettings.getSettings);
  const abandonedCarts = useQuery(api.abandonedCarts.getAllAbandonedCarts, {
    status: statusFilter as "pending" | "reminded" | "recovered" | "expired" | undefined,
  });

  const handleScanCarts = async () => {
    setScanning(true);
    try {
      const result = await scanCarts({});
      toast.success(`Found ${result.tracked} abandoned carts`);
    } catch (error) {
      toast.error("Failed to scan for abandoned carts");
    } finally {
      setScanning(false);
    }
  };

  const handleProcessAll = async () => {
    setProcessing(true);
    try {
      const result = await processAllCarts({});
      toast.success(`Processed ${result.processed} abandoned carts`);
    } catch (error) {
      toast.error("Failed to process abandoned carts");
    } finally {
      setProcessing(false);
    }
  };

  const handleSendReminder = async (cartId: any) => {
    try {
      const result = await sendReminder({ cartId: cartId as any });
      if (result.success) {
        toast.success(
          `Reminder sent! Email: ${result.emailSent ? "✓" : "✗"}, WhatsApp: ${result.whatsappSent ? "✓" : "✗"}`
        );
      } else {
        toast.error("Failed to send reminder");
      }
    } catch (error) {
      toast.error("Failed to send reminder");
    }
  };

  if (!stats || !abandonedCarts || !settings) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const recoveryRate =
    stats.total > 0 ? ((stats.recovered / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Abandoned Carts</h1>
          <p className="text-muted-foreground">
            Recover lost sales with automated email & WhatsApp reminders
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/backend-skinly/products">Back to Admin</Link>
          </Button>
        </div>
      </div>

      {/* Automation Status Banner */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <ZapIcon className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600">Automation Active</span>
                  <Badge variant="outline" className="text-green-600 border-green-500/30">
                    Every 30 min
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  System automatically scans for abandoned carts and sends reminders after {settings.delayHours}h delay
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Reminder Offer</div>
              <div className="font-semibold">
                {settings.couponDiscountType === "percentage"
                  ? `${settings.couponDiscountValue}% OFF`
                  : `₹${settings.couponDiscountValue} OFF`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="carts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="carts" className="flex items-center gap-2">
            <ShoppingCartIcon className="h-4 w-4" />
            Abandoned Carts
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Carts Tab */}
        <TabsContent value="carts" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Abandoned</CardTitle>
                <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.totalValue)} total value
                </p>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <ClockIcon className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Awaiting reminder</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reminded</CardTitle>
                <MailIcon className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.reminded}</div>
                <p className="text-xs text-muted-foreground">Email/WhatsApp sent</p>
              </CardContent>
            </Card>

            <Card className="border-green-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recovered</CardTitle>
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.recovered}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.recoveredValue)} recovered
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
                <CheckCircle2Icon className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{recoveryRate}%</div>
                <p className="text-xs text-muted-foreground">Success rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    <ClockIcon className="h-3 w-3 text-yellow-500" /> Pending
                  </span>
                </SelectItem>
                <SelectItem value="reminded">
                  <span className="flex items-center gap-2">
                    <MailIcon className="h-3 w-3 text-blue-500" /> Reminded
                  </span>
                </SelectItem>
                <SelectItem value="recovered">
                  <span className="flex items-center gap-2">
                    <TrendingUpIcon className="h-3 w-3 text-green-500" /> Recovered
                  </span>
                </SelectItem>
                <SelectItem value="expired">
                  <span className="flex items-center gap-2">
                    <AlertCircleIcon className="h-3 w-3 text-gray-500" /> Expired
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleScanCarts}
                      disabled={scanning}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCwIcon className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
                      {scanning ? "Scanning..." : "Manual Scan"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Scan runs automatically every 30 min. Use this for immediate scan.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleProcessAll} disabled={processing} size="sm">
                      <SendIcon className={`h-4 w-4 mr-2 ${processing ? "animate-pulse" : ""}`} />
                      {processing ? "Processing..." : "Send All Reminders"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Process runs automatically every 30 min. Use this for immediate processing.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Abandoned Carts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Abandoned Carts</CardTitle>
              <CardDescription>
                {abandonedCarts.length} cart{abandonedCarts.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abandonedCarts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCartIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No abandoned carts found</p>
                  <p className="text-sm">Carts will appear here when customers leave items without checking out</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Cart</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Abandoned</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Coupon</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abandonedCarts.map((cart) => (
                      <TableRow key={cart._id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium text-sm truncate max-w-[200px]">
                                {cart.userEmail}
                              </div>
                              {cart.userPhone && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MessageSquareIcon className="h-3 w-3" />
                                  {cart.userPhone}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => setSelectedCart(cart)}
                              >
                                <PackageIcon className="h-3 w-3" />
                                {cart.items.length} item{cart.items.length !== 1 ? "s" : ""}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cart Items</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {selectedCart?.items.map((item: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-3 rounded-lg border"
                                  >
                                    {item.productImage ? (
                                      <img
                                        src={item.productImage}
                                        alt={item.productTitle}
                                        className="h-12 w-12 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                                        <PackageIcon className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate">
                                        {item.productTitle}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {item.variant}
                                        {item.phoneModel && ` • ${item.phoneModel}`}
                                        {item.coverage && ` • ${item.coverage === "full_body_wrap" ? "Full Body" : "Back Only"}`}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">
                                        {formatCurrency(item.price * item.quantity)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        x{item.quantity}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="flex justify-between pt-3 border-t font-semibold">
                                  <span>Total</span>
                                  <span>{formatCurrency(selectedCart?.cartTotal || 0)}</span>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-semibold">
                            <IndianRupeeIcon className="h-3 w-3" />
                            {cart.cartTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1 text-sm">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                  {formatTimeAgo(cart.abandonedAt)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {new Date(cart.abandonedAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cart.status === "recovered"
                                ? "default"
                                : cart.status === "reminded"
                                  ? "secondary"
                                  : cart.status === "pending"
                                    ? "outline"
                                    : "destructive"
                            }
                            className={
                              cart.status === "recovered"
                                ? "bg-green-500"
                                : cart.status === "reminded"
                                  ? "bg-blue-500 text-white"
                                  : cart.status === "pending"
                                    ? "border-yellow-500 text-yellow-600"
                                    : ""
                            }
                          >
                            {cart.status === "pending" && <ClockIcon className="h-3 w-3 mr-1" />}
                            {cart.status === "reminded" && <MailIcon className="h-3 w-3 mr-1" />}
                            {cart.status === "recovered" && <CheckCircle2Icon className="h-3 w-3 mr-1" />}
                            {cart.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cart.couponCode ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {cart.couponCode}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {cart.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(cart._id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <SendIcon className="h-3 w-3 mr-1" />
                              Send Now
                            </Button>
                          )}
                          {cart.status === "reminded" && cart.reminderSentAt && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-xs text-muted-foreground">
                                    Sent {formatTimeAgo(cart.reminderSentAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {new Date(cart.reminderSentAt).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <AbandonedCartSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AbandonedCartsPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingCartIcon />
            </EmptyMedia>
            <EmptyTitle>Please sign in to access admin</EmptyTitle>
            <EmptyDescription>
              You need to be logged in to manage abandoned carts
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <SignInButton />
          </EmptyContent>
        </Empty>
      </Unauthenticated>
      <AuthLoading>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <AbandonedCartsPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
