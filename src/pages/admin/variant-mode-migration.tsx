import { useState } from "react";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Loader2, PackageIcon } from "lucide-react";

export default function VariantModeMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    totalProcessed: number;
    singleVariantProducts: number;
    multiVariantProducts: number;
    alreadyMigrated: number;
    skipped: number;
  } | null>(null);

  const runMigration = useAction(api.migrateVariantModes.migrateProductVariantModes);

  const handleRunMigration = async () => {
    setIsRunning(true);
    setResults(null);
    try {
      const result = await runMigration({ batchSize: 500 });
      setResults(result);
      toast.success("Variant mode migration completed!");
    } catch (error) {
      toast.error("Migration failed: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Variant Mode Migration</h1>
          <p className="text-muted-foreground">
            Auto-detect and set variant modes for existing products based on variant count
          </p>
        </div>

        {/* Migration Card */}
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              Run Variant Mode Migration
            </CardTitle>
            <CardDescription>
              This will scan all products and automatically set:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• <strong>Single Variant Mode</strong> for products with only 1 variant (no variant title required)</li>
                <li>• <strong>Multiple Variant Mode</strong> for products with 2+ variants (variant title required)</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background p-4 rounded-lg space-y-2 border">
              <p className="text-sm font-semibold">What this migration does:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Products with 1 variant → <code className="bg-muted px-1.5 py-0.5 rounded">hasMultipleVariants: false</code></li>
                <li>• Products with 2+ variants → <code className="bg-muted px-1.5 py-0.5 rounded">hasMultipleVariants: true</code></li>
                <li>• Single-variant products get <code className="bg-muted px-1.5 py-0.5 rounded">isDefaultVariant: true</code> on their variant</li>
                <li>• Already migrated products are skipped automatically</li>
              </ul>
            </div>

            <Button
              onClick={handleRunMigration}
              disabled={isRunning}
              size="lg"
              className="w-full"
              variant="default"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Running Migration...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  Run Migration Now
                </>
              )}
            </Button>

            {results && (
              <div className="space-y-3 mt-4 pt-4 border-t">
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="size-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Migration Complete!</p>
                    <ul className="space-y-1 text-muted-foreground mt-1">
                      <li>• Total products processed: <strong>{results.totalProcessed}</strong></li>
                      <li>• Single variant products: <strong className="text-blue-600">{results.singleVariantProducts}</strong></li>
                      <li>• Multiple variant products: <strong className="text-purple-600">{results.multiVariantProducts}</strong></li>
                      <li>• Already migrated: <strong>{results.alreadyMigrated}</strong></li>
                      {results.skipped > 0 && <li>• Skipped (no variants): <strong>{results.skipped}</strong></li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="size-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold mb-1">Single Variant Mode:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Product has exactly 1 variant</li>
                <li>No variant title is required in the product form</li>
                <li>Simplified admin UI for single-product items</li>
                <li>The variant is marked with <code className="bg-muted px-1.5 py-0.5 rounded">isDefaultVariant: true</code></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Multiple Variant Mode:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Product has 2 or more variants</li>
                <li>Variant title is required (e.g., "Black", "Only Back", "Full Body Wrap")</li>
                <li>Full multi-variant UI with swatch colors and variant management</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> This migration is safe to run multiple times. It only updates products that haven't been migrated yet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
