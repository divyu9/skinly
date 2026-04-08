import { useState } from "react";
import { useQuery, usePaginatedQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Id } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function WhatsAppDebugLogsPage() {
  const [selectedUsecase, setSelectedUsecase] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedErrorType, setSelectedErrorType] = useState<string | undefined>();
  const [selectedLogId, setSelectedLogId] = useState<Id<"whatsappDebugLogs"> | null>(null);

  // Build filter args
  const filterArgs: {
    usecaseKey?: string;
    success?: boolean;
    errorType?: string;
  } = {};

  if (selectedUsecase) {
    filterArgs.usecaseKey = selectedUsecase;
  }
  if (selectedStatus === "success") {
    filterArgs.success = true;
  } else if (selectedStatus === "failed") {
    filterArgs.success = false;
  }
  if (selectedErrorType) {
    filterArgs.errorType = selectedErrorType;
  }

  const { results: logs, status, loadMore } = usePaginatedQuery(
    api.whatsappDebugLogs.getDebugLogs,
    filterArgs,
    { initialNumItems: 20 }
  );

  const stats = useQuery(api.whatsappDebugLogs.getDebugStats);
  const usecases = useQuery(api.whatsappDebugLogs.getUsecasesWithLogs);
  const errorTypes = useQuery(api.whatsappDebugLogs.getErrorTypes);
  const selectedLog = useQuery(
    api.whatsappDebugLogs.getDebugLog,
    selectedLogId ? { logId: selectedLogId } : "skip"
  );

  const handleClearFilters = () => {
    setSelectedUsecase(undefined);
    setSelectedStatus(undefined);
    setSelectedErrorType(undefined);
  };

  const maskPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      return `+91******${digits.slice(-4)}`;
    }
    return phone;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!logs || !stats) {
    return (
      <AdminLayout>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">WhatsApp Debug Logs</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">WhatsApp Debug Logs</h1>
            <p className="text-muted-foreground">
              Detailed API call logs for debugging WhatsApp messages
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Last 24 Hours</CardTitle>
            <CardDescription>Summary of WhatsApp API calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Calls
                </p>
                <p className="text-2xl font-bold">{stats.totalLogs}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Success
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.successLogs}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Failed
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.failedLogs}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </p>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-full sm:w-48">
                <Select
                  value={selectedUsecase || "all"}
                  onValueChange={(v) =>
                    setSelectedUsecase(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Use Cases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Use Cases</SelectItem>
                    {usecases?.map((uc) => (
                      <SelectItem key={uc.key} value={uc.key}>
                        {uc.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={selectedStatus || "all"}
                  onValueChange={(v) =>
                    setSelectedStatus(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={selectedErrorType || "all"}
                  onValueChange={(v) =>
                    setSelectedErrorType(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Error Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Error Types</SelectItem>
                    {errorTypes?.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedUsecase || selectedStatus || selectedErrorType) && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
            <CardDescription>
              Click on a row to see full details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No debug logs found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Use Case</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Template ID</TableHead>
                        <TableHead>HTTP Status</TableHead>
                        <TableHead>Error Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow
                          key={log._id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => setSelectedLogId(log._id)}
                        >
                          <TableCell>
                            {log.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDistanceToNow(log.createdAt, {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.usecaseKey}
                          </TableCell>
                          <TableCell className="text-xs">
                            {maskPhone(log.recipientPhone)}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">
                            {log.templateId}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.responseStatus === 200
                                  ? "outline"
                                  : "destructive"
                              }
                            >
                              {log.responseStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.errorType ? (
                              <Badge variant="outline" className="text-xs">
                                {log.errorType}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {logs.length} logs
                  </div>
                  {status === "CanLoadMore" && (
                    <Button onClick={() => loadMore(20)} size="sm">
                      <ChevronRight className="mr-2 h-4 w-4" />
                      Load More
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog
          open={selectedLogId !== null}
          onOpenChange={(open) => !open && setSelectedLogId(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Debug Log Details</DialogTitle>
              <DialogDescription>
                Complete request and response information
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-6">
                {/* Status & Error */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedLog.log.success ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <span className="text-lg font-semibold">
                      {selectedLog.log.success ? "Success" : "Failed"}
                    </span>
                  </div>
                  {!selectedLog.log.success && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                      <p className="font-medium text-red-900 dark:text-red-100">
                        {selectedLog.log.errorMessage}
                      </p>
                      {selectedLog.log.suggestedFix && (
                        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                          <strong>Suggested Fix:</strong>{" "}
                          {selectedLog.log.suggestedFix}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Request Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Request Details</h3>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          URL
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(selectedLog.log.requestUrl)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <code className="text-xs break-all">
                        {selectedLog.log.requestUrl}
                      </code>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          Parameters
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(selectedLog.log.requestParams)
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(
                          JSON.parse(selectedLog.log.requestParams),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                    {selectedLog.log.requestVariables && (
                      <div className="rounded-lg bg-muted p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            Variables
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              copyToClipboard(selectedLog.log.requestVariables || "")
                            }
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(
                            JSON.parse(selectedLog.log.requestVariables),
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Response Details */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Response Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        HTTP Status:
                      </span>
                      <Badge
                        variant={
                          selectedLog.log.responseStatus === 200
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {selectedLog.log.responseStatus}
                      </Badge>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          Response Body
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(selectedLog.log.responseBody)
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="text-xs overflow-x-auto">
                        {selectedLog.log.responseBody}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Use Case:</span>
                      <p className="font-medium">{selectedLog.log.usecaseKey}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Template ID:</span>
                      <p className="font-medium">{selectedLog.log.templateId}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>
                      <p className="font-medium">
                        {maskPhone(selectedLog.log.recipientPhone)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Timestamp:</span>
                      <p className="font-medium">
                        {new Date(selectedLog.log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
