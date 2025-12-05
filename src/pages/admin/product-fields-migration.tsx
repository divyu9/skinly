import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

export default function ProductFieldsMigration() {
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningQuick, setIsRunningQuick] = useState(false);
  const [isRunningForce, setIsRunningForce] = useState(false);
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
  const [forceResults, setForceResults] = useState<{
    totalProducts: number;
    categoriesChanged: number;
    categoriesUnchanged: number;
    finishesAssigned: number;
    beforeCounts: Record<string, number>;
    afterCounts: Record<string, number>;
    unmatchedProducts: string[];
    unmatchedCount: number;
    changedSamples: Array<{title: string; before: string; after: string}>;
  } | null>(null);

  const runMigration = useMutation(api.migrateProductFields.migrateProductFields);
  const ensureCategories = useMutation(api.ensureGadgetCategory.ensureAllProductsHaveCategory);
  const forceRecategorize = useMutation(api.migrateProductFields.forceRecategorizeAllProducts);

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

  const handleForceRecategorize = async () => {
    setIsRunningForce(true);
    setForceResults(null);
    try {
      const result = await forceRecategorize({});
      setForceResults(result);
      toast.success(`Fixed ${result.categoriesChanged} miscategorized products!`);
    } catch (error) {
      toast.error("Force recategorization failed: " + (error as Error).message);
      console.error(error);
    } finally {
      setIsRunningForce(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Product Fields Migration</h1>
            <p className="text-muted-foreground">
              Auto-assign gadgetCategory and finishType fields to all products based on their titles
            </p>
          </div>

          {/* Force Recategorization Card - MAIN ACTION */}
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                Fix Miscategorized Products (Recommended)
              </CardTitle>
              <CardDescription>
                Re-categorize ALL products using the improved detection logic. This fixes camera skins, lens skins, charger skins, iPad skins, controller skins, PS5/Xbox skins, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-background p-4 rounded-lg space-y-2 border">
                <p className="text-sm font-semibold">This will fix:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• iPad/Tablet skins (currently categorized as phone)</li>
                  <li>• Controller skins (currently categorized as phone)</li>
                  <li>• PS5/Xbox/Console skins (currently categorized as phone)</li>
                  <li>• Camera skins (currently categorized as phone)</li>
                  <li>• Lens skins (currently categorized as phone)</li>
                  <li>• Charger skins (currently categorized as accessory)</li>
                  <li>• Drone skins (currently categorized as phone)</li>
                  <li>• Mac Mini skins (currently categorized as phone)</li>
                </ul>
              </div>

              <Button
                onClick={handleForceRecategorize}
                disabled={isRunningForce}
                size="lg"
                className="w-full"
                variant="default"
              >
                {isRunningForce ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Recategorizing Products...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    Fix All Miscategorized Products
                  </>
                )}
              </Button>

              {forceResults && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="size-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Recategorization Complete!</p>
                      <ul className="space-y-1 text-muted-foreground mt-1">
                        <li>• Total products: <strong>{forceResults.totalProducts}</strong></li>
                        <li>• Categories fixed: <strong className="text-green-600">{forceResults.categoriesChanged}</strong></li>
                        <li>• Already correct: <strong>{forceResults.categoriesUnchanged}</strong></li>
                        <li>• Finishes assigned: <strong>{forceResults.finishesAssigned}</strong></li>
                      </ul>
                    </div>
                  </div>

                  {/* Before/After Counts */}
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-muted/50 p-3 rounded-lg border">
                      <p className="font-semibold text-sm mb-2 text-muted-foreground">Before:</p>
                      <ul className="text-xs space-y-1">
                        {Object.entries(forceResults.beforeCounts).map(([cat, count]) => (
                          <li key={cat}>
                            <Badge variant="outline" className="text-xs mr-2">{cat}</Badge>
                            {count}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg border">
                      <p className="font-semibold text-sm mb-2 text-green-600">After:</p>
                      <ul className="text-xs space-y-1">
                        {Object.entries(forceResults.afterCounts).map(([cat, count]) => (
                          <li key={cat}>
                            <Badge variant="outline" className="text-xs mr-2">{cat}</Badge>
                            {count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Sample Changes */}
                  {forceResults.changedSamples.length > 0 && (
                    <div className="bg-muted/30 p-3 rounded-lg border">
                      <p className="font-semibold text-sm mb-2">Sample Changes:</p>
                      <ul className="text-xs space-y-2">
                        {forceResults.changedSamples.map((sample, i) => (
                          <li key={i} className="flex flex-col gap-1">
                            <span className="font-medium">{sample.title}</span>
                            <span className="text-muted-foreground">
                              <Badge variant="outline" className="text-[10px]">{sample.before}</Badge>
                              {' → '}
                              <Badge variant="default" className="text-[10px]">{sample.after}</Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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
    </AdminLayout>
  );
}
