import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { AdminHeader } from "@/components/admin-header.tsx";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

export default function ProductFieldsMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningQuick, setIsRunningQuick] = useState(false);
  const [results, setResults] = useState<{
    totalProducts: number;
    categoriesAssigned: number;
    finishesAssigned: number;
    alreadyHadCategory: number;
    alreadyHadFinish: number;
    unmatchedProducts: string[];
    unmatchedCount: number;
  } | null>(null);
  const [quickResults, setQuickResults] = useState<{
    total: number;
    updated: number;
    alreadySet: number;
    message: string;
  } | null>(null);

  const runMigration = useMutation(api.migrateProductFields.migrateProductFields);
  const ensureCategories = useMutation(api.ensureGadgetCategory.ensureAllProductsHaveCategory);

  const handleRunMigration = async () => {
    setIsRunning(true);
    setResults(null);
    try {
      const result = await runMigration({});
      setResults(result);
      toast.success("Product fields migration completed!");
    } catch (error) {
      toast.error("Migration failed: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEnsureCategories = async () => {
    setIsRunningQuick(true);
    setQuickResults(null);
    try {
      const result = await ensureCategories({});
      setQuickResults(result);
      toast.success("Category safety check completed!");
    } catch (error) {
      toast.error("Safety check failed: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsRunningQuick(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="container mx-auto p-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Product Fields Migration</h1>
            <p className="text-muted-foreground">
              Auto-assign gadgetCategory and finishType fields to all products based on their titles
            </p>
          </div>

          {/* Quick Safety Check Card */}
          <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertCircle className="size-5" />
                Safety Check: Ensure All Products Have Category
              </CardTitle>
              <CardDescription>
                Run this first to ensure all products have a gadgetCategory before enabling the database index
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-100/50 dark:bg-orange-900/20 p-4 rounded-lg space-y-2 border border-orange-200 dark:border-orange-800">
                <p className="text-sm">
                  <strong>Purpose:</strong> This sets <code className="bg-background px-1.5 py-0.5 rounded">gadgetCategory = "phone"</code> for any products that don't have it yet.
                </p>
                <p className="text-xs text-muted-foreground">
                  This is a required step before making gadgetCategory a required field in the database schema.
                </p>
              </div>

              <Button
                onClick={handleEnsureCategories}
                disabled={isRunningQuick}
                size="lg"
                className="w-full"
                variant="default"
              >
                {isRunningQuick ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Running Safety Check...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Run Safety Check Now
                  </>
                )}
              </Button>

              {quickResults && (
                <div className="space-y-2 mt-4 pt-4 border-t border-orange-200">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="size-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-semibold">{quickResults.message}</p>
                      <ul className="space-y-1 text-muted-foreground mt-1">
                        <li>• Total products: <strong>{quickResults.total}</strong></li>
                        <li>• Updated: <strong>{quickResults.updated}</strong></li>
                        <li>• Already had category: <strong>{quickResults.alreadySet}</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Migration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Run Fields Migration
              </CardTitle>
              <CardDescription>
                This will scan all products and automatically assign category and finish type based on title keywords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-sm mb-2">Gadget Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Phone</Badge>
                    <Badge variant="secondary">Laptop</Badge>
                    <Badge variant="secondary">Tablet</Badge>
                    <Badge variant="secondary">Camera</Badge>
                    <Badge variant="secondary">Lens</Badge>
                    <Badge variant="secondary">Drone</Badge>
                    <Badge variant="secondary">Console</Badge>
                    <Badge variant="secondary">Mac Mini</Badge>
                    <Badge variant="secondary">Cover</Badge>
                    <Badge variant="secondary">Accessory</Badge>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-2">Finish Types:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Matte</Badge>
                    <Badge variant="secondary">3D Embossed</Badge>
                    <Badge variant="secondary">Transparent</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Only products without existing category/finish will be updated. Run this after adding new products or to fix unassigned products.
                </p>
              </div>

              <Button
                onClick={handleRunMigration}
                disabled={isRunning}
                size="lg"
                className="w-full"
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
                    <div>
                      <p className="font-semibold">Migration Results:</p>
                      <ul className="space-y-1 text-muted-foreground mt-1">
                        <li>• Total products scanned: <strong>{results.totalProducts}</strong></li>
                        <li>• Categories assigned: <strong>{results.categoriesAssigned}</strong></li>
                        <li>• Finishes assigned: <strong>{results.finishesAssigned}</strong></li>
                        <li>• Already had category: <strong>{results.alreadyHadCategory}</strong></li>
                        <li>• Already had finish: <strong>{results.alreadyHadFinish}</strong></li>
                      </ul>
                    </div>
                  </div>
                  {results.unmatchedCount > 0 && (
                    <div className="flex items-start gap-3 text-sm">
                      <AlertCircle className="size-5 text-amber-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Unmatched Products: {results.unmatchedCount}</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          These products could not be automatically categorized. Please review and assign manually.
                        </p>
                        {results.unmatchedProducts.length > 0 && (
                          <div className="bg-background p-3 rounded border max-h-40 overflow-y-auto">
                            <ul className="space-y-1 text-xs">
                              {results.unmatchedProducts.map((title, i) => (
                                <li key={i}>• {title}</li>
                              ))}
                              {results.unmatchedCount > 20 && (
                                <li className="text-muted-foreground italic">
                                  ... and {results.unmatchedCount - 20} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageSearch className="size-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Gadget Category Detection:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Phone:</strong> Contains "Skin" but NOT "Cover", "Case", "Ring", "Charger", "Magsafe", or "Autoapply"</li>
                  <li><strong>Laptop:</strong> Contains "Laptop" + "Skin"</li>
                  <li><strong>Cover:</strong> Contains "Cover", "Case", "Magsafe Cover", or "Autoapply Guard"</li>
                  <li><strong>Accessory:</strong> Contains "Ring", "Stand", "Holder", or "Charger"</li>
                  <li>Other categories matched by keywords in title</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Finish Type Detection:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Matte:</strong> Contains "Matte"</li>
                  <li><strong>Embossed:</strong> Contains "3D Embossed", "3D Textured", or "Textured"</li>
                  <li><strong>Transparent:</strong> Contains "Tranzy" or "Transparent"</li>
                </ul>
              </div>
              <div className="bg-muted p-3 rounded">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> This migration is safe to run multiple times. It only updates products that don't already have these fields set.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
