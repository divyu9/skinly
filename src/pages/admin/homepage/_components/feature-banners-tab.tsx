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
import { toast } from "sonner";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  ImageIcon, 
  EyeIcon, 
  EyeOffIcon 
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface BannerFormData {
  backgroundImage: string;
  heading: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  isActive: boolean;
  order: number;
}

export function FeatureBannersTab() {
  const banners = useQuery(api.homepage.getAllFeatureBanners);
  const createBanner = useMutation(api.homepage.createFeatureBanner);
  const updateBanner = useMutation(api.homepage.updateFeatureBanner);
  const deleteBanner = useMutation(api.homepage.deleteFeatureBanner);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Id<"featureBanners"> | null>(null);
  const [formData, setFormData] = useState<BannerFormData>({
    backgroundImage: "",
    heading: "",
    subheading: "",
    ctaText: "",
    ctaLink: "",
    isActive: true,
    order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenDialog = (bannerId?: Id<"featureBanners">) => {
    if (bannerId && banners) {
      const banner = banners.find((b) => b._id === bannerId);
      if (banner) {
        setEditingBanner(bannerId);
        setFormData({
          backgroundImage: banner.backgroundImage,
          heading: banner.heading || "",
          subheading: banner.subheading || "",
          ctaText: banner.ctaText || "",
          ctaLink: banner.ctaLink || "",
          isActive: banner.isActive,
          order: banner.order,
        });
      }
    } else {
      setEditingBanner(null);
      setFormData({
        backgroundImage: "",
        heading: "",
        subheading: "",
        ctaText: "",
        ctaLink: "",
        isActive: true,
        order: banners ? banners.length : 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBanner(null);
  };

  const handleSave = async () => {
    if (!formData.backgroundImage) {
      toast.error("Background image URL is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingBanner) {
        await updateBanner({
          bannerId: editingBanner,
          backgroundImage: formData.backgroundImage,
          heading: formData.heading || undefined,
          subheading: formData.subheading || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Banner updated successfully");
      } else {
        await createBanner({
          backgroundImage: formData.backgroundImage,
          heading: formData.heading || undefined,
          subheading: formData.subheading || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Banner created successfully");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save banner");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (bannerId: Id<"featureBanners">) => {
    if (!confirm("Are you sure you want to delete this banner?")) {
      return;
    }

    try {
      await deleteBanner({ bannerId });
      toast.success("Banner deleted successfully");
    } catch (error) {
      toast.error("Failed to delete banner");
      console.error(error);
    }
  };

  if (banners === undefined) {
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
          <h3 className="text-lg font-semibold">Feature Banners</h3>
          <p className="text-sm text-muted-foreground">
            Manage feature banners that auto-scroll on the homepage
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {/* Banners Grid */}
      {banners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No feature banners yet. Click "Add Banner" to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {banners.map((banner) => (
            <Card key={banner._id} className={cn(!banner.isActive && "opacity-60")}>
              <CardContent className="p-0">
                {/* Banner Image */}
                <div
                  className="relative h-40 bg-cover bg-center rounded-t-lg"
                  style={{ backgroundImage: `url(${banner.backgroundImage})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent rounded-t-lg" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    {banner.isActive ? (
                      <div className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <EyeIcon className="w-3 h-3" />
                        Active
                      </div>
                    ) : (
                      <div className="bg-gray-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <EyeOffIcon className="w-3 h-3" />
                        Inactive
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <h4 className="text-white font-semibold text-sm line-clamp-1">
                      {banner.heading || "No heading"}
                    </h4>
                    <p className="text-white/80 text-xs line-clamp-1">
                      {banner.subheading || "No subheading"}
                    </p>
                  </div>
                </div>

                {/* Banner Actions */}
                <div className="p-4 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Order: {banner.order}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(banner._id)}
                    >
                      <EditIcon className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(banner._id)}
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
              {editingBanner ? "Edit Banner" : "Create Banner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="background-image">Background Image URL *</Label>
              <Input
                id="background-image"
                value={formData.backgroundImage}
                onChange={(e) => setFormData({ ...formData, backgroundImage: e.target.value })}
                placeholder="https://cdn.hercules.app/file_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heading">Heading</Label>
              <Input
                id="heading"
                value={formData.heading}
                onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                placeholder="Premium Protection"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subheading">Subheading</Label>
              <Input
                id="subheading"
                value={formData.subheading}
                onChange={(e) => setFormData({ ...formData, subheading: e.target.value })}
                placeholder="Protect your device in style"
              />
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
              <Label htmlFor="cta-link">CTA Button Link</Label>
              <Input
                id="cta-link"
                value={formData.ctaLink}
                onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                placeholder="/products"
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
