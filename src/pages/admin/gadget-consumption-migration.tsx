import { useState } from "react";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GadgetConsumptionMigration() {
  const [result, setResult] = useState<{
    success: boolean;
    linked: number;
    created: number;
    skipped: number;
    message: string;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const runMigration = useAction(api.migrateGadgetConsumption.linkAndSeedConsumption);
  
  const handleRunMigration = async () => {
    if (!confirm("Are you sure you want to run this migration? This will link existing consumption data to gadget types and create missing entries.")) {
      return;
    }
    
    setIsRunning(true);
    setResult(null);
    
    try {
      const migrationResult = await runMigration();
      setResult(migrationResult);
      toast.success("Migration completed successfully!");
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Migration failed. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gadget Consumption Migration</h1>
        <p className="text-muted-foreground">
          Link existing consumption data to gadget types and seed missing entries
        </p>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Migration Steps</CardTitle>
          <CardDescription>This migration will perform the following actions:</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Link existing gadgetConsumption entries to matching gadgetTypes by name</li>
            <li>Create missing consumption entries for gadget types without data</li>
            <li>Use sensible defaults based on typical device dimensions</li>
          </ol>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Default Consumption Values</CardTitle>
          <CardDescription>The following defaults will be used for missing entries:</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Phone:</strong> 15cm × 8cm
            </div>
            <div>
              <strong>Laptop:</strong> 42cm × 29.5cm
            </div>
            <div>
              <strong>Tablet:</strong> 25cm × 20cm
            </div>
            <div>
              <strong>Camera:</strong> 40cm × 29.5cm
            </div>
            <div>
              <strong>Lens:</strong> 20cm × 10cm
            </div>
            <div>
              <strong>Drone:</strong> 35cm × 29.5cm
            </div>
            <div>
              <strong>Charger:</strong> 10cm × 8cm
            </div>
            <div>
              <strong>Console:</strong> 40cm × 29.5cm
            </div>
            <div>
              <strong>Mac Mini:</strong> 20cm × 20cm
            </div>
            <div>
              <strong>Cover:</strong> 15cm × 8cm
            </div>
            <div>
              <strong>Accessory:</strong> 10cm × 8cm
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            onClick={handleRunMigration}
            disabled={isRunning}
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Running Migration...
              </>
            ) : (
              <>Run Migration</>
            )}
          </Button>
        </div>
        
        {result && (
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="size-5 text-green-600" />
            ) : (
              <AlertCircle className="size-5 text-red-600" />
            )}
            <span className="text-sm font-medium">
              {result.success ? "Success" : "Failed"}
            </span>
          </div>
        )}
      </div>
      
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Migration Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Linked existing entries:</span>
                <span className="text-lg font-bold">{result.linked}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Created new entries:</span>
                <span className="text-lg font-bold">{result.created}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Skipped (already linked):</span>
                <span className="text-lg font-bold">{result.skipped}</span>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">{result.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
