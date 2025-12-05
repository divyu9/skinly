import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { Settings, Eye, EyeOff } from "lucide-react";

const PROVIDERS = [
  { value: "authkey", label: "AUTHKEY", endpoint: "https://api.authkey.io/request" },
  { value: "twilio", label: "Twilio", endpoint: "https://api.twilio.com" },
  { value: "messagebird", label: "MessageBird", endpoint: "https://rest.messagebird.com" },
  { value: "gupshup", label: "Gupshup", endpoint: "https://api.gupshup.io" },
  { value: "other", label: "Other / Custom", endpoint: "" },
];

interface ProviderConfig {
  providerName: string;
  authKey: string;
  apiEndpoint: string;
  senderPhone: string;
  lastUpdatedAt: number;
  lastUpdatedBy: string;
}

export function ProviderSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthKey, setShowAuthKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerSettings = useQuery(api.whatsapp.getWhatsAppProviderSettings) as ProviderConfig | null | undefined;
  const saveSettings = useMutation(api.whatsapp.saveWhatsAppProviderSettings);

  const [formData, setFormData] = useState({
    providerName: "authkey",
    authKey: "",
    apiEndpoint: "",
    senderPhone: "",
  });

  // Load existing settings when dialog opens
  useEffect(() => {
    if (isOpen && providerSettings) {
      setFormData({
        providerName: providerSettings.providerName,
        authKey: providerSettings.authKey,
        apiEndpoint: providerSettings.apiEndpoint,
        senderPhone: providerSettings.senderPhone,
      });
    }
  }, [isOpen, providerSettings]);

  const handleProviderChange = (value: string) => {
    const provider = PROVIDERS.find((p) => p.value === value);
    setFormData({
      ...formData,
      providerName: value,
      apiEndpoint: provider?.endpoint ?? "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await saveSettings({
        providerName: formData.providerName,
        authKey: formData.authKey,
        apiEndpoint: formData.apiEndpoint || undefined,
        senderPhone: formData.senderPhone || undefined,
      });
      toast.success("Provider settings saved successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.value === providerSettings?.providerName);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>WhatsApp Provider</CardTitle>
            <CardDescription>
              Configure your WhatsApp messaging provider
            </CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Provider Settings</DialogTitle>
                <DialogDescription>
                  Configure your WhatsApp provider credentials and settings
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label htmlFor="provider">
                    Provider <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.providerName} onValueChange={handleProviderChange}>
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Auth Key */}
                <div className="space-y-2">
                  <Label htmlFor="authKey">
                    Auth Key / API Key <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="authKey"
                      type={showAuthKey ? "text" : "password"}
                      value={formData.authKey}
                      onChange={(e) => setFormData({ ...formData, authKey: e.target.value })}
                      placeholder="Enter your API key"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthKey(!showAuthKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showAuthKey ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API authentication key from the provider
                  </p>
                </div>

                {/* API Endpoint */}
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">API Endpoint</Label>
                  <Input
                    id="apiEndpoint"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                    placeholder="https://api.provider.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Base URL for API requests (optional, auto-filled for known providers)
                  </p>
                </div>

                {/* Sender Phone */}
                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Sender Phone Number</Label>
                  <Input
                    id="senderPhone"
                    value={formData.senderPhone}
                    onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                    placeholder="+1234567890"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your WhatsApp Business phone number (optional)
                  </p>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {providerSettings ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Provider:</span>
              <Badge variant="secondary" className="text-sm">
                {currentProvider?.label ?? providerSettings.providerName}
              </Badge>
            </div>
            {providerSettings.senderPhone && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sender Phone:</span>
                <span className="text-sm font-medium">{providerSettings.senderPhone}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Last updated by {providerSettings.lastUpdatedBy} on{" "}
              {new Date(providerSettings.lastUpdatedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No provider configured. Click "Configure" to set up your WhatsApp provider.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
