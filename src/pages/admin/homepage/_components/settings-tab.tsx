import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { SaveIcon } from "lucide-react";

export function SettingsTab() {
  const settings = useQuery(api.homepage.getHomepageSettings);
  const updateSettings = useMutation(api.homepage.updateHomepageSettings);

  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [logoRedirectLink, setLogoRedirectLink] = useState("/");
  const [showSearchIcon, setShowSearchIcon] = useState(true);
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [marqueeMaxModels, setMarqueeMaxModels] = useState(20);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setLogoImageUrl(settings.logoImageUrl || "");
      setLogoRedirectLink(settings.logoRedirectLink || "/");
      setShowSearchIcon(settings.showSearchIcon ?? true);
      setMarqueeEnabled(settings.marqueeEnabled ?? true);
      setMarqueeMaxModels(settings.marqueeMaxModels || 20);
      setAnnouncementEnabled(settings.announcementEnabled ?? false);
      setAnnouncementText(settings.announcementText || "");
      setAnnouncementLink(settings.announcementLink || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        logoImageUrl: logoImageUrl || undefined,
        logoRedirectLink,
        showSearchIcon,
        marqueeEnabled,
        marqueeMaxModels,
        announcementEnabled,
        announcementText: announcementText || undefined,
        announcementLink: announcementLink || undefined,
      });
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (settings === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Header Settings</CardTitle>
          <CardDescription>
            Configure the mobile header logo and search icon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo Image URL</Label>
            <Input
              id="logo-url"
              value={logoImageUrl}
              onChange={(e) => setLogoImageUrl(e.target.value)}
              placeholder="https://cdn.hercules.app/file_..."
            />
            <p className="text-xs text-muted-foreground">
              Upload logo to Files & Media and paste URL here
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-link">Logo Redirect Link</Label>
            <Input
              id="logo-link"
              value={logoRedirectLink}
              onChange={(e) => setLogoRedirectLink(e.target.value)}
              placeholder="/"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Search Icon</Label>
              <p className="text-xs text-muted-foreground">
                Display search icon in mobile header
              </p>
            </div>
            <Switch
              checked={showSearchIcon}
              onCheckedChange={setShowSearchIcon}
            />
          </div>
        </CardContent>
      </Card>

      {/* Marquee Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Models Marquee</CardTitle>
          <CardDescription>
            Configure the scrolling models marquee banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Marquee</Label>
              <p className="text-xs text-muted-foreground">
                Show scrolling supported models banner
              </p>
            </div>
            <Switch
              checked={marqueeEnabled}
              onCheckedChange={setMarqueeEnabled}
            />
          </div>

          {marqueeEnabled && (
            <div className="space-y-2">
              <Label htmlFor="marquee-max">Maximum Models to Display</Label>
              <Input
                id="marquee-max"
                type="number"
                min="1"
                max="50"
                value={marqueeMaxModels}
                onChange={(e) => setMarqueeMaxModels(parseInt(e.target.value) || 20)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Announcement Bar Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Announcement Bar</CardTitle>
          <CardDescription>
            Configure the top announcement banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Announcement Bar</Label>
              <p className="text-xs text-muted-foreground">
                Show announcement banner at the top
              </p>
            </div>
            <Switch
              checked={announcementEnabled}
              onCheckedChange={setAnnouncementEnabled}
            />
          </div>

          {announcementEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="announcement-text">Announcement Text</Label>
                <Input
                  id="announcement-text"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Free shipping on orders above ₹999!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="announcement-link">Link (Optional)</Label>
                <Input
                  id="announcement-link"
                  value={announcementLink}
                  onChange={(e) => setAnnouncementLink(e.target.value)}
                  placeholder="/products"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <SaveIcon className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
