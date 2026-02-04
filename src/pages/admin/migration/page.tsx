import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  Loader2Icon
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

interface MigrationCardProps {
  title: string;
  description: string;
  priority?: string;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  status: string;
  onRunBatch?: () => void;
  isRunning?: boolean;
}

function MigrationCard({
  title,
  description,
  priority,
  total,
  processed,
  successful,
  failed,
  status,
  onRunBatch,
  isRunning
}: MigrationCardProps) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
  const remaining = total - processed;

  const getStatusColor = () => {
    if (status === "completed") return "bg-green-500";
    if (status === "in_progress") return "bg-blue-500";
    if (status === "failed") return "bg-red-500";
    return "bg-gray-500";
  };

  const getStatusIcon = () => {
    if (status === "completed") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    if (status === "in_progress") return <ClockIcon className="w-5 h-5 text-blue-500 animate-pulse" />;
    if (status === "failed") return <XCircleIcon className="w-5 h-5 text-red-500" />;
    return <ClockIcon className="w-5 h-5 text-gray-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              {title}
              {priority && (
                <Badge variant={priority === "CRITICAL" ? "destructive" : "secondary"}>
                  {priority}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onRunBatch && status !== "completed" && (
            <Button
              size="sm"
              onClick={onRunBatch}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  Run Batch
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{successful}</div>
            <div className="text-xs text-muted-foreground">Success</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{remaining}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge variant={status === "completed" ? "default" : "secondary"} className={getStatusColor()}>
            {status === "completed" && "✓ Complete"}
            {status === "in_progress" && "⏳ In Progress"}
            {status === "pending" && "⏸ Pending"}
            {status === "failed" && "✗ Failed"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MigrationDashboard() {
  const migrationStatus = useQuery(api.migrateCloudinaryToR2.getMigrationStatus);
  const [runningBatches, setRunningBatches] = useState<Set<string>>(new Set());

  // Actions
  const runSiteAssets = useAction(api.migrateCloudinaryToR2Batch.migrateSiteAssets);
  const runProductsBatch = useAction(api.migrateCloudinaryToR2Batch.migrateProductImagesBatch);
  const runMockupsBatch = useAction(api.migrateCloudinaryToR2Batch.migrateMockupsBatch);
  const runMediaBatch = useAction(api.migrateCloudinaryToR2Batch.migrateMediaLibraryBatch);

  const handleRunBatch = async (type: string, action: () => Promise<any>) => {
    setRunningBatches(prev => new Set(prev).add(type));
    try {
      await action();
      toast.success(`${type} batch completed successfully`);
    } catch (error) {
      toast.error(`Failed to run ${type} batch: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunningBatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(type);
        return newSet;
      });
    }
  };

  if (!migrationStatus) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const isPhase1Complete =
    migrationStatus.siteAssets.status === "completed" &&
    migrationStatus.products.status === "completed";

  const isFullyComplete =
    isPhase1Complete &&
    migrationStatus.mockups.status === "completed" &&
    migrationStatus.mediaLibrary.status === "completed";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Cloudinary → R2 Migration</h1>
        <p className="text-muted-foreground">
          Monitor and control the migration of images from Cloudinary to Cloudflare R2
        </p>
      </div>

      {/* Deadline Alert */}
      <Alert>
        <AlertTriangleIcon className="h-4 w-4" />
        <AlertTitle>Migration Window: 1 Week</AlertTitle>
        <AlertDescription>
          Complete migration before Cloudinary plan expires. Automated cron runs every 5 minutes.
        </AlertDescription>
      </Alert>

      {/* Phase 1: Critical Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Phase 1: Critical Assets (Priority)</CardTitle>
          <CardDescription>
            Site logos and product images - user-facing content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <MigrationCard
              title="Site Assets (Logos)"
              description="Header and footer logos"
              priority="CRITICAL"
              total={migrationStatus.siteAssets.total}
              processed={migrationStatus.siteAssets.processed}
              successful={migrationStatus.siteAssets.successful}
              failed={migrationStatus.siteAssets.failed}
              status={migrationStatus.siteAssets.status}
              onRunBatch={() => handleRunBatch("Site Assets", () => runSiteAssets({}))}
              isRunning={runningBatches.has("Site Assets")}
            />

            <MigrationCard
              title="Product Images"
              description="Product catalog images"
              priority="HIGH"
              total={migrationStatus.products.total}
              processed={migrationStatus.products.processed}
              successful={migrationStatus.products.successful}
              failed={migrationStatus.products.failed}
              status={migrationStatus.products.status}
              onRunBatch={() => handleRunBatch("Products", () => runProductsBatch({ batchSize: 20 }))}
              isRunning={runningBatches.has("Products")}
            />
          </div>

          {isPhase1Complete && (
            <Alert className="mt-4 bg-green-50 border-green-200">
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Phase 1 Complete!</AlertTitle>
              <AlertDescription className="text-green-700">
                All critical assets have been migrated. Phase 2 (mockups) can now run.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Phase 2: Background Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Phase 2: Background Assets</CardTitle>
          <CardDescription>
            Mockups and media library - runs after Phase 1 complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <MigrationCard
              title="Mockup Images"
              description="Phone mockup images (~9K)"
              total={migrationStatus.mockups.total}
              processed={migrationStatus.mockups.processed}
              successful={migrationStatus.mockups.successful}
              failed={migrationStatus.mockups.failed}
              status={migrationStatus.mockups.status}
              onRunBatch={
                isPhase1Complete
                  ? () => handleRunBatch("Mockups", () => runMockupsBatch({ batchSize: 50, skipExisting: true }))
                  : undefined
              }
              isRunning={runningBatches.has("Mockups")}
            />

            <MigrationCard
              title="Media Library"
              description="Admin media items"
              total={migrationStatus.mediaLibrary.total}
              processed={migrationStatus.mediaLibrary.processed}
              successful={migrationStatus.mediaLibrary.successful}
              failed={migrationStatus.mediaLibrary.failed}
              status={migrationStatus.mediaLibrary.status}
              onRunBatch={
                isPhase1Complete
                  ? () => handleRunBatch("Media Library", () => runMediaBatch({ batchSize: 30 }))
                  : undefined
              }
              isRunning={runningBatches.has("Media Library")}
            />
          </div>

          {!isPhase1Complete && (
            <Alert className="mt-4">
              <ClockIcon className="h-4 w-4" />
              <AlertTitle>Waiting for Phase 1</AlertTitle>
              <AlertDescription>
                Phase 2 will start automatically once Phase 1 (critical assets) is complete.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Failed Items */}
      {(migrationStatus.siteAssets.failedItems.length > 0 ||
        migrationStatus.products.failedItems.length > 0 ||
        migrationStatus.mockups.failedItems.length > 0 ||
        migrationStatus.mediaLibrary.failedItems.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />
              Failed Items
            </CardTitle>
            <CardDescription>
              These items failed to migrate and may need manual intervention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...migrationStatus.siteAssets.failedItems,
                ...migrationStatus.products.failedItems,
                ...migrationStatus.mockups.failedItems,
                ...migrationStatus.mediaLibrary.failedItems].map((item, i) => (
                <Alert key={i} variant="destructive">
                  <AlertDescription>
                    <div className="font-mono text-xs">ID: {item.id}</div>
                    <div className="text-sm mt-1">Error: {item.error}</div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Section */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Checklist</CardTitle>
          <CardDescription>
            After migration, verify these admin pages show R2 links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Link to="/backend-skinly/products" className="text-blue-600 hover:underline">
              → Products List - Product thumbnails
            </Link>
            <Link to="/backend-skinly/homepage" className="text-blue-600 hover:underline">
              → Homepage Settings - Logos and banners
            </Link>
            <Link to="/backend-skinly/media" className="text-blue-600 hover:underline">
              → Media Library - All media items
            </Link>
            <Link to="/backend-skinly/mockups-advanced" className="text-blue-600 hover:underline">
              → Mockups - Mockup images
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Completion Status */}
      {isFullyComplete && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircleIcon className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Migration Complete! 🎉</AlertTitle>
          <AlertDescription className="text-green-700">
            All images have been successfully migrated to Cloudflare R2. You can now:
            <ul className="list-disc list-inside mt-2">
              <li>Verify all images are loading correctly</li>
              <li>Test upload/delete flows</li>
              <li>Remove Cloudinary cron job from convex/crons.ts</li>
              <li>Cancel Cloudinary subscription</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
