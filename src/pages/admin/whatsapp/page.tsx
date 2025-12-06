import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { Search, Power, PowerOff, AlertTriangle, Database, HelpCircle, MessageSquareIcon } from "lucide-react";
import { Authenticated } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { TemplateManager } from "./_components/template-manager.tsx";
import { ProviderSettings } from "./_components/provider-settings.tsx";
import { AdminNotifications } from "./_components/admin-notifications.tsx";
import { SetupWizard } from "./_components/setup-wizard.tsx";

export default function WhatsAppAdminPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());

  const usecases = useQuery(api.whatsapp.getAllUsecases);
  const templates = useQuery(api.whatsapp.getApprovedTemplates);
  const updateUsecase = useMutation(api.whatsapp.updateUsecase);
  const bulkUpdate = useMutation(api.whatsapp.bulkUpdateUsecases);
  const seedUsecases = useMutation(api.whatsappSeed.seedUsecases);
  const seedTemplates = useMutation(api.whatsappSeed.seedTemplates);
  const checkSeeded = useMutation(api.whatsappSeed.checkSeeded);

  // Filter use-cases by search query
  const filteredUsecases = usecases?.filter(
    (uc) =>
      uc.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uc.usecaseKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (uc.description && uc.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate stats
  const enabledCount = usecases?.filter((uc) => uc.enabled).length ?? 0;
  const totalCount = usecases?.length ?? 0;
  const hasTemplateIssues = usecases?.some((uc) => uc.enabled && !uc.templateName) ?? false;

  // Handle toggle change
  const handleToggleChange = async (usecaseKey: string, enabled: boolean) => {
    setUpdatingKeys((prev) => new Set(prev).add(usecaseKey));
    try {
      await updateUsecase({ usecaseKey, enabled });
      toast.success(`Use-case ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(usecaseKey);
        return next;
      });
    }
  };

  // Handle template change
  const handleTemplateChange = async (usecaseKey: string, templateValue: string) => {
    setUpdatingKeys((prev) => new Set(prev).add(usecaseKey));

    try {
      // Parse template value (format: "templateName|providerTemplateId" or "none")
      if (templateValue === "none") {
        await updateUsecase({
          usecaseKey,
          templateName: undefined,
          providerTemplateId: undefined,
        });
        toast.success("Template cleared");
      } else {
        const [templateName, providerTemplateId] = templateValue.split("|");
        await updateUsecase({ usecaseKey, templateName, providerTemplateId });
        toast.success("Template updated");
      }
    } catch (error) {
      toast.error(`Failed to update template: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(usecaseKey);
        return next;
      });
    }
  };

  // Handle enable all
  const handleEnableAll = async () => {
    if (!filteredUsecases) return;
    const keys = filteredUsecases.map((uc) => uc.usecaseKey);
    try {
      const result = await bulkUpdate({ keys, enabled: true });
      toast.success(result.message);
    } catch (error) {
      toast.error(`Failed to enable all: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle disable all
  const handleDisableAll = async () => {
    if (!filteredUsecases) return;
    const keys = filteredUsecases.map((uc) => uc.usecaseKey);
    try {
      const result = await bulkUpdate({ keys, enabled: false });
      toast.success(result.message);
    } catch (error) {
      toast.error(`Failed to disable all: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle seed data
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      // Check if already seeded
      const seededStatus = await checkSeeded({});

      if (seededStatus.usecases.seeded && seededStatus.templates.seeded) {
        toast.info("Data is already seeded");
        setIsSeeding(false);
        return;
      }

      // Seed use-cases
      const usecasesResult = await seedUsecases({});
      
      // Seed templates
      const templatesResult = await seedTemplates({});

      toast.success(
        `Seeded ${usecasesResult.created} use-cases and ${templatesResult.created} templates`
      );
    } catch (error) {
      toast.error(`Failed to seed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSeeding(false);
    }
  };

  if (usecases === undefined || templates === undefined) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <Authenticated>
        <div className="space-y-6">
        {/* Provider Settings */}
        <ProviderSettings />

        {/* Admin Notifications */}
        <AdminNotifications />

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">WhatsApp Use-case Toggles</h1>
            <p className="text-muted-foreground">
              Manage WhatsApp notification use-cases and templates
            </p>
            {usecases && (
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {enabledCount} of {totalCount} enabled
                </span>
                {hasTemplateIssues && (
                  <Badge variant="destructive" className="text-xs">
                    Missing Templates
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <SetupWizard />
            <Button variant="outline" asChild>
              <Link to="/admin/whatsapp/health">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Health Check
              </Link>
            </Button>
            <Button variant="default" asChild>
              <Link to="/admin/whatsapp/messages">
                <MessageSquareIcon className="mr-2 h-4 w-4" />
                View Messages
              </Link>
            </Button>
            <TemplateManager />
            <Button onClick={handleSeedData} disabled={isSeeding} variant="outline">
              <Database className="mr-2 h-4 w-4" />
              {isSeeding ? "Seeding..." : "Seed Data"}
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search use-cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Bulk actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnableAll}
                  disabled={!filteredUsecases?.length}
                >
                  <Power className="mr-2 h-4 w-4" />
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisableAll}
                  disabled={!filteredUsecases?.length}
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  Disable All
                </Button>
              </div>

              {/* Help */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>How to Approve Templates</DialogTitle>
                    <DialogDescription className="space-y-3">
                      <p>
                        To use WhatsApp notifications, you need to get your message templates
                        approved by AUTHKEY and your DLT provider:
                      </p>
                      <ol className="list-decimal space-y-2 pl-4">
                        <li>Register your message templates with your DLT provider</li>
                        <li>Submit templates for approval in the AUTHKEY dashboard</li>
                        <li>Wait for approval (usually 24-48 hours)</li>
                        <li>Once approved, add templates to the approved templates list</li>
                        <li>Assign templates to use-cases on this page</li>
                      </ol>
                      <p className="text-sm text-muted-foreground">
                        Note: Only approved templates can be assigned to use-cases. Marketing
                        messages require user consent.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Use-cases List */}
        {!filteredUsecases?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No use-cases match your search"
                  : "No use-cases found. Click 'Seed Data' to populate initial data."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredUsecases.map((usecase) => {
              const isUpdating = updatingKeys.has(usecase.usecaseKey);
              const hasNoTemplate = usecase.enabled && !usecase.templateName;
              const needsConsent =
                usecase.enabled && !usecase.isTransactional && usecase.requireConsent;

              return (
                <Card key={usecase.usecaseKey}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{usecase.displayName}</CardTitle>
                          {usecase.isTransactional ? (
                            <Badge variant="secondary">Transactional</Badge>
                          ) : (
                            <Badge variant="outline">Marketing</Badge>
                          )}
                        </div>
                        {usecase.description && (
                          <p className="text-sm text-muted-foreground">{usecase.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60">{usecase.usecaseKey}</p>
                      </div>
                      <Switch
                        checked={usecase.enabled}
                        onCheckedChange={(checked) =>
                          handleToggleChange(usecase.usecaseKey, checked)
                        }
                        disabled={isUpdating}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Template Selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Approved Template</label>
                      <Select
                        value={
                          usecase.templateName && usecase.providerTemplateId
                            ? `${usecase.templateName}|${usecase.providerTemplateId}`
                            : "none"
                        }
                        onValueChange={(value) =>
                          handleTemplateChange(usecase.usecaseKey, value)
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (No template assigned)</SelectItem>
                          {templates.map((template) => (
                            <SelectItem
                              key={template.providerTemplateId}
                              value={`${template.templateName}|${template.providerTemplateId}`}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span>{template.templateName}</span>
                                  <Badge
                                    variant={
                                      template.type === "transactional" ? "secondary" : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {template.type}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {template.providerTemplateId}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Warnings */}
                    {hasNoTemplate && (
                      <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950">
                        <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <p className="text-orange-900 dark:text-orange-200">
                          No template selected — messages will not send
                        </p>
                      </div>
                    )}

                    {needsConsent && (
                      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
                        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-900 dark:text-blue-200">
                          Make sure you have user consent for marketing messages
                        </p>
                      </div>
                    )}

                    {/* Last Updated */}
                    {usecase.lastUpdatedBy && usecase.lastUpdatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last updated by {usecase.lastUpdatedBy} on{" "}
                        {new Date(usecase.lastUpdatedAt).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </Authenticated>
    </AdminLayout>
  );
}
