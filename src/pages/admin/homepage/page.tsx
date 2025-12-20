import { useState } from "react";
import { AdminPageWrapper } from "@/components/admin-page-wrapper.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { SettingsTab } from "./_components/settings-tab.tsx";
import { HeroSlidesTab } from "./_components/hero-slides-tab.tsx";
import { UgcVideosTab } from "./_components/ugc-videos-tab.tsx";
import { CategoriesTab } from "./_components/categories-tab.tsx";
import { 
  SettingsIcon, 
  ImageIcon, 
  VideoIcon, 
  LayoutGridIcon 
} from "lucide-react";

export default function HomepageManagement() {
  const [activeTab, setActiveTab] = useState("settings");

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Homepage Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage homepage content, hero slides, UGC videos, and category display
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="slides" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Hero Slides</span>
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <SettingsTab />
          </TabsContent>

          {/* Hero Slides Tab */}
          <TabsContent value="slides" className="space-y-6">
            <HeroSlidesTab />
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
    </AdminPageWrapper>
  );
}
