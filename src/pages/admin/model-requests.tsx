import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useAuth } from "@/hooks/use-auth.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { SmartphoneIcon, AlertTriangleIcon, PhoneIcon, MailIcon, CalendarIcon, CheckCircleIcon, XCircleIcon, SearchIcon, FilterIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ConvexError } from "convex/values";
import { Checkbox } from "@/components/ui/checkbox.tsx";

interface ModelRequest {
  _id: Id<"modelRequests">;
  _creationTime: number;
  brandName: string;
  modelName: string;
  category: "phone" | "tablet" | "laptop" | "console" | "charger" | "drone" | "camera" | "lens" | "mac-mini";
  whatsappPhone: string;
  userId?: Id<"users">;
  userEmail?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  approvedAt?: number;
}

function ModelRequestsContent() {
  const { user } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const allRequests = useQuery(api.modelRequests.getAllModelRequests, {});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedRequests, setSelectedRequests] = useState<Set<Id<"modelRequests">>>(new Set());
  
  // Mutations
  const approveRequests = useMutation(api.modelRequests.approveModelRequests);
  const rejectRequest = useMutation(api.modelRequests.rejectModelRequest);
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "reject" | null;
    requestIds: Id<"modelRequests">[];
  }>({
    open: false,
    action: null,
    requestIds: [],
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle bulk approval
  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) {
      toast.error("No requests selected");
      return;
    }

    setConfirmDialog({
      open: true,
      action: "approve",
      requestIds: Array.from(selectedRequests),
    });
  };

  // Handle single or bulk actions
  const handleAction = async () => {
    if (!confirmDialog.action || confirmDialog.requestIds.length === 0) return;

    setIsUpdating(true);
    try {
      if (confirmDialog.action === "approve") {
        const result = await approveRequests({ requestIds: confirmDialog.requestIds });
        toast.success(`${result.successCount} request(s) approved successfully`);
        if (result.skipCount > 0) {
          toast.info(`${result.skipCount} request(s) were skipped (already processed or duplicate)`);
        }
      } else if (confirmDialog.action === "reject") {
        // Reject one at a time
        for (const requestId of confirmDialog.requestIds) {
          await rejectRequest({ requestId });
        }
        toast.success(`${confirmDialog.requestIds.length} request(s) rejected`);
      }

      // Clear selections and close dialog
      setSelectedRequests(new Set());
      setConfirmDialog({ open: false, action: null, requestIds: [] });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to process request(s)");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const openConfirmDialog = (action: "approve" | "reject", requestId: Id<"modelRequests">) => {
    setConfirmDialog({ open: true, action, requestIds: [requestId] });
  };

  // Toggle selection
  const toggleSelection = (requestId: Id<"modelRequests">) => {
    const newSelection = new Set(selectedRequests);
    if (newSelection.has(requestId)) {
      newSelection.delete(requestId);
    } else {
      newSelection.add(requestId);
    }
    setSelectedRequests(newSelection);
  };

  // Select all in current tab
  const toggleSelectAll = () => {
    const currentRequests = filteredRequests(currentTab);
    if (selectedRequests.size === currentRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(currentRequests.map(r => r._id)));
    }
  };

  // Check if user is admin
  if (currentUser === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-orange-500" />
              <CardTitle>Admin Access Required</CardTitle>
            </div>
            <CardDescription>
              You need admin privileges to manage model requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md space-y-3">
              <p className="text-sm font-medium">To set yourself as an admin:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Go to the <strong>Database</strong> tab in the left sidebar</li>
                <li>Click on the <strong>users</strong> table</li>
                <li>Find your user row (look for your email: <code className="bg-background px-1 py-0.5 rounded">{currentUser?.email || "your-email"}</code>)</li>
                <li>Double-click the row to edit it</li>
                <li>Add a new field: <code className="bg-background px-1 py-0.5 rounded">isAdmin</code> and set it to <code className="bg-background px-1 py-0.5 rounded">true</code> (boolean)</li>
                <li>Save the changes</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (allRequests === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Filter requests based on search and status
  const filteredRequests = (status: "pending" | "approved" | "rejected") => {
    const requests = allRequests.filter(r => r.status === status);
    if (!searchTerm.trim()) return requests;
    
    const term = searchTerm.toLowerCase();
    return requests.filter(r => 
      r.brandName.toLowerCase().includes(term) ||
      r.modelName.toLowerCase().includes(term) ||
      r.whatsappPhone.includes(term) ||
      (r.userEmail && r.userEmail.toLowerCase().includes(term))
    );
  };

  // Calculate stats
  const stats = {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === "pending").length,
    approved: allRequests.filter(r => r.status === "approved").length,
    rejected: allRequests.filter(r => r.status === "rejected").length,
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      phone: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      tablet: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      laptop: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      console: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      charger: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      drone: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
      camera: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
      lens: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
      "mac-mini": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const renderRequestTable = (requests: ModelRequest[], emptyMessage: string) => {
    if (requests.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmartphoneIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyMessage}</EmptyTitle>
            <EmptyDescription>
              {searchTerm ? "Try adjusting your search terms" : "Model requests will appear here when customers submit them"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {currentTab === "pending" && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRequests.size === requests.length && requests.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Device</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request._id}>
                {currentTab === "pending" && (
                  <TableCell>
                    <Checkbox
                      checked={selectedRequests.has(request._id)}
                      onCheckedChange={() => toggleSelection(request._id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{request.brandName}</div>
                    <div className="text-sm text-muted-foreground">{request.modelName}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getCategoryBadgeColor(request.category)}>
                    {request.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {request.userEmail && (
                      <div className="flex items-center gap-1 text-sm">
                        <MailIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[200px]" title={request.userEmail}>
                          {request.userEmail}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <PhoneIcon className="h-3 w-3" />
                      <span>{request.whatsappPhone}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{formatDistanceToNow(request.requestedAt, { addSuffix: true })}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {request.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog("approve", request._id)}
                          className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openConfirmDialog("reject", request._id)}
                          className="gap-1 text-destructive hover:bg-destructive/10"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {request.status === "approved" && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    )}
                    {request.status === "rejected" && (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Rejected
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <SmartphoneIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertTriangleIcon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Added to catalog</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircleIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Declined</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Model Requests</CardTitle>
          <CardDescription>Review and approve customer device model requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search by brand, model, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            {selectedRequests.size > 0 && currentTab === "pending" && (
              <Button
                onClick={handleBulkApprove}
                className="gap-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Approve {selectedRequests.size} Selected
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={(v) => {
        setCurrentTab(v as "pending" | "approved" | "rejected");
        setSelectedRequests(new Set());
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {stats.approved > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.approved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            {stats.rejected > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.rejected}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {renderRequestTable(filteredRequests("pending"), "No pending requests")}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {renderRequestTable(filteredRequests("approved"), "No approved requests")}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {renderRequestTable(filteredRequests("rejected"), "No rejected requests")}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !isUpdating && setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "approve" && `Approve ${confirmDialog.requestIds.length} Request(s)`}
              {confirmDialog.action === "reject" && `Reject ${confirmDialog.requestIds.length} Request(s)`}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "approve" && "This will add the model(s) to your supported devices catalog and send WhatsApp confirmations to customers."}
              {confirmDialog.action === "reject" && "This will reject the request(s) and notify customers via WhatsApp."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, action: null, requestIds: [] })}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "reject" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={isUpdating}
            >
              {isUpdating ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ModelRequestsPage() {
  return (
    <Authenticated>
      <ModelRequestsContent />
    </Authenticated>
  );
}
