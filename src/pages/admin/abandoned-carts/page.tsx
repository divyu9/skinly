import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
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
import { ShoppingCartIcon, MailIcon, MessageSquareIcon, TrendingUpIcon } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link } from "react-router-dom";
import { AdminHeader } from "@/components/admin-header.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

function AbandonedCartsPageInner() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const processAllCarts = useAction(api.abandonedCartsActions.processAbandonedCarts);
  const sendReminder = useAction(api.abandonedCartsActions.sendAbandonedCartReminder);
  const [processing, setProcessing] = useState(false);

  const stats = useQuery(api.abandonedCarts.getAbandonedCartStats);
  const abandonedCarts = useQuery(api.abandonedCarts.getAllAbandonedCarts, {
    status: statusFilter as "pending" | "reminded" | "recovered" | "expired" | undefined,
  });

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSendReminder = async (cartId: any) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  if (!stats || !abandonedCarts) {
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
            <Link to="/admin">Back to Admin</Link>
          </Button>
          <Button onClick={handleProcessAll} disabled={processing}>
            {processing ? "Processing..." : "Send All Reminders"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abandoned</CardTitle>
            <ShoppingCartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              ₹{stats.totalValue.toFixed(0)} total value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <MailIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Need reminders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovered</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recovered}</div>
            <p className="text-xs text-muted-foreground">
              ₹{stats.recoveredValue.toFixed(0)} recovered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recoveryRate}%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reminded">Reminded</SelectItem>
            <SelectItem value="recovered">Recovered</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Abandoned Carts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Abandoned Carts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Abandoned At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abandonedCarts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No abandoned carts found
                  </TableCell>
                </TableRow>
              ) : (
                abandonedCarts.map((cart) => (
                  <TableRow key={cart._id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{cart.userEmail}</div>
                        {cart.userPhone && (
                          <div className="text-xs text-muted-foreground">
                            {cart.userPhone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{cart.items.length} items</TableCell>
                    <TableCell className="font-medium">
                      ₹{cart.cartTotal.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(cart.abandonedAt).toLocaleDateString()} at{" "}
                      {new Date(cart.abandonedAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cart.status === "recovered"
                            ? "default"
                            : cart.status === "reminded"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {cart.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cart.couponCode ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {cart.couponCode}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cart.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendReminder(cart._id)}
                        >
                          Send Reminder
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AbandonedCartsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
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
      </div>
    </div>
  );
}
