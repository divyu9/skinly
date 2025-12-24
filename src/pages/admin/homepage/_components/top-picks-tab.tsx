import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { StarIcon, AlertCircleIcon, SaveIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export function TopPicksTab() {
  const sections = useQuery(api.homepage.getAllHomepageSections);
  const section = sections?.find((s) => s.sectionType === "top_picks");
  const updateSection = useMutation(api.homepage.updateHomepageSection);

  // Parse config
  const config = section?.config as {
    title?: string;
    tabs?: Array<{
      label: string;
      tag?: string;
    }>;
  } | undefined;

  const [title, setTitle] = useState(config?.title || "Top Picks For You");
  const [tabs, setTabs] = useState(config?.tabs || [
    { label: "Bestsellers", tag: "bestseller" },
    { label: "New Arrivals", tag: "new" },
    { label: "Trending", tag: "trending" }
  ]);
  const [saving, setSaving] = useState(false);

  // Preview products for first tab
  const [previewTabIndex, setPreviewTabIndex] = useState(0);
  const previewProducts = useQuery(
    api.products.getProductsByTag,
    tabs[previewTabIndex]?.tag 
      ? { tag: tabs[previewTabIndex].tag, limit: 6 }
      : "skip"
  );

  const handleSave = async () => {
    if (!section) return;

    try {
      setSaving(true);
      await updateSection({
        sectionId: section._id,
        config: JSON.stringify({
          title,
          tabs,
        }),
      });
      toast.success("Top Picks settings saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTab = () => {
    setTabs([...tabs, { label: "New Tab", tag: "" }]);
  };

  const handleRemoveTab = (index: number) => {
    if (tabs.length <= 1) {
      toast.error("You must have at least one tab");
      return;
    }
    setTabs(tabs.filter((_, i) => i !== index));
  };

  const handleUpdateTab = (index: number, field: "label" | "tag", value: string) => {
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], [field]: value };
    setTabs(newTabs);
  };

  if (sections === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!section) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircleIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Top Picks section not found in database.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Section Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Section Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Top Picks For You"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <p className="text-sm font-medium">Section Status</p>
              <p className="text-xs text-muted-foreground">
                {section.isActive ? "Active" : "Inactive"} • Order: {section.order}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <SaveIcon className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tab Configuration</CardTitle>
            <Button onClick={handleAddTab} size="sm" variant="outline">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tabs.map((tab, index) => (
            <Card key={index} className="border-2">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`tab-label-${index}`}>Tab Label</Label>
                      <Input
                        id={`tab-label-${index}`}
                        value={tab.label}
                        onChange={(e) => handleUpdateTab(index, "label", e.target.value)}
                        placeholder="Bestsellers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`tab-tag-${index}`}>Product Tag</Label>
                      <Input
                        id={`tab-tag-${index}`}
                        value={tab.tag || ""}
                        onChange={(e) => handleUpdateTab(index, "tag", e.target.value)}
                        placeholder="bestseller, new, trending, trendy, etc."
                      />
                      <p className="text-xs text-muted-foreground">
                        Products with this tag will be shown in this tab
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTab(index)}
                    disabled={tabs.length <= 1}
                  >
                    <Trash2Icon className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Tip:</strong> Common tags include: bestseller, new, trending, trendy, featured, popular
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Product Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Preview</CardTitle>
            <div className="flex gap-2">
              {tabs.map((tab, index) => (
                <Button
                  key={index}
                  variant={previewTabIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewTabIndex(index)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!tabs[previewTabIndex]?.tag ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Add a tag to preview products</p>
            </div>
          ) : previewProducts === undefined ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : previewProducts.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircleIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No products found with tag "{tabs[previewTabIndex].tag}"
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Make sure products have this tag assigned in the Products page
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {previewProducts.length} products found
                </p>
                <Badge variant="secondary">Tag: {tabs[previewTabIndex].tag}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {previewProducts.map((product) => (
                  <div key={product._id} className="space-y-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      {product.images[0] && (
                        <img
                          src={product.images[0].url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <p className="text-xs line-clamp-2">{product.title}</p>
                    {product.variants[0] && (
                      <p className="text-xs font-semibold">
                        ₹{product.variants[0].price}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
