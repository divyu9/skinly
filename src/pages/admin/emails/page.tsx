import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
import { Textarea } from "@/components/ui/textarea.tsx";
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
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Eye,
  Edit,
  Trash2,
  Power,
  Send,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

const EMAIL_TYPES = [
  { value: "order_confirmed", label: "Order Confirmed" },
  { value: "order_dispatched", label: "Order Dispatched" },
  { value: "order_delivered", label: "Order Delivered" },
  { value: "order_cancelled", label: "Order Cancelled" },
  { value: "payment_failed", label: "Payment Failed" },
] as const;

type EmailType = (typeof EMAIL_TYPES)[number]["value"];

export default function AdminEmailsPage() {
  const [selectedType, setSelectedType] = useState<EmailType>("order_confirmed");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Id<"emailTemplates"> | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");

  const templates = useQuery(api.emailTemplateManagement.getAllTemplates);
  const variables = useQuery(api.emailTemplateManagement.getTemplateVariables, {
    templateType: selectedType,
  });

  const createTemplate = useMutation(api.emailTemplateManagement.createTemplate);
  const updateTemplate = useMutation(api.emailTemplateManagement.updateTemplate);
  const deleteTemplate = useMutation(api.emailTemplateManagement.deleteTemplate);
  const toggleActive = useMutation(api.emailTemplateManagement.toggleTemplateActive);
  const sendTest = useAction(api.emailTemplateActions.sendTestEmail);

  const filteredTemplates = templates?.filter((t) => t.templateType === selectedType) || [];
  const activeTemplate = filteredTemplates.find((t) => t.isActive);

  const handleCreate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setSubject("");
    setHtmlContent("");
    setEditorOpen(true);
  };

  const handleEdit = (template: typeof filteredTemplates[0]) => {
    setEditingTemplate(template._id);
    setTemplateName(template.templateName);
    setSubject(template.subject);
    setHtmlContent(template.htmlContent);
    setEditorOpen(true);
  };

  const handleSave = async (activate: boolean) => {
    try {
      if (!templateName || !subject || !htmlContent) {
        toast.error("Please fill in all fields");
        return;
      }

      if (editingTemplate) {
        await updateTemplate({
          templateId: editingTemplate,
          templateName,
          subject,
          htmlContent,
          isActive: activate,
        });
        toast.success("Template updated successfully");
      } else {
        await createTemplate({
          templateType: selectedType,
          templateName,
          subject,
          htmlContent,
          isActive: activate,
        });
        toast.success("Template created successfully");
      }

      setEditorOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    }
  };

  const handleDelete = async (templateId: Id<"emailTemplates">) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteTemplate({ templateId });
      toast.success("Template deleted");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleToggleActive = async (templateId: Id<"emailTemplates">) => {
    try {
      await toggleActive({ templateId });
      toast.success("Template status updated");
    } catch (error) {
      toast.error("Failed to update template status");
    }
  };

  const handlePreview = () => {
    setPreviewHtml(htmlContent);
    setPreviewOpen(true);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    if (!editingTemplate) {
      toast.error("Please save the template first");
      return;
    }

    try {
      await sendTest({
        templateId: editingTemplate,
        recipientEmail: testEmail,
      });
      toast.success("Test email sent successfully");
      setTestEmailOpen(false);
      setTestEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    }
  };

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    toast.success(`Copied {{${variable}}}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
            <p className="text-muted-foreground">
              Create and manage custom HTML email templates for order notifications
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Templates by Type</CardTitle>
            <CardDescription>
              Manage email templates for different order notification types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as EmailType)}>
              <TabsList className="grid w-full grid-cols-5">
                {EMAIL_TYPES.map((type) => (
                  <TabsTrigger key={type.value} value={type.value}>
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {EMAIL_TYPES.map((type) => (
                <TabsContent key={type.value} value={type.value} className="space-y-4">
                  {filteredTemplates.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Create your first custom template for {type.label.toLowerCase()} emails
                      </p>
                      <Button className="mt-4" onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Template
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template Name</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTemplates.map((template) => (
                          <TableRow key={template._id}>
                            <TableCell className="font-medium">
                              {template.templateName}
                            </TableCell>
                            <TableCell>{template.subject}</TableCell>
                            <TableCell>
                              {template.isActive ? (
                                <Badge className="bg-green-500">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(template.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(template)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(template._id)}
                                >
                                  <Power
                                    className={cn(
                                      "h-4 w-4",
                                      template.isActive && "text-green-500"
                                    )}
                                  />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(template._id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Current Active Template Info */}
        {activeTemplate && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                Active Template for {EMAIL_TYPES.find((t) => t.value === selectedType)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Template:</span> {activeTemplate.templateName}
                </div>
                <div>
                  <span className="font-medium">Subject:</span> {activeTemplate.subject}
                </div>
                <div>
                  <span className="font-medium">Last Activated:</span>{" "}
                  {activeTemplate.lastActivatedAt
                    ? new Date(activeTemplate.lastActivatedAt).toLocaleString()
                    : "N/A"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              Create custom HTML email template for{" "}
              {EMAIL_TYPES.find((t) => t.value === selectedType)?.label.toLowerCase()} notifications
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-6">
            {/* Editor Section */}
            <div className="col-span-2 space-y-4">
              <div>
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Order Confirmed - v2"
                />
              </div>

              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Your Order {{order_number}} is Confirmed!"
                />
              </div>

              <div>
                <Label htmlFor="htmlContent">HTML Content</Label>
                <Textarea
                  id="htmlContent"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="Enter your HTML template here with {{variable}} placeholders"
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handlePreview}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                {editingTemplate && (
                  <Button variant="outline" onClick={() => setTestEmailOpen(true)}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </Button>
                )}
              </div>
            </div>

            {/* Variables Reference Panel */}
            <div>
              <Label>Available Variables</Label>
              <Card className="mt-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Click to Copy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {variables?.map((variable) => (
                    <Button
                      key={variable}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start font-mono text-xs"
                      onClick={() => copyVariable(variable)}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      {`{{${variable}}}`}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)}>
              Save as Draft
            </Button>
            <Button onClick={() => handleSave(true)}>Save & Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview how your email will look (with sample data)
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-white p-6">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email with sample data to verify your template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testEmail">Recipient Email</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest}>
              <Send className="mr-2 h-4 w-4" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
