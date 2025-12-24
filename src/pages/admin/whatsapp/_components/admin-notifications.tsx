import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";

export function AdminNotifications() {
  const settings = useQuery(api.whatsapp.getAdminNotificationSettings);
  const saveSettings = useMutation(api.whatsapp.saveAdminNotificationSettings);

  const [enabled, setEnabled] = useState(false);
  const [adminPhone, setAdminPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when settings load
  if (settings && !hasChanges) {
    if (enabled !== settings.enabled || adminPhone !== settings.adminPhone) {
      setEnabled(settings.enabled);
      setAdminPhone(settings.adminPhone || "");
    }
  }

  const handleSave = async () => {
    if (!adminPhone && enabled) {
      toast.error("Please enter an admin phone number");
      return;
    }

    setIsSaving(true);
    try {
      await saveSettings({
        enabled,
        adminPhone: adminPhone.trim(),
      });
      toast.success("Admin notification settings saved");
      setHasChanges(false);
    } catch (error) {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    setHasChanges(true);
  };

  const handlePhoneChange = (value: string) => {
    setAdminPhone(value);
    setHasChanges(true);
  };

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Admin Order Notifications</CardTitle>
        </div>
        <CardDescription>
          Receive WhatsApp notifications for every new order placed on your store
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="admin-notifications-toggle" className="text-base font-medium">
              Enable Admin Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when customers place orders
            </p>
          </div>
          <Switch
            id="admin-notifications-toggle"
            checked={enabled}
            onCheckedChange={handleEnabledChange}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {/* Admin Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="admin-phone">Admin WhatsApp Number</Label>
          <Input
            id="admin-phone"
            type="tel"
            placeholder="+91 9876543210"
            value={adminPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Include country code (e.g., +91 for India)
          </p>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        )}

        {/* Info Message */}
        {enabled && adminPhone && !hasChanges && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
            <p className="text-green-900 dark:text-green-200">
              Admin notifications are active. You'll receive WhatsApp alerts for new orders at{" "}
              <span className="font-medium">{adminPhone}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
