import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { SaveIcon, UploadIcon, Loader2Icon, XIcon, ImageIcon } from "lucide-react";

export function SettingsTab() {
  const settings = useQuery(api.homepage.getHomepageSettings);
  const updateSettings = useMutation(api.homepage.updateHomepageSettings);
  const uploadToR2 = useAction(api.r2.uploadToR2);

  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [footerLogoImageUrl, setFooterLogoImageUrl] = useState("");
  const [logoRedirectLink, setLogoRedirectLink] = useState("/");
  const [showSearchIcon, setShowSearchIcon] = useState(true);
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [marqueeMaxModels, setMarqueeMaxModels] = useState(20);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHeaderLogo, setIsUploadingHeaderLogo] = useState(false);
  const [isUploadingFooterLogo, setIsUploadingFooterLogo] = useState(false);

  const headerLogoInputRef = useRef<HTMLInputElement>(null);
  const footerLogoInputRef = useRef<HTMLInputElement>(null);

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setLogoImageUrl(settings.logoImageUrl || "");
      setFooterLogoImageUrl(settings.footerLogoImageUrl || "");
      setLogoRedirectLink(settings.logoRedirectLink || "/");
      setShowSearchIcon(settings.showSearchIcon ?? true);
      setMarqueeEnabled(settings.marqueeEnabled ?? true);
      setMarqueeMaxModels(settings.marqueeMaxModels || 20);
      setAnnouncementEnabled(settings.announcementEnabled ?? false);
      setAnnouncementText(settings.announcementText || "");
      setAnnouncementLink(settings.announcementLink || "");
    }
  }, [settings]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Handle logo upload
  const handleLogoUpload = async (file: File, type: "header" | "footer") => {
    const setUploading = type === "header" ? setIsUploadingHeaderLogo : setIsUploadingFooterLogo;
    const setUrl = type === "header" ? setLogoImageUrl : setFooterLogoImageUrl;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const timestamp = Date.now();
      const r2Key = `general/${type}-logo-${timestamp}.webp`;

      const result = await uploadToR2({
        fileBase64: base64,
        key: r2Key,
        contentType: "image/webp",
      });

      if (result.success && (result.url || result.publicUrl)) {
        setUrl(result.url || result.publicUrl);
        toast.success(`${type === "header" ? "Header" : "Footer"} logo uploaded successfully`);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      toast.error("Failed to upload logo");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        logoImageUrl: logoImageUrl || undefined,
        footerLogoImageUrl: footerLogoImageUrl || undefined,
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

  // Default logo URL (fallback)
  const defaultLogoUrl = "/logo.webp";

  return (
    <div className="space-y-6">
      {/* Header Logo Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Header Logo</CardTitle>
          <CardDescription>
            Upload your header logo (used in mobile header and navigation). Recommended: PNG/SVG with transparent background, max 5MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Preview */}
          <div className="flex items-center gap-4">
            <div className="relative w-40 h-16 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
              {logoImageUrl ? (
                <img
                  src={logoImageUrl}
                  alt="Header Logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-muted-foreground text-xs text-center p-2">
                  <ImageIcon className="size-6 mx-auto mb-1" />
                  No logo uploaded
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={headerLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file, "header");
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => headerLogoInputRef.current?.click()}
                  disabled={isUploadingHeaderLogo}
                >
                  {isUploadingHeaderLogo ? (
                    <>
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="size-4 mr-2" />
                      Upload Logo
                    </>
                  )}
                </Button>
                {logoImageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoImageUrl("")}
                    className="text-destructive hover:text-destructive"
                  >
                    <XIcon className="size-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Uploads to Cloudinary with WebP optimization
              </p>
            </div>
          </div>

          {/* Manual URL Input (fallback) */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="logo-url" className="text-xs text-muted-foreground">
              Or paste image URL directly
            </Label>
            <Input
              id="logo-url"
              value={logoImageUrl}
              onChange={(e) => setLogoImageUrl(e.target.value)}
              placeholder={defaultLogoUrl}
              className="text-xs"
            />
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

      {/* Footer Logo Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Logo</CardTitle>
          <CardDescription>
            Upload a separate logo for the footer (optional). If not set, header logo will be used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Preview */}
          <div className="flex items-center gap-4">
            <div className="relative w-40 h-16 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
              {footerLogoImageUrl ? (
                <img
                  src={footerLogoImageUrl}
                  alt="Footer Logo"
                  className="max-w-full max-h-full object-contain"
                />
              ) : logoImageUrl ? (
                <img
                  src={logoImageUrl}
                  alt="Footer Logo (using header)"
                  className="max-w-full max-h-full object-contain opacity-50"
                />
              ) : (
                <div className="text-muted-foreground text-xs text-center p-2">
                  <ImageIcon className="size-6 mx-auto mb-1" />
                  Using header logo
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={footerLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file, "footer");
                }}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => footerLogoInputRef.current?.click()}
                  disabled={isUploadingFooterLogo}
                >
                  {isUploadingFooterLogo ? (
                    <>
                      <Loader2Icon className="size-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="size-4 mr-2" />
                      Upload Footer Logo
                    </>
                  )}
                </Button>
                {footerLogoImageUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFooterLogoImageUrl("")}
                    className="text-destructive hover:text-destructive"
                  >
                    <XIcon className="size-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to use the header logo
              </p>
            </div>
          </div>

          {/* Manual URL Input (fallback) */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="footer-logo-url" className="text-xs text-muted-foreground">
              Or paste image URL directly
            </Label>
            <Input
              id="footer-logo-url"
              value={footerLogoImageUrl}
              onChange={(e) => setFooterLogoImageUrl(e.target.value)}
              placeholder="Leave empty to use header logo"
              className="text-xs"
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
