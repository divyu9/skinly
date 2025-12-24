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

interface SlideFormData {
  imageUrl: string;
  heading: string;
  subheading: string;
  ctaText: string;
  ctaLink: string;
  isActive: boolean;
  order: number;
  mobileWidth: string;
  mobileHeight: string;
  desktopWidth: string;
  desktopHeight: string;
}

export function HeroSlidesTab() {
  const slides = useQuery(api.homepage.getAllHeroSlides);
  const createSlide = useMutation(api.homepage.createHeroSlide);
  const updateSlide = useMutation(api.homepage.updateHeroSlide);
  const deleteSlide = useMutation(api.homepage.deleteHeroSlide);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Id<"heroSlides"> | null>(null);
  const [formData, setFormData] = useState<SlideFormData>({
    imageUrl: "",
    heading: "",
    subheading: "",
    ctaText: "",
    ctaLink: "",
    isActive: true,
    order: 0,
    mobileWidth: "90vw",
    mobileHeight: "110vw",
    desktopWidth: "600px",
    desktopHeight: "400px",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenDialog = (slideId?: Id<"heroSlides">) => {
    if (slideId && slides) {
      const slide = slides.find((s) => s._id === slideId);
      if (slide) {
        setEditingSlide(slideId);
        setFormData({
          imageUrl: slide.imageUrl,
          heading: slide.heading || "",
          subheading: slide.subheading || "",
          ctaText: slide.ctaText || "",
          ctaLink: slide.ctaLink || "",
          isActive: slide.isActive,
          order: slide.order,
          mobileWidth: slide.mobileWidth || "90vw",
          mobileHeight: slide.mobileHeight || "110vw",
          desktopWidth: slide.desktopWidth || "600px",
          desktopHeight: slide.desktopHeight || "400px",
        });
      }
    } else {
      setEditingSlide(null);
      setFormData({
        imageUrl: "",
        heading: "",
        subheading: "",
        ctaText: "",
        ctaLink: "",
        isActive: true,
        order: slides ? slides.length : 0,
        mobileWidth: "90vw",
        mobileHeight: "110vw",
        desktopWidth: "600px",
        desktopHeight: "400px",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSlide(null);
  };

  const handleSave = async () => {
    if (!formData.imageUrl) {
      toast.error("Image URL is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingSlide) {
        await updateSlide({
          slideId: editingSlide,
          imageUrl: formData.imageUrl,
          heading: formData.heading || undefined,
          subheading: formData.subheading || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          isActive: formData.isActive,
          order: formData.order,
          mobileWidth: formData.mobileWidth || undefined,
          mobileHeight: formData.mobileHeight || undefined,
          desktopWidth: formData.desktopWidth || undefined,
          desktopHeight: formData.desktopHeight || undefined,
        });
        toast.success("Slide updated successfully");
      } else {
        await createSlide({
          imageUrl: formData.imageUrl,
          heading: formData.heading || undefined,
          subheading: formData.subheading || undefined,
          ctaText: formData.ctaText || undefined,
          ctaLink: formData.ctaLink || undefined,
          isActive: formData.isActive,
          order: formData.order,
          mobileWidth: formData.mobileWidth || undefined,
          mobileHeight: formData.mobileHeight || undefined,
          desktopWidth: formData.desktopWidth || undefined,
          desktopHeight: formData.desktopHeight || undefined,
        });
        toast.success("Slide created successfully");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save slide");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slideId: Id<"heroSlides">) => {
    if (!confirm("Are you sure you want to delete this slide?")) {
      return;
    }

    try {
      await deleteSlide({ slideId });
      toast.success("Slide deleted successfully");
    } catch (error) {
      toast.error("Failed to delete slide");
      console.error(error);
    }
  };

  if (slides === undefined) {
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
          <h3 className="text-lg font-semibold">Hero Slides</h3>
          <p className="text-sm text-muted-foreground">
            Manage homepage hero carousel slides
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Slide
        </Button>
      </div>

      {/* Slides Grid */}
      {slides.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No hero slides yet. Click "Add Slide" to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide) => (
            <Card key={slide._id} className={cn(!slide.isActive && "opacity-60")}>
              <CardContent className="p-0">
                {/* Slide Image */}
                <div
                  className="relative h-40 bg-cover bg-center rounded-t-lg"
                  style={{ backgroundImage: `url(${slide.imageUrl})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-t-lg" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    {slide.isActive ? (
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
                      {slide.heading || "No heading"}
                    </h4>
                    <p className="text-white/80 text-xs line-clamp-1">
                      {slide.subheading || "No subheading"}
                    </p>
                  </div>
                </div>

                {/* Slide Actions */}
                <div className="p-4 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Order: {slide.order}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(slide._id)}
                    >
                      <EditIcon className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(slide._id)}
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
              {editingSlide ? "Edit Slide" : "Create Slide"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">Image URL *</Label>
              <Input
                id="image-url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://cdn.hercules.app/file_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heading">Heading</Label>
              <Input
                id="heading"
                value={formData.heading}
                onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                placeholder="Premium Device Skins"
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

            {/* Dimensions Section */}
            <div className="space-y-3 pt-2 border-t">
              <div>
                <h4 className="text-sm font-semibold mb-1">Slide Dimensions</h4>
                <p className="text-xs text-muted-foreground">
                  Configure custom dimensions for mobile and desktop views
                </p>
              </div>

              {/* Mobile Dimensions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Mobile View</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="mobile-width" className="text-xs">Width</Label>
                    <Input
                      id="mobile-width"
                      value={formData.mobileWidth}
                      onChange={(e) => setFormData({ ...formData, mobileWidth: e.target.value })}
                      placeholder="90vw"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mobile-height" className="text-xs">Height</Label>
                    <Input
                      id="mobile-height"
                      value={formData.mobileHeight}
                      onChange={(e) => setFormData({ ...formData, mobileHeight: e.target.value })}
                      placeholder="110vw"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Desktop Dimensions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Desktop View</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="desktop-width" className="text-xs">Width</Label>
                    <Input
                      id="desktop-width"
                      value={formData.desktopWidth}
                      onChange={(e) => setFormData({ ...formData, desktopWidth: e.target.value })}
                      placeholder="600px"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="desktop-height" className="text-xs">Height</Label>
                    <Input
                      id="desktop-height"
                      value={formData.desktopHeight}
                      onChange={(e) => setFormData({ ...formData, desktopHeight: e.target.value })}
                      placeholder="400px"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
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
