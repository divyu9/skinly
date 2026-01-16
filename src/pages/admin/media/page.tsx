import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Card,
  CardContent,
} from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Copy,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  Video,
  FolderOpen,
  Check,
  X,
  Loader2,
  Grid,
  List,
  Filter,
  Plus,
} from "lucide-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

export default function MediaLibraryPage() {
  return (
    <AdminLayout>
      <AuthLoading>
        <LoadingSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Sign in Required</h2>
            <p className="text-muted-foreground">Please sign in to manage media.</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <MediaLibraryContent />
      </Authenticated>
    </AdminLayout>
  );
}

function MediaLibraryContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | "image" | "video">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItems, setSelectedItems] = useState<Set<Id<"mediaLibrary">>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Queries
  const mediaResult = useQuery(api.mediaLibrary.listMedia, {
    folder: selectedFolder || undefined,
    mediaType: selectedType === "all" ? undefined : selectedType,
    searchQuery: searchQuery || undefined,
    limit: 100,
  });
  const folders = useQuery(api.mediaLibrary.getFolders);

  // Mutations
  const deleteMedia = useMutation(api.mediaLibrary.deleteMedia);
  const bulkDelete = useMutation(api.mediaLibrary.bulkDeleteMedia);

  // Copy URL to clipboard
  const copyToClipboard = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  }, []);

  // Handle delete
  const handleDelete = async (id: Id<"mediaLibrary">) => {
    if (!confirm("Delete this media item?")) return;
    try {
      await deleteMedia({ id });
      toast.success("Media deleted");
    } catch (error) {
      toast.error("Failed to delete media");
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} items?`)) return;

    try {
      await bulkDelete({ ids: Array.from(selectedItems) });
      setSelectedItems(new Set());
      toast.success(`${selectedItems.size} items deleted`);
    } catch (error) {
      toast.error("Failed to delete items");
    }
  };

  // Toggle item selection
  const toggleSelection = (id: Id<"mediaLibrary">) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage images and videos. Click to copy URL.
          </p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="size-4 mr-2" />
          Upload Media
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Folder Filter */}
        <Select
          value={selectedFolder || "all"}
          onValueChange={(v) => setSelectedFolder(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <FolderOpen className="size-4 mr-2" />
            <SelectValue placeholder="All folders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All folders</SelectItem>
            {folders?.map((folder) => (
              <SelectItem key={folder} value={folder}>
                {folder}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as typeof selectedType)}
        >
          <SelectTrigger className="w-[140px]">
            <Filter className="size-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>

        {/* View Mode */}
        <div className="flex border rounded-lg">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="size-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedItems.size} selected
          </span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="size-4 mr-2" />
            Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedItems(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Media Grid/List */}
      {mediaResult === undefined ? (
        <LoadingSkeleton />
      ) : mediaResult.items.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="size-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No media found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedFolder
              ? "Try adjusting your filters"
              : "Upload your first image or video"}
          </p>
          <Button onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="size-4 mr-2" />
            Upload Media
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mediaResult.items.map((item) => (
            <MediaCard
              key={item._id}
              item={item}
              isSelected={selectedItems.has(item._id)}
              isCopied={copiedUrl === item.cloudinaryUrl}
              onSelect={() => toggleSelection(item._id)}
              onCopy={() => copyToClipboard(item.cloudinaryUrl)}
              onDelete={() => handleDelete(item._id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {mediaResult.items.map((item) => (
            <MediaListItem
              key={item._id}
              item={item}
              isSelected={selectedItems.has(item._id)}
              isCopied={copiedUrl === item.cloudinaryUrl}
              onSelect={() => toggleSelection(item._id)}
              onCopy={() => copyToClipboard(item.cloudinaryUrl)}
              onDelete={() => handleDelete(item._id)}
              formatBytes={formatBytes}
            />
          ))}
        </div>
      )}

      {/* Stats */}
      {mediaResult && mediaResult.totalCount > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {mediaResult.items.length} of {mediaResult.totalCount} items
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        folders={folders || []}
      />
    </div>
  );
}

// Media Card Component (Grid View)
function MediaCard({
  item,
  isSelected,
  isCopied,
  onSelect,
  onCopy,
  onDelete,
}: {
  item: {
    _id: Id<"mediaLibrary">;
    cloudinaryUrl: string;
    filename: string;
    mediaType: "image" | "video";
    folder?: string;
    format?: string;
  };
  isSelected: boolean;
  isCopied: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div
          className="aspect-square bg-muted relative"
          onClick={onCopy}
        >
          {item.mediaType === "image" ? (
            <img
              src={item.cloudinaryUrl}
              alt={item.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="size-12 text-muted-foreground" />
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isCopied ? (
              <div className="flex items-center gap-2 text-green-400">
                <Check className="size-6" />
                <span className="text-sm font-medium">Copied!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white">
                <Copy className="size-6" />
                <span className="text-sm font-medium">Click to copy</span>
              </div>
            )}
          </div>

          {/* Selection Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={cn(
              "absolute top-2 left-2 size-5 rounded border-2 flex items-center justify-center transition-all",
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100"
            )}
          >
            {isSelected && <Check className="size-3" />}
          </button>

          {/* Type Badge */}
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 text-xs"
          >
            {item.format?.toUpperCase() || item.mediaType}
          </Badge>
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="text-xs font-medium truncate" title={item.filename}>
            {item.filename}
          </p>
          {item.folder && (
            <p className="text-xs text-muted-foreground truncate">
              {item.folder}
            </p>
          )}
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 size-6 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="size-4 mr-2" />
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

// Media List Item Component (List View)
function MediaListItem({
  item,
  isSelected,
  isCopied,
  onSelect,
  onCopy,
  onDelete,
  formatBytes,
}: {
  item: {
    _id: Id<"mediaLibrary">;
    cloudinaryUrl: string;
    filename: string;
    mediaType: "image" | "video";
    folder?: string;
    format?: string;
    width?: number;
    height?: number;
    bytes?: number;
    createdAt: number;
  };
  isSelected: boolean;
  isCopied: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDelete: () => void;
  formatBytes: (bytes?: number) => string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors",
        isSelected && "ring-2 ring-primary"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onSelect}
        className={cn(
          "size-5 rounded border-2 flex items-center justify-center flex-shrink-0",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "border-gray-300"
        )}
      >
        {isSelected && <Check className="size-3" />}
      </button>

      {/* Thumbnail */}
      <div className="size-12 rounded bg-muted flex-shrink-0 overflow-hidden">
        {item.mediaType === "image" ? (
          <img
            src={item.cloudinaryUrl}
            alt={item.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="size-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.filename}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {item.folder && <span>{item.folder}</span>}
          {item.width && item.height && (
            <span>
              {item.width}x{item.height}
            </span>
          )}
          <span>{formatBytes(item.bytes)}</span>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* URL Display */}
      <div className="hidden lg:flex items-center gap-2 max-w-xs">
        <code className="text-xs bg-muted px-2 py-1 rounded truncate">
          {item.cloudinaryUrl.split("/").slice(-2).join("/")}
        </code>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant={isCopied ? "default" : "outline"}
          size="sm"
          onClick={onCopy}
          className="gap-2"
        >
          {isCopied ? (
            <>
              <Check className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy URL
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// Upload Dialog Component
function UploadDialog({
  open,
  onOpenChange,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: string[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState("media-library");
  const [customFolder, setCustomFolder] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, "pending" | "uploading" | "done" | "error">>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAndAdd = useAction(api.mediaLibrary.uploadAndAddToLibrary);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);

    // Initialize progress for new files
    const newProgress: Record<string, "pending"> = {};
    selectedFiles.forEach((file) => {
      newProgress[file.name] = "pending";
    });
    setUploadProgress((prev) => ({ ...prev, ...newProgress }));
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);

    const newProgress: Record<string, "pending"> = {};
    droppedFiles.forEach((file) => {
      newProgress[file.name] = "pending";
    });
    setUploadProgress((prev) => ({ ...prev, ...newProgress }));
  };

  // Remove file from list
  const removeFile = (index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      const next = prev.filter((_, i) => i !== index);
      setUploadProgress((p) => {
        const { [file.name]: _, ...rest } = p;
        return rest;
      });
      return next;
    });
  };

  // Upload files
  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    const targetFolder = customFolder || folder;

    for (const file of files) {
      setUploadProgress((prev) => ({ ...prev, [file.name]: "uploading" }));

      try {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Determine media type
        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        // Upload
        const result = await uploadAndAdd({
          imageBase64: base64,
          filename: file.name,
          folder: targetFolder,
          mediaType,
        });

        if (result.success) {
          setUploadProgress((prev) => ({ ...prev, [file.name]: "done" }));
        } else {
          setUploadProgress((prev) => ({ ...prev, [file.name]: "error" }));
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch (error) {
        setUploadProgress((prev) => ({ ...prev, [file.name]: "error" }));
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);

    // Check if all succeeded
    const allDone = files.every((f) => uploadProgress[f.name] === "done");
    if (allDone || files.length === Object.values(uploadProgress).filter(s => s === "done").length) {
      toast.success(`${files.length} files uploaded successfully`);
      setTimeout(() => {
        setFiles([]);
        setUploadProgress({});
        onOpenChange(false);
      }, 1000);
    }
  };

  // Reset on close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFiles([]);
      setUploadProgress({});
      setCustomFolder("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Upload images or videos to your media library. Files will be
            automatically optimized.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Folder Selection */}
          <div className="space-y-2">
            <Label>Folder</Label>
            <div className="flex gap-2">
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="media-library">media-library</SelectItem>
                  <SelectItem value="products">products</SelectItem>
                  <SelectItem value="banners">banners</SelectItem>
                  <SelectItem value="categories">categories</SelectItem>
                  {folders
                    .filter(
                      (f) =>
                        !["media-library", "products", "banners", "categories"].includes(f)
                    )
                    .map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or enter custom folder..."
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              "hover:border-primary hover:bg-muted/50",
              files.length > 0 && "border-primary bg-muted/30"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports images and videos up to 10MB
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted"
                >
                  {/* Preview */}
                  <div className="size-10 rounded bg-background flex items-center justify-center overflow-hidden">
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="size-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {uploadProgress[file.name] === "uploading" && (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    )}
                    {uploadProgress[file.name] === "done" && (
                      <Check className="size-4 text-green-500" />
                    )}
                    {uploadProgress[file.name] === "error" && (
                      <X className="size-4 text-destructive" />
                    )}
                    {uploadProgress[file.name] === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Upload {files.length} {files.length === 1 ? "file" : "files"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-square rounded-lg" />
            <Skeleton className="h-4 mt-2 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
