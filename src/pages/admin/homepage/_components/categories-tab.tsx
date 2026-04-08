import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { SaveIcon, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface CategoryConfig {
  categoryName: string;
  displayName: string;
  imageUrl: string;
  linkUrl: string;
  buttonText: string;
  isActive: boolean;
  order: number;
  // Image dimensions for mobile and desktop
  mobileWidth: string;
  mobileHeight: string;
  desktopWidth: string;
  desktopHeight: string;
}

export function CategoriesTab() {
  const categories = useQuery(api.homepage.getAllCategoryDisplaySettings);
  const productCategories = useQuery(api.productCategories.listAllWithCounts);
  const bulkUpdate = useMutation(api.homepage.bulkUpdateCategoryDisplaySettings);

  const [configs, setConfigs] = useState<CategoryConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with product categories or loaded data
  useEffect(() => {
    if (categories && productCategories) {
      const existingMap = new Map(categories.map((cat) => [cat.categoryName, cat]));
      
      const initialConfigs = productCategories.map((productCategory: { id: string; displayName: string; count: number }, index: number) => {
        const existing = existingMap.get(productCategory.id);
        if (existing) {
          return {
            categoryName: existing.categoryName,
            displayName: existing.displayName,
            imageUrl: existing.imageUrl || "",
            linkUrl: existing.linkUrl || "",
            buttonText: existing.buttonText || "",
            isActive: existing.isActive,
            order: existing.order,
            mobileWidth: existing.mobileWidth || "70vw",
            mobileHeight: existing.mobileHeight || "90vw",
            desktopWidth: existing.desktopWidth || "23vw",
            desktopHeight: existing.desktopHeight || "30vw",
          };
        } else {
          return {
            categoryName: productCategory.id,
            displayName: productCategory.displayName,
            imageUrl: "",
            linkUrl: "",
            buttonText: "",
            isActive: true,
            order: index,
            mobileWidth: "70vw",
            mobileHeight: "90vw",
            desktopWidth: "23vw",
            desktopHeight: "30vw",
          };
        }
      });
      
      setConfigs(initialConfigs);
    }
  }, [categories, productCategories]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await bulkUpdate({
        categories: configs.map((config) => ({
          categoryName: config.categoryName,
          displayName: config.displayName,
          imageUrl: config.imageUrl || undefined,
          linkUrl: config.linkUrl || undefined,
          buttonText: config.buttonText || undefined,
          isActive: config.isActive,
          order: config.order,
          mobileWidth: config.mobileWidth || undefined,
          mobileHeight: config.mobileHeight || undefined,
          desktopWidth: config.desktopWidth || undefined,
          desktopHeight: config.desktopHeight || undefined,
        })),
      });
      toast.success("Categories saved successfully");
    } catch (error) {
      toast.error("Failed to save categories");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (categoryName: string, updates: Partial<CategoryConfig>) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.categoryName === categoryName ? { ...config, ...updates } : config
      )
    );
  };

  if (categories === undefined || productCategories === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Category Display Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how product categories appear on the homepage
        </p>
      </div>

      {/* Categories Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {configs.map((config) => (
          <Card key={config.categoryName} className={cn(!config.isActive && "opacity-60")}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{config.displayName}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {config.categoryName}
                  </CardDescription>
                </div>
                <Switch
                  checked={config.isActive}
                  onCheckedChange={(checked) =>
                    updateConfig(config.categoryName, { isActive: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview Image */}
              {config.imageUrl ? (
                <div
                  className="h-32 rounded-lg bg-cover bg-center"
                  style={{ backgroundImage: `url(${config.imageUrl})` }}
                />
              ) : (
                <div className="h-32 rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}

              {/* Display Name */}
              <div className="space-y-2">
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={config.displayName}
                  onChange={(e) =>
                    updateConfig(config.categoryName, { displayName: e.target.value })
                  }
                  placeholder="e.g., Premium Skins"
                />
              </div>

              {/* Image URL */}
              <div className="space-y-2">
                <Label className="text-xs">Image URL</Label>
                <Input
                  value={config.imageUrl}
                  onChange={(e) =>
                    updateConfig(config.categoryName, { imageUrl: e.target.value })
                  }
                  placeholder="https://pub-db30b224c5eb4a378f7b3fd8fd5f2272.r2.dev/..."
                />
              </div>

              {/* Link URL */}
              <div className="space-y-2">
                <Label className="text-xs">Link URL</Label>
                <Input
                  value={config.linkUrl}
                  onChange={(e) =>
                    updateConfig(config.categoryName, { linkUrl: e.target.value })
                  }
                  placeholder="Leave empty for auto-generated link"
                />
              </div>

              {/* Button Text */}
              <div className="space-y-2">
                <Label className="text-xs">Button Text (leave empty to hide button)</Label>
                <Input
                  value={config.buttonText}
                  onChange={(e) =>
                    updateConfig(config.categoryName, { buttonText: e.target.value })
                  }
                  placeholder="e.g., Shop Now"
                />
              </div>

              {/* Display Order */}
              <div className="space-y-2">
                <Label className="text-xs">Display Order</Label>
                <Input
                  type="number"
                  value={config.order}
                  onChange={(e) =>
                    updateConfig(config.categoryName, {
                      order: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Image Dimensions Section */}
              <div className="space-y-3 pt-3 border-t">
                <div>
                  <Label className="text-xs font-semibold">Image Dimensions</Label>
                  <p className="text-xs text-muted-foreground">
                    Set card size for mobile and desktop views
                  </p>
                </div>

                {/* Mobile Dimensions */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mobile (W × H)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={config.mobileWidth}
                      onChange={(e) =>
                        updateConfig(config.categoryName, { mobileWidth: e.target.value })
                      }
                      placeholder="70vw"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={config.mobileHeight}
                      onChange={(e) =>
                        updateConfig(config.categoryName, { mobileHeight: e.target.value })
                      }
                      placeholder="90vw"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Desktop Dimensions */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Desktop (W × H)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={config.desktopWidth}
                      onChange={(e) =>
                        updateConfig(config.categoryName, { desktopWidth: e.target.value })
                      }
                      placeholder="23vw"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={config.desktopHeight}
                      onChange={(e) =>
                        updateConfig(config.categoryName, { desktopHeight: e.target.value })
                      }
                      placeholder="30vw"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <SaveIcon className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save All Categories"}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Categories are automatically synced from your Product Categories (Skins, Cases And Covers, Magneto X, etc.). 
            These settings only control how categories appear on the homepage "Category Explorer" section.
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
            <li><strong>Button Text:</strong> Leave empty to hide the button overlay (useful if text is already on the image)</li>
            <li><strong>Link URL:</strong> Leave empty to use the auto-generated category link</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
