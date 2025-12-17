import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { AdminLayout } from "@/components/admin-layout.tsx";

type PageType = "brand" | "device" | "product" | "skin-type" | "keyword";

type Template = {
  _id: Id<"seoPageTemplates">;
  pageType: PageType;
  displayName: string;
  description?: string;
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

export default function SEOTemplatesPage() {
  const templates = useQuery(api.seoTemplates.getTemplates);
  const updateTemplate = useMutation(api.seoTemplates.updateTemplate);
  const initializeTemplates = useMutation(api.seoTemplates.initializeDefaultTemplates);

  const [selectedType, setSelectedType] = useState<PageType>("brand");
  const [isSaving, setIsSaving] = useState(false);

  const currentTemplate = templates?.find((t) => t.pageType === selectedType);

  const handleInitialize = async () => {
    try {
      await initializeTemplates({});
      toast.success("Default templates initialized successfully");
    } catch (error) {
      toast.error("Failed to initialize templates");
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!currentTemplate) return;

    setIsSaving(true);
    try {
      await updateTemplate({
        pageType: selectedType,
        displayName: currentTemplate.displayName,
        description: currentTemplate.description,
        layoutConfig: currentTemplate.layoutConfig,
        defaultFilters: currentTemplate.defaultFilters,
        contentStructure: currentTemplate.contentStructure,
      });
      toast.success("Template saved successfully");
    } catch (error) {
      toast.error("Failed to save template");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
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
        <Button onClick={handleSave} disabled={isSaving || !currentTemplate}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Template
        </Button>
      </div>

      <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as PageType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="device">Device</TabsTrigger>
          <TabsTrigger value="product">Product</TabsTrigger>
          <TabsTrigger value="skin-type">Skin Type</TabsTrigger>
          <TabsTrigger value="keyword">Keyword</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="space-y-6">
          {currentTemplate && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Template Information</CardTitle>
                  <CardDescription>Basic template settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Display Name</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentTemplate.displayName}
                    </p>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentTemplate.description || "No description"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Layout Sections</CardTitle>
                  <CardDescription>
                    Configure which sections appear and in what order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentTemplate.layoutConfig.sections.map((section) => (
                      <div key={section.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground w-8">
                            #{section.order}
                          </span>
                          <div>
                            <p className="font-medium">{section.label}</p>
                            <p className="text-sm text-muted-foreground">ID: {section.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={section.enabled} disabled />
                          <span className="text-sm text-muted-foreground">
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
                      <Label>Auto-categorize products</Label>
                      <Switch checked={currentTemplate.defaultFilters.autoCategorize ?? false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <Label>Filter by brand</Label>
                      <Switch checked={currentTemplate.defaultFilters.filterByBrand ?? false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <Label>Filter by device</Label>
                      <Switch checked={currentTemplate.defaultFilters.filterByDevice ?? false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <Label>Filter by product type</Label>
                      <Switch checked={currentTemplate.defaultFilters.filterByProduct ?? false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <Label>Filter by design</Label>
                      <Switch checked={currentTemplate.defaultFilters.filterByDesign ?? false} disabled />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <Label>Show model selector</Label>
                      <Switch checked={currentTemplate.defaultFilters.showModelSelector ?? false} disabled />
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
                    <Label>H1 Pattern</Label>
                    <p className="text-sm text-muted-foreground mt-1 font-mono bg-muted p-2 rounded">
                      {currentTemplate.contentStructure.h1Pattern}
                    </p>
                  </div>
                  <div>
                    <Label>Introduction Length</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentTemplate.contentStructure.introLength}
                    </p>
                  </div>
                  <div>
                    <Label>Include Sections</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentTemplate.contentStructure.includeSections.map((section) => (
                        <span key={section} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                          {section}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Keywords to Include</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentTemplate.contentStructure.keywordsToInclude.map((keyword) => (
                        <span key={keyword} className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full">
                          {keyword}
                        </span>
                      ))}
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
