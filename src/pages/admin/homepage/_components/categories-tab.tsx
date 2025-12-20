import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
  isActive: boolean;
  order: number;
}

export function CategoriesTab() {
  const categories = useQuery(api.homepage.getAllCategoryDisplaySettings);
  const gadgetTypes = useQuery(api.gadgetTypes.list);
  const bulkUpdate = useMutation(api.homepage.bulkUpdateCategoryDisplaySettings);

  const [configs, setConfigs] = useState<CategoryConfig[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with gadget types or loaded data
  useEffect(() => {
    if (categories && gadgetTypes) {
      const existingMap = new Map(categories.map((cat) => [cat.categoryName, cat]));
      
      const initialConfigs = gadgetTypes.map((gadgetType: { name: string; displayName: string }, index: number) => {
        const existing = existingMap.get(gadgetType.name);
        if (existing) {
          return {
            categoryName: existing.categoryName,
            displayName: existing.displayName,
            imageUrl: existing.imageUrl || "",
            isActive: existing.isActive,
            order: existing.order,
          };
        } else {
          return {
            categoryName: gadgetType.name,
            displayName: gadgetType.displayName,
            imageUrl: "",
            isActive: true,
            order: index,
          };
        }
      });
      
      setConfigs(initialConfigs);
    }
  }, [categories, gadgetTypes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await bulkUpdate({
        categories: configs.map((config) => ({
          categoryName: config.categoryName,
          displayName: config.displayName,
          imageUrl: config.imageUrl || undefined,
          isActive: config.isActive,
          order: config.order,
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

  if (categories === undefined || gadgetTypes === undefined) {
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
                  placeholder="https://cdn.hercules.app/file_..."
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
            <strong>Note:</strong> Categories are automatically synced from your Product Classification Gadget Types. 
            These settings only control how categories appear on the homepage "Category Explorer" section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
