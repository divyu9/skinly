import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { Loader2, Key, BarChart3, Database, Image as ImageIcon, UploadIcon, XIcon, ShieldIcon, ClockIcon, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const metaPixelSetting = useQuery(api.settings.getSetting, { key: "META_PIXEL_ID" });
  const updateSetting = useMutation(api.settings.updateSetting);
  const setupR2Cors = useAction(api.r2.setupR2Cors);
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const updateHomepageSettings = useMutation(api.homepage.updateHomepageSettings);
  const uploadToR2 = useAction(api.r2.uploadToR2);
  const recentBackups = useQuery(api.backup.getRecent) as any[] | undefined;
  const runBackupNow = useMutation(api.backup.runBackupNow);
  const unpaidHoursSetting = useQuery(api.settings.getSetting, { key: "AUTO_CANCEL_UNPAID_HOURS" });
  const runUnpaidSweep = useMutation(api.orders.runUnpaidSweep);
  const runDailyDigest = useMutation(api.orders.runDailyDigest);
  const runSeoAutoPages = useMutation(api.seo.runSeoAutoPages);
  const seoPerDaySetting = useQuery(api.settings.getSetting, { key: "SEO_AUTO_PAGES_PER_DAY" });
  const seoPublishSetting = useQuery(api.settings.getSetting, { key: "SEO_AUTO_PUBLISH" });
  const rollFloorSetting = useQuery(api.settings.getSetting, { key: "LOW_STOCK_ROLL_METRES" });
  const sheetFloorSetting = useQuery(api.settings.getSetting, { key: "LOW_STOCK_CUTOUT_SHEETS" });
  
  const [metaPixelId, setMetaPixelId] = useState("");
  const [isSettingUpCors, setIsSettingUpCors] = useState(false);
  const [isSavingPixel, setIsSavingPixel] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [unpaidHours, setUnpaidHours] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [rollFloor, setRollFloor] = useState("");
  const [sheetFloor, setSheetFloor] = useState("");
  const [isSavingFloors, setIsSavingFloors] = useState(false);
  const [isDigesting, setIsDigesting] = useState(false);
  const [seoPerDay, setSeoPerDay] = useState("");
  const [seoPublish, setSeoPublish] = useState(false);
  const [isSavingSeo, setIsSavingSeo] = useState(false);
  const [isSeoRunning, setIsSeoRunning] = useState(false);

  useEffect(() => {
    const v = (seoPerDaySetting as any)?.value;
    if (v !== undefined && v !== null) setSeoPerDay(String(v));
  }, [seoPerDaySetting]);
  useEffect(() => {
    setSeoPublish((seoPublishSetting as any)?.value === true);
  }, [seoPublishSetting]);

  const handleSaveSeoAuto = async () => {
    setIsSavingSeo(true);
    try {
      await Promise.all([
        updateSetting({ key: "SEO_AUTO_PAGES_PER_DAY", value: Math.max(0, Math.floor(Number(seoPerDay) || 0)) }),
        updateSetting({ key: "SEO_AUTO_PUBLISH", value: seoPublish }),
      ]);
      toast.success("Saved");
    } catch {
      toast.error("Could not save that");
    } finally {
      setIsSavingSeo(false);
    }
  };

  const handleSeo = async (mode: "coverage" | "preview" | "run") => {
    setIsSeoRunning(true);
    try {
      const res: any = await runSeoAutoPages(
        mode === "coverage"
          ? { coverageOnly: true }
          : { dryRun: mode === "preview", limit: Number(seoPerDay) || undefined }
      );
      toast.success(res?.message || "Done", {
        description: mode === "coverage"
          ? [
              res?.coverage?.brandsMissing?.length
                ? `Brand + gadget missing: ${res.coverage.brandsMissing.slice(0, 6).join(", ")}`
                : "",
              res?.coverage?.themesMissing?.length
                ? `Themes missing: ${res.coverage.themesMissing.slice(0, 6).join(", ")}`
                : "",
            ].filter(Boolean).join(" — ") || undefined
          : undefined,
        duration: 15000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not run");
    } finally {
      setIsSeoRunning(false);
    }
  };

  useEffect(() => {
    const v = (rollFloorSetting as any)?.value;
    if (v !== undefined && v !== null) setRollFloor(String(v));
  }, [rollFloorSetting]);
  useEffect(() => {
    const v = (sheetFloorSetting as any)?.value;
    if (v !== undefined && v !== null) setSheetFloor(String(v));
  }, [sheetFloorSetting]);

  const handleSaveFloors = async () => {
    setIsSavingFloors(true);
    try {
      await Promise.all([
        updateSetting({ key: "LOW_STOCK_ROLL_METRES", value: Number(rollFloor) || 0 }),
        updateSetting({ key: "LOW_STOCK_CUTOUT_SHEETS", value: Number(sheetFloor) || 0 }),
      ]);
      toast.success("Low-stock levels saved");
    } catch {
      toast.error("Could not save those");
    } finally {
      setIsSavingFloors(false);
    }
  };

  const handleRunDigest = async () => {
    setIsDigesting(true);
    try {
      const res: any = await runDailyDigest({});
      const low = (res?.digest?.lowStock || []).slice(0, 6)
        .map((l: any) => `${l.code} (${l.left}${l.unit === "m" ? "m" : " sheets"})`).join(", ");
      toast.success(res?.message || "Digest built", {
        description: low ? `Running low: ${low}` : "Nothing running low",
        duration: 15000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the digest");
    } finally {
      setIsDigesting(false);
    }
  };

  useEffect(() => {
    const v = (unpaidHoursSetting as any)?.value;
    if (v !== undefined && v !== null) setUnpaidHours(String(v));
  }, [unpaidHoursSetting]);

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res: any = await runBackupNow({});
      toast.success(res?.message || "Backup complete", {
        description: res?.sizeMb ? `${res.sizeMb} MB written to R2 under backups/${res.day}` : undefined,
        duration: 8000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The backup did not finish");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSaveUnpaidRule = async () => {
    const n = Number(unpaidHours);
    if (unpaidHours.trim() !== "" && (!Number.isFinite(n) || (n !== 0 && n < 1))) {
      toast.error("Enter a whole number of hours, or 0 to switch it off");
      return;
    }
    setIsSavingRule(true);
    try {
      await updateSetting({ key: "AUTO_CANCEL_UNPAID_HOURS", value: Math.floor(n || 0) });
      toast.success(n >= 1 ? `Unpaid orders will be cancelled after ${Math.floor(n)} hours` : "Auto-cancel switched off");
    } catch {
      toast.error("Could not save that");
    } finally {
      setIsSavingRule(false);
    }
  };

  /** Counts first. Choosing the window means seeing whose orders it would take. */
  const handlePreviewSweep = async (dryRun: boolean) => {
    const n = Number(unpaidHours);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a window of at least one hour to try");
      return;
    }
    setIsSweeping(true);
    try {
      const res: any = await runUnpaidSweep({ hours: Math.floor(n), dryRun });
      const list = (res?.orders || []).slice(0, 8).map((o: any) => o.orderNumber).join(", ");
      toast[dryRun ? "warning" : "success"](res?.message || "Done", {
        description: list || undefined,
        duration: 12000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The sweep did not run");
    } finally {
      setIsSweeping(false);
    }
  };

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

  const isLoading = metaPixelSetting === undefined;
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

      {/*
        The key is not editable here, and must not be.

        It used to be saved into `settings`, a collection whose rule is
        `read: if true` — so the key was downloadable by anyone who knew the
        project id, and the SEO generator then shipped it to the browser to call
        OpenAI from the page. It now lives only in the functions environment,
        and a write rule refuses anything credential-shaped, so this form could
        no longer save even if it were kept.
      */}
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenAI API Key
            </CardTitle>
            <CardDescription>
              Used for SEO content and the AI listing generator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This key is held on the server, not here. Anything stored on this page is
                readable by the public storefront, so a secret cannot live on it.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              To change it, set <code className="rounded bg-muted px-1 py-0.5">OPENAI_API_KEY</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5">functions/.env</code> and redeploy the
              functions. Get a key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                the OpenAI platform
              </a>.
            </p>
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

        {/*
          A copy of the database somewhere else. There was none, and this shop
          runs bulk rewrites by hand every week.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5" />
              Backups
            </CardTitle>
            <CardDescription>
              Every collection worth keeping is copied to R2 each night at 2:30 am, as one gzipped
              JSON file per collection. Run one by hand before any large edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleBackupNow} disabled={isBackingUp} variant="secondary">
              {isBackingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Back up now
            </Button>

            {recentBackups === undefined ? null : recentBackups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No backup has run yet. The first one goes tonight, or press the button.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last runs</p>
                {recentBackups.map((b: any) => (
                  <div key={b._id} className="flex items-center gap-3 text-sm">
                    <span className={`size-2 rounded-full ${b.ok ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="font-medium tabular-nums">{b.day}</span>
                    <span className="text-muted-foreground">
                      {Number(b.totalDocs || 0).toLocaleString("en-IN")} documents
                      {b.failed?.length ? ` · failed: ${b.failed.join(", ")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/*
          Unpaid orders hold their material off the shelf until something
          closes them. Off by default: the window is a judgement about your own
          customers, and nobody should find it running by accident.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Unpaid orders
            </CardTitle>
            <CardDescription>
              An order takes its sheets and metres off the shelf the moment it is placed, before the
              payment. One abandoned at the payment page holds them until it is cancelled — and
              cancelling puts them back. COD orders are never touched by this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label htmlFor="unpaid-hours">Cancel after (hours)</Label>
                <Input
                  id="unpaid-hours"
                  className="mt-1.5"
                  inputMode="numeric"
                  placeholder="0 = off"
                  value={unpaidHours}
                  onChange={(e) => setUnpaidHours(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveUnpaidRule} disabled={isSavingRule}>
                {isSavingRule && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => handlePreviewSweep(true)} disabled={isSweeping}>
                {isSweeping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Show me which
              </Button>
              <Button variant="outline" onClick={() => handlePreviewSweep(false)} disabled={isSweeping}>
                Run once now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Show me which" changes nothing — it counts what a window would take, which is how you
              pick one. Cancelling sends the customer no message.
            </p>
          </CardContent>
        </Card>

        {/*
          Nothing watched the shelf. A roll running out was discovered when a
          listing went out of stock, which is a day too late.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Morning digest
            </CardTitle>
            <CardDescription>
              At 9:00 every morning: yesterday's orders and takings, what is waiting to be packed,
              what is stuck, and which designs are running low. Sent on WhatsApp to the admin number
              if an <code>admin_daily_digest</code> usecase exists, and recorded either way.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44">
                <Label htmlFor="roll-floor">Roll is low at (metres)</Label>
                <Input id="roll-floor" className="mt-1.5" inputMode="decimal" placeholder="5"
                  value={rollFloor} onChange={(e) => setRollFloor(e.target.value)} />
              </div>
              <div className="w-44">
                <Label htmlFor="sheet-floor">Cutout is low at (sheets)</Label>
                <Input id="sheet-floor" className="mt-1.5" inputMode="numeric" placeholder="3"
                  value={sheetFloor} onChange={(e) => setSheetFloor(e.target.value)} />
              </div>
              <Button onClick={handleSaveFloors} disabled={isSavingFloors}>
                {isSavingFloors && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" onClick={handleRunDigest} disabled={isDigesting}>
                {isDigesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Show me today's
              </Button>
            </div>
          </CardContent>
        </Card>

        {/*
          3,684 models, 230 landing pages. The machinery to write one has
          existed for a while; nothing ever noticed a model had none.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Landing pages, written nightly
            </CardTitle>
            <CardDescription>
              Three kinds of page, written by the same generator the SEO screen uses: one per model
              ("acer swift 5 skins"), one per brand and gadget ("dell laptop skins" — 366 models sit
              behind that one, and none of these existed), and one per theme from your collections
              ("anime phone skins"). A model added today gets its page tomorrow; after that the order is
              what a page is worth — how much sits behind it, times what that kind of thing sells
              for. A console skin's median is ₹1,199 and a phone skin's is ₹199, so a console page
              is written before six phone ones. The cap is what keeps one night's run from spending
              a month of OpenAI budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <Label htmlFor="seo-per-day">Pages a night</Label>
                <Input id="seo-per-day" className="mt-1.5" inputMode="numeric" placeholder="0 = off"
                  value={seoPerDay} onChange={(e) => setSeoPerDay(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" className="size-4" checked={seoPublish}
                  onChange={(e) => setSeoPublish(e.target.checked)} />
                Publish them straight away
              </label>
              <Button onClick={handleSaveSeoAuto} disabled={isSavingSeo}>
                {isSavingSeo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleSeo("coverage")} disabled={isSeoRunning}>
                {isSeoRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                How many are missing?
              </Button>
              <Button variant="outline" onClick={() => handleSeo("preview")} disabled={isSeoRunning}>
                Show me tonight's
              </Button>
              <Button variant="outline" onClick={() => handleSeo("run")} disabled={isSeoRunning}>
                Write them now
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Writing or repairing a page asks the storefront to rebuild itself, so a new page is
              live in about five minutes without going near GitHub.
              Left unpublished, new pages wait in SEO Pages and the morning digest counts them —
              thin or wrong pages at scale hurt a site more than missing ones, so it is worth
              reading a few before turning publishing on. A theme needs 25 products before it gets a
              page at all, and 20 on one gadget: "anime phone" has 58 and earns one, "car" has ten
              across the whole catalogue and does not.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
