import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function EditSEOPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  
  const page = useQuery(api.seoPages.getPage, { 
    pageId: pageId as Id<"seoPages"> 
  });
  const updatePage = useMutation(api.seoPages.updatePage);
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form state
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [h1Heading, setH1Heading] = useState("");
  const [slug, setSlug] = useState("");
  const [contentHTML, setContentHTML] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  
  // Initialize form when page loads
  useEffect(() => {
    if (page) {
      setMetaTitle(page.metaTitle || "");
      setMetaDescription(page.metaDescription || "");
      setH1Heading(page.h1Heading || "");
      setSlug(page.slug || "");
      setContentHTML(page.contentHTML || "");
      setHeroImageUrl(page.heroImageUrl || "");
      setFaqs(page.faqs || []);
    }
  }, [page]);
  
  // Track changes
  useEffect(() => {
    if (!page) return;
    
    const changed = 
      metaTitle !== (page.metaTitle || "") ||
      metaDescription !== (page.metaDescription || "") ||
      h1Heading !== (page.h1Heading || "") ||
      slug !== (page.slug || "") ||
      contentHTML !== (page.contentHTML || "") ||
      JSON.stringify(faqs) !== JSON.stringify(page.faqs || []);
    
    setHasChanges(changed);
  }, [page, metaTitle, metaDescription, h1Heading, slug, contentHTML, faqs]);
  
  const handleSave = async () => {
    if (!pageId || !page) return;
    
    // Validation
    if (!metaTitle.trim()) {
      toast.error("Meta title is required");
      return;
    }
    if (!metaDescription.trim()) {
      toast.error("Meta description is required");
      return;
    }
    if (!h1Heading.trim()) {
      toast.error("H1 heading is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    
    setIsSaving(true);
    try {
      await updatePage({
        pageId: pageId as Id<"seoPages">,
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
        h1Heading: h1Heading.trim(),
        slug: slug.trim(),
        contentHTML: contentHTML.trim(),
        faqs: faqs.filter(faq => faq.question.trim() && faq.answer.trim()),
      });
      
      toast.success("Page updated successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to update page");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const addFAQ = () => {
    setFaqs([...faqs, { question: "", answer: "" }]);
  };
  
  const updateFAQ = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  };
  
  const removeFAQ = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };
  
  if (!page) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }
  
  const previewUrl = `${window.location.origin}/${slug}`;
  
  return (
    <AdminLayout>
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/backend-skinly/seo-pages")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Edit SEO Page</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{page.pageType}</Badge>
                {page.isPublished ? (
                  <Badge variant="default">Published</Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
        
        {hasChanges && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium">You have unsaved changes</p>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Basic SEO Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Basic SEO Information</CardTitle>
              <CardDescription>
                Configure the core SEO metadata for this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">
                  Meta Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Enter meta title (60-70 characters recommended)"
                  maxLength={70}
                />
                <p className="text-xs text-muted-foreground">
                  {metaTitle.length}/70 characters
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="metaDescription">
                  Meta Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="metaDescription"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Enter meta description (155-160 characters recommended, must end with complete sentence)"
                  rows={3}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {metaDescription.length}/200 characters
                  {metaDescription.length >= 155 && metaDescription.length <= 160 && (
                    <span className="text-green-600 ml-2">✓ Optimal length</span>
                  )}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="h1Heading">
                  H1 Heading <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="h1Heading"
                  value={h1Heading}
                  onChange={(e) => setH1Heading(e.target.value)}
                  placeholder="Enter main page heading"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slug">
                  URL Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="url-slug-here"
                />
                <p className="text-xs text-muted-foreground">
                  Preview: {previewUrl}
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Hero Image */}
          <Card>
            <CardHeader>
              <CardTitle>Hero Image</CardTitle>
              <CardDescription>
                Optional background image for the hero section. To change the hero image, use the "Upload Hero Image" option in the SEO Pages list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {heroImageUrl ? (
                <div className="space-y-2">
                  <Label>Current Hero Image</Label>
                  <div className="mt-2">
                    <img
                      src={heroImageUrl}
                      alt="Hero preview"
                      className="max-w-md rounded-lg border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To update, go back to the SEO Pages list and use "Upload Hero Image" from the page actions menu.
                  </p>
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No hero image set. Add one from the SEO Pages list using "Upload Hero Image" action.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Content HTML */}
          <Card>
            <CardHeader>
              <CardTitle>Page Content (HTML)</CardTitle>
              <CardDescription>
                Main content area in HTML format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={contentHTML}
                onChange={(e) => setContentHTML(e.target.value)}
                placeholder="<h2>Section Title</h2><p>Content here...</p>"
                rows={10}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
          
          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle>FAQs</CardTitle>
              <CardDescription>
                Add frequently asked questions for this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>FAQ {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFAQ(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={faq.question}
                    onChange={(e) => updateFAQ(index, "question", e.target.value)}
                    placeholder="Question"
                  />
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                    placeholder="Answer"
                    rows={3}
                  />
                </div>
              ))}
              
              <Button variant="outline" onClick={addFAQ} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add FAQ
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
