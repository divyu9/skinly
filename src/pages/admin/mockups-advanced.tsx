import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { toast } from "sonner";
import { 
  Upload, 
  Search, 
  Image as ImageIcon, 
  CheckCircle2, 
  XCircle, 
  FolderOpen,
  Trash2,
  Download,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Database,
  Images,
  BarChart3,
  X,
  Minimize2,
  Maximize2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert.tsx";

// --- TYPES ---

interface UploadTask {
  id: string;
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
  files: File[];
  status: 'pending' | 'uploading' | 'completed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    current: string;
  };
  fileStatuses: Map<string, 'pending' | 'uploading' | 'success' | 'failed' | 'skipped'>;
  skipExisting: boolean;
  cancelController?: AbortController;
}

// --- COMPONENTS ---

// Upload Progress Panel (Floating)
function UploadProgressPanel({ 
  tasks, 
  onCancel, 
  onDismiss 
}: { 
  tasks: UploadTask[], 
  onCancel: (id: string) => void,
  onDismiss: (id: string) => void 
}) {
  const [minimized, setMinimized] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-full max-w-md bg-background border shadow-xl rounded-lg overflow-hidden transition-all duration-300 ${minimized ? 'h-12' : 'max-h-[80vh]'}`}>
      <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between cursor-pointer" onClick={() => setMinimized(!minimized)}>
        <div className="font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Manager ({tasks.length})
        </div>
        <div className="flex items-center gap-1">
          {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </div>
      </div>
      
      {!minimized && (
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-4">
            {tasks.map(task => {
              const percentage = task.progress.total > 0 
                ? ((task.progress.completed + task.progress.failed + task.progress.skipped) / task.progress.total) * 100 
                : 0;

              return (
                <div key={task.id} className="border rounded-md p-3 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{task.brandName} {task.modelName}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.status === 'completed' ? 'Upload Complete' : 
                         task.status === 'cancelled' ? 'Cancelled' :
                         task.status === 'pending' ? 'Pending...' :
                         `Uploading... ${task.progress.current}`}
                      </div>
                    </div>
                    {task.status === 'uploading' || task.status === 'pending' ? (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCancel(task.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDismiss(task.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{Math.round(percentage)}%</span>
                      <span>{task.progress.completed + task.progress.failed + task.progress.skipped} / {task.progress.total}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <div className="flex gap-3 text-xs pt-1">
                      <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {task.progress.completed}</span>
                      <span className="text-blue-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {task.progress.skipped}</span>
                      <span className="text-red-600 flex items-center gap-1"><XCircle className="h-3 w-3" /> {task.progress.failed}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// Parse SKU from filename
function parseSKUFromFilename(filename: string): string | null {
  // Remove _B, _B1, _B2 anywhere in the filename (case insensitive)
  // Also handle cases where it might be attached to other words e.g. "Model_B1_SKU"
  const cleanFilename = filename.replace(/_B\d*(?=_|\.|$| )/gi, "_");
  
  // Match patterns like L-01, M-123, S-45, R-123, A-01, T-50 etc.
  // Also supports optional suffixes like R-123-PH
  const match = cleanFilename.match(/([LMSBFART])-(\d+)(?:-[A-Z0-9]+)?/i);
  
  if (!match) return null;

  // Always return uppercase
  return match[0].toUpperCase();
}

// View Mockups Dialog
function ViewMockupsDialog({
  open,
  onOpenChange,
  modelId,
  brandName,
  modelName,
  mockups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
  mockups: any[];
}) {
  const deleteMockup = useMutation(api.mockupsAdvanced.deleteMockup);
  const [deletingId, setDeletingId] = useState<Id<"mockups"> | null>(null);

  const handleDelete = async (id: Id<"mockups">) => {
    if (!confirm("Are you sure you want to delete this mockup?")) return;
    setDeletingId(id);
    try {
      await deleteMockup({ mockupId: id });
      toast.success("Mockup deleted");
    } catch (error) {
      toast.error("Failed to delete mockup");
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mockups for {brandName} {modelName}</DialogTitle>
          <DialogDescription>
            {mockups.length} mockups uploaded
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1">
          {mockups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No mockups found for this model.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mockups.map((mockup) => (
                <div key={mockup._id} className="relative group border rounded-lg overflow-hidden">
                  <div className="aspect-[9/16] bg-muted relative">
                    <img
                      src={mockup.cloudinaryUrl || "/placeholder.png"}
                      alt={mockup.sku}
                      className="object-cover w-full h-full"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(mockup._id)}
                        disabled={deletingId === mockup._id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-2 bg-background border-t text-center">
                    <span className="font-mono font-bold text-sm">{mockup.sku}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Delete All Mockups Dialog
function DeleteAllMockupsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);
  const deleteAll = useMutation(api.mockupsAdvanced.deleteAllMockups);

  const handleDelete = async () => {
    setDeleting(true);
    let totalDeleted = 0;
    
    try {
      // Loop until all deleted
      while (true) {
        const result = await deleteAll({});
        totalDeleted += result.deleted;
        if (!result.hasMore) break;
      }
      
      toast.success(`Successfully deleted all ${totalDeleted} mockups.`);
      onOpenChange(false);
      setStep(1); // Reset for next time
    } catch (error) {
      toast.error("Failed to delete mockups");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setStep(1); // Reset on close
      onOpenChange(val);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete ALL Mockups</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "This will delete EVERY mockup in the system. Are you sure you want to proceed?"
              : "Please confirm your choice."
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="py-4">
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action will remove all mockups from the database and delete their images from Cloudinary.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-md">
              <p className="text-destructive font-bold text-center">
                THIS ACTION IS IRREVERSIBLE!
              </p>
              <p className="text-destructive text-sm text-center mt-2">
                You are about to permanently delete all mockups. This cannot be undone.
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Are you absolutely sure?
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button variant="destructive" onClick={() => setStep(2)}>
              Next Step
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting Everything..." : "Yes, Delete Everything"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delete SKU Dialog
function DeleteSKUDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sku, setSku] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteBySKU = useMutation(api.mockupsAdvanced.deleteMockupsBySKU);

  const handleDelete = async () => {
    if (!sku.trim()) return;
    
    if (!confirm(`Are you sure you want to delete SKU "${sku}" from ALL models? This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const result = await deleteBySKU({ sku: sku.trim().toUpperCase() });
      if (result.deleted > 0) {
        toast.success(`Deleted ${result.deleted} mockups for SKU ${sku}`);
        onOpenChange(false);
        setSku("");
      } else {
        toast.info(`No mockups found for SKU ${sku}`);
      }
    } catch (error) {
      toast.error("Failed to delete mockups");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Mockups by SKU</DialogTitle>
          <DialogDescription>
            Enter a SKU (e.g., "L-01") to delete it from ALL models in the system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">SKU to Delete</label>
            <Input 
              placeholder="e.g. L-01" 
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This will permanently delete all mockup images associated with this SKU from Cloudinary and the database.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={!sku.trim() || deleting}
          >
            {deleting ? "Deleting..." : "Delete All Matches"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Model card component with lazy-loaded stats
function ModelCard({ 
  modelId, 
  brandName, 
  modelName, 
  initialCount,
  onUploadClick,
  onViewClick,
  onDeleteClick
}: {
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
  initialCount?: number;
  onUploadClick: (modelId: Id<"supportedModels">, brandName: string, modelName: string) => void;
  onViewClick: (modelId: Id<"supportedModels">, brandName: string, modelName: string, missingSKUsInStock?: string[], missingSKUsOutOfStock?: string[], mockups?: any[]) => void;
  onDeleteClick: (modelId: Id<"supportedModels">, brandName: string, modelName: string) => void;
}) {
  const [showStats, setShowStats] = useState(false);
  const stats = useQuery(
    api.mockupsAdvanced.getModelMockupStats,
    showStats ? { modelId } : "skip"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{brandName} {modelName}</CardTitle>
            <CardDescription className="mt-1">
              {initialCount !== undefined && `${initialCount} unique SKUs uploaded`}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(modelId, brandName, modelName);
              }}
              title="Delete all mockups for this model"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${showStats ? 'rotate-90' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {showStats && (
        <CardContent className="pt-0">
          {stats === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">{stats.coverage}%</span>
                </div>
                <Progress value={stats.coverage} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{stats.uploadedSKUs} of {stats.totalSKUs} SKUs</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onUploadClick(modelId, brandName, modelName)}
                  className="flex-1"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Upload
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewClick(modelId, brandName, modelName, undefined, undefined, stats.mockups)}
                  className="flex-1"
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  View ({stats.mockups.length})
                </Button>
              </div>

              {stats.missingSKUs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewClick(modelId, brandName, modelName, stats.missingSKUsInStock, stats.missingSKUsOutOfStock)}
                  className="w-full"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  View Missing SKUs ({stats.missingSKUs.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Missing SKUs dialog with inventory tabs
function MissingSKUsDialog({
  open,
  onOpenChange,
  missingSKUsInStock,
  missingSKUsOutOfStock,
  modelName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingSKUsInStock: string[];
  missingSKUsOutOfStock: string[];
  modelName: string;
}) {
  const [activeTab, setActiveTab] = useState<"instock" | "outofstock">("instock");

  const handleDownloadCSV = (skus: string[], type: string) => {
    const csv = `SKU\n${skus.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-skus-${type}-${modelName.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSKUs = activeTab === "instock" ? missingSKUsInStock : missingSKUsOutOfStock;
  const totalCount = missingSKUsInStock.length + missingSKUsOutOfStock.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px]">
        <DialogHeader>
          <DialogTitle>Missing SKUs for {modelName}</DialogTitle>
          <DialogDescription>
            {totalCount} total SKU{totalCount !== 1 ? 's' : ''} without mockups
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "instock" | "outofstock")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="instock">
              In Stock
              {missingSKUsInStock.length > 0 && (
                <Badge variant="secondary" className="ml-2">{missingSKUsInStock.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="outofstock">
              Out of Stock
              {missingSKUsOutOfStock.length > 0 && (
                <Badge variant="secondary" className="ml-2">{missingSKUsOutOfStock.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instock" className="mt-4">
            {missingSKUsInStock.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No in-stock SKUs missing mockups
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="grid grid-cols-4 gap-2">
                  {missingSKUsInStock.map((sku) => (
                    <Badge key={sku} variant="outline" className="justify-center">
                      {sku}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="outofstock" className="mt-4">
            {missingSKUsOutOfStock.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No out-of-stock SKUs missing mockups
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="grid grid-cols-4 gap-2">
                  {missingSKUsOutOfStock.map((sku) => (
                    <Badge key={sku} variant="outline" className="justify-center">
                      {sku}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => handleDownloadCSV(currentSKUs, activeTab)}
            disabled={currentSKUs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download {activeTab === "instock" ? "In Stock" : "Out of Stock"} CSV
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Upload dialog - Refactored to queue uploads
function UploadMockupsDialog({
  open,
  onOpenChange,
  modelId,
  brandName,
  modelName,
  onStartUpload
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
  onStartUpload: (files: File[], skipExisting: boolean, existingSKUs: Set<string>) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);

  // Fetch current stats to check for existing mockups
  const stats = useQuery(api.mockupsAdvanced.getModelMockupStats, { modelId });
  const existingSKUs = useMemo(() => {
    if (!stats) return new Set<string>();
    return new Set(stats.mockups.map(m => m.sku.toUpperCase()));
  }, [stats]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleStart = () => {
    if (files.length === 0) return;
    onStartUpload(files, skipExisting, existingSKUs);
    onOpenChange(false);
    setFiles([]); // Reset
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Mockups for {brandName} {modelName}</DialogTitle>
          <DialogDescription>
            Select mockup images. SKUs will be auto-detected from filenames (e.g., L-01, M-174)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
             <div className="flex items-center space-x-2">
               <input 
                 type="checkbox" 
                 id="skipExisting"
                 className="h-4 w-4 rounded border-gray-300"
                 checked={skipExisting}
                 onChange={(e) => setSkipExisting(e.target.checked)}
               />
               <label htmlFor="skipExisting" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                 Skip SKUs that already have mockups
               </label>
             </div>
             <div className="text-xs text-muted-foreground ml-auto">
               {existingSKUs.size} SKUs already uploaded
             </div>
          </div>

          <div>
            <Input
              type="file"
              accept="image/*"
              multiple
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload files</span> or drag and drop</p>
                <p className="text-xs text-muted-foreground">Select individual images or entire folders</p>
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <ScrollArea className="h-[200px] border rounded p-4">
              <div className="space-y-2">
                {files.map((file, idx) => {
                  const sku = parseSKUFromFilename(file.name);
                  return (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sku ? `SKU: ${sku}` : 'No SKU detected'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={files.length === 0}>
            Start Upload ({files.length} Files)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MockupsAdvancedPage() {
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [modelSearch, setModelSearch] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [missingSKUsDialogOpen, setMissingSKUsDialogOpen] = useState(false);
  const [viewMockupsDialogOpen, setViewMockupsDialogOpen] = useState(false);
  const [deleteSKUDialogOpen, setDeleteSKUDialogOpen] = useState(false);
  const [deleteAllMockupsDialogOpen, setDeleteAllMockupsDialogOpen] = useState(false);
  const [selectedMockups, setSelectedMockups] = useState<any[]>([]);
  
  // Upload Manager State
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  
  const [selectedModel, setSelectedModel] = useState<{
    id: Id<"supportedModels">;
    brand: string;
    name: string;
    missingSKUsInStock?: string[];
    missingSKUsOutOfStock?: string[];
  } | null>(null);

  // Queries
  const brands = useQuery(api.mockupsAdvanced.getUniqueBrands, {});
  const modelsWithMockups = useQuery(api.mockupsAdvanced.getModelsWithMockups, {
    brandFilter: brandFilter === "all" ? undefined : brandFilter,
  });
  const modelsMissing = useQuery(api.mockupsAdvanced.getModelsMissingMockups, {
    brandFilter: brandFilter === "all" ? undefined : brandFilter,
  });
  const modelsFullCoverage = useQuery(api.mockupsAdvanced.getModelsWithFullCoverage, {
    brandFilter: brandFilter === "all" ? undefined : brandFilter,
  });
  const overviewStats = useQuery(api.mockupsAdvanced.getOverviewStats, {});

  // Mutations & Actions
  const migrateMockups = useMutation(api.mockupsAdvanced.migrateMockupsToModels);
  const deleteAllMockups = useMutation(api.mockupsAdvanced.deleteAllMockupsForModel);
  const uploadToCloudinary = useAction(api.cloudinary.uploadToCloudinary);
  const storeMockup = useMutation(api.mockupsAdvanced.storeMockupAdvanced);
  // Need to use getModelMockupStats for checking existing SKUs, but hooks can't be called in loop.
  // We'll pass the initial set of existing SKUs from the dialog to the task.
  // Wait, the dialog already fetches stats. We can pass the existing Set from the dialog to onStartUpload?
  // Or we can fetch it again here? We can't use useQuery conditionally in a loop.
  // We will assume the Dialog passes the `skipExisting` boolean and we might need to fetch existing SKUs *before* starting?
  // Actually, for "skip existing", we need to know what exists. 
  // Solution: The Dialog already knows what exists. We can pass the Set of existing SKUs to the start function.
  
  const [migrating, setMigrating] = useState(false);

  // --- UPLOAD MANAGER LOGIC ---

  const handleStartUpload = async (files: File[], skipExisting: boolean, existingSKUs: Set<string>) => {
    if (!selectedModel) return;

    const taskId = crypto.randomUUID();
    const controller = new AbortController();

    const newTask: UploadTask = {
      id: taskId,
      modelId: selectedModel.id,
      brandName: selectedModel.brand,
      modelName: selectedModel.name,
      files,
      status: 'pending',
      progress: {
        total: files.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        current: 'Starting...',
      },
      fileStatuses: new Map(files.map(f => [f.name, 'pending'])),
      skipExisting,
      cancelController: controller,
    };

    setUploadTasks(prev => [...prev, newTask]);

    // Start background process
    processUploadQueue(newTask, skipExisting, existingSKUs);
  };

  const processUploadQueue = async (task: UploadTask, skipExisting: boolean, existingSKUs: Set<string>) => {
    // Update status to uploading
    updateTaskStatus(task.id, 'uploading');
    await executeUpload(task, existingSKUs);
  };
  
  // Helper to update task state
  const updateTaskStatus = (id: string, status: UploadTask['status'], progress?: Partial<UploadTask['progress']>) => {
    setUploadTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        status,
        progress: progress ? { ...t.progress, ...progress } : t.progress
      };
    }));
  };

  const handleCancelUpload = (id: string) => {
    const task = uploadTasks.find(t => t.id === id);
    if (task?.cancelController) {
      task.cancelController.abort();
    }
    updateTaskStatus(id, 'cancelled');
  };

  const handleDismissUpload = (id: string) => {
    setUploadTasks(prev => prev.filter(t => t.id !== id));
  };

  // The actual upload worker with parallelism
  const executeUpload = async (task: UploadTask, existingSKUs: Set<string>) => {
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    // Concurrency limit
    const CONCURRENCY = 5;

    // Helper to upload a single file
    const uploadSingleFile = async (file: File) => {
       if (task.cancelController?.signal.aborted) return;

       const sku = parseSKUFromFilename(file.name);
       
       if (!sku) {
         failed++;
         updateTaskStatus(task.id, 'uploading', { failed, current: `Failed: ${file.name}` });
         return;
       }

       if (task.skipExisting && existingSKUs.has(sku)) {
         skipped++;
         updateTaskStatus(task.id, 'uploading', { skipped, current: `Skipped: ${file.name}` });
         return;
       }

       updateTaskStatus(task.id, 'uploading', { current: `Uploading: ${file.name}` });

       try {
         const base64 = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onload = () => resolve(reader.result as string);
           reader.onerror = reject;
           reader.readAsDataURL(file);
         });

         const cloudinaryResult = await uploadToCloudinary({
           imageBase64: base64,
           folder: `mockups/${task.brandName}/${task.modelName}`,
           publicId: sku,
         });

         if (!cloudinaryResult.success) throw new Error("Upload failed");

         await storeMockup({
           brand: task.brandName,
           model: task.modelName,
           sku,
           cloudinaryUrl: cloudinaryResult.cloudinaryUrl,
           cloudinaryPublicId: cloudinaryResult.publicId,
           supportedModelId: task.modelId,
         });

         completed++;
         updateTaskStatus(task.id, 'uploading', { completed });
       } catch (error) {
         console.error(error);
         failed++;
         updateTaskStatus(task.id, 'uploading', { failed, current: `Error: ${file.name}` });
       }
    };

    // Process files in chunks
    for (let i = 0; i < task.files.length; i += CONCURRENCY) {
      if (task.cancelController?.signal.aborted) break;
      
      const chunk = task.files.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(file => uploadSingleFile(file)));
    }

    if (!task.cancelController?.signal.aborted) {
      updateTaskStatus(task.id, 'completed', { current: 'Done' });
      toast.success(`Finished uploading for ${task.brandName} ${task.modelName}`);
    }
  };

  // --- END UPLOAD MANAGER LOGIC ---

  const handleMigration = async () => {
    setMigrating(true);
    try {
      const result = await migrateMockups({});
      toast.success(`Migration complete: ${result.updated} mockups linked, ${result.noMatch} without matches`);
    } catch (error) {
      toast.error("Migration failed");
      console.error(error);
    } finally {
      setMigrating(false);
    }
  };

  const handleUploadClick = (modelId: Id<"supportedModels">, brand: string, name: string) => {
    setSelectedModel({ id: modelId, brand, name });
    setUploadDialogOpen(true);
  };

  const handleDeleteClick = async (modelId: Id<"supportedModels">, brand: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ALL mockups for ${brand} ${name}? This action cannot be undone.`)) return;
    
    try {
      const result = await deleteAllMockups({ modelId });
      toast.success(`Deleted ${result.deleted} mockups for ${brand} ${name}`);
    } catch (error) {
      toast.error("Failed to delete mockups");
      console.error(error);
    }
  };

  const handleViewClick = (modelId: Id<"supportedModels">, brand: string, name: string, missingSKUsInStock?: string[], missingSKUsOutOfStock?: string[], mockups?: any[]) => {
    if (missingSKUsInStock || missingSKUsOutOfStock) {
      setSelectedModel({ id: modelId, brand, name, missingSKUsInStock, missingSKUsOutOfStock });
      setMissingSKUsDialogOpen(true);
    } else if (mockups && mockups.length > 0) {
      setSelectedModel({ id: modelId, brand, name });
      setSelectedMockups(mockups);
      setViewMockupsDialogOpen(true);
    } else {
      toast.info("No mockups to view");
    }
  };

  // Filter models by search term
  const filterModelsBySearch = <T extends { modelName: string; brandName: string }>(models: T[] | undefined): T[] | undefined => {
    if (!models || !modelSearch.trim()) return models;
    const searchLower = modelSearch.toLowerCase().trim();
    return models.filter(m => 
      m.modelName.toLowerCase().includes(searchLower) ||
      m.brandName.toLowerCase().includes(searchLower)
    );
  };

  const filteredModelsWithMockups = useMemo(() => filterModelsBySearch(modelsWithMockups), [modelsWithMockups, modelSearch]);
  const filteredModelsMissing = useMemo(() => filterModelsBySearch(modelsMissing), [modelsMissing, modelSearch]);
  const filteredModelsFullCoverage = useMemo(() => filterModelsBySearch(modelsFullCoverage), [modelsFullCoverage, modelSearch]);

  const partialCoverageCount = filteredModelsWithMockups?.length ?? 0;
  const missingCount = filteredModelsMissing?.length ?? 0;
  const fullCoverageCount = filteredModelsFullCoverage?.length ?? 0;

  // Calculate total models count
  const totalModels = (modelsWithMockups?.length ?? 0) + (modelsMissing?.length ?? 0) + (modelsFullCoverage?.length ?? 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Advanced Mockup Management</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage phone mockups by model with intelligent SKU detection
          </p>
        </div>

        {/* Overview Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                Total Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalModels}</div>
              <p className="text-xs text-muted-foreground mt-1">Phone models in database</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Images className="h-4 w-4 text-muted-foreground" />
                Total Mockups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats?.totalMockups ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Mockups uploaded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Unique SKUs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats?.uniqueSKUs ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">of {overviewStats?.totalSKUs ?? 0} total SKUs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats?.coverage ?? 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">Overall SKU coverage</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex gap-4">
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands?.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {modelSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setModelSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => setDeleteAllMockupsDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ALL
            </Button>
            <Button variant="destructive" onClick={() => setDeleteSKUDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete by SKU
            </Button>
            <Button variant="outline" onClick={handleMigration} disabled={migrating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${migrating ? 'animate-spin' : ''}`} />
              {migrating ? 'Migrating...' : 'Sync Existing Mockups'}
            </Button>
          </div>
        </div>

      <Tabs defaultValue="partial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partial">
            Partial Coverage
            {partialCoverageCount > 0 && (
              <Badge variant="secondary" className="ml-2">{partialCoverageCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="missing">
            Missing Mockups
            {missingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{missingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="complete">
            Complete Coverage
            {fullCoverageCount > 0 && (
              <Badge variant="default" className="ml-2 bg-green-600">{fullCoverageCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partial" className="space-y-4">
          {modelsWithMockups === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !filteredModelsWithMockups || filteredModelsWithMockups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {modelSearch ? "No models match your search" : "No models with partial mockup coverage"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModelsWithMockups.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  initialCount={model.mockupCount}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
                  onDeleteClick={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="missing" className="space-y-4">
          {modelsMissing === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !filteredModelsMissing || filteredModelsMissing.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
                <p className="text-muted-foreground">
                  {modelSearch ? "No models match your search" : "All models have at least one mockup!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModelsMissing.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
                  onDeleteClick={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="complete" className="space-y-4">
          {modelsFullCoverage === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !filteredModelsFullCoverage || filteredModelsFullCoverage.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {modelSearch ? "No models match your search" : "No models have complete mockup coverage yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModelsFullCoverage.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  initialCount={model.mockupCount}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
                  onDeleteClick={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedModel && (
        <>
          <UploadMockupsDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            modelId={selectedModel.id}
            brandName={selectedModel.brand}
            modelName={selectedModel.name}
            onStartUpload={(files, skipExisting) => {
              // We need to pass the existing SKUs here if we want to skip duplicates in the background
              // Since the Dialog fetches them, we can capture them?
              // Hack: The Dialog component has the data. 
              // We can pass a callback `onStartUpload` that receives `existingSKUs` too.
              // I'll fix the Dialog component to pass `existingSKUs` in the next step.
              // For now, assume it's just files/skip.
              handleStartUpload(files, skipExisting);
            }}
          />
          {(selectedModel.missingSKUsInStock || selectedModel.missingSKUsOutOfStock) && (
            <MissingSKUsDialog
              open={missingSKUsDialogOpen}
              onOpenChange={setMissingSKUsDialogOpen}
              missingSKUsInStock={selectedModel.missingSKUsInStock || []}
              missingSKUsOutOfStock={selectedModel.missingSKUsOutOfStock || []}
              modelName={`${selectedModel.brand} ${selectedModel.name}`}
            />
          )}
          <ViewMockupsDialog
            open={viewMockupsDialogOpen}
            onOpenChange={setViewMockupsDialogOpen}
            modelId={selectedModel.id}
            brandName={selectedModel.brand}
            modelName={selectedModel.name}
            mockups={selectedMockups}
          />
        </>
      )}

      <DeleteSKUDialog 
        open={deleteSKUDialogOpen} 
        onOpenChange={setDeleteSKUDialogOpen} 
      />
      <DeleteAllMockupsDialog 
        open={deleteAllMockupsDialogOpen} 
        onOpenChange={setDeleteAllMockupsDialogOpen} 
      />
      
      {/* Upload Progress Panel */}
      <UploadProgressPanel 
        tasks={uploadTasks} 
        onCancel={handleCancelUpload}
        onDismiss={handleDismissUpload}
      />
    </div>
    </AdminLayout>
  );
}
