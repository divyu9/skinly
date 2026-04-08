import { useState } from "react";
import { useQuery, useMutation } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { TrendingUpIcon, AlertCircleIcon, SaveIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

export function MostTrendyTab() {
  const sections = useQuery(api.homepage.getAllHomepageSections);
  const section = sections?.find((s) => s.sectionType === "most_trendy");
  const updateSection = useMutation(api.homepage.updateHomepageSection);

  // Parse config
  const config = section?.config as {
    title?: string;
    subtitle?: string;
    tags?: string[];
    maxProducts?: number;
    cardWidth?: number;
    cardHeight?: number;
  } | undefined;

  const [title, setTitle] = useState(config?.title || "Most Trendy");
  const [subtitle, setSubtitle] = useState(config?.subtitle || "");
  const [tags, setTags] = useState<string[]>(config?.tags || ["trendy"]);
  const [tagInput, setTagInput] = useState("");
  const [maxProducts, setMaxProducts] = useState(config?.maxProducts || 10);
  const [cardWidth, setCardWidth] = useState(config?.cardWidth || 280);
  const [cardHeight, setCardHeight] = useState(config?.cardHeight || 380);
  const [saving, setSaving] = useState(false);

  // Preview products
  const previewProducts = useQuery(
    api.homepage.getProductsByTags,
    tags.length > 0 ? { tags, maxProducts: 6 } : "skip"
  );

  const handleSave = async () => {
    if (!section) return;

    try {
      setSaving(true);
      await updateSection({
        sectionId: section._id,
        config: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          tags,
          maxProducts,
          cardWidth,
          cardHeight,
        }),
      });
      toast.success("Most Trendy settings saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (!trimmedTag) {
      toast.error("Please enter a tag");
      return;
    }
    if (tags.includes(trimmedTag)) {
      toast.error("Tag already exists");
      return;
    }
    setTags([...tags, trimmedTag]);
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    if (tags.length <= 1) {
      toast.error("You must have at least one tag");
      return;
    }
    setTags(tags.filter((t) => t !== tag));
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
          <TrendingUpIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Most Trendy section not found in database.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Section Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Most Trendy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle (Optional)</Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Check out what's trending"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxProducts">Max Products</Label>
              <Input
                id="maxProducts"
                type="number"
                value={maxProducts}
                onChange={(e) => setMaxProducts(parseInt(e.target.value) || 10)}
                min={1}
                max={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardWidth">Card Width (px)</Label>
              <Input
                id="cardWidth"
                type="number"
                value={cardWidth}
                onChange={(e) => setCardWidth(parseInt(e.target.value) || 280)}
                min={200}
                max={400}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardHeight">Card Height (px)</Label>
              <Input
                id="cardHeight"
                type="number"
                value={cardHeight}
                onChange={(e) => setCardHeight(parseInt(e.target.value) || 380)}
                min={250}
                max={500}
              />
            </div>
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

      {/* Tags Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Product Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter tag (e.g., trendy, featured, popular)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button onClick={handleAddTag} variant="outline">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-sm py-2 px-3">
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 hover:text-destructive"
                  disabled={tags.length <= 1}
                >
                  <Trash2Icon className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>How it works:</strong> Products with ANY of these tags will be shown in the Most Trendy section. Tags are case-insensitive.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Product Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Product Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Add at least one tag to preview products</p>
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
                No products found with tags: {tags.join(", ")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Make sure products have at least one of these tags assigned in the Products page
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {previewProducts.length} products found (showing up to 6)
                </p>
                <div className="flex gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
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
                    <div className="flex flex-wrap gap-1">
                      {product.tags.filter(t => tags.includes(t.toLowerCase())).map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] px-1 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
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
