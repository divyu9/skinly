import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import {
  MessageSquareIcon,
  FilterIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertCircleIcon,
  SendIcon,
  EyeIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function WhatsAppMessagesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [usecaseFilter, setUsecaseFilter] = useState<string>("all");
  const [phoneFilter, setPhoneFilter] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<Id<"whatsappMessages"> | null>(null);

  // Queries
  const messages = useQuery(
    api.whatsappMessaging.getMessages,
    statusFilter !== "all"
      ? { status: statusFilter as "pending" | "sent" | "delivered" | "read" | "failed" }
      : usecaseFilter !== "all"
      ? { usecaseKey: usecaseFilter }
      : phoneFilter
      ? { recipientPhone: phoneFilter }
      : {}
  );

  const queueStats = useQuery(api.whatsappMessaging.getQueueStats);
  const deliveryStats = useQuery(api.whatsappMessaging.getDeliveryStats);
  const messageDetails = useQuery(
    api.whatsappMessaging.getMessageDetails,
    selectedMessageId ? { messageId: selectedMessageId } : "skip"
  );

  // Mutations
  const retryMessage = useMutation(api.whatsappMessaging.retryMessage);
  const triggerWorker = useMutation(api.whatsappMessaging.triggerWorker);

  const handleRetry = async (messageId: Id<"whatsappMessages">) => {
    try {
      await retryMessage({ messageId });
      toast.success("Message queued for retry");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry message");
    }
  };

  const handleTriggerWorker = async () => {
    try {
      await triggerWorker({});
      toast.success("Worker triggered");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to trigger worker");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2Icon }
    > = {
      pending: { variant: "outline", icon: ClockIcon },
      sent: { variant: "secondary", icon: SendIcon },
      delivered: { variant: "default", icon: CheckCircle2Icon },
      read: { variant: "default", icon: EyeIcon },
      failed: { variant: "destructive", icon: AlertCircleIcon },
    };

    const config = statusConfig[status] || { variant: "outline" as const, icon: ClockIcon };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="size-3" />
        {status}
      </Badge>
    );
  };

  if (!messages || !queueStats || !deliveryStats) {
    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageSquareIcon className="size-8" />
              WhatsApp Messages
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTriggerWorker}>
                <RefreshCwIcon className="size-4 mr-2" />
                Trigger Worker
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/whatsapp">Back to Settings</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            View and monitor all sent WhatsApp messages
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Delivery Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sent:</span>
                  <span className="font-semibold">{deliveryStats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivered:</span>
                  <span className="font-semibold text-green-600">{deliveryStats.delivered}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="font-semibold text-red-600">{deliveryStats.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Queue Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-semibold">{queueStats.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing:</span>
                  <span className="font-semibold text-blue-600">{queueStats.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="font-semibold text-red-600">{queueStats.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-semibold">{deliveryStats.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent:</span>
                  <span className="font-semibold">{deliveryStats.sent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Read:</span>
                  <span className="font-semibold text-blue-600">{deliveryStats.read}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FilterIcon className="size-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Use Case</Label>
                <Select value={usecaseFilter} onValueChange={setUsecaseFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Use Cases</SelectItem>
                    <SelectItem value="order_received">Order Received</SelectItem>
                    <SelectItem value="order_dispatched">Order Dispatched</SelectItem>
                    <SelectItem value="order_delivered">Order Delivered</SelectItem>
                    <SelectItem value="order_cancelled">Order Cancelled</SelectItem>
                    <SelectItem value="cod_confirmation">COD Confirmation</SelectItem>
                    <SelectItem value="cod_otp">COD OTP</SelectItem>
                    <SelectItem value="partial_cod">Partial COD</SelectItem>
                    <SelectItem value="payment_failed">Payment Failed</SelectItem>
                    <SelectItem value="back_in_stock">Back in Stock</SelectItem>
                    <SelectItem value="review_request">Review Request</SelectItem>
                    <SelectItem value="review_reminder">Review Reminder</SelectItem>
                    <SelectItem value="otp_login">Login OTP</SelectItem>
                    <SelectItem value="admin_new_order">Admin New Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="Filter by phone..."
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value)}
                />
              </div>
            </div>

            {(statusFilter !== "all" || usecaseFilter !== "all" || phoneFilter) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setStatusFilter("all");
                  setUsecaseFilter("all");
                  setPhoneFilter("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Messages Table */}
        <Card>
          <CardHeader>
            <CardTitle>Messages ({messages.length})</CardTitle>
            <CardDescription>
              Showing most recent {messages.length} messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages found
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Use Case</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message._id}>
                        <TableCell className="text-sm">
                          {message.createdAtFormatted}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {message.usecaseKey}
                          </span>
                        </TableCell>
                        <TableCell>{message.recipientName}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {message.recipientPhone}
                        </TableCell>
                        <TableCell>{getStatusBadge(message.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {message.sentAtFormatted || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedMessageId(message._id)}
                            >
                              View
                            </Button>
                            {message.status === "failed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(message._id)}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message Details Dialog */}
      <Dialog
        open={selectedMessageId !== null}
        onOpenChange={(open) => !open && setSelectedMessageId(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
            <DialogDescription>Full details of the WhatsApp message</DialogDescription>
          </DialogHeader>

          {messageDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(messageDetails.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Use Case</Label>
                  <div className="mt-1 text-sm font-mono bg-muted px-2 py-1 rounded inline-block">
                    {messageDetails.usecaseKey}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Recipient</Label>
                <div className="mt-1 text-sm">{messageDetails.recipientName}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {messageDetails.recipientPhone}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Template</Label>
                <div className="mt-1 text-sm">{messageDetails.templateName}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  ID: {messageDetails.providerTemplateId}
                </div>
              </div>

              {messageDetails.variables && Object.keys(messageDetails.variables).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Variables</Label>
                  <div className="mt-1 bg-muted p-3 rounded text-xs font-mono">
                    {JSON.stringify(messageDetails.variables, null, 2)}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Retry Count</Label>
                  <div className="mt-1 text-sm">{messageDetails.retryCount}</div>
                </div>
                {messageDetails.providerMessageId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Provider Message ID</Label>
                    <div className="mt-1 text-xs font-mono">{messageDetails.providerMessageId}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <div className="mt-1 text-sm">
                    {new Date(messageDetails.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
                {messageDetails.sentAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sent</Label>
                    <div className="mt-1 text-sm">
                      {new Date(messageDetails.sentAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                )}
                {messageDetails.deliveredAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivered</Label>
                    <div className="mt-1 text-sm">
                      {new Date(messageDetails.deliveredAt).toLocaleString("en-IN")}
                    </div>
                  </div>
                )}
              </div>

              {messageDetails.errorMessage && (
                <div className="pt-4 border-t">
                  <Label className="text-xs text-muted-foreground">Error Message</Label>
                  <div className="mt-1 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded">
                    {messageDetails.errorMessage}
                  </div>
                </div>
              )}

              {messageDetails.queueStatus && (
                <div className="pt-4 border-t">
                  <Label className="text-xs text-muted-foreground">Queue Status</Label>
                  <div className="mt-1 text-sm">
                    Status: {messageDetails.queueStatus} | Attempts: {messageDetails.queueAttempts}
                  </div>
                  {messageDetails.queueError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                      {messageDetails.queueError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
