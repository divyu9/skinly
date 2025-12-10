import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import {
  Mail,
  Settings,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function AdminEmailsPage() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUsecase, setSelectedUsecase] = useState<Id<"emailUsecaseTemplates"> | null>(null);
  const [msg91TemplateId, setMsg91TemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  // Fetch data
  const usecases = useQuery(api.emailManagement.getAllUsecases);
  const stats = useQuery(api.emailManagement.getStats);

  // Mutations
  const updateUsecase = useMutation(api.emailManagement.updateUsecase);
  const seedUsecases = useMutation(api.emailSeed.seedEmailUsecases);

  const handleEdit = (usecase: NonNullable<typeof usecases>[0]) => {
    setSelectedUsecase(usecase._id);
    setMsg91TemplateId(usecase.msg91TemplateId || "");
    setTemplateName(usecase.templateName || "");
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUsecase) return;

    // Find the usecase to get its key
    const usecase = usecases?.find(u => u._id === selectedUsecase);
    if (!usecase) return;

    try {
      await updateUsecase({
        usecaseKey: usecase.usecaseKey,
        msg91TemplateId: msg91TemplateId || undefined,
        templateName: templateName || undefined,
        enabled: msg91TemplateId ? true : false,
      });
      toast.success("Use-case updated successfully");
      setEditDialogOpen(false);
      setSelectedUsecase(null);
      setMsg91TemplateId("");
      setTemplateName("");
    } catch (error) {
      toast.error("Failed to update use-case");
      console.error(error);
    }
  };

  const handleToggleEnabled = async (usecaseKey: string, currentEnabled: boolean) => {
    try {
      await updateUsecase({
        usecaseKey,
        enabled: !currentEnabled,
      });
      toast.success(currentEnabled ? "Use-case disabled" : "Use-case enabled");
    } catch (error) {
      toast.error("Failed to toggle use-case");
      console.error(error);
    }
  };

  const handleSeedUsecases = async () => {
    try {
      const result = await seedUsecases({});
      toast.success(`Seeded ${result.created} use-cases`);
    } catch (error) {
      toast.error("Failed to seed use-cases");
      console.error(error);
    }
  };

  if (!usecases || !stats) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Email Management</h1>
            <p className="text-muted-foreground">
              Configure MSG91 email templates and monitor delivery
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Group usecases by category
  const orderUsecases = usecases.filter((u) =>
    ["order_confirmed", "order_dispatched", "order_delivered", "order_cancelled", "payment_failed"].includes(u.usecaseKey)
  );
  const engagementUsecases = usecases.filter((u) =>
    ["abandoned_cart", "back_in_stock"].includes(u.usecaseKey)
  );
  const supportUsecases = usecases.filter((u) =>
    ["model_requested", "model_added"].includes(u.usecaseKey)
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Email Management</h1>
            <p className="text-muted-foreground">
              Configure MSG91 email templates and monitor delivery
            </p>
          </div>
          <Button onClick={handleSeedUsecases} variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Reseed Use-cases
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm font-medium">Sent</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">
                {stats.successRate}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0
                  ? `${((stats.failed / stats.total) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
        </div>

        {/* Use-cases Tabs */}
        <Tabs defaultValue="order" className="w-full">
          <TabsList>
            <TabsTrigger value="order" className="gap-2">
              <Mail className="h-4 w-4" />
              Order Emails ({orderUsecases.length})
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Engagement ({engagementUsecases.length})
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <FileText className="h-4 w-4" />
              Support ({supportUsecases.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="order" className="space-y-4">
            <UsecaseTable
              usecases={orderUsecases}
              onEdit={handleEdit}
              onToggle={handleToggleEnabled}
            />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <UsecaseTable
              usecases={engagementUsecases}
              onEdit={handleEdit}
              onToggle={handleToggleEnabled}
            />
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <UsecaseTable
              usecases={supportUsecases}
              onEdit={handleEdit}
              onToggle={handleToggleEnabled}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Email Template</DialogTitle>
              <DialogDescription>
                Add MSG91 template ID and configure settings for this use-case
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msg91TemplateId">MSG91 Template ID *</Label>
                <Input
                  id="msg91TemplateId"
                  value={msg91TemplateId}
                  onChange={(e) => setMsg91TemplateId(e.target.value)}
                  placeholder="e.g., 12345678901234567890"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your MSG91 Email Templates dashboard
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name (Optional)</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Order Confirmation V2"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-medium">Important:</p>
                    <p className="mt-1">
                      Make sure your MSG91 template variables match the use-case requirements.
                      The template will be automatically enabled once you save a valid template ID.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!msg91TemplateId.trim()}>
                Save Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function UsecaseTable({
  usecases,
  onEdit,
  onToggle,
}: {
  usecases: NonNullable<ReturnType<typeof useQuery<typeof api.emailManagement.getAllUsecases>>>;
  onEdit: (usecase: NonNullable<typeof usecases>[0]) => void;
  onToggle: (usecaseKey: string, currentEnabled: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Templates</CardTitle>
        <CardDescription>
          Configure MSG91 templates for automated emails
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Use Case</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Template ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usecases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No use-cases found
                </TableCell>
              </TableRow>
            ) : (
              usecases.map((usecase) => (
                <TableRow key={usecase._id}>
                  <TableCell className="font-medium">{usecase.displayName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs">
                    {usecase.description}
                  </TableCell>
                  <TableCell>
                    {usecase.msg91TemplateId ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {usecase.msg91TemplateId}
                      </code>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not configured</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={usecase.enabled}
                        onCheckedChange={() => onToggle(usecase.usecaseKey, usecase.enabled)}
                        disabled={!usecase.msg91TemplateId}
                      />
                      <Badge
                        variant={usecase.enabled ? "default" : "secondary"}
                        className={cn(
                          "gap-1",
                          usecase.enabled && "bg-green-500 hover:bg-green-600"
                        )}
                      >
                        {usecase.enabled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(usecase)}
                    >
                      {usecase.msg91TemplateId ? "Edit" : "Configure"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
