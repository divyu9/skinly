import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
  RefreshCw
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

// Parse SKU from filename
function parseSKUFromFilename(filename: string): string | null {
  const match = filename.match(/([LMSBF])-(\d+)/i);
  return match ? match[0].toUpperCase() : null;
}

// Model card component with lazy-loaded stats
function ModelCard({ 
  modelId, 
  brandName, 
  modelName, 
  initialCount,
  onUploadClick,
  onViewClick 
}: {
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
  initialCount?: number;
  onUploadClick: (modelId: Id<"supportedModels">, brandName: string, modelName: string) => void;
  onViewClick: (modelId: Id<"supportedModels">, brandName: string, modelName: string, missingSKUs?: string[]) => void;
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${showStats ? 'rotate-90' : ''}`} />
          </Button>
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
                  onClick={() => onViewClick(modelId, brandName, modelName)}
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
                  onClick={() => onViewClick(modelId, brandName, modelName, stats.missingSKUs)}
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

// Missing SKUs dialog
function MissingSKUsDialog({
  open,
  onOpenChange,
  missingSKUs,
  modelName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingSKUs: string[];
  modelName: string;
}) {
  const handleDownloadCSV = () => {
    const csv = `SKU\n${missingSKUs.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-skus-${modelName.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px]">
        <DialogHeader>
          <DialogTitle>Missing SKUs for {modelName}</DialogTitle>
          <DialogDescription>
            {missingSKUs.length} SKU{missingSKUs.length !== 1 ? 's' : ''} without mockups
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-4 gap-2">
            {missingSKUs.map((sku) => (
              <Badge key={sku} variant="outline">
                {sku}
              </Badge>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Upload dialog with detailed progress
function UploadMockupsDialog({
  open,
  onOpenChange,
  modelId,
  brandName,
  modelName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelId: Id<"supportedModels">;
  brandName: string;
  modelName: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    current: string;
    fileStatuses: Map<string, 'pending' | 'uploading' | 'success' | 'failed'>;
  }>({
    total: 0,
    completed: 0,
    failed: 0,
    current: '',
    fileStatuses: new Map(),
  });

  const generateUploadUrl = useMutation(api.mockups.generateUploadUrl);
  const storeMockup = useMutation(api.mockupsAdvanced.storeMockupAdvanced);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      
      // Initialize file statuses
      setUploadProgress(prev => {
        const newStatuses = new Map(prev.fileStatuses);
        newFiles.forEach(file => newStatuses.set(file.name, 'pending'));
        return { ...prev, fileStatuses: newStatuses };
      });
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({
      total: files.length,
      completed: 0,
      failed: 0,
      current: '',
      fileStatuses: new Map(files.map(f => [f.name, 'pending' as const])),
    });

    for (const file of files) {
      const sku = parseSKUFromFilename(file.name);
      if (!sku) {
        setUploadProgress(prev => {
          const newStatuses = new Map(prev.fileStatuses);
          newStatuses.set(file.name, 'failed');
          return {
            ...prev,
            failed: prev.failed + 1,
            fileStatuses: newStatuses,
          };
        });
        continue;
      }

      setUploadProgress(prev => {
        const newStatuses = new Map(prev.fileStatuses);
        newStatuses.set(file.name, 'uploading');
        return { ...prev, current: file.name, fileStatuses: newStatuses };
      });

      try {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) throw new Error("Upload failed");

        const { storageId } = await uploadResponse.json();
        await storeMockup({
          brand: brandName,
          model: modelName,
          sku,
          fileId: storageId,
          supportedModelId: modelId,
        });

        setUploadProgress(prev => {
          const newStatuses = new Map(prev.fileStatuses);
          newStatuses.set(file.name, 'success');
          return {
            ...prev,
            completed: prev.completed + 1,
            fileStatuses: newStatuses,
          };
        });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        setUploadProgress(prev => {
          const newStatuses = new Map(prev.fileStatuses);
          newStatuses.set(file.name, 'failed');
          return {
            ...prev,
            failed: prev.failed + 1,
            fileStatuses: newStatuses,
          };
        });
      }
    }

    setUploading(false);
    toast.success(`Upload complete: ${uploadProgress.completed} succeeded, ${uploadProgress.failed} failed`);
  };

  const progressPercentage = uploadProgress.total > 0
    ? ((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100
    : 0;

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
          <div>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          {files.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{uploadProgress.completed + uploadProgress.failed} / {uploadProgress.total}</span>
                </div>
                <Progress value={progressPercentage} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="text-green-600">{uploadProgress.completed} succeeded</span>
                  <span className="text-red-600">{uploadProgress.failed} failed</span>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded p-4">
                <div className="space-y-2">
                  {files.map((file) => {
                    const status = uploadProgress.fileStatuses.get(file.name) || 'pending';
                    const sku = parseSKUFromFilename(file.name);
                    
                    return (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {sku ? `SKU: ${sku}` : 'No SKU detected'}
                          </div>
                        </div>
                        <div className="ml-2">
                          {status === 'pending' && <Badge variant="outline">Pending</Badge>}
                          {status === 'uploading' && (
                            <Badge variant="secondary">
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Uploading
                            </Badge>
                          )}
                          {status === 'success' && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          )}
                          {status === 'failed' && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={files.length === 0 || uploading}>
            {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MockupsAdvancedPage() {
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [missingSKUsDialogOpen, setMissingSKUsDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{
    id: Id<"supportedModels">;
    brand: string;
    name: string;
    missingSKUs?: string[];
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
  const totalSKUs = useQuery(api.mockupsAdvanced.getTotalPhoneSkinSKUs, {});

  // Mutations
  const migrateMockups = useMutation(api.mockupsAdvanced.migrateMockupsToModels);
  const [migrating, setMigrating] = useState(false);

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

  const handleViewClick = (modelId: Id<"supportedModels">, brand: string, name: string, missingSKUs?: string[]) => {
    if (missingSKUs && missingSKUs.length > 0) {
      setSelectedModel({ id: modelId, brand, name, missingSKUs });
      setMissingSKUsDialogOpen(true);
    } else {
      toast.info("View mockups feature coming soon");
    }
  };

  const partialCoverageCount = modelsWithMockups?.length ?? 0;
  const missingCount = modelsMissing?.length ?? 0;
  const fullCoverageCount = modelsFullCoverage?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Advanced Mockup Management</h1>
        <p className="text-muted-foreground mt-2">
          Upload and manage phone mockups by model with intelligent SKU detection
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
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
        </div>

        <Button variant="outline" onClick={handleMigration} disabled={migrating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${migrating ? 'animate-spin' : ''}`} />
          {migrating ? 'Migrating...' : 'Sync Existing Mockups'}
        </Button>
      </div>

      {totalSKUs !== undefined && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Total Phone Skin SKUs</AlertTitle>
          <AlertDescription>
            There are {totalSKUs} total SKUs across all phone skin products
          </AlertDescription>
        </Alert>
      )}

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
          ) : modelsWithMockups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No models with partial mockup coverage</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelsWithMockups.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  initialCount={model.mockupCount}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
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
          ) : modelsMissing.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
                <p className="text-muted-foreground">All models have at least one mockup!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelsMissing.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
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
          ) : modelsFullCoverage.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No models have complete mockup coverage yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelsFullCoverage.map((model) => (
                <ModelCard
                  key={model._id}
                  modelId={model._id}
                  brandName={model.brandName}
                  modelName={model.modelName}
                  initialCount={model.mockupCount}
                  onUploadClick={handleUploadClick}
                  onViewClick={handleViewClick}
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
          />
          {selectedModel.missingSKUs && (
            <MissingSKUsDialog
              open={missingSKUsDialogOpen}
              onOpenChange={setMissingSKUsDialogOpen}
              missingSKUs={selectedModel.missingSKUs}
              modelName={`${selectedModel.brand} ${selectedModel.name}`}
            />
          )}
        </>
      )}
    </div>
  );
}
