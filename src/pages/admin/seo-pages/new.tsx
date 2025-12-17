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
import { Separator } from "@/components/ui/separator.tsx";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";

type PageType = "keyword" | "device" | "brand" | "skin_type";

export default function NewSEOPage() {
  const navigate = useNavigate();
  const [pageType, setPageType] = useState<PageType>("keyword");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openAIKeySetting = useQuery(api.settings.getSetting, {
    key: "openaiApiKey",
  });
  const createPage = useMutation(api.seoPages.createPage);
  const generateContent = useAction(api.seoContentGenerator.generateSEOContent);

  const openAIEnabled = openAIKeySetting?.value;

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug) {
      setSlug(generateSlug(value));
    }
    if (!metaTitle) {
      setMetaTitle(value);
    }
  };

  const handleGenerateAI = async () => {
    if (!title) {
      toast.error("Please enter a title first");
      return;
    }

    if (!openAIEnabled) {
      toast.error("OpenAI API key not configured");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const result = await generateContent({
        pageType: pageType === "skin_type" ? "skin-type" : pageType,
        keywords: [title],
      });

      if (result.success && result.contentHTML) {
        setContent(result.contentHTML);
        if (result.faqs && result.faqs.length > 0) {
          // Add FAQs to content if available
          const faqHTML = result.faqs
            .map(
              (faq) =>
                `<h3>${faq.question}</h3><p>${faq.answer}</p>`
            )
            .join("\n");
          setContent(result.contentHTML + "\n\n" + faqHTML);
        }
        // Generate meta description from first paragraph
        const firstParagraph = result.contentHTML.match(/<p>(.*?)<\/p>/)?.[1] || "";
        const cleanText = firstParagraph.replace(/<[^>]*>/g, "").substring(0, 160);
        setMetaDescription(cleanText);
        toast.success("AI content generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate content");
      }
    } catch (error) {
      toast.error("Failed to generate AI content");
      console.error(error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    if (!metaTitle.trim()) {
      toast.error("Meta title is required");
      return;
    }

    if (!metaDescription.trim()) {
      toast.error("Meta description is required");
      return;
    }

    setIsSaving(true);
    try {
      await createPage({
        pageType: pageType === "skin_type" ? "skin-type" : pageType,
        slug,
        h1Heading: title,
        metaTitle,
        metaDescription,
        contentHTML: content,
        faqs: [],
        keywords: [title],
        imageAltTexts: [],
        filterConfig: {},
        isPublished: isPublished,
      });

      toast.success("Page created successfully!");
      navigate("/backend-skinly/seo-pages");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create page"
      );
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create SEO Page</h1>
          <p className="mt-1 text-muted-foreground">
            Create a new SEO-optimized landing page
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/backend-skinly/seo-pages")}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isPublished ? "Publish" : "Save Draft"}
              </>
            )}
          </Button>
        </div>
      </div>

      {!openAIEnabled && useAI && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            OpenAI API key not configured. Configure the API key in Settings to
            enable AI content generation.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Page Details</CardTitle>
              <CardDescription>
                Basic information about your SEO page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pageType">Page Type</Label>
                <Select
                  value={pageType}
                  onValueChange={(value) => setPageType(value as PageType)}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Premium Phone Skins"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {title.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    goskinly.com/
                  </span>
                  <Input
                    id="slug"
                    placeholder="premium-phone-skins"
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    maxLength={100}
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Content</CardTitle>
                  <CardDescription>
                    The main content of your landing page
                  </CardDescription>
                </div>
                {openAIEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI || !title}
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">HTML Content</Label>
                <Textarea
                  id="content"
                  placeholder="<h2>Welcome</h2><p>Your content here...</p>"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use HTML markup for formatting. Images should use alt text for
                  SEO.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isPublished">Publish Immediately</Label>
                  <p className="text-xs text-muted-foreground">
                    Make this page live on your site
                  </p>
                </div>
                <Switch
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO Meta</CardTitle>
              <CardDescription>Search engine optimization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input
                  id="metaTitle"
                  placeholder="Title for search engines"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  {metaTitle.length}/60 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  placeholder="Description for search engines"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={160}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {metaDescription.length}/160 characters
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Use descriptive, keyword-rich titles</p>
              <p>• Keep meta descriptions under 160 characters</p>
              <p>• Include target keywords naturally</p>
              <p>• Add alt text to all images</p>
              <p>• Structure content with proper headings</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AdminLayout>
  );
}
