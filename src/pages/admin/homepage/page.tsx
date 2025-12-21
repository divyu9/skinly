import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { SettingsTab } from "./_components/settings-tab.tsx";
import { HeroSlidesTab } from "./_components/hero-slides-tab.tsx";
import { FeatureBannersTab } from "./_components/feature-banners-tab.tsx";
import { UgcVideosTab } from "./_components/ugc-videos-tab.tsx";
import { CategoriesTab } from "./_components/categories-tab.tsx";
import { MostTrendyTab } from "./_components/most-trendy-tab.tsx";
import { ExploreByBrandTab } from "./_components/explore-by-brand-tab.tsx";
import { ExploreByGadgetTab } from "./_components/explore-by-gadget-tab.tsx";
import { LayoutManagerTab } from "./_components/layout-manager-tab.tsx";
import { 
  SettingsIcon, 
  ImageIcon, 
  VideoIcon, 
  LayoutGridIcon,
  RectangleHorizontalIcon,
  TrendingUpIcon,
  TagIcon,
  SmartphoneIcon,
  LayoutListIcon
} from "lucide-react";

export default function HomepageManagement() {
  const [activeTab, setActiveTab] = useState("layout");

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Homepage Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage homepage sections, content, hero slides, featured products, and layout
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-auto min-w-full lg:min-w-0">
              <TabsTrigger value="layout" className="gap-2">
                <LayoutListIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Layout</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="slides" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Hero Slides</span>
              </TabsTrigger>
              <TabsTrigger value="trendy" className="gap-2">
                <TrendingUpIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Most Trendy</span>
              </TabsTrigger>
              <TabsTrigger value="brands" className="gap-2">
                <TagIcon className="h-4 w-4" />
                <span className="hidden sm:inline">By Brand</span>
              </TabsTrigger>
              <TabsTrigger value="gadgets" className="gap-2">
                <SmartphoneIcon className="h-4 w-4" />
                <span className="hidden sm:inline">By Gadget</span>
              </TabsTrigger>
              <TabsTrigger value="banners" className="gap-2">
                <RectangleHorizontalIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Banners</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-2">
                <VideoIcon className="h-4 w-4" />
                <span className="hidden sm:inline">UGC Videos</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-2">
                <LayoutGridIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Categories</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Layout Manager Tab */}
          <TabsContent value="layout" className="space-y-6">
            <LayoutManagerTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <SettingsTab />
          </TabsContent>

          {/* Hero Slides Tab */}
          <TabsContent value="slides" className="space-y-6">
            <HeroSlidesTab />
          </TabsContent>

          {/* Most Trendy Tab */}
          <TabsContent value="trendy" className="space-y-6">
            <MostTrendyTab />
          </TabsContent>

          {/* Explore by Brand Tab */}
          <TabsContent value="brands" className="space-y-6">
            <ExploreByBrandTab />
          </TabsContent>

          {/* Explore by Gadget Tab */}
          <TabsContent value="gadgets" className="space-y-6">
            <ExploreByGadgetTab />
          </TabsContent>

          {/* Feature Banners Tab */}
          <TabsContent value="banners" className="space-y-6">
            <FeatureBannersTab />
          </TabsContent>

          {/* UGC Videos Tab */}
          <TabsContent value="videos" className="space-y-6">
            <UgcVideosTab />
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <CategoriesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
