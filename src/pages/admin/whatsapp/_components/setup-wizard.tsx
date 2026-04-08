import { useState } from "react";
import { useQuery, useMutation, useAction, useConvex } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { Progress } from "@/components/ui/progress.tsx";

const STEPS = [
  { id: "welcome", title: "Welcome", description: "Let's set up WhatsApp notifications" },
  { id: "seed", title: "Initialize Data", description: "Set up use-cases and templates" },
  { id: "provider", title: "Provider Config", description: "Configure authkey.io API" },
  { id: "templates", title: "Add Templates", description: "Add your first template" },
  { id: "test", title: "Test System", description: "Send a test message" },
  { id: "complete", title: "Complete", description: "You're all set!" },
];

export function SetupWizard() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Seed data state
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Provider settings state
  const [authKey, setAuthKey] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);
  
  // Template state
  const [templateName, setTemplateName] = useState("");
  const [providerTemplateId, setProviderTemplateId] = useState("");
  const [templateType, setTemplateType] = useState<"transactional" | "marketing">("transactional");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  
  // Test message state
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  // Queries and mutations
  const usecases = useQuery(api.whatsapp.getAllUsecases);
  const templates = useQuery(api.whatsapp.getApprovedTemplates);
  const providerSettings = useQuery(api.whatsapp.getWhatsAppProviderSettings);
  
  const convex = useConvex();
  const checkSeeded = useMutation(api.whatsappSeed.checkSeeded);
  const seedUsecases = useMutation(api.whatsappSeed.seedUsecases);
  const seedTemplates = useMutation(api.whatsappSeed.seedTemplates);
  const saveProvider = useMutation(api.whatsapp.saveWhatsAppProviderSettings);
  const createTemplate = useMutation(api.whatsapp.createTemplate);
  const testTemplate = useAction(api.whatsappActions.testTemplate);

  // Calculate completion status
  const isDataSeeded = (usecases?.length ?? 0) > 0;
  const hasProvider = !!providerSettings?.authKey;
  const hasTemplates = (templates?.length ?? 0) > 0;

  // Load provider settings when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && providerSettings?.authKey) {
      setAuthKey(providerSettings.authKey);
    }
  };

  // Handle seed data
  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const status = await checkSeeded({});
      
      if (status.usecases.seeded && status.templates.seeded) {
        toast.success("Data already seeded");
        setCurrentStep(2);
        return;
      }

      await seedUsecases({});
      await seedTemplates({});
      
      toast.success("Data seeded successfully");
      setCurrentStep(2);
    } catch (error) {
      toast.error("Failed to seed data");
      console.error(error);
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle save provider
  const handleSaveProvider = async () => {
    if (!authKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setSavingProvider(true);
    try {
      await saveProvider({
        providerName: "authkey",
        authKey: authKey.trim(),
        apiEndpoint: "https://api.authkey.io/request",
        senderPhone: "",
      });
      toast.success("Provider settings saved");
      setCurrentStep(3);
    } catch (error) {
      toast.error("Failed to save provider settings");
      console.error(error);
    } finally {
      setSavingProvider(false);
    }
  };

  // Handle create template
  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !providerTemplateId.trim()) {
      toast.error("Please fill in all template fields");
      return;
    }

    setCreatingTemplate(true);
    try {
      await createTemplate({
        templateName: templateName.trim(),
        providerTemplateId: providerTemplateId.trim(),
        templateType,
        language: "en",
      });
      toast.success("Template created");
      setTemplateName("");
      setProviderTemplateId("");
      setCurrentStep(4);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create template");
      console.error(error);
    } finally {
      setCreatingTemplate(false);
    }
  };

  // Handle test message
  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setTesting(true);
    try {
      // Get all templates with IDs
      const allTemplates = await convex.query(api.whatsapp.getAllTemplates, {});
      if (!allTemplates || allTemplates.length === 0) {
        toast.error("No templates available");
        return;
      }

      const firstTemplate = allTemplates[0];
      await testTemplate({
        templateId: firstTemplate._id,
        testPhoneNumber: testPhone.trim(),
      });
      toast.success("Test message queued! Check /admin/whatsapp/messages to track delivery.");
      setCurrentStep(5);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test message");
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  // Handle skip test
  const handleSkipTest = () => {
    setCurrentStep(5);
  };

  // Handle finish
  const handleFinish = () => {
    setOpen(false);
    setCurrentStep(0);
    toast.success("Setup complete! WhatsApp notifications are ready to use.");
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Quick Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            WhatsApp Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 ${
                  index === currentStep ? "text-primary font-medium" : ""
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="py-6">
          {currentStep === 0 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Welcome to WhatsApp Setup!</h3>
                <p className="text-muted-foreground">
                  This wizard will guide you through setting up WhatsApp notifications for your store.
                  It takes about 5 minutes.
                </p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What you'll need:</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-left">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>An authkey.io account with API key</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>At least one approved WhatsApp message template</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>A phone number to test with (with country code)</span>
                  </div>
                </CardContent>
              </Card>
              <Button onClick={() => setCurrentStep(1)} size="lg" className="w-full">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Initialize Data</h3>
                <p className="text-sm text-muted-foreground">
                  First, we need to set up the default notification use-cases and template structure.
                </p>
              </div>
              
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Database Status</p>
                      <p className="text-sm text-muted-foreground">
                        {isDataSeeded ? "Data already seeded" : "Ready to initialize"}
                      </p>
                    </div>
                    <Badge variant={isDataSeeded ? "default" : "secondary"}>
                      {isDataSeeded ? "Complete" : "Pending"}
                    </Badge>
                  </div>
                  
                  {isDataSeeded ? (
                    <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-900 dark:text-green-200 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      <span>Your system is already initialized with {usecases?.length ?? 0} use-cases</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSeed}
                      disabled={isSeeding}
                      className="w-full"
                    >
                      {isSeeding ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        <>Initialize System</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {isDataSeeded && (
                  <Button onClick={() => setCurrentStep(2)} className="flex-1">
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Provider Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your authkey.io API key to enable WhatsApp messaging.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="authkey">Authkey.io API Key</Label>
                    <Input
                      id="authkey"
                      type="password"
                      placeholder="Enter your authkey.io API key"
                      value={authKey}
                      onChange={(e) => setAuthKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a
                        href="https://authkey.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        authkey.io dashboard
                      </a>
                    </p>
                  </div>

                  {hasProvider && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-900 dark:text-green-200 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      <span>Provider already configured</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSaveProvider}
                  disabled={savingProvider || !authKey.trim()}
                  className="flex-1"
                >
                  {savingProvider ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save & Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Add Your First Template</h3>
                <p className="text-sm text-muted-foreground">
                  Add a template that you've already approved with authkey.io and your DLT provider.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  {hasTemplates ? (
                    <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-900 dark:text-green-200 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                      <span>You have {templates?.length ?? 0} template(s) configured</span>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="templateName">Template Name</Label>
                        <Input
                          id="templateName"
                          placeholder="e.g., order_confirmation"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="providerId">Provider Template ID</Label>
                        <Input
                          id="providerId"
                          placeholder="e.g., 123456789"
                          value={providerTemplateId}
                          onChange={(e) => setProviderTemplateId(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Find this in your authkey.io dashboard
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Template Type</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={templateType === "transactional" ? "default" : "outline"}
                            onClick={() => setTemplateType("transactional")}
                            className="flex-1"
                          >
                            Transactional
                          </Button>
                          <Button
                            variant={templateType === "marketing" ? "default" : "outline"}
                            onClick={() => setTemplateType("marketing")}
                            className="flex-1"
                          >
                            Marketing
                          </Button>
                        </div>
                      </div>

                      <Button
                        onClick={handleCreateTemplate}
                        disabled={creatingTemplate || !templateName.trim() || !providerTemplateId.trim()}
                        className="w-full"
                      >
                        {creatingTemplate ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>Add Template</>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {hasTemplates && (
                  <Button onClick={() => setCurrentStep(4)} className="flex-1">
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Test the System</h3>
                <p className="text-sm text-muted-foreground">
                  Send a test message to verify everything is working correctly.
                </p>
              </div>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>Make sure to include the country code (e.g., +919876543210 for India)</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Phone Number</Label>
                    <Input
                      id="testPhone"
                      type="tel"
                      placeholder="+919876543210"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleTest}
                    disabled={testing || !testPhone.trim()}
                    className="w-full"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Test...
                      </>
                    ) : (
                      <>Send Test Message</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSkipTest}
                  className="flex-1"
                >
                  Skip Test
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Setup Complete!</h3>
                <p className="text-muted-foreground">
                  WhatsApp notifications are now configured and ready to use.
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Next Steps:</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-left">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    <span>Assign templates to use-cases on the main page</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    <span>Enable the notifications you want to send</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    <span>Monitor message logs to track delivery</span>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleFinish} size="lg" className="w-full">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finish Setup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
