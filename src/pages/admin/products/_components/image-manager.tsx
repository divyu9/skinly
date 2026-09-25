import { useState, useRef } from "react";
import { useAction, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import type { Id } from "@/lib/firebase-api";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { ImageIcon, TrashIcon, StarIcon, UploadIcon, GripVerticalIcon } from "lucide-react";

interface ProductImage {
  url: string;
  alt?: string;
}

interface ImageManagerProps {
  productId: Id<"products">;
  images: ProductImage[];
  onImagesUpdate?: (images: ProductImage[]) => void;
}

export function ImageManager({ productId, images, onImagesUpdate }: ImageManagerProps) {
  const [localImages, setLocalImages] = useState<ProductImage[]>(images);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The same upload the Media Library uses: to R2, re-encoded, and kept in the library too.
  const uploadToLibrary = useAction(api.mediaLibrary.uploadAndAddToLibrary);
  const addProductImages = useMutation(api.products.addProductImages);
  const removeProductImage = useMutation(api.products.removeProductImage);
  const reorderProductImages = useMutation(api.products.reorderProductImages);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newImages: ProductImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        /*
         * Uploaded through the Media Library's R2 path. This asked for an
         * upload URL and POSTed the file expecting the old backend's
         * { storageId } reply, then linked /api/storage/<id> — none of which
         * exists any more, so no image ever uploaded from here.
         */
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] || "");
          r.onerror = () => reject(new Error(`Could not read ${file.name}`));
          r.readAsDataURL(file);
        });
        const uploaded: any = await uploadToLibrary({
          fileBase64: base64, filename: file.name, folder: "products", contentType: file.type, mediaType: "image",
        });
        const imageUrl = uploaded?.url || uploaded?.publicUrl;
        if (!imageUrl) throw new Error(`Failed to upload ${file.name}`);

        newImages.push({
          url: imageUrl,
          alt: file.name.replace(/\.[^/.]+$/, ""),
        });
      }

      // Add images to product
      const updatedImages = await addProductImages({
        productId,
        images: newImages,
      });

      setLocalImages(updatedImages);
      onImagesUpdate?.(updatedImages);
      toast.success(`${newImages.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (!confirm("Are you sure you want to remove this image?")) return;

    try {
      const updatedImages = await removeProductImage({
        productId,
        imageIndex: index,
      });
      setLocalImages(updatedImages);
      onImagesUpdate?.(updatedImages);
      toast.success("Image removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove image");
    }
  };

  const handleSetPrimary = async (index: number) => {
    if (index === 0) return; // Already primary

    try {
      const reorderedImages = [...localImages];
      const [primaryImage] = reorderedImages.splice(index, 1);
      reorderedImages.unshift(primaryImage);

      const updatedImages = await reorderProductImages({
        productId,
        images: reorderedImages,
      });

      setLocalImages(updatedImages);
      onImagesUpdate?.(updatedImages);
      toast.success("Primary image updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to set primary image");
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reorderedImages = [...localImages];
    const [draggedImage] = reorderedImages.splice(draggedIndex, 1);
    reorderedImages.splice(index, 0, draggedImage);

    setLocalImages(reorderedImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      await reorderProductImages({
        productId,
        images: localImages,
      });
      onImagesUpdate?.(localImages);
      toast.success("Images reordered");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reorder images");
      setLocalImages(images); // Revert on error
    } finally {
      setDraggedIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          variant="outline"
        >
          <UploadIcon className="size-4 mr-2" />
          {isUploading ? "Uploading..." : "Upload Images"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <p className="text-sm text-muted-foreground">
          {localImages.length} image(s) • First image is primary
        </p>
      </div>

      {/* Images Grid */}
      {localImages.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <ImageIcon className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No images yet</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            <UploadIcon className="size-4 mr-2" />
            Upload Images
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {localImages.map((image, index) => (
            <Card
              key={index}
              className="group relative cursor-move overflow-hidden"
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
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
              <div
                className="aspect-square cursor-pointer"
                onClick={() => setPreviewImage(image.url)}
              >
                <img
                  src={image.url}
                  alt={image.alt || `Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Actions */}
              <div className="p-2 flex gap-2 bg-background/95 backdrop-blur-sm">
                {index !== 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetPrimary(index)}
                    className="flex-1 text-xs"
                  >
                    <StarIcon className="size-3 mr-1" />
                    Set Primary
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveImage(index)}
                  className="text-xs"
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Full size product image</DialogDescription>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
