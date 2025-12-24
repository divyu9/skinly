import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Loader2, Save, RotateCcw, ArrowUp, ArrowDown, X, Plus, Image } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { AdminLayout } from "@/components/admin-layout.tsx";

type PageType = "brand" | "device" | "product" | "skin-type" | "keyword";

type Template = {
  _id: Id<"seoPageTemplates">;
  pageType: PageType;
  displayName: string;
  description?: string;
  defaultHeroImage?: string;
  layoutConfig: {
    sections: Array<{
      id: string;
      label: string;
      enabled: boolean;
      order: number;
    }>;
  };
  defaultFilters: {
    autoCategorize?: boolean;
    filterByBrand?: boolean;
    filterByDevice?: boolean;
    filterByProduct?: boolean;
    filterByDesign?: boolean;
    showModelSelector?: boolean;
  };
  contentStructure: {
    h1Pattern: string;
    introLength: string;
    includeSections: string[];
    keywordsToInclude: string[];
  };
};

type EditableTemplate = Omit<Template, "_id">;

export default function SEOTemplatesPage() {
  const templates = useQuery(api.seoTemplates.getTemplates);
  const updateTemplate = useMutation(api.seoTemplates.updateTemplate);
  const initializeTemplates = useMutation(api.seoTemplates.initializeDefaultTemplates);
  const reinitializeTemplates = useMutation(api.seoTemplates.reinitializeTemplates);
  const initializeDefaultHeroImages = useMutation(api.seoTemplates.initializeDefaultHeroImages);
  const updateHeroImagesByPageType = useMutation(api.seoPages.updateHeroImagesByPageType);

  const [selectedType, setSelectedType] = useState<PageType>("brand");
  const [isSaving, setIsSaving] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState<EditableTemplate | null>(null);
  const [newSection, setNewSection] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isReinitializing, setIsReinitializing] = useState(false);
  const [isInitializingHeroImages, setIsInitializingHeroImages] = useState(false);
  const [isApplyingHeroImage, setIsApplyingHeroImage] = useState(false);

  const currentTemplate = templates?.find((t) => t.pageType === selectedType);

  // Initialize edited template when currentTemplate changes
  useEffect(() => {
    if (currentTemplate) {
      setEditedTemplate({
        pageType: currentTemplate.pageType,
        displayName: currentTemplate.displayName,
        description: currentTemplate.description,
        defaultHeroImage: currentTemplate.defaultHeroImage,
        layoutConfig: currentTemplate.layoutConfig,
        defaultFilters: currentTemplate.defaultFilters,
        contentStructure: currentTemplate.contentStructure,
      });
      setHasChanges(false);
    }
  }, [currentTemplate]);

  const handleInitialize = async () => {
    try {
      await initializeTemplates({});
      toast.success("Default templates initialized successfully");
    } catch (error) {
      toast.error("Failed to initialize templates");
      console.error(error);
    }
  };

  const handleReinitialize = async () => {
    if (!confirm("This will delete ALL existing templates and create fresh defaults. You'll lose any customizations. Continue?")) {
      return;
    }

    setIsReinitializing(true);
    try {
      const result = await reinitializeTemplates({});
      toast.success(`Templates re-initialized successfully. Deleted ${result.deleted}, created ${result.created}`);
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to re-initialize templates");
      console.error(error);
    } finally {
      setIsReinitializing(false);
    }
  };

  const handleInitializeHeroImages = async () => {
    setIsInitializingHeroImages(true);
    try {
      const result = await initializeDefaultHeroImages({});
      toast.success(result.message);
    } catch (error) {
      toast.error("Failed to initialize hero images");
      console.error(error);
    } finally {
      setIsInitializingHeroImages(false);
    }
  };

  const handleApplyHeroImageToPages = async () => {
    if (!editedTemplate?.defaultHeroImage) {
      toast.error("No hero image set for this template");
      return;
    }

    if (!confirm(`This will update the hero image for ALL ${selectedType} pages. This will overwrite any custom hero images. Continue?`)) {
      return;
    }

    setIsApplyingHeroImage(true);
    try {
      const result = await updateHeroImagesByPageType({
        pageType: selectedType,
        heroImageUrl: editedTemplate.defaultHeroImage,
      });
      toast.success(`Updated hero image for ${result.updatedCount} pages`);
    } catch (error) {
      toast.error("Failed to apply hero image to pages");
      console.error(error);
    } finally {
      setIsApplyingHeroImage(false);
    }
  };

  const handleSave = async () => {
    if (!editedTemplate) return;

    setIsSaving(true);
    try {
      await updateTemplate({
        pageType: selectedType,
        displayName: editedTemplate.displayName,
        description: editedTemplate.description,
        defaultHeroImage: editedTemplate.defaultHeroImage,
        layoutConfig: editedTemplate.layoutConfig,
        defaultFilters: editedTemplate.defaultFilters,
        contentStructure: editedTemplate.contentStructure,
      });
      toast.success("Template saved successfully");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save template");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (currentTemplate) {
      setEditedTemplate({
        pageType: currentTemplate.pageType,
        displayName: currentTemplate.displayName,
        description: currentTemplate.description,
        defaultHeroImage: currentTemplate.defaultHeroImage,
        layoutConfig: currentTemplate.layoutConfig,
        defaultFilters: currentTemplate.defaultFilters,
        contentStructure: currentTemplate.contentStructure,
      });
      setHasChanges(false);
      toast.info("Changes reset");
    }
  };

  const updateField = <K extends keyof EditableTemplate>(field: K, value: EditableTemplate[K]) => {
    if (!editedTemplate) return;
    setEditedTemplate({ ...editedTemplate, [field]: value });
    setHasChanges(true);
  };

  const toggleSection = (sectionId: string) => {
    if (!editedTemplate) return;
    const sections = editedTemplate.layoutConfig.sections.map((s) =>
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    );
    updateField("layoutConfig", { sections });
  };

  const moveSectionUp = (index: number) => {
    if (!editedTemplate || index === 0) return;
    const sections = [...editedTemplate.layoutConfig.sections];
    [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    sections.forEach((s, i) => (s.order = i + 1));
    updateField("layoutConfig", { sections });
  };

  const moveSectionDown = (index: number) => {
    if (!editedTemplate || index === editedTemplate.layoutConfig.sections.length - 1) return;
    const sections = [...editedTemplate.layoutConfig.sections];
    [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    sections.forEach((s, i) => (s.order = i + 1));
    updateField("layoutConfig", { sections });
  };

  const toggleFilter = (filterKey: keyof EditableTemplate["defaultFilters"]) => {
    if (!editedTemplate) return;
    updateField("defaultFilters", {
      ...editedTemplate.defaultFilters,
      [filterKey]: !editedTemplate.defaultFilters[filterKey],
    });
  };

  const addIncludeSection = () => {
    if (!editedTemplate || !newSection.trim()) return;
    const sections = [...editedTemplate.contentStructure.includeSections, newSection.trim()];
    updateField("contentStructure", { ...editedTemplate.contentStructure, includeSections: sections });
    setNewSection("");
  };

  const removeIncludeSection = (section: string) => {
    if (!editedTemplate) return;
    const sections = editedTemplate.contentStructure.includeSections.filter((s) => s !== section);
    updateField("contentStructure", { ...editedTemplate.contentStructure, includeSections: sections });
  };

  const addKeyword = () => {
    if (!editedTemplate || !newKeyword.trim()) return;
    const keywords = [...editedTemplate.contentStructure.keywordsToInclude, newKeyword.trim()];
    updateField("contentStructure", { ...editedTemplate.contentStructure, keywordsToInclude: keywords });
    setNewKeyword("");
  };

  const removeKeyword = (keyword: string) => {
    if (!editedTemplate) return;
    const keywords = editedTemplate.contentStructure.keywordsToInclude.filter((k) => k !== keyword);
    updateField("contentStructure", { ...editedTemplate.contentStructure, keywordsToInclude: keywords });
  };

  if (templates === undefined) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (templates.length === 0) {
    return (
      <AdminLayout>
        <div className="max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>SEO Page Templates</CardTitle>
            <CardDescription>
              No templates found. Initialize default templates to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleInitialize}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Initialize Default Templates
            </Button>
          </CardContent>
        </Card>
      </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SEO Page Templates</h1>
            <p className="text-muted-foreground mt-2">
              Configure global templates for each page type
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleInitializeHeroImages} 
              disabled={isInitializingHeroImages}
            >
              {isInitializingHeroImages ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Image className="mr-2 h-4 w-4" />
              )}
              Set Default Hero Images
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReinitialize} 
              disabled={isReinitializing}
            >
              {isReinitializing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Re-Initialize All
            </Button>
            {hasChanges && (
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Changes
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || !editedTemplate || !hasChanges}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Template
            </Button>
          </div>
        </div>

        {hasChanges && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="py-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                You have unsaved changes. Click "Save Template" to apply them.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as PageType)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="device">Device</TabsTrigger>
            <TabsTrigger value="product">Product</TabsTrigger>
            <TabsTrigger value="skin-type">Skin Type</TabsTrigger>
            <TabsTrigger value="keyword">Keyword</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedType} className="space-y-6">
            {editedTemplate && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Template Information</CardTitle>
                    <CardDescription>Basic template settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={editedTemplate.displayName}
                        onChange={(e) => updateField("displayName", e.target.value)}
                        placeholder="e.g., Brand Pages"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={editedTemplate.description || ""}
                        onChange={(e) => updateField("description", e.target.value)}
                        placeholder="Describe this template's purpose"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Default Hero Image</CardTitle>
                    <CardDescription>
                      Set the default hero banner image for all pages of this type
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="defaultHeroImage">Hero Image URL</Label>
                      <Input
                        id="defaultHeroImage"
                        value={editedTemplate.defaultHeroImage || ""}
                        onChange={(e) => updateField("defaultHeroImage", e.target.value)}
                        placeholder="https://cdn.hercules.app/file_..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use a Hercules CDN URL (https://cdn.hercules.app/file_...)
                      </p>
                    </div>
                    {editedTemplate.defaultHeroImage && (
                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <img 
                            src={editedTemplate.defaultHeroImage} 
                            alt="Hero preview" 
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={handleApplyHeroImageToPages}
                        disabled={!editedTemplate.defaultHeroImage || isApplyingHeroImage}
                        variant="secondary"
                      >
                        {isApplyingHeroImage ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Image className="mr-2 h-4 w-4" />
                        )}
                        Apply to All {editedTemplate.displayName}
                      </Button>
                      <p className="text-xs text-muted-foreground flex items-center">
                        This will update all existing pages of this type
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Layout Sections</CardTitle>
                    <CardDescription>
                      Configure which sections appear and in what order. Use arrows to reorder.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {editedTemplate.layoutConfig.sections.map((section, index) => (
                        <div key={section.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4 flex-1">
                            <span className="text-sm font-medium text-muted-foreground w-8">
                              #{section.order}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium">{section.label}</p>
                              <p className="text-sm text-muted-foreground">ID: {section.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveSectionUp(index)}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveSectionDown(index)}
                                disabled={index === editedTemplate.layoutConfig.sections.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </div>
                            <Switch
                              checked={section.enabled}
                              onCheckedChange={() => toggleSection(section.id)}
                            />
                            <span className="text-sm text-muted-foreground w-16">
                              {section.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Default Filters</CardTitle>
                    <CardDescription>
                      Product filtering behavior for this page type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="autoCategorize">Auto-categorize products</Label>
                        <Switch
                          id="autoCategorize"
                          checked={editedTemplate.defaultFilters.autoCategorize ?? false}
                          onCheckedChange={() => toggleFilter("autoCategorize")}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="filterByBrand">Filter by brand</Label>
                        <Switch
                          id="filterByBrand"
                          checked={editedTemplate.defaultFilters.filterByBrand ?? false}
                          onCheckedChange={() => toggleFilter("filterByBrand")}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="filterByDevice">Filter by device</Label>
                        <Switch
                          id="filterByDevice"
                          checked={editedTemplate.defaultFilters.filterByDevice ?? false}
                          onCheckedChange={() => toggleFilter("filterByDevice")}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="filterByProduct">Filter by product type</Label>
                        <Switch
                          id="filterByProduct"
                          checked={editedTemplate.defaultFilters.filterByProduct ?? false}
                          onCheckedChange={() => toggleFilter("filterByProduct")}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="filterByDesign">Filter by design</Label>
                        <Switch
                          id="filterByDesign"
                          checked={editedTemplate.defaultFilters.filterByDesign ?? false}
                          onCheckedChange={() => toggleFilter("filterByDesign")}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label htmlFor="showModelSelector">Show model selector</Label>
                        <Switch
                          id="showModelSelector"
                          checked={editedTemplate.defaultFilters.showModelSelector ?? false}
                          onCheckedChange={() => toggleFilter("showModelSelector")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content Structure (AI Guidelines)</CardTitle>
                    <CardDescription>
                      Template structure for AI content generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="h1Pattern">H1 Pattern</Label>
                      <Input
                        id="h1Pattern"
                        value={editedTemplate.contentStructure.h1Pattern}
                        onChange={(e) =>
                          updateField("contentStructure", {
                            ...editedTemplate.contentStructure,
                            h1Pattern: e.target.value,
                          })
                        }
                        placeholder="e.g., {Brand} Skins - Premium Protection"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use placeholders like {"{Brand}"}, {"{Device}"}, {"{Product}"}, {"{Keyword}"}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="introLength">Introduction Length</Label>
                      <Input
                        id="introLength"
                        value={editedTemplate.contentStructure.introLength}
                        onChange={(e) =>
                          updateField("contentStructure", {
                            ...editedTemplate.contentStructure,
                            introLength: e.target.value,
                          })
                        }
                        placeholder="e.g., 2-3 paragraphs"
                      />
                    </div>
                    <div>
                      <Label>Include Sections</Label>
                      <div className="flex flex-wrap gap-2 mt-2 mb-2">
                        {editedTemplate.contentStructure.includeSections.map((section) => (
                          <Badge key={section} variant="secondary" className="gap-1">
                            {section}
                            <button
                              onClick={() => removeIncludeSection(section)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newSection}
                          onChange={(e) => setNewSection(e.target.value)}
                          placeholder="Add section (e.g., benefits)"
                          onKeyDown={(e) => e.key === "Enter" && addIncludeSection()}
                        />
                        <Button onClick={addIncludeSection} size="sm" disabled={!newSection.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Keywords to Include</Label>
                      <div className="flex flex-wrap gap-2 mt-2 mb-2">
                        {editedTemplate.contentStructure.keywordsToInclude.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="gap-1">
                            {keyword}
                            <button
                              onClick={() => removeKeyword(keyword)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          placeholder="Add keyword (e.g., premium)"
                          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                        />
                        <Button onClick={addKeyword} size="sm" disabled={!newKeyword.trim()}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
