import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { BellIcon, SendIcon, UsersIcon, PackageIcon, CheckCircleIcon } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/firebase-hooks";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import type { Id } from "@/lib/firebase-api";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";

function AdminStockNotificationsPageInner() {
  const stats = useQuery(api.stockNotifications.getNotificationStats, {});
  const sendNotifications = useMutation(api.stockNotificationsActions.sendRestockNotifications);
  const [sendingFor, setSendingFor] = useState<Id<"variants"> | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{
    variantId: Id<"variants">;
    variantTitle: string;
    count: number;
  } | null>(null);

  const handleSendNotifications = async (
    variantId: Id<"variants">,
    variantTitle: string,
    count: number
  ) => {
    setSelectedVariant({ variantId, variantTitle, count });
    setShowConfirmDialog(true);
  };

  const confirmSendNotifications = async () => {
    if (!selectedVariant) return;

    setSendingFor(selectedVariant.variantId);
    setShowConfirmDialog(false);

    try {
      const result = await sendNotifications({
        variantId: selectedVariant.variantId,
      });

      if (result.sent > 0) {
        toast.success(`WhatsApp notifications sent to ${result.sent} customer(s)`);
      } else {
        toast.info("No notifications were sent");
      }
    } catch (error) {
      toast.error("Failed to send notifications");
      console.error(error);
    } finally {
      setSendingFor(null);
      setSelectedVariant(null);
    }
  };

  if (stats === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const totalWaiting = stats.reduce((sum, product) => sum + product.totalCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Back-in-Stock Notifications</h1>
          <p className="text-muted-foreground">Manage customer notifications for out-of-stock products</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalWaiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.reduce((sum, product) => sum + product.variants.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>No waiting notifications</EmptyTitle>
            <EmptyDescription>
              Customers will appear here when they sign up for stock notifications
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {stats.map((product) => (
            <Card key={product.productId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{product.productTitle}</CardTitle>
                    <CardDescription>{product.totalCount} customer(s) waiting</CardDescription>
                  </div>
                  <Badge variant="outline">
                    <UsersIcon className="size-3 mr-1" />
                    {product.totalCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {product.variants.map((variant) => (
                    <div
                      key={variant.variantId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{variant.variantTitle}</div>
                        <div className="text-sm text-muted-foreground">SKU: {variant.sku}</div>
                        <div className="text-sm text-primary font-semibold mt-1">
                          {variant.count} customer(s) waiting
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleSendNotifications(
                            variant.variantId as Id<"variants">,
                            variant.variantTitle,
                            variant.count
                          )
                        }
                        disabled={sendingFor === variant.variantId}
                      >
                        {sendingFor === variant.variantId ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <SendIcon className="size-4 mr-2" />
                            Send Alerts
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp Notifications?</DialogTitle>
            <DialogDescription>
              This will send WhatsApp messages to {selectedVariant?.count} customer(s) waiting for{" "}
              <strong>{selectedVariant?.variantTitle}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <CheckCircleIcon className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold mb-1">Before sending:</div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Make sure the product is actually back in stock</li>
                  <li>Update the inventory quantity in the products page</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSendNotifications}>
              <SendIcon className="size-4 mr-2" />
              Send Notifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminStockNotificationsPage() {
  return (
    <AdminLayout>
      <Unauthenticated>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>Please sign in to access admin</EmptyTitle>
              <EmptyDescription>
                You need to be logged in to manage stock notifications
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
        <AdminStockNotificationsPageInner />
      </Authenticated>
    </AdminLayout>
  );
}
