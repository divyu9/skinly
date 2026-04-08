import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { 
  GripVerticalIcon,
  LayoutListIcon,
  SaveIcon
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

const SECTION_INFO: Record<string, { label: string; description: string }> = {
  hero_slides: {
    label: "Hero Slider",
    description: "Full-width image carousel with CTAs"
  },
  models_marquee: {
    label: "Supported Models Marquee",
    description: "Scrolling banner of supported device models"
  },
  explore_models: {
    label: "Explore by Models",
    description: "Grid of device models for quick selection"
  },
  category_explorer: {
    label: "Category Explorer",
    description: "Auto-linked product category navigation"
  },
  top_picks: {
    label: "Top Picks",
    description: "Horizontally scrolling featured products"
  },
  most_trendy: {
    label: "Most Trendy",
    description: "Products organized by trending tags"
  },
  explore_by_brand: {
    label: "Explore by Brand",
    description: "Products organized by brand"
  },
  explore_by_gadget: {
    label: "Explore by Gadget",
    description: "Products organized by gadget type"
  },
  why_skinly: {
    label: "Why Skinly",
    description: "Trust indicators and value propositions"
  },
  feature_banner: {
    label: "Feature Banner",
    description: "Promotional banner with CTA"
  },
  ugc_videos: {
    label: "UGC Videos",
    description: "User-generated content video grid"
  },
};

export function LayoutManagerTab() {
  const sectionsData = useQuery(api.homepage.getAllHomepageSections);
  const updateSection = useMutation(api.homepage.updateHomepageSection);
  const bulkReorder = useMutation(api.homepage.bulkReorderSections);

  const [sections, setSections] = useState<typeof sectionsData>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Initialize sections when data loads
  useEffect(() => {
    if (sectionsData) {
      const sortedSections = [...sectionsData].sort((a, b) => a.order - b.order);
      setSections(sortedSections);
      setHasChanges(false);
    }
  }, [sectionsData]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !sections) return;

    const newSections = [...sections];
    const draggedSection = newSections[draggedIndex];
    newSections.splice(draggedIndex, 1);
    newSections.splice(index, 0, draggedSection);
    
    // Update order values
    newSections.forEach((section, idx) => {
      section.order = idx;
    });

    setSections(newSections);
    setDraggedIndex(index);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleToggleActive = async (index: number) => {
    if (!sections) return;
    const section = sections[index];
    if (!section) return;
    try {
      await updateSection({
        sectionId: section._id,
        isActive: !section.isActive,
      });
      const newSections = [...sections];
      newSections[index] = { ...section, isActive: !section.isActive };
      setSections(newSections);
      const label = SECTION_INFO[section.sectionType]?.label || section.sectionName;
      toast.success(`${label} ${!section.isActive ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error("Failed to update section");
      console.error(error);
    }
  };

  const handleSaveOrder = async () => {
    if (!sections) return;
    setIsSaving(true);
    try {
      const sectionOrders = sections.map((section) => ({
        sectionId: section._id,
        order: section.order,
      }));
      await bulkReorder({ sectionOrders });
      toast.success("Section order saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save section order");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (sectionsData === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Homepage Layout Manager</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop to reorder sections, toggle visibility
          </p>
        </div>
        <Button 
          onClick={handleSaveOrder} 
          disabled={!hasChanges || isSaving}
        >
          <SaveIcon className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Order"}
        </Button>
      </div>

      {/* Info Card */}
      {hasChanges && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="py-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              You have unsaved changes. Click "Save Order" to apply the new layout.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sections List */}
      {!sections || sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutListIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No sections found. Please check your homepage configuration.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => {
            const label = SECTION_INFO[section.sectionType]?.label || section.sectionName;
            const description = SECTION_INFO[section.sectionType]?.description || "";
            
            return (
              <Card
                key={section._id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "cursor-move transition-all",
                  draggedIndex === index && "opacity-50",
                  !section.isActive && "opacity-60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <GripVerticalIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold">
                          {label}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-muted-foreground">
                        Order: {section.order}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label 
                          htmlFor={`toggle-${section._id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {section.isActive ? "Visible" : "Hidden"}
                        </Label>
                        <Switch
                          id={`toggle-${section._id}`}
                          checked={section.isActive}
                          onCheckedChange={() => handleToggleActive(index)}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <h4 className="text-sm font-semibold mb-2">How to use:</h4>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Drag and drop cards to reorder homepage sections</li>
            <li>Use the toggle switch to show/hide sections (takes effect immediately)</li>
            <li>Click "Save Order" to apply the new layout order</li>
            <li>Hidden sections won't appear on the homepage but can be re-enabled anytime</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
