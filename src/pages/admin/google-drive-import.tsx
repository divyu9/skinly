import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import { 
  FolderIcon, 
  PlayIcon, 
  PauseIcon, 
  XIcon, 
  RefreshCwIcon, 
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  LoaderIcon,
  ExternalLinkIcon,
  FileIcon,
  DownloadIcon,
  AlertTriangleIcon
} from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface ImportJob {
  _id: Id<"importJobs">;
  _creationTime: number;
  folderId: string;
  folderUrl: string;
  status: "pending" | "running" | "paused" | "completed" | "failed";
  totalFiles?: number;
  filesChecked: number;
  filesSkipped: number;
  filesUploaded: number;
  filesFailed: number;
  currentFile?: string;
  lastCheckpoint?: number;
  startedAt?: number;
  completedAt?: number;
  lastActivityAt?: number;
  errorMessage?: string;
  failedFiles?: Array<{ filename: string; reason: string }>;
}

function AdminGoogleDriveImportInner() {
  const [folderUrl, setFolderUrl] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [selectedJobFailures, setSelectedJobFailures] = useState<ImportJob | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ isConfigured: boolean; message: string } | null>(null);
  
  const allJobs = useQuery(api.googleDriveImportPublic.getAllImportJobs) as ImportJob[] | undefined;
  const activeJobs = useQuery(api.googleDriveImportPublic.getActiveImportJobs) as ImportJob[] | undefined;
  
  const startImport = useAction(api.googleDriveImport.startGoogleDriveImport);
  const checkApiKey = useAction(api.googleDriveImport.checkApiKeyStatus);
  const pauseJob = useMutation(api.googleDriveImportPublic.pauseImportJob);
  const resumeJob = useMutation(api.googleDriveImportPublic.resumeImportJob);
  const cancelJob = useMutation(api.googleDriveImportPublic.cancelImportJob);
  const retryFailed = useMutation(api.googleDriveImportPublic.retryFailedFiles);
  const deleteJob = useMutation(api.googleDriveImportPublic.deleteImportJob);

  const handleCheckApiKey = async () => {
    setIsCheckingApiKey(true);
    try {
      const status = await checkApiKey({});
      setApiKeyStatus(status as { isConfigured: boolean; message: string });
      if (status.isConfigured) {
        toast.success("API key is configured!");
      } else {
        toast.error("API key not found. Please follow the setup guide.");
        setShowSetupGuide(true);
      }
    } catch (error) {
      console.error("Failed to check API key:", error);
      toast.error("Failed to check API key status");
    } finally {
      setIsCheckingApiKey(false);
    }
  };

  const handleStartImport = async () => {
    if (!folderUrl.trim()) {
      toast.error("Please enter a Google Drive folder URL");
      return;
    }

    setIsStarting(true);
    try {
      await startImport({ folderUrl: folderUrl.trim() });
      toast.success("Import job started! Processing files from Google Drive...");
      setFolderUrl("");
    } catch (error) {
      console.error("Failed to start import:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start import";
      toast.error(errorMessage);
      
      // If API key not configured, show setup guide
      if (errorMessage.includes("API key not configured")) {
        setShowSetupGuide(true);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async (jobId: Id<"importJobs">) => {
    try {
      await pauseJob({ jobId });
      toast.success("Import job paused");
    } catch (error) {
      console.error("Failed to pause:", error);
      toast.error("Failed to pause job");
    }
  };

  const handleResume = async (jobId: Id<"importJobs">) => {
    try {
      await resumeJob({ jobId });
      toast.success("Import job resumed");
    } catch (error) {
      console.error("Failed to resume:", error);
      toast.error("Failed to resume job");
    }
  };

  const handleCancel = async (jobId: Id<"importJobs">) => {
    if (!confirm("Are you sure you want to cancel this import?")) return;
    
    try {
      await cancelJob({ jobId });
      toast.success("Import job cancelled");
    } catch (error) {
      console.error("Failed to cancel:", error);
      toast.error("Failed to cancel job");
    }
  };

  const handleRetry = async (jobId: Id<"importJobs">) => {
    try {
      const result = await retryFailed({ jobId });
      toast.success(`Retrying ${result.retriedCount} failed files`);
    } catch (error) {
      console.error("Failed to retry:", error);
      toast.error(error instanceof Error ? error.message : "Failed to retry");
    }
  };

  const handleDelete = async (jobId: Id<"importJobs">) => {
    if (!confirm("Are you sure you want to delete this job record?")) return;
    
    try {
      await deleteJob({ jobId });
      toast.success("Job record deleted");
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete job");
    }
  };

  const getStatusBadge = (status: ImportJob["status"]) => {
    const variants: Record<ImportJob["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { variant: "secondary", icon: <ClockIcon className="h-3 w-3" /> },
      running: { variant: "default", icon: <LoaderIcon className="h-3 w-3 animate-spin" /> },
      paused: { variant: "outline", icon: <PauseIcon className="h-3 w-3" /> },
      completed: { variant: "default", icon: <CheckCircleIcon className="h-3 w-3" /> },
      failed: { variant: "destructive", icon: <AlertCircleIcon className="h-3 w-3" /> },
    };

    const config = variants[status];
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return "—";
    const endTime = end || Date.now();
    const seconds = Math.floor((endTime - start) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const calculateProgress = (job: ImportJob) => {
    if (!job.totalFiles || job.totalFiles === 0) return 0;
    const processed = job.filesChecked;
    return Math.round((processed / job.totalFiles) * 100);
  };

  const isJobStalled = (job: ImportJob) => {
    // A job is stalled if it's running/pending but hasn't had activity in 5+ minutes
    if (job.status !== "running" && job.status !== "pending") return false;
    if (!job.lastActivityAt) return false;
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return job.lastActivityAt < fiveMinutesAgo;
  };

  const getJobStatusDisplay = (job: ImportJob) => {
    if (isJobStalled(job)) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangleIcon className="h-3 w-3" />
          Stalled
        </Badge>
      );
    }
    return getStatusBadge(job.status);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Google Drive Import</h1>
            <p className="mt-2 text-muted-foreground">
              Import mockup images directly from Google Drive folders
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleCheckApiKey}
            disabled={isCheckingApiKey}
          >
            {isCheckingApiKey ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <CheckCircleIcon className="mr-2 h-4 w-4" />
                Check API Key
              </>
            )}
          </Button>
        </div>

        {/* API Key Status Alert */}
        {apiKeyStatus && !apiKeyStatus.isConfigured && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-destructive">
                    Google Drive API Key Not Configured
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {apiKeyStatus.message}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSetupGuide(!showSetupGuide)}
                  >
                    {showSetupGuide ? "Hide" : "Show"} Setup Instructions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Guide */}
        {showSetupGuide && (
          <Card>
            <CardHeader>
              <CardTitle>Google Drive API Setup Guide</CardTitle>
              <CardDescription>
                Follow these steps to enable Google Drive import functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </div>
                  <h3 className="font-semibold">Create a Google Cloud Project</h3>
                </div>
                <p className="ml-8 text-sm text-muted-foreground">
                  Go to{" "}
                  <a
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Cloud Console
                  </a>{" "}
                  and create a new project (or select an existing one).
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    2
                  </div>
                  <h3 className="font-semibold">Enable Google Drive API</h3>
                </div>
                <p className="ml-8 text-sm text-muted-foreground">
                  In the Google Cloud Console, navigate to <strong>APIs & Services → Library</strong>. 
                  Search for "Google Drive API" and click <strong>Enable</strong>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    3
                  </div>
                  <h3 className="font-semibold">Create API Key</h3>
                </div>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Go to <strong>APIs & Services → Credentials</strong> and click{" "}
                    <strong>Create Credentials → API Key</strong>.
                  </p>
                  <p>
                    Copy the generated API key - you'll need it in the next step.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    4
                  </div>
                  <h3 className="font-semibold">Restrict API Key (Recommended)</h3>
                </div>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Click on the API key you just created and set the following restrictions:
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Application restrictions:</strong> None (or IP addresses if you prefer)
                    </li>
                    <li>
                      <strong>API restrictions:</strong> Select "Restrict key" and choose "Google Drive API"
                    </li>
                  </ul>
                  <p>Click <strong>Save</strong>.</p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    5
                  </div>
                  <h3 className="font-semibold">Add API Key to Hercules Secrets</h3>
                </div>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <p>
                    In your Hercules App Builder, go to the <strong>Secrets</strong> tab in the left sidebar.
                  </p>
                  <p>Add a new secret with:</p>
                  <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                    <p>
                      <strong>Key:</strong> GOOGLE_DRIVE_API_KEY
                    </p>
                    <p>
                      <strong>Value:</strong> [Your API key from step 3]
                    </p>
                  </div>
                  <p className="text-yellow-600">
                    <strong>Important:</strong> After adding the secret, refresh this page for the changes to take effect.
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    6
                  </div>
                  <h3 className="font-semibold">Make Your Folder Public</h3>
                </div>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <p>
                    In Google Drive, right-click your folder and select <strong>Share</strong>.
                  </p>
                  <p>
                    Click "Change to anyone with the link" and set permissions to <strong>Viewer</strong>.
                  </p>
                  <p>Copy the folder link and paste it below to start importing!</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCheckApiKey}
                  disabled={isCheckingApiKey}
                >
                  {isCheckingApiKey ? (
                    <>
                      <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="mr-2 h-4 w-4" />
                      Verify API Key
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSetupGuide(false)}
                >
                  Close Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Jobs Summary */}
        {activeJobs && activeJobs.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LoaderIcon className="h-5 w-5 animate-spin" />
                Active Imports ({activeJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeJobs.map((job) => (
                <div key={job._id} className="space-y-2 rounded-lg border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getJobStatusDisplay(job)}
                      <span className="font-mono text-sm text-muted-foreground">
                        {job.folderId.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isJobStalled(job) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResume(job._id)}
                        >
                          <RefreshCwIcon className="h-4 w-4" />
                          Resume
                        </Button>
                      )}
                      {job.status === "running" && !isJobStalled(job) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePause(job._id)}
                        >
                          <PauseIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {job.status === "paused" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResume(job._id)}
                        >
                          <PlayIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(job._id)}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {isJobStalled(job) && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                      <p className="font-medium text-yellow-900">
                        ⚠️ This job appears to be stalled
                      </p>
                      <p className="mt-1 text-yellow-700">
                        No activity detected for over 5 minutes. This usually happens when the import
                        action times out. Click "Resume" to continue from where it left off.
                      </p>
                    </div>
                  )}
                  
                  {job.currentFile && (
                    <p className="text-sm text-muted-foreground">
                      Processing: {job.currentFile}
                    </p>
                  )}
                  
                  <Progress value={calculateProgress(job)} className="h-2" />
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground">
                        Checked: <strong>{job.filesChecked}</strong>
                        {job.totalFiles && ` / ${job.totalFiles}`}
                      </span>
                      <span className="text-green-600">
                        Uploaded: <strong>{job.filesUploaded}</strong>
                      </span>
                      <span className="text-yellow-600">
                        Skipped: <strong>{job.filesSkipped}</strong>
                      </span>
                      {job.filesFailed > 0 && (
                        <span className="text-destructive">
                          Failed: <strong>{job.filesFailed}</strong>
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {formatDuration(job.startedAt, job.lastActivityAt)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Start New Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderIcon className="h-5 w-5" />
              Start New Import
            </CardTitle>
            <CardDescription>
              Paste a public Google Drive folder URL to import all mockup images
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiKeyStatus && !apiKeyStatus.isConfigured && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                <p className="font-medium text-yellow-900">
                  ⚠️ Google Drive API key required
                </p>
                <p className="mt-1 text-yellow-700">
                  Please configure your API key using the setup guide above before starting an import.
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="folderUrl">Google Drive Folder URL</Label>
              <Input
                id="folderUrl"
                type="text"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                disabled={isStarting}
              />
              <p className="text-sm text-muted-foreground">
                Make sure the folder is set to "Anyone with the link can view"
              </p>
            </div>
            
            <Button
              onClick={handleStartImport}
              disabled={!folderUrl.trim() || isStarting}
              className="w-full"
            >
              {isStarting ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Starting Import...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Start Import
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* All Import Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>Last 20 import jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {!allJobs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : allJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderIcon className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No imports yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start your first import by entering a Google Drive folder URL above
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {allJobs.map((job) => (
                  <Card key={job._id} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              {getJobStatusDisplay(job)}
                              <span className="font-mono text-sm text-muted-foreground">
                                ID: {job.folderId.slice(0, 16)}...
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ClockIcon className="h-3 w-3" />
                              Started: {formatDate(job.startedAt)}
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            {isJobStalled(job) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResume(job._id)}
                              >
                                <RefreshCwIcon className="h-4 w-4" />
                                Resume
                              </Button>
                            )}
                            {job.status === "running" && !isJobStalled(job) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePause(job._id)}
                              >
                                <PauseIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {job.status === "paused" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResume(job._id)}
                              >
                                <PlayIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {(job.status === "running" || job.status === "paused" || job.status === "pending") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel(job._id)}
                              >
                                <XIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {job.status === "failed" && job.filesFailed > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetry(job._id)}
                              >
                                <RefreshCwIcon className="h-4 w-4" />
                                Retry Failed
                              </Button>
                            )}
                            {(job.status === "completed" || job.status === "failed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(job._id)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            )}
                            <a
                              href={job.folderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                <ExternalLinkIcon className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </div>

                        {/* Stalled Warning */}
                        {isJobStalled(job) && (
                          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                            <p className="font-medium text-yellow-900">
                              ⚠️ This job appears to be stalled
                            </p>
                            <p className="mt-1 text-yellow-700">
                              No activity for over 5 minutes. Click "Resume" to continue from checkpoint (file {job.lastCheckpoint || 0}).
                            </p>
                          </div>
                        )}

                        {/* Progress Bar */}
                        {job.totalFiles && job.totalFiles > 0 && (
                          <div className="space-y-1">
                            <Progress value={calculateProgress(job)} className="h-2" />
                            <p className="text-right text-xs text-muted-foreground">
                              {calculateProgress(job)}%
                            </p>
                          </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/50 p-4 sm:grid-cols-4">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Checked</p>
                            <p className="text-2xl font-bold">
                              {job.filesChecked}
                              {job.totalFiles && (
                                <span className="text-sm text-muted-foreground">
                                  {" "}/ {job.totalFiles}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Uploaded</p>
                            <p className="text-2xl font-bold text-green-600">
                              {job.filesUploaded}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Skipped</p>
                            <p className="text-2xl font-bold text-yellow-600">
                              {job.filesSkipped}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Failed</p>
                            <p className="text-2xl font-bold text-destructive">
                              {job.filesFailed}
                            </p>
                          </div>
                        </div>

                        {/* Current File & Duration */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            {job.currentFile && (
                              <p className="text-muted-foreground">
                                <FileIcon className="mr-1 inline h-3 w-3" />
                                {job.currentFile}
                              </p>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            Duration: {formatDuration(job.startedAt, job.completedAt || job.lastActivityAt)}
                          </p>
                        </div>

                        {/* Error Message */}
                        {job.errorMessage && (
                          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                            <AlertTriangleIcon className="h-4 w-4 text-destructive" />
                            <p className="text-sm text-destructive">{job.errorMessage}</p>
                          </div>
                        )}

                        {/* Failed Files Link */}
                        {job.failedFiles && job.failedFiles.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedJobFailures(job)}
                          >
                            <AlertCircleIcon className="mr-2 h-4 w-4" />
                            View {job.failedFiles.length} Failed Files
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Failed Files Dialog */}
      <Dialog open={!!selectedJobFailures} onOpenChange={() => setSelectedJobFailures(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Failed Files</DialogTitle>
            <DialogDescription>
              {selectedJobFailures?.failedFiles?.length || 0} files failed to upload
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {selectedJobFailures?.failedFiles?.map((file, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <p className="font-mono text-sm font-medium">{file.filename}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{file.reason}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminGoogleDriveImportPage() {
  return (
    <>
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>Please sign in to access the admin panel</CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton />
            </CardContent>
          </Card>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AdminGoogleDriveImportInner />
      </Authenticated>
    </>
  );
}
