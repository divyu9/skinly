import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  Zap,
  Activity,
  MessageSquare,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function WhatsAppHealthPage() {
  const health = useQuery(api.whatsappHealthCheck.getSystemHealth);
  const autoLinkTemplates = useMutation(api.whatsappAutoFix.autoLinkTemplates);
  const enableTransactional = useMutation(
    api.whatsappAutoFix.enableTransactionalUsecases
  );
  const clearStuckQueue = useMutation(api.whatsappAutoFix.clearStuckQueue);

  const handleAutoLinkTemplates = async () => {
    try {
      const result = await autoLinkTemplates();
      toast.success(result.message);
      window.location.reload();
    } catch (error) {
      toast.error("Failed to link templates");
      console.error(error);
    }
  };

  const handleEnableTransactional = async () => {
    try {
      const result = await enableTransactional();
      toast.success(result.message);
      window.location.reload();
    } catch (error) {
      toast.error("Failed to enable use cases");
      console.error(error);
    }
  };

  const handleClearStuckQueue = async () => {
    try {
      const result = await clearStuckQueue();
      toast.success(result.message);
      window.location.reload();
    } catch (error) {
      toast.error("Failed to clear queue");
      console.error(error);
    }
  };

  if (health === undefined) {
    return (
      <AdminPageWrapper>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">WhatsApp Health</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminPageWrapper>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "disabled":
        return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-600">Healthy</Badge>;
      case "warning":
        return <Badge className="bg-yellow-600">Warning</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "disabled":
        return <Badge variant="outline">Disabled</Badge>;
      default:
        return null;
    }
  };

  const overallStatusMessage =
    health.overallStatus === "healthy"
      ? "All Systems Operational"
      : health.overallStatus === "warning"
      ? "Some Issues Detected"
      : "Critical Issues Detected";

  return (
    <AdminPageWrapper>
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">WhatsApp Health</h1>
          <p className="text-muted-foreground">Monitor and fix WhatsApp messaging system</p>
        </div>
        {/* Overall System Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(health.overallStatus)}
                  {overallStatusMessage}
                </CardTitle>
                <CardDescription>
                  System health and diagnostics
                </CardDescription>
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Provider Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4" />
                  Provider Status
                </div>
                <div className="space-y-1">
                  {health.provider.configured ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        {health.provider.active ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>
                          {health.provider.provider} -{" "}
                          {health.provider.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {health.provider.hasCredentials ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>
                          {health.provider.hasCredentials
                            ? "Credentials Set"
                            : "No Credentials"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      Not Configured
                    </div>
                  )}
                </div>
              </div>

              {/* Queue Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Queue Status
                </div>
                <div className="space-y-1">
                  <div className="text-sm">Pending: {health.queue.pending}</div>
                  <div className="text-sm">
                    Processing: {health.queue.processing}
                  </div>
                  <div className="text-sm">Failed: {health.queue.failed}</div>
                  {health.queue.stuck > 0 && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600">
                      <AlertTriangle className="h-4 w-4" />
                      {health.queue.stuck} stuck messages
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  Last 24 Hours
                </div>
                <div className="space-y-1">
                  <div className="text-sm">
                    Messages: {health.stats.messages24h}
                  </div>
                  <div className="text-sm">
                    Success Rate: {health.stats.successRate}%
                  </div>
                  <div className="text-sm">
                    Active: {health.stats.enabledUsecases} /{" "}
                    {health.stats.totalUsecases} use cases
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Fix common issues with one click
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAutoLinkTemplates} size="sm">
                <LinkIcon className="mr-2 h-4 w-4" />
                Auto-Link Templates
              </Button>
              <Button onClick={handleEnableTransactional} size="sm">
                <Zap className="mr-2 h-4 w-4" />
                Enable All Transactional
              </Button>
              {(health.queue.stuck > 0 || health.queue.failed > 0) && (
                <Button
                  onClick={handleClearStuckQueue}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Clear Stuck Queue
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Use Case Status Table */}
        <Card>
          <CardHeader>
            <CardTitle>Use Case Status ({health.usecases.length})</CardTitle>
            <CardDescription>
              All WhatsApp use cases and their health status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Use Case</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Messages (7d)</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Last Sent</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.usecases.map((usecase) => (
                    <TableRow key={usecase.usecaseKey}>
                      <TableCell>{getStatusIcon(usecase.status)}</TableCell>
                      <TableCell className="font-medium">
                        {usecase.displayName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {usecase.isTransactional
                            ? "Transactional"
                            : "Marketing"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {usecase.enabled ? (
                          <Badge variant="outline" className="text-xs">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {usecase.templateName || (
                          <span className="text-muted-foreground">
                            Not Linked
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{usecase.messageCount}</TableCell>
                      <TableCell>
                        {usecase.successRate !== null ? (
                          <span
                            className={
                              usecase.successRate >= 80
                                ? "text-green-600"
                                : usecase.successRate >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }
                          >
                            {usecase.successRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {usecase.lastSent ? (
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(usecase.lastSent, {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {usecase.issues.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {usecase.issues.map((issue, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs text-red-600"
                              >
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageWrapper>
  );
}
