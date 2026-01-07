import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, CheckCircle2, AlertTriangle, Cloud, ArrowRight, ServerIcon } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MigrationPage() {
  const migrateAction = useAction(api.migrateShopifyImages.migrateImagesFromShopify);
  
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("shopify");
  const [stats, setStats] = useState({
    processed: 0,
    success: 0,
    failed: 0,
    scanned: 0,
    errors: [] as string[],
  });
  const [cursor, setCursor] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  // Reset stats when switching tabs
  const handleTabChange = (value: string) => {
    if (isRunning) {
      toast.error("Please stop the current migration before switching tabs.");
      return;
    }
    setActiveTab(value);
    setStats({ processed: 0, success: 0, failed: 0, scanned: 0, errors: [] });
    setCursor(null);
    setIsFinished(false);
  };

  // Auto-run effect when running is true
  useEffect(() => {
    let active = true;

    const runBatch = async () => {
      if (!isRunning || isFinished) return;

      try {
        const result = await migrateAction({
          batchSize: 5, // Small batch for safety
          cursor: cursor || undefined,
          source: activeTab, // "shopify" or "hercules"
        });

        if (!active) return;

        setStats(prev => ({
          processed: prev.processed + result.processed,
          success: prev.success + result.success,
          failed: prev.failed + result.failed,
          scanned: prev.scanned + (result.scanned || 0),
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
             toast.success(`Migration completed! No more ${activeTab} images found.`);
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
  }, [isRunning, cursor, isFinished, migrateAction, activeTab]);

  const toggleMigration = () => {
    if (isFinished) {
        // Reset to start over check
        setIsFinished(false);
        setCursor(null);
        setStats({ processed: 0, success: 0, failed: 0, scanned: 0, errors: [] });
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

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shopify" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Shopify Migration
            </TabsTrigger>
            <TabsTrigger value="hercules" className="flex items-center gap-2">
              <ServerIcon className="h-4 w-4" />
              Hercules Migration
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${activeTab === 'shopify' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    {activeTab === 'shopify' ? <Cloud className="h-6 w-6" /> : <ServerIcon className="h-6 w-6" />}
                  </div>
                  <div>
                    <CardTitle className="capitalize">{activeTab} Image Migration</CardTitle>
                    <CardDescription>
                      Move all product images from {activeTab === 'shopify' ? 'cdn.shopify.com' : 'Hercules CDN'} to your Cloudinary storage.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Before you start</AlertTitle>
                  <AlertDescription>
                    This process will scan all products, fetch images directly from {activeTab === 'shopify' ? 'Shopify' : 'Hercules'}, 
                    upload them to Cloudinary, and update your database.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">{stats.scanned}</div>
                    <div className="text-xs text-muted-foreground">Database Scanned</div>
                  </div>
                  <div className="p-4 border rounded-lg bg-blue-100/50 dark:bg-blue-900/20">
                    <div className="text-2xl font-bold text-blue-600">{stats.processed}</div>
                    <div className="text-xs text-muted-foreground">Matches Found</div>
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
        </Tabs>
      </div>
    </AdminLayout>
  );
}
