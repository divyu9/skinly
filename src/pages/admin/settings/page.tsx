import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { Loader2, Key } from "lucide-react";

export default function SettingsPage() {
  const openAIKeySetting = useQuery(api.settings.getSetting, { key: "OPENAI_API_KEY" });
  const oldKeySetting = useQuery(api.settings.getSetting, { key: "openaiApiKey" });
  const updateSetting = useMutation(api.settings.updateSetting);
  const migrateKey = useMutation(api.migrateOpenAIKey.migrateOpenAIKey);
  
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

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

  const isLoading = openAIKeySetting === undefined;
  const hasKey = openAIKeySetting?.value;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your application settings</p>
        </div>

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
      </div>
    </AdminLayout>
  );
}
