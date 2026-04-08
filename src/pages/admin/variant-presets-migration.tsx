import { useState } from "react";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout.tsx";

export default function VariantPresetsMigrationPage() {
  const [result, setResult] = useState<{ success: boolean; created: number; message: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const runMigration = useAction(api.migrateVariantPresets.seedVariantPresets);

  const handleRunMigration = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await runMigration({});
      setResult(res);
    } catch (error) {
      setResult({
        success: false,
        created: 0,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Variant Consumption Presets</h1>
          <p className="text-muted-foreground mt-2">
            Seed common variant consumption presets for all gadget types
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seed Variant Presets</CardTitle>
            <CardDescription>
              This will create common consumption presets like "Lid Only", "Lid + Keyboard" for laptops, 
              "Body + Controller" for drones, etc. Presets are linked to gadget types and can be reused 
              across products. Only runs once (skips if presets already exist).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleRunMigration}
              disabled={isRunning}
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Migration...
                </>
              ) : (
                "Run Migration"
              )}
            </Button>

            {result && (
              <div
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  result.success
                    ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{result.message}</p>
                  {result.success && result.created > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {result.created} consumption presets
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">What this migration does:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Creates preset templates for phones, laptops, tablets, drones, cameras, etc.</li>
                <li>Each preset has a name, multiplier, and description</li>
                <li>Presets are linked to gadget types for easy reuse</li>
                <li>Skips gadget types that already have presets</li>
                <li>Example: Laptop gets "Lid Only" (0.5x), "Lid + Keyboard" (1.0x), "Full Body" (1.5x)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
