import { useState, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { HeroSlider } from "@/components/hero-slider.tsx";
import { CategoryExplorer } from "@/components/category-explorer.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { WelcomeBackCard } from "@/components/welcome-back-card.tsx";

// Lazy load below-the-fold and modal components for better FCP/LCP
const MobileNav = lazy(() => import("@/components/mobile-nav.tsx").then(m => ({ default: m.MobileNav })));
const ModelsMarquee = lazy(() => import("@/components/models-marquee.tsx").then(m => ({ default: m.ModelsMarquee })));
const ExploreModels = lazy(() => import("@/components/explore-models.tsx").then(m => ({ default: m.ExploreModels })));
const TopPicks = lazy(() => import("@/components/top-picks.tsx").then(m => ({ default: m.TopPicks })));
const MostTrendy = lazy(() => import("@/components/most-trendy.tsx").then(m => ({ default: m.MostTrendy })));
const ExploreByBrand = lazy(() => import("@/components/explore-by-brand.tsx").then(m => ({ default: m.ExploreByBrand })));
const ExploreByGadget = lazy(() => import("@/components/explore-by-gadget.tsx").then(m => ({ default: m.ExploreByGadget })));
const SiteFooter = lazy(() => import("@/components/site-footer.tsx").then(m => ({ default: m.SiteFooter })));
const BugReportModal = lazy(() => import("@/components/bug-report-modal.tsx").then(m => ({ default: m.BugReportModal })));
const WhySkinly = lazy(() => import("@/components/why-skinly").then(m => ({ default: m.WhySkinly })));
const FeatureBanner = lazy(() => import("@/components/feature-banner").then(m => ({ default: m.FeatureBanner })));
const UgcVideos = lazy(() => import("@/components/ugc-videos").then(m => ({ default: m.UgcVideos })));

// Loading fallback for lazy components
function SectionSkeleton() {
  return (
    <div className="container mx-auto px-4 py-12 space-y-4">
      <Skeleton className="h-10 w-64 mx-auto" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";

export default function Index() {
  const [isRequestModelOpen, setIsRequestModelOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Request model form state
  const [requestBrand, setRequestBrand] = useState("");
  const [requestModel, setRequestModel] = useState("");
  const [requestCategory, setRequestCategory] = useState<string>("");
  const [requestPhone, setRequestPhone] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const createModelRequest = useMutation(api.modelRequests.createModelRequest);
  
  // Get homepage sections to render dynamically
  const homepageSections = useQuery(api.homepage.getActiveHomepageSections);
  
  // Get homepage settings to determine header height
  const homepageSettings = useQuery(api.homepage.getHomepageSettings);
  const showAnnouncement = homepageSettings?.announcementEnabled ?? false;
  const headerOffset = showAnnouncement ? 92 : 64; // 28px announcement + 64px header OR just 64px header
  
  // Sort sections by order for dynamic rendering
  const sortedActiveSections = homepageSections?.sort((a, b) => a.order - b.order) || [];
  
  // Helper to render section by type
  const renderSection = (section: typeof sortedActiveSections[0]) => {
    const key = section._id;

    switch (section.sectionType) {
      case "hero_slides":
        // Hero slider is critical for LCP - keep it eager
        return <HeroSlider key={key} />;

      case "models_marquee":
        return null; // Already rendered above header

      case "explore_models":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <ExploreModels onRequestModelClick={() => setIsRequestModelOpen(true)} />
          </Suspense>
        );

      case "category_explorer":
        // Category explorer is above the fold - keep it eager
        return <CategoryExplorer key={key} onRequestModel={handleRequestModel} />;

      case "top_picks":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <TopPicks />
          </Suspense>
        );

      case "most_trendy":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <MostTrendy
              sectionId={section._id}
              config={section.config as never}
            />
          </Suspense>
        );

      case "explore_by_brand":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <ExploreByBrand
              sectionId={section._id}
              config={section.config as never}
            />
          </Suspense>
        );

      case "explore_by_gadget":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <ExploreByGadget
              sectionId={section._id}
              config={section.config as never}
            />
          </Suspense>
        );

      case "why_skinly":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <WhySkinly />
          </Suspense>
        );

      case "feature_banner":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <FeatureBanner />
          </Suspense>
        );

      case "ugc_videos":
        return (
          <Suspense key={key} fallback={<SectionSkeleton />}>
            <UgcVideos />
          </Suspense>
        );

      default:
        return null;
    }
  };

  const handleRequestModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestBrand || !requestModel || !requestCategory || !requestPhone) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmittingRequest(true);
    try {
      await createModelRequest({
        brandName: requestBrand,
        modelName: requestModel,
        category: requestCategory,
        whatsappPhone: requestPhone,
      });
      
      toast.success("Request submitted! We'll notify you when it's available.");
      setIsRequestModelOpen(false);
      setRequestBrand("");
      setRequestModel("");
      setRequestCategory("");
      setRequestPhone("");
    } catch (error) {
      toast.error("Failed to submit request. Please try again.");
      console.error(error);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleMenuClick = () => {
    setIsMobileMenuOpen(true);
  };

  const handleRequestModel = (category: string, brand: string) => {
    setRequestCategory(category);
    setRequestBrand(brand);
    setIsRequestModelOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Skinly - Premium Device Skins & Accessories</title>
        <meta name="description" content="Shop premium skins and accessories for your devices. High-quality materials, precise fit, and stunning designs." />
      </Helmet>

      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={handleMenuClick}
        onRequestModelClick={() => setIsRequestModelOpen(true)}
      />

      {/* Models Marquee - below header */}
      <div style={{ marginTop: `${headerOffset}px` }}>
        <Suspense fallback={<div className="h-10" />}>
          <ModelsMarquee />
        </Suspense>
      </div>

      {/* Main Content */}
      <main className="min-h-screen">
        {/* Personalized Welcome Card for returning users */}
        <WelcomeBackCard onRequestChangeModel={() => setIsRequestModelOpen(true)} />

        {/* Dynamically render sections based on layout manager order */}
        {sortedActiveSections.map((section) => renderSection(section))}
      </main>

      {/* Footer */}
      <Suspense fallback={<div className="h-32" />}>
        <SiteFooter />
      </Suspense>

      {/* Mobile Navigation Sheet */}
      <Suspense fallback={null}>
        <MobileNav
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        />
      </Suspense>

      {/* Request Model Dialog */}
      <Dialog open={isRequestModelOpen} onOpenChange={setIsRequestModelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Your Model</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestModelSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request-brand">Brand Name *</Label>
              <Input
                id="request-brand"
                placeholder="e.g., Apple, Samsung, OnePlus"
                value={requestBrand}
                onChange={(e) => setRequestBrand(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-model">Model Name *</Label>
              <Input
                id="request-model"
                placeholder="e.g., iPhone 15 Pro Max, Galaxy S24 Ultra"
                value={requestModel}
                onChange={(e) => setRequestModel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-category">Device Category *</Label>
              <Select value={requestCategory} onValueChange={setRequestCategory} required>
                <SelectTrigger id="request-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="camera">Camera</SelectItem>
                  <SelectItem value="lens">Lens</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="console">Gaming Console</SelectItem>
                  <SelectItem value="charger">Charger</SelectItem>
                  <SelectItem value="mac-mini">Mac Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-phone">WhatsApp Number *</Label>
              <Input
                id="request-phone"
                type="tel"
                placeholder="e.g., 9876543210"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                We'll notify you on WhatsApp when your model is available
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRequestModelOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRequest}
                className="flex-1"
              >
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bug Report Modal */}
      <Suspense fallback={null}>
        <BugReportModal
          open={isBugReportOpen}
          onOpenChange={setIsBugReportOpen}
        />
      </Suspense>
    </>
  );
}
