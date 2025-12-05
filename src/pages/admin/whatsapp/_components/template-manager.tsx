import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { FileText, Plus, Edit, Trash2, Send, CheckCircle2 } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { VariablesMultiSelect } from "./variables-multi-select.tsx";

interface TemplateFormData {
  templateName: string;
  providerTemplateId: string;
  templateType: "transactional" | "marketing";
  templateBody: string;
  variables: string[]; // Changed to array
  language: string;
  status: "active" | "inactive";
}

export function TemplateManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Id<"whApprovedTemplates"> | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<Id<"whApprovedTemplates"> | null>(null);
  
  // Test template state
  const [testTemplateId, setTestTemplateId] = useState<Id<"whApprovedTemplates"> | null>(null);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const templates = useQuery(api.whatsapp.getAllTemplates);
  const createTemplate = useMutation(api.whatsapp.createTemplate);
  const updateTemplate = useMutation(api.whatsapp.updateTemplate);
  const deleteTemplate = useMutation(api.whatsapp.deleteTemplate);
  const testTemplate = useAction(api.whatsappActions.testTemplate);

  const [formData, setFormData] = useState<TemplateFormData>({
    templateName: "",
    providerTemplateId: "",
    templateType: "transactional",
    templateBody: "",
    variables: [], // Changed to array
    language: "en",
    status: "active",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form
  const resetForm = () => {
    setFormData({
      templateName: "",
      providerTemplateId: "",
      templateType: "transactional",
      templateBody: "",
      variables: [], // Changed to array
      language: "en",
      status: "active",
    });
    setEditingTemplate(null);
  };

  // Open form for new template
  const handleAddNew = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleEdit = (template: {
    _id: Id<"whApprovedTemplates">;
    templateName: string;
    providerTemplateId: string;
    type: "transactional" | "marketing";
    templateBody: string | null;
    variables: string[];
    language: string;
    status: "active" | "inactive";
  }) => {
    setFormData({
      templateName: template.templateName,
      providerTemplateId: template.providerTemplateId,
      templateType: template.type,
      templateBody: template.templateBody ?? "",
      variables: template.variables, // Already an array
      language: template.language,
      status: template.status,
    });
    setEditingTemplate(template._id);
    setIsFormOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const variablesArray = formData.variables.filter((v) => v.length > 0);

      if (editingTemplate) {
        // Update existing template
        await updateTemplate({
          templateId: editingTemplate,
          templateName: formData.templateName,
          providerTemplateId: formData.providerTemplateId,
          templateType: formData.templateType,
          templateBody: formData.templateBody || undefined,
          variables: variablesArray.length > 0 ? variablesArray : undefined,
          language: formData.language,
          status: formData.status,
        });
        toast.success("Template updated successfully");
      } else {
        // Create new template
        await createTemplate({
          templateName: formData.templateName,
          providerTemplateId: formData.providerTemplateId,
          templateType: formData.templateType,
          templateBody: formData.templateBody || undefined,
          variables: variablesArray.length > 0 ? variablesArray : undefined,
          language: formData.language,
        });
        toast.success("Template created successfully");
      }

      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTemplateId) return;

    try {
      await deleteTemplate({ templateId: deleteTemplateId });
      toast.success("Template deleted successfully");
      setDeleteTemplateId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    }
  };

  // Handle test template
  const handleTestTemplate = async () => {
    if (!testTemplateId || !testPhoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsTesting(true);
    try {
      const result = await testTemplate({
        templateId: testTemplateId,
        testPhoneNumber: testPhoneNumber,
      });
      
      toast.success(
        <div>
          <p className="font-semibold">Test message sent!</p>
          <p className="text-sm mt-1">Check your WhatsApp for the message</p>
        </div>
      );
      
      setTestTemplateId(null);
      setTestPhoneNumber("");
    } catch (error) {
      toast.error(
        <div>
          <p className="font-semibold">Test failed</p>
          <p className="text-sm mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      );
    } finally {
      setIsTesting(false);
    }
  };

  const templateCount = templates?.length ?? 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Manage Templates
            {templateCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {templateCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Approved Templates</DialogTitle>
            <DialogDescription>
              Add, edit, or remove approved WhatsApp message templates
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={handleAddNew} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add New Template
            </Button>

            {/* Templates List */}
            {templates === undefined ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : templates.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>No templates yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first approved template to get started
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <Card key={template.providerTemplateId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{template.templateName}</CardTitle>
                            <Badge variant={template.type === "transactional" ? "secondary" : "outline"}>
                              {template.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Provider ID: {template.providerTemplateId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={template.status === "active" ? "secondary" : "outline"} className="text-xs">
                            {template.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTestTemplateId(template._id)}
                            title="Test template"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                            title="Edit template"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTemplateId(template._id)}
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {template.templateBody && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{template.templateBody}</p>
                        {template.variables.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.variables.map((variable) => (
                              <Badge key={variable} variant="outline" className="text-xs">
                                {`{${variable}}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Template Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Add New Template"}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update template details" : "Create a new approved template"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="templateName">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="templateName"
                value={formData.templateName}
                onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                placeholder="e.g., Order Received - v3"
                required
              />
            </div>

            {/* Provider Template ID */}
            <div className="space-y-2">
              <Label htmlFor="providerTemplateId">
                Provider Template ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="providerTemplateId"
                value={formData.providerTemplateId}
                onChange={(e) =>
                  setFormData({ ...formData, providerTemplateId: e.target.value })
                }
                placeholder="e.g., ORDER_RECEIVED_V3"
                required
              />
              <p className="text-xs text-muted-foreground">
                The HSM/template ID from AUTHKEY
              </p>
            </div>

            {/* Template Type */}
            <div className="space-y-2">
              <Label htmlFor="templateType">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.templateType}
                onValueChange={(value: "transactional" | "marketing") =>
                  setFormData({ ...formData, templateType: value })
                }
              >
                <SelectTrigger id="templateType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template Body */}
            <div className="space-y-2">
              <Label htmlFor="templateBody">Template Body</Label>
              <Textarea
                id="templateBody"
                value={formData.templateBody}
                onChange={(e) => setFormData({ ...formData, templateBody: e.target.value })}
                placeholder="Hi {customer_name}, your order #{order_number} has been received!"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use curly braces for variables: {`{variable_name}`}
              </p>
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label htmlFor="variables">Variables</Label>
              <VariablesMultiSelect
                value={formData.variables}
                onChange={(values) => setFormData({ ...formData, variables: values })}
              />
              <p className="text-xs text-muted-foreground">
                Select variables to use in your template message
              </p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                placeholder="en"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This template will be permanently deleted.
              <br />
              <br />
              Note: You cannot delete templates that are currently assigned to use-cases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Template Dialog */}
      <Dialog open={!!testTemplateId} onOpenChange={(open) => !open && setTestTemplateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Template</DialogTitle>
            <DialogDescription>
              Send a test message to verify your template works correctly
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Template info */}
            {testTemplateId && templates && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {templates.find((t) => t._id === testTemplateId)?.templateName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Provider ID: {templates.find((t) => t._id === testTemplateId)?.providerTemplateId}
                </p>
                {templates.find((t) => t._id === testTemplateId)?.variables && templates.find((t) => t._id === testTemplateId)!.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {templates.find((t) => t._id === testTemplateId)!.variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="text-xs">
                        {`{${variable}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Phone number input */}
            <div className="space-y-2">
              <Label htmlFor="testPhone">WhatsApp Phone Number</Label>
              <Input
                id="testPhone"
                type="tel"
                placeholder="+91 9876543210"
                value={testPhoneNumber}
                onChange={(e) => setTestPhoneNumber(e.target.value)}
                disabled={isTesting}
              />
              <p className="text-xs text-muted-foreground">
                Enter your WhatsApp number with country code
              </p>
            </div>

            {/* Info message */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
              <p className="text-blue-900 dark:text-blue-200">
                <strong>Note:</strong> Test variables will be filled with sample values automatically.
                You'll receive the test message on WhatsApp.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTestTemplateId(null);
                  setTestPhoneNumber("");
                }}
                disabled={isTesting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTestTemplate}
                disabled={isTesting || !testPhoneNumber}
              >
                {isTesting ? "Sending..." : "Send Test Message"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
