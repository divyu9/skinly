import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Progress } from "@/components/ui/progress.tsx";

type PageType = "keyword" | "device" | "brand" | "skin_type";

interface GenerationItem {
  value: string;
  status: "pending" | "generating" | "success" | "error";
  error?: string;
  pageId?: Id<"seoPages">;
}

type Id<T> = string & { __tableName: T };

export default function AutoGenerateSEOPages() {
  const navigate = useNavigate();
  const [pageType, setPageType] = useState<PageType>("keyword");
  const [inputText, setInputText] = useState("");
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openAIKeySetting = useQuery(api.settings.getSetting, {
    key: "openaiApiKey",
  });
  const createPage = useMutation(api.seoPages.createPage);
  const generateContent = useAction(api.seoContentGenerator.generateSEOContent);

  const openAIEnabled = openAIKeySetting?.value;

  const parseInput = () => {
    const lines = inputText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error("Please enter at least one item");
      return;
    }

    const parsedItems: GenerationItem[] = lines.map((line) => ({
      value: line,
      status: "pending",
    }));

    setItems(parsedItems);
    toast.success(`Parsed ${parsedItems.length} items`);
  };

  const generateSlug = (value: string, type: PageType) => {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    switch (type) {
      case "keyword":
        return base;
      case "device":
        return `skins-for-${base}`;
      case "brand":
        return `${base}-skins`;
      case "skin_type":
        return `${base}-skins`;
      default:
        return base;
    }
  };

  const generateTitle = (value: string, type: PageType) => {
    switch (type) {
      case "keyword":
        return value;
      case "device":
        return `${value} Skins & Wraps`;
      case "brand":
        return `${value} Device Skins`;
      case "skin_type":
        return `${value} Skins`;
      default:
        return value;
    }
  };

  const startGeneration = async () => {
    if (items.length === 0) {
      toast.error("No items to generate");
      return;
    }

    setIsGenerating(true);
    setCurrentIndex(0);

    for (let i = 0; i < items.length; i++) {
      setCurrentIndex(i);
      const item = items[i];

      // Update status to generating
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: "generating" } : it
        )
      );

      try {
        const slug = generateSlug(item.value, pageType);
        const title = generateTitle(item.value, pageType);

        let content = "";
        let metaDescription = "";
        let faqs: Array<{ question: string; answer: string }> = [];

        // Try to generate AI content if enabled
        if (openAIEnabled) {
          try {
            const apiPageType = pageType === "skin_type" ? "skin-type" : pageType;
            const aiContent = await generateContent({
              pageType: apiPageType,
              keywords: [item.value],
            });

            if (aiContent.success && aiContent.contentHTML) {
              content = aiContent.contentHTML;
              // Generate meta description from first paragraph
              const firstParagraph = aiContent.contentHTML.match(/<p>(.*?)<\/p>/)?.[1] || "";
              metaDescription = firstParagraph.replace(/<[^>]*>/g, "").substring(0, 160);
              faqs = aiContent.faqs || [];
            }
          } catch (error) {
            // If AI generation fails, use placeholder
            console.error("AI generation failed, using placeholder:", error);
          }
        }

        // If no AI content, use placeholder
        if (!content) {
          content = `<h2>Welcome to ${title}</h2><p>This is a placeholder content section. Please edit this page to add your custom content about ${item.value}.</p>`;
          metaDescription = `Discover ${item.value} at GoSkinly. Premium quality products and services.`;
          faqs = [
            {
              question: `What is ${item.value}?`,
              answer: "This is a placeholder answer. Please update with actual content.",
            },
          ];
        }

        // Create the page
        const apiPageType = pageType === "skin_type" ? "skin-type" : pageType;
        const result = await createPage({
          pageType: apiPageType,
          slug,
          h1Heading: title,
          metaTitle: title,
          metaDescription,
          contentHTML: content,
          faqs,
          keywords: [item.value],
          imageAltTexts: [],
          filterConfig: {},
          isPublished: false,
        });

        // Update status to success
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "success", pageId: result.pageId } : it
          )
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Update status to error
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", error: errorMessage } : it
          )
        );
      }
    }

    setIsGenerating(false);
    const successCount = items.filter((it) => it.status === "success").length;
    const errorCount = items.filter((it) => it.status === "error").length;

    if (errorCount === 0) {
      toast.success(`Successfully generated ${successCount} pages!`);
    } else {
      toast.warning(
        `Generated ${successCount} pages with ${errorCount} errors`
      );
    }
  };

  const progress = items.length > 0 ? (currentIndex / items.length) * 100 : 0;
  const successCount = items.filter((it) => it.status === "success").length;
  const errorCount = items.filter((it) => it.status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Generate SEO Pages</h1>
          <p className="mt-1 text-muted-foreground">
            Bulk create SEO-optimized pages with AI-generated content
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/backend-skinly/seo-pages")}>
          Cancel
        </Button>
      </div>

      {!openAIEnabled && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            OpenAI API key not configured. Pages will be created with placeholder
            content. Configure the API key in Settings to enable AI generation.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Configure the type and content for page generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pageType">Page Type</Label>
              <Select
                value={pageType}
                onValueChange={(value) => setPageType(value as PageType)}
                disabled={isGenerating}
              >
                <SelectTrigger id="pageType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword Page</SelectItem>
                  <SelectItem value="device">Device Page</SelectItem>
                  <SelectItem value="brand">Brand Page</SelectItem>
                  <SelectItem value="skin_type">Skin Type Page</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pageType === "keyword" &&
                  "General keyword-based pages (e.g., 'premium phone skins')"}
                {pageType === "device" &&
                  "Device-specific pages (e.g., 'iPhone 15 Pro')"}
                {pageType === "brand" &&
                  "Brand-specific pages (e.g., 'Apple', 'Samsung')"}
                {pageType === "skin_type" &&
                  "Skin type pages (e.g., 'Carbon Fiber', 'Matte')"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inputText">
                Items (one per line)
              </Label>
              <Textarea
                id="inputText"
                placeholder={
                  pageType === "keyword"
                    ? "Enter keywords, one per line:\npremium phone skins\ncustom device wraps"
                    : pageType === "device"
                      ? "Enter device models, one per line:\niPhone 15 Pro\nSamsung Galaxy S24"
                      : pageType === "brand"
                        ? "Enter brand names, one per line:\nApple\nSamsung"
                        : "Enter skin types, one per line:\nCarbon Fiber\nMatte Black"
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isGenerating}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Each line will create one page. Empty lines will be ignored.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={parseInput}
                disabled={!inputText.trim() || isGenerating}
                variant="outline"
                className="flex-1"
              >
                Parse Items
              </Button>
              <Button
                onClick={startGeneration}
                disabled={items.length === 0 || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Start Generation
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {items.length === 0
                ? "Parsed items will appear here"
                : `${items.length} items ready for generation`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGenerating && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {currentIndex} / {items.length}
                  </span>
                </div>
                <Progress value={progress} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {successCount} success
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    {errorCount} errors
                  </span>
                </div>
              </div>
            )}

            {items.length > 0 && (
              <>
                <Separator className="mb-4" />
                <div className="max-h-[500px] space-y-2 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{item.value}</p>
                        <p className="text-xs text-muted-foreground">
                          /{generateSlug(item.value, pageType)}
                        </p>
                        {item.error && (
                          <p className="text-xs text-red-500">{item.error}</p>
                        )}
                      </div>
                      <div>
                        {item.status === "pending" && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {item.status === "generating" && (
                          <Badge variant="secondary">
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Generating
                          </Badge>
                        )}
                        {item.status === "success" && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Success
                          </Badge>
                        )}
                        {item.status === "error" && (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            Error
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {items.length === 0 && (
              <div className="flex h-[200px] items-center justify-center text-center text-muted-foreground">
                <div>
                  <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">
                    Enter items in the configuration panel
                    <br />
                    and click "Parse Items" to preview
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!isGenerating && items.length > 0 && successCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Generation Complete</h3>
                <p className="text-sm text-muted-foreground">
                  {successCount} pages created successfully
                  {errorCount > 0 && `, ${errorCount} failed`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setItems([]);
                    setInputText("");
                    setCurrentIndex(0);
                  }}
                >
                  Create More
                </Button>
                <Button onClick={() => navigate("/backend-skinly/seo-pages")}>
                  View All Pages
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
