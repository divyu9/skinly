import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  VideoIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  PlayCircleIcon 
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface VideoFormData {
  videoUrl: string;
  thumbnailUrl: string;
  sourceType: "instagram" | "manual";
  socialMediaId: string;
  productId: string;
  ctaText: string;
  isApproved: boolean;
  isActive: boolean;
  order: number;
}

export function UgcVideosTab() {
  const videos = useQuery(api.homepage.getAllUgcVideos);
  const createVideo = useMutation(api.homepage.createUgcVideo);
  const updateVideo = useMutation(api.homepage.updateUgcVideo);
  const deleteVideo = useMutation(api.homepage.deleteUgcVideo);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Id<"ugcVideos"> | null>(null);
  const [formData, setFormData] = useState<VideoFormData>({
    videoUrl: "",
    thumbnailUrl: "",
    sourceType: "manual",
    socialMediaId: "",
    productId: "",
    ctaText: "Shop Now",
    isApproved: true,
    isActive: true,
    order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenDialog = (videoId?: Id<"ugcVideos">) => {
    if (videoId && videos) {
      const video = videos.find((v) => v._id === videoId);
      if (video) {
        setEditingVideo(videoId);
        setFormData({
          videoUrl: video.videoUrl,
          thumbnailUrl: video.thumbnailUrl || "",
          sourceType: video.sourceType,
          socialMediaId: video.socialMediaId || "",
          productId: video.productId || "",
          ctaText: video.ctaText || "Shop Now",
          isApproved: video.isApproved,
          isActive: video.isActive,
          order: video.order,
        });
      }
    } else {
      setEditingVideo(null);
      setFormData({
        videoUrl: "",
        thumbnailUrl: "",
        sourceType: "manual",
        socialMediaId: "",
        productId: "",
        ctaText: "Shop Now",
        isApproved: true,
        isActive: true,
        order: videos ? videos.length : 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingVideo(null);
  };

  const handleSave = async () => {
    if (!formData.videoUrl) {
      toast.error("Video URL is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingVideo) {
        await updateVideo({
          videoId: editingVideo,
          videoUrl: formData.videoUrl,
          thumbnailUrl: formData.thumbnailUrl || undefined,
          productId: formData.productId ? (formData.productId as Id<"products">) : undefined,
          ctaText: formData.ctaText || undefined,
          isApproved: formData.isApproved,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Video updated successfully");
      } else {
        await createVideo({
          videoUrl: formData.videoUrl,
          thumbnailUrl: formData.thumbnailUrl || undefined,
          sourceType: formData.sourceType,
          socialMediaId: formData.socialMediaId || undefined,
          productId: formData.productId ? (formData.productId as Id<"products">) : undefined,
          ctaText: formData.ctaText || undefined,
          isApproved: formData.isApproved,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Video created successfully");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save video");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (videoId: Id<"ugcVideos">) => {
    if (!confirm("Are you sure you want to delete this video?")) {
      return;
    }

    try {
      await deleteVideo({ videoId });
      toast.success("Video deleted successfully");
    } catch (error) {
      toast.error("Failed to delete video");
      console.error(error);
    }
  };

  if (videos === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">UGC Videos</h3>
          <p className="text-sm text-muted-foreground">
            Manage user-generated content videos
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Video
        </Button>
      </div>

      {/* Videos Grid */}
      {videos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <VideoIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No UGC videos yet. Click "Add Video" to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card key={video._id} className={cn(!video.isActive && "opacity-60")}>
              <CardContent className="p-0">
                {/* Video Thumbnail */}
                <div
                  className="relative h-56 bg-cover bg-center rounded-t-lg"
                  style={{
                    backgroundImage: video.thumbnailUrl
                      ? `url(${video.thumbnailUrl})`
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-black/30 rounded-t-lg" />
                  
                  {/* Status Badges */}
                  <div className="absolute top-2 right-2 flex flex-col gap-2">
                    {video.isApproved ? (
                      <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        Approved
                      </div>
                    ) : (
                      <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <XCircleIcon className="w-3 h-3" />
                        Pending
                      </div>
                    )}
                    
                    {video.sourceType === "instagram" && (
                      <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                        Instagram
                      </div>
                    )}
                  </div>

                  {/* Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircleIcon className="w-16 h-16 text-white/80" />
                  </div>

                  {/* CTA Text */}
                  {video.ctaText && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-white text-black px-3 py-1.5 rounded text-xs font-semibold text-center">
                        {video.ctaText}
                      </div>
                    </div>
                  )}
                </div>

                {/* Video Actions */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Order: {video.order}</span>
                    {video.productId && (
                      <span className="text-primary">Has product link</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(video._id)}
                      className="flex-1"
                    >
                      <EditIcon className="w-3 h-3 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(video._id)}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVideo ? "Edit Video" : "Add Video"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL *</Label>
              <Input
                id="video-url"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://cdn.hercules.app/file_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
              <Input
                id="thumbnail-url"
                value={formData.thumbnailUrl}
                onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                placeholder="https://cdn.hercules.app/file_..."
              />
            </div>

            {!editingVideo && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="source-type">Source Type</Label>
                  <Select
                    value={formData.sourceType}
                    onValueChange={(value: "instagram" | "manual") =>
                      setFormData({ ...formData, sourceType: value })
                    }
                  >
                    <SelectTrigger id="source-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.sourceType === "instagram" && (
                  <div className="space-y-2">
                    <Label htmlFor="social-id">Social Media ID</Label>
                    <Input
                      id="social-id"
                      value={formData.socialMediaId}
                      onChange={(e) =>
                        setFormData({ ...formData, socialMediaId: e.target.value })
                      }
                      placeholder="Instagram post ID"
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="product-id">Product ID (Optional)</Label>
              <Input
                id="product-id"
                value={formData.productId}
                onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                placeholder="Product ID to link"
              />
              <p className="text-xs text-muted-foreground">
                Find product ID in Products admin page
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta-text">CTA Button Text</Label>
              <Input
                id="cta-text"
                value={formData.ctaText}
                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                placeholder="Shop Now"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Display Order</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Approved</Label>
              <Switch
                checked={formData.isApproved}
                onCheckedChange={(checked) => setFormData({ ...formData, isApproved: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
