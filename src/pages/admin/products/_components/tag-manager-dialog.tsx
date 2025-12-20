import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { XIcon, TagIcon, SparklesIcon, TrendingUpIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: Id<"products">;
  productTitle: string;
  currentTags: string[];
}

const COMMON_TAGS = [
  { label: "Bestseller", value: "bestseller", icon: StarIcon },
  { label: "New", value: "new", icon: SparklesIcon },
  { label: "Trending", value: "trending", icon: TrendingUpIcon },
];

export function TagManagerDialog({
  open,
  onOpenChange,
  productId,
  productTitle,
  currentTags,
}: TagManagerDialogProps) {
  const [tags, setTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateProductTags = useMutation(api.products.updateProductTags);

  // Reset tags when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTags(currentTags);
      setNewTag("");
    }
    onOpenChange(newOpen);
  };

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProductTags({
        productId,
        tags,
      });
      toast.success("Tags updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update tags");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCommonTag = (tagValue: string) => {
    if (tags.includes(tagValue)) {
      handleRemoveTag(tagValue);
    } else {
      handleAddTag(tagValue);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            {productTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Common Tags (Quick Add) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Add Tags</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_TAGS.map((commonTag) => {
                const Icon = commonTag.icon;
                const isActive = tags.includes(commonTag.value);
                return (
                  <Button
                    key={commonTag.value}
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => toggleCommonTag(commonTag.value)}
                    className="gap-2"
                  >
                    <Icon className="size-3" />
                    {commonTag.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              These tags control which products appear in the Top Picks section on the homepage
            </p>
          </div>

          {/* Current Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Tags ({tags.length})</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 gap-2">
                    <TagIcon className="size-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-full hover:bg-muted p-0.5"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Tag */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Custom Tag</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter tag name..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag(newTag);
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
