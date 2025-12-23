import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";

type MigrationResult = {
  success: boolean;
  matched: number;
  unmatched: number;
  skipped: number;
  unmatchedVariants: Array<{
    productId: string;
    variantTitle: string;
    gadgetType: string;
  }>;
};

export default function VariantPresetsAutoAssignPage() {
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const runAutoAssign = useAction(api.migrateVariantPresetsAutoAssign.autoAssignPresets);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await runAutoAssign({});
      setResult(res);
    } catch (error) {
      setResult({
        success: false,
        matched: 0,
        unmatched: 0,
        skipped: 0,
        unmatchedVariants: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Auto-Assign Variant Presets</h1>
          <p className="text-muted-foreground mt-2">
            Automatically link variants to consumption presets based on name matching
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Smart Auto-Assignment</CardTitle>
            <CardDescription>
              This tool will automatically match variant titles to preset names (case-insensitive, exact match).
              Only products with a gadget type are eligible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Finds all variants for products with gadget types</li>
                  <li>Matches variant title to preset name (exact match, case-insensitive)</li>
                  <li>Skips variants that already have a preset or custom multiplier</li>
                  <li>Example: Variant "Lid Only" matches preset "Lid Only" for laptops</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleRun}
              disabled={isRunning}
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Auto-Assignment...
                </>
              ) : (
                "Run Auto-Assignment"
              )}
            </Button>

            {result && (
              <div className="space-y-4">
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
                    <p className="font-medium">
                      {result.success
                        ? "Auto-assignment completed successfully"
                        : "Auto-assignment failed"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Matched</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{result.matched}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Variants linked to presets
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Skipped</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{result.skipped}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Already have preset/multiplier
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Unmatched</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{result.unmatched}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        No matching preset found
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {result.unmatchedVariants.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Unmatched Variants</CardTitle>
                      <CardDescription>
                        These variants could not be matched to any preset. You may need to create matching presets or assign manually.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Gadget Type</TableHead>
                            <TableHead>Variant Title</TableHead>
                            <TableHead>Product ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.unmatchedVariants.slice(0, 50).map((v, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Badge variant="secondary">{v.gadgetType}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{v.variantTitle}</TableCell>
                              <TableCell className="text-sm text-muted-foreground font-mono">
                                {v.productId}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {result.unmatchedVariants.length > 50 && (
                        <p className="text-sm text-muted-foreground mt-4 text-center">
                          Showing first 50 of {result.unmatchedVariants.length} unmatched variants
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageWrapper>
  );
}
