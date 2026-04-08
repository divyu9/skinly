import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { Loader2, Key, BarChart3, Database, Image as ImageIcon, UploadIcon, XIcon } from "lucide-react";

export default function SettingsPage() {
  const openAIKeySetting = useQuery(api.settings.getSetting, { key: "OPENAI_API_KEY" });
  const oldKeySetting = useQuery(api.settings.getSetting, { key: "openaiApiKey" });
  const metaPixelSetting = useQuery(api.settings.getSetting, { key: "META_PIXEL_ID" });
  const updateSetting = useMutation(api.settings.updateSetting);
  const migrateKey = useMutation(api.migrateOpenAIKey.migrateOpenAIKey);
  const setupR2Cors = useAction(api.r2.setupR2Cors);
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const updateHomepageSettings = useMutation(api.homepage.updateHomepageSettings);
  const uploadToR2 = useAction(api.r2.uploadToR2);
  
  const [apiKey, setApiKey] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUpCors, setIsSettingUpCors] = useState(false);
  const [isSavingPixel, setIsSavingPixel] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Logo Settings
  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (homepageSettings) {
      setLogoImageUrl(homepageSettings.logoImageUrl || "");
    }
  }, [homepageSettings]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB");
      return;
    }
    setIsUploadingLogo(true);
    try {
      const base64 = await fileToBase64(file);
      const timestamp = Date.now();
      const r2Key = `general/header-logo-${timestamp}.webp`;
      const result = await uploadToR2({
        fileBase64: base64,
        key: r2Key,
        contentType: "image/webp",
      });
      if (result.success && (result.url || result.publicUrl)) {
        setLogoImageUrl(result.url || result.publicUrl || "");
        toast.success("Logo uploaded successfully");
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      toast.error("Failed to upload logo");
      console.error(error);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveLogoSettings = async () => {
    setIsSavingLogo(true);
    try {
      await updateHomepageSettings({
        logoImageUrl: logoImageUrl || undefined,
      });
      toast.success("Logo settings saved successfully");
    } catch (error) {
      toast.error("Failed to save logo settings");
      console.error(error);
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsSaving(true);
    try {
      await updateSetting({
        key: "OPENAI_API_KEY",
        value: apiKey.trim(),
      });
      toast.success("OpenAI API key saved successfully!");
      setApiKey("");
    } catch (error) {
      toast.error("Failed to save API key");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateKey({});
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to migrate API key");
      console.error(error);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSavePixel = async () => {
    if (!metaPixelId.trim()) {
      toast.error("Please enter a Facebook Pixel ID");
      return;
    }

    setIsSavingPixel(true);
    try {
      await updateSetting({
        key: "META_PIXEL_ID",
        value: metaPixelId.trim(),
      });
      toast.success("Facebook Pixel ID saved successfully!");
      setMetaPixelId("");
    } catch (error) {
      toast.error("Failed to save Pixel ID");
      console.error(error);
    } finally {
      setIsSavingPixel(false);
    }
  };

  const handleSetupCors = async () => {
    setIsSettingUpCors(true);
    try {
      const result = await setupR2Cors({});
      if (result?.success) {
        toast.success(result.message || "R2 CORS configured successfully");
      } else {
        toast.error(result?.error || "Failed to configure CORS");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to configure CORS");
      console.error(error);
    } finally {
      setIsSettingUpCors(false);
    }
  };

  const isLoading = openAIKeySetting === undefined || metaPixelSetting === undefined;
  const hasKey = openAIKeySetting?.value;
  const hasPixel = metaPixelSetting?.value;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your application settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Brand Logo
            </CardTitle>
            <CardDescription>
              Upload the main brand logo. This will be automatically displayed across the website (Header, Footer, Checkout, Order Summary, etc.) and auto-adjust its size based on the available space.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-40 h-16 border rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden p-2">
                {logoImageUrl ? (
                  <img
                    src={logoImageUrl}
                    alt="Brand Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground text-xs text-center">
                    <ImageIcon className="size-6 mx-auto mb-1" />
                    No logo uploaded
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
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
                  Recommended: PNG/SVG with transparent background, max 5MB.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="logo-url" className="text-xs text-muted-foreground">
                Or paste image URL directly
              </Label>
              <Input
                id="logo-url"
                value={logoImageUrl}
                onChange={(e) => setLogoImageUrl(e.target.value)}
                placeholder="/logo.webp"
                className="text-xs"
              />
            </div>

            <Button onClick={handleSaveLogoSettings} disabled={isSavingLogo || isUploadingLogo}>
              {isSavingLogo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Logo
            </Button>
          </CardContent>
        </Card>

      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenAI API Key
            </CardTitle>
            <CardDescription>
              Required for AI-powered SEO content generation. Get your API key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                OpenAI Platform
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                {oldKeySetting && !hasKey && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                      ⚠️ API Key Migration Required
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Your API key was saved with an old key name. Click the button below to migrate it to the new format.
                    </p>
                    <Button 
                      onClick={handleMigrate} 
                      disabled={isMigrating}
                      size="sm"
                      variant="outline"
                    >
                      {isMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Migrate API Key
                    </Button>
                  </div>
                )}
                
                {hasKey && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ API key is configured (ends with: ...{String(hasKey).slice(-4)})
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    {hasKey ? "Update API Key" : "Enter API Key"}
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-proj-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isSaving}
                  />
                </div>

                <Button onClick={handleSave} disabled={isSaving || !apiKey.trim()}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasKey ? "Update Key" : "Save Key"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Facebook Pixel ID
            </CardTitle>
            <CardDescription>
              Track and measure your website traffic and conversions. Get your Pixel ID from{" "}
              <a
                href="https://business.facebook.com/events_manager2/list/pixel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Facebook Events Manager
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                {hasPixel && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      ✓ Facebook Pixel is configured (ID: {String(hasPixel)})
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="metaPixelId">
                    {hasPixel ? "Update Pixel ID" : "Enter Pixel ID"}
                  </Label>
                  <Input
                    id="metaPixelId"
                    type="text"
                    placeholder="1234567890123456"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                    disabled={isSavingPixel}
                  />
                </div>

                <Button onClick={handleSavePixel} disabled={isSavingPixel || !metaPixelId.trim()}>
                  {isSavingPixel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasPixel ? "Update Pixel ID" : "Save Pixel ID"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cloudflare R2 Storage
            </CardTitle>
            <CardDescription>
              Manage your R2 storage bucket settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CORS Configuration</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Sets up the required Cross-Origin Resource Sharing (CORS) headers on your R2 bucket to allow direct image uploads from the browser. You only need to run this once per bucket.
              </p>
              <Button 
                onClick={handleSetupCors} 
                disabled={isSettingUpCors}
                variant="secondary"
              >
                {isSettingUpCors && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Configure R2 CORS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
