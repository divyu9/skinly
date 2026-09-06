import { useState, useRef, useCallback } from "react";
import { useAction } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { MediaPickerDialog } from "./media-picker-dialog.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import {
  TrashIcon,
  StarIcon,
  UploadIcon,
  GripVerticalIcon,
  Loader2Icon,
  LinkIcon,
  XIcon,
  ImageIcon
} from "lucide-react";

interface ProductImage {
  url: string;
  alt: string;
  id?: string; // Optional id for dnd-kit compatibility
}

interface ProductImageUploaderProps {
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  productSlug?: string;
  generateId?: boolean; // If true, adds unique id to each image
}

export function ProductImageUploader({
  images,
  onImagesChange,
  productSlug = "product",
  generateId = false
}: ProductImageUploaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [altInput, setAltInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToR2 = useAction(api.r2.uploadToR2);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Generate unique filename
  const getUniqueFileName = (index: number) => {
    const timestamp = Date.now();
    return `img_${index}_${timestamp}`;
  };

  // Generate unique id for dnd-kit
  const generateImageId = () => `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Upload single file
  const uploadFile = async (file: File, index: number): Promise<ProductImage | null> => {
    try {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        return null;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return null;
      }

      // Convert to base64
      const base64 = await fileToBase64(file);

      // Upload to R2
      const slug = productSlug.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'webp';
      const r2Key = `products/${slug}/${getUniqueFileName(index)}.${extension}`;

      const result = await uploadToR2({
        fileBase64: base64,
        key: r2Key,
        contentType: file.type || "image/webp",
      });

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      const newImage: ProductImage = {
        url: result.url || result.publicUrl!,
        alt: file.name.replace(/\.[^/.]+$/, ""),
      };

      // Add id if generateId is enabled
      if (generateId) {
        newImage.id = generateImageId();
      }

      return newImage;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    }
  };

  // Handle file selection (from file picker or drop)
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploadingCount(fileArray.length);

    const newImages: ProductImage[] = [];
    const startIndex = images.length;

    for (let i = 0; i < fileArray.length; i++) {
      const uploadedImage = await uploadFile(fileArray[i], startIndex + i);
      if (uploadedImage) {
        newImages.push(uploadedImage);
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
      toast.success(`${newImages.length} image(s) uploaded successfully`);
    }

    setUploadingCount(0);
  }, [images, onImagesChange, productSlug, uploadToR2]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  // Remove image
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  // Update image alt text
  const updateImageAlt = (index: number, alt: string) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], alt };
    onImagesChange(newImages);
  };

  // Set as primary (move to first position)
  const setAsPrimary = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [primaryImage] = newImages.splice(index, 1);
    newImages.unshift(primaryImage);
    onImagesChange(newImages);
    toast.success("Primary image updated");
  };

  // Drag reorder handlers
  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleImageDragEnd = () => {
    setDraggedIndex(null);
  };

  // Add image from URL
  const handleAddFromUrl = () => {
    if (!urlInput.trim()) {
      toast.error("Please enter an image URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    const newImage: ProductImage = {
      url: urlInput.trim(),
      alt: altInput.trim() || "Product image",
    };

    // Add id if generateId is enabled
    if (generateId) {
      newImage.id = generateImageId();
    }

    onImagesChange([...images, newImage]);
    setUrlInput("");
    setAltInput("");
    setShowUrlInput(false);
    toast.success("Image added from URL");
  };

  const isUploading = uploadingCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Upload new images, or reuse ones already in your media library.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <ImageIcon className="mr-2 size-4" />
          Choose from library
        </Button>
      </div>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingUrls={images.map((img) => img.url)}
        onSelect={(picked) => {
          const startIndex = images.length;
          const added = picked.map((p, i) => ({
            url: p.url,
            alt: p.alt,
            ...(generateId ? { id: `img-${startIndex + i}-${Date.now()}` } : {}),
          }));
          onImagesChange([...images, ...added]);
          toast.success(`${added.length} image(s) added from library`);
        }}
      />

      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="size-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Uploading {uploadingCount} image(s)...
            </p>
          </div>
        ) : (
          <>
            <UploadIcon className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">
              Drag and drop images here
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or click to select files (PNG, JPG, WebP, max 10MB)
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-4 mr-2" />
                Select Files
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowUrlInput(!showUrlInput)}
              >
                <LinkIcon className="size-4 mr-2" />
                Add from URL
              </Button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* URL Input */}
      {showUrlInput && (
        <Card className="p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Image URL (https://...)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <Input
                placeholder="Alt text (optional)"
                value={altInput}
                onChange={(e) => setAltInput(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleAddFromUrl} size="sm">
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUrlInput(false);
                setUrlInput("");
                setAltInput("");
              }}
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Images Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {images.length} image(s) • First image is primary
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <Card
                key={`${image.url}-${index}`}
                className={`
                  group relative overflow-hidden cursor-move
                  ${draggedIndex === index ? "ring-2 ring-primary" : ""}
                `}
                draggable
                onDragStart={() => handleImageDragStart(index)}
                onDragOver={(e) => handleImageDragOver(e, index)}
                onDragEnd={handleImageDragEnd}
              >
                {/* Primary Badge */}
                {index === 0 && (
                  <Badge className="absolute top-2 left-2 z-10 bg-yellow-500 text-white">
                    <StarIcon className="size-3 mr-1" />
                    Primary
                  </Badge>
                )}

                {/* Drag Handle */}
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-background/80 backdrop-blur-sm rounded p-1">
                    <GripVerticalIcon className="size-4" />
                  </div>
                </div>

                {/* Image */}
                <div className="aspect-square bg-muted">
                  <img
                    src={image.url}
                    alt={image.alt || `Product image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='50' font-family='sans-serif' font-size='12' text-anchor='middle' dy='.3em' fill='%23999'%3EImage Error%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>

                {/* Actions & Alt Text */}
                <div className="p-2 space-y-2 bg-background">
                  <Input
                    placeholder="Alt text"
                    value={image.alt}
                    onChange={(e) => updateImageAlt(index, e.target.value)}
                    className="h-7 text-xs"
                  />
                  <div className="flex gap-1">
                    {index !== 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAsPrimary(index)}
                        className="flex-1 h-7 text-xs"
                      >
                        <StarIcon className="size-3 mr-1" />
                        Primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeImage(index)}
                      className="h-7 text-xs"
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && !isUploading && (
        <p className="text-xs text-muted-foreground text-center">
          No images added yet. Upload images or add from URL.
        </p>
      )}
    </div>
  );
}
