import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { CheckIcon, XIcon, SparklesIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

interface SEOPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentContent: {
    metaTitle: string;
    description: string;
    metaDescription: string;
    tags: string[];
  };
  generatedContent: {
    metaTitle: string;
    description: string;
    metaDescription: string;
    tags: string[];
  };
  onApply: () => void;
  isApplying?: boolean;
}

export function SEOPreviewDialog({
  open,
  onOpenChange,
  currentContent,
  generatedContent,
  onApply,
  isApplying = false,
}: SEOPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <DialogTitle>AI-Generated SEO Content</DialogTitle>
          </div>
          <DialogDescription>
            Review the AI-generated content before applying it to your product.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Meta Title */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Meta Title</h3>
                <Badge variant="secondary" className="text-xs">
                  {generatedContent.metaTitle.length} / 70 chars
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Current</div>
                  <div className="p-3 bg-muted/50 rounded-md text-sm min-h-[60px]">
                    {currentContent.metaTitle || (
                      <span className="text-muted-foreground italic">No meta title set</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground font-medium">AI Generated</div>
                    <SparklesIcon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm min-h-[60px]">
                    {generatedContent.metaTitle}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Product Description</h3>
                <Badge variant="secondary" className="text-xs">
                  {generatedContent.description.length} chars
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Current</div>
                  <div className="p-3 bg-muted/50 rounded-md text-sm min-h-[200px] whitespace-pre-wrap">
                    {currentContent.description || (
                      <span className="text-muted-foreground italic">No description set</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground font-medium">AI Generated</div>
                    <SparklesIcon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm min-h-[200px] whitespace-pre-wrap">
                    {generatedContent.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Description */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Meta Description (SEO)</h3>
                <Badge variant="secondary" className="text-xs">
                  {generatedContent.metaDescription.length} / 160 chars
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Current</div>
                  <div className="p-3 bg-muted/50 rounded-md text-sm min-h-[80px]">
                    {currentContent.metaDescription || (
                      <span className="text-muted-foreground italic">No meta description set</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground font-medium">AI Generated</div>
                    <SparklesIcon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm min-h-[80px]">
                    {generatedContent.metaDescription}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">SEO Tags</h3>
                <Badge variant="secondary" className="text-xs">
                  {generatedContent.tags.length} tags
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Current</div>
                  <div className="p-3 bg-muted/50 rounded-md min-h-[80px]">
                    {currentContent.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {currentContent.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">No tags set</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground font-medium">AI Generated</div>
                    <SparklesIcon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md min-h-[80px]">
                    <div className="flex flex-wrap gap-1.5">
                      {generatedContent.tags.map((tag, idx) => (
                        <Badge key={idx} variant="default" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            <XIcon className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onApply} disabled={isApplying}>
            <CheckIcon className="h-4 w-4 mr-2" />
            {isApplying ? "Applying..." : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
