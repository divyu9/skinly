import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { useAuth } from "@/hooks/use-auth.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { ErrorState, ErrorStateHeader, ErrorStateMedia, ErrorStateTitle, ErrorStateDescription } from "@/components/ui/error-state.tsx";
import { BugIcon, AlertTriangleIcon, FileTextIcon, ImageIcon, VideoIcon, PhoneIcon, MailIcon, CalendarIcon, CheckCircleIcon, TrashIcon, RotateCcwIcon, SearchIcon, XIcon, EyeIcon } from "lucide-react";
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

interface BugReportWithAttachments {
  _id: Id<"bugReports">;
  _creationTime: number;
  bugId: string;
  userEmail: string;
  userPhone: string;
  bugDetails: string;
  status: "pending" | "resolved" | "deleted";
  userId?: Id<"users">;
  attachmentCount: number;
  ipAddress?: string;
  updatedAt?: number;
  attachments: Array<{
    _id: Id<"bugAttachments">;
    bugReportId: Id<"bugReports">;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileId: Id<"_storage">;
    url?: string;
  }>;
}

function BugReportsContent() {
  const { user } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const stats = useQuery(api.admin.bugReports.getBugStats);
  const allReports = useQuery(api.admin.bugReports.getBugReports, {});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBug, setSelectedBug] = useState<BugReportWithAttachments | null>(null);
  const [currentTab, setCurrentTab] = useState<"pending" | "resolved" | "deleted">("pending");
  
  // Status management
  const updateStatus = useMutation(api.admin.bugReports.updateBugStatus);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "resolve" | "delete" | "restore" | null;
    bugId: Id<"bugReports"> | null;
  }>({
    open: false,
    action: null,
    bugId: null,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle status update
  const handleStatusUpdate = async (status: "pending" | "resolved" | "deleted") => {
    if (!confirmDialog.bugId) return;

    setIsUpdating(true);
    try {
      await updateStatus({
        bugReportId: confirmDialog.bugId,
        status,
      });

      const actionText = status === "resolved" ? "resolved" : status === "deleted" ? "deleted" : "restored";
      toast.success(`Bug report ${actionText} successfully`);
      
      // Close dialog and refresh
      setConfirmDialog({ open: false, action: null, bugId: null });
      
      // Close detail modal if it's the same bug
      if (selectedBug?._id === confirmDialog.bugId) {
        setSelectedBug(null);
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update bug status");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const openConfirmDialog = (action: "resolve" | "delete" | "restore", bugId: Id<"bugReports">) => {
    setConfirmDialog({ open: true, action, bugId });
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Get filtered count for current tab
  const getFilteredCount = () => {
    return filteredReports(currentTab).length;
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
              You need admin privileges to view bug reports.
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
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Once you have admin access, you can manage other admins through the Database tab.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats === undefined || allReports === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Filter reports based on search
  const filteredReports = (status: "pending" | "resolved" | "deleted") => {
    const reports = allReports.filter(r => r.status === status);
    if (!searchTerm.trim()) return reports;
    
    const term = searchTerm.toLowerCase();
    return reports.filter(r => 
      r.bugId.toLowerCase().includes(term) ||
      r.userEmail.toLowerCase().includes(term) ||
      r.userPhone.includes(term) ||
      r.bugDetails.toLowerCase().includes(term)
    );
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (fileType.startsWith("video/")) return <VideoIcon className="h-4 w-4" />;
    return <FileTextIcon className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderBugTable = (reports: BugReportWithAttachments[], emptyMessage: string) => {
    if (reports.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BugIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyMessage}</EmptyTitle>
            <EmptyDescription>
              {searchTerm ? "Try adjusting your search terms" : "Bug reports will appear here when submitted"}
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
              <TableHead>Bug ID</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Attachments</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((bug) => (
              <TableRow key={bug._id}>
                <TableCell className="font-mono text-sm">
                  <Badge variant="outline">{bug.bugId}</Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <MailIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[200px]" title={bug.userEmail}>{bug.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <PhoneIcon className="h-3 w-3" />
                      <span>{bug.userPhone}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[300px] truncate text-sm" title={bug.bugDetails}>
                    {bug.bugDetails}
                  </div>
                </TableCell>
                <TableCell>
                  {bug.attachments.length > 0 ? (
                    <Badge variant="secondary">
                      {bug.attachments.length} file{bug.attachments.length > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{formatDistanceToNow(bug._creationTime, { addSuffix: true })}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBug(bug)}
                  >
                    View Details
                  </Button>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <BugIcon className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <BugIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Fixed & closed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deleted</CardTitle>
            <BugIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deleted}</div>
            <p className="text-xs text-muted-foreground">Soft-deleted reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Bug Reports</CardTitle>
          <CardDescription>Manage and track bug reports from users</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by Bug ID, email, phone, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved
            {stats.resolved > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.resolved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deleted">
            Deleted
            {stats.deleted > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.deleted}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {renderBugTable(filteredReports("pending"), "No pending bug reports")}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {renderBugTable(filteredReports("resolved"), "No resolved bug reports")}
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          {renderBugTable(filteredReports("deleted"), "No deleted bug reports")}
        </TabsContent>
      </Tabs>

      {/* Bug Details Dialog - Will be implemented in next milestone */}
      {selectedBug && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bug Report Details</CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant="outline">{selectedBug.bugId}</Badge>
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedBug(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Contact Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MailIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBug.userEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBug.userPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Submitted {formatDistanceToNow(selectedBug._creationTime, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Bug Details</h4>
                <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                  {selectedBug.bugDetails}
                </div>
              </div>

              {selectedBug.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Attachments</h4>
                  <div className="space-y-2">
                    {selectedBug.attachments.map((attachment) => (
                      <div
                        key={attachment._id}
                        className="flex items-center justify-between p-2 border rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          {getFileIcon(attachment.fileType)}
                          <div>
                            <div className="text-sm font-medium">{attachment.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.fileSize)}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`${import.meta.env.VITE_CONVEX_URL}/api/storage/${attachment.fileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium mb-2">Status</h4>
                <Badge
                  variant={
                    selectedBug.status === "pending"
                      ? "default"
                      : selectedBug.status === "resolved"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {selectedBug.status.charAt(0).toUpperCase() + selectedBug.status.slice(1)}
                </Badge>
              </div>

              {/* Status Management Actions */}
              <div className="pt-4 border-t space-y-3">
                <h4 className="text-sm font-medium">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedBug.status === "pending" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openConfirmDialog("resolve", selectedBug._id)}
                        className="gap-2"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        Mark as Resolved
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openConfirmDialog("delete", selectedBug._id)}
                        className="gap-2"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}
                  {selectedBug.status === "resolved" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openConfirmDialog("restore", selectedBug._id)}
                        className="gap-2"
                      >
                        <RotateCcwIcon className="h-4 w-4" />
                        Restore to Pending
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openConfirmDialog("delete", selectedBug._id)}
                        className="gap-2"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}
                  {selectedBug.status === "deleted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmDialog("restore", selectedBug._id)}
                      className="gap-2"
                    >
                      <RotateCcwIcon className="h-4 w-4" />
                      Restore to Pending
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !isUpdating && setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "resolve" && "Mark Bug as Resolved"}
              {confirmDialog.action === "delete" && "Delete Bug Report"}
              {confirmDialog.action === "restore" && "Restore Bug Report"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "resolve" && "This will mark the bug report as resolved. You can restore it later if needed."}
              {confirmDialog.action === "delete" && "This will soft-delete the bug report. You can restore it later from the Deleted tab."}
              {confirmDialog.action === "restore" && "This will restore the bug report to pending status."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, action: null, bugId: null })}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.action === "delete" ? "destructive" : "default"}
              onClick={() => {
                if (confirmDialog.action === "resolve") {
                  handleStatusUpdate("resolved");
                } else if (confirmDialog.action === "delete") {
                  handleStatusUpdate("deleted");
                } else if (confirmDialog.action === "restore") {
                  handleStatusUpdate("pending");
                }
              }}
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

export default function BugsPage() {
  return (
    <Authenticated>
      <BugReportsContent />
    </Authenticated>
  );
}
