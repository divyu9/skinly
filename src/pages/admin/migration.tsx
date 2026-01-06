import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, CheckCircle2, AlertTriangle, Cloud, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function MigrationPage() {
  const migrateAction = useAction(api.migrateShopifyImages.migrateImagesFromShopify);
  
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({
    processed: 0,
    success: 0,
    failed: 0,
    errors: [] as string[],
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  // Auto-run effect when running is true
  useEffect(() => {
    let active = true;

    const runBatch = async () => {
      if (!isRunning || isFinished) return;

      try {
        const result = await migrateAction({
          batchSize: 5, // Small batch for safety
          cursor: cursor || undefined,
        });

        if (!active) return;

        setStats(prev => ({
          processed: prev.processed + result.processed,
          success: prev.success + result.success,
          failed: prev.failed + result.failed,
          errors: [...prev.errors, ...result.errors],
        }));

        if (result.hasMore && result.nextCursor) {
          setCursor(result.nextCursor);
          // Continue automatically if running
          // Add small delay to prevent rate limiting
          setTimeout(runBatch, 1000); 
        } else {
          // Check if we just processed 0 items but there might be more if we keep scanning?
          // The backend logic handles "skipping" non-shopify items, so nextCursor is reliable.
          if (!result.hasMore && result.processed === 0) {
             setIsFinished(true);
             setIsRunning(false);
             toast.success("Migration completed! No more Shopify images found.");
          } else if (result.nextCursor) {
             // If we processed items but have a cursor, keep going
             setCursor(result.nextCursor);
             setTimeout(runBatch, 1000);
          } else {
             setIsFinished(true);
             setIsRunning(false);
             toast.success("Migration completed!");
          }
        }

      } catch (error) {
        console.error("Migration batch failed:", error);
        setStats(prev => ({
          ...prev,
          failed: prev.failed + 1,
          errors: [...prev.errors, `Batch error: ${error instanceof Error ? error.message : "Unknown"}`]
        }));
        setIsRunning(false); // Stop on crash
        toast.error("Migration paused due to error");
      }
    };

    if (isRunning) {
      runBatch();
    }

    return () => { active = false; };
  }, [isRunning, cursor, isFinished, migrateAction]);

  const toggleMigration = () => {
    if (isFinished) {
        // Reset to start over check
        setIsFinished(false);
        setCursor(null);
        setStats({ processed: 0, success: 0, failed: 0, errors: [] });
    }
    setIsRunning(!isRunning);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Migration</h1>
          <p className="text-muted-foreground mt-2">
            Tools to migrate data from legacy platforms to your new infrastructure.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Shopify Image Migration</CardTitle>
                <CardDescription>
                  Move all product images from `cdn.shopify.com` to your Cloudinary storage.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Before you start</AlertTitle>
              <AlertDescription>
                This process will scan all products, download images from Shopify, upload them to Cloudinary, and update your database. 
                Ensure your Cloudinary environment variables are set.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{stats.processed}</div>
                <div className="text-xs text-muted-foreground">Products Scanned</div>
              </div>
              <div className="p-4 border rounded-lg bg-green-100/50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="p-4 border rounded-lg bg-red-100/50 dark:bg-red-900/20">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Progress Bar (Visual only since total is hard to estimate precisely without full scan) */}
            <div className="space-y-2">
               <div className="flex justify-between text-sm">
                 <span>Status</span>
                 <span>{isRunning ? "Migrating..." : isFinished ? "Completed" : "Idle"}</span>
               </div>
               <Progress value={isRunning ? undefined : (isFinished ? 100 : 0)} className="h-2" />
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={toggleMigration} 
                size="lg"
                className={isRunning ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                {isRunning ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" /> Pause Migration
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> {isFinished ? "Restart Scan" : "Start Migration"}
                  </>
                )}
              </Button>
            </div>

            {stats.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2 text-destructive">Error Log</h3>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50">
                  {stats.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-600 mb-1 font-mono">
                      {err}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
